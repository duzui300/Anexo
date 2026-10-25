import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? '127.0.0.1';
const ROOT = fileURLToPath(new URL('../tests/fixtures/chatgpt/', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const conversations = [
  {
    id: 'conv-anexo-1',
    title: 'Designing a local-first bookmark system',
    create_time: '2026-10-01T09:12:00.000Z',
    update_time: '2026-10-23T18:40:00.000Z',
    is_archived: false,
    is_starred: true,
    gizmo_id: null,
  },
  {
    id: 'conv-anexo-2',
    title: 'Chrome MV3 service worker notes',
    create_time: '2026-09-22T11:00:00.000Z',
    update_time: '2026-10-20T08:10:00.000Z',
    is_archived: false,
    is_starred: false,
    gizmo_id: null,
  },
  {
    id: 'conv-anexo-3',
    title: 'Prompt rewrite examples',
    create_time: '2026-08-14T14:30:00.000Z',
    update_time: '2026-08-14T15:02:00.000Z',
    is_archived: false,
    is_starred: false,
    gizmo_id: null,
  },
];

const conversation = {
  id: 'conv-anexo-1',
  title: 'Designing a local-first bookmark system',
  create_time: '2026-10-01T09:12:00.000Z',
  update_time: '2026-10-23T18:40:00.000Z',
  current_node: 'a3',
  mapping: {
    a1: {
      id: 'a1',
      message: {
        id: 'msg-user-1',
        author: { role: 'user' },
        create_time: 1759319520,
        content: {
          content_type: 'text',
          parts: ['How should I design bookmarks that survive DOM changes?'],
        },
      },
      parent: null,
      children: ['a2'],
    },
    a2: {
      id: 'a2',
      message: {
        id: 'msg-assistant-1',
        author: { role: 'assistant' },
        create_time: 1759319580,
        content: {
          content_type: 'text',
          parts: [
            'Anchor each bookmark to a stable conversation ID plus a stable message ID. Keep a fallback of turn index, role and a text hash, so a bookmark can still resolve when ChatGPT rerenders the message list.\n\nStore only a short preview, not the full message body. That keeps storage small and avoids duplicating conversation data.',
          ],
        },
      },
      parent: 'a1',
      children: ['a3'],
    },
    a3: {
      id: 'a3',
      message: {
        id: 'msg-user-2',
        author: { role: 'user' },
        create_time: 1759319640,
        content: { content_type: 'text', parts: ['What about note highlights?'] },
      },
      parent: 'a2',
      children: [],
    },
  },
};

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/backend-api/conversations') {
    json(res, 200, { items: conversations, total: conversations.length, limit: 20, offset: 0 });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/backend-api/conversations/search') {
    const query = (url.searchParams.get('query') ?? '').toLowerCase();
    const items = conversations
      .filter((item) => item.title.toLowerCase().includes(query))
      .map((item) => ({ ...item, snippet: item.title }));
    json(res, 200, { items, total: items.length, has_more: false });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/backend-api/gizmos/snorlax/sidebar') {
    json(res, 200, { items: [], cursor: null });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/backend-api/models') {
    json(res, 200, { models: [{ slug: 'gpt-5', title: 'GPT-5', description: 'Mock model' }] });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/backend-api/accounts/check/v4-2023-04-27') {
    json(res, 200, {
      accounts: {
        default: {
          account: { plan_type: 'plus', is_deactivated: false },
          entitlement: { subscription_plan: 'chatgptplusplan' },
        },
      },
    });
    return;
  }

  const convMatch = url.pathname.match(/^\/backend-api\/conversation\/([^/]+)$/);
  if (convMatch) {
    if (req.method === 'GET') {
      json(res, 200, { ...conversation, id: convMatch[1], conversation_id: convMatch[1] });
      return;
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      json(res, 200, { success: true, ...(body ? JSON.parse(body) : {}) });
      return;
    }
    if (req.method === 'DELETE') {
      json(res, 200, { success: true });
      return;
    }
  }

  if (url.pathname.startsWith('/backend-api/')) {
    json(res, 404, { detail: 'Not found in mock' });
    return;
  }

  const pathname = url.pathname === '/' ? '/page.html' : url.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(ROOT, safePath);

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Anexo mock ChatGPT server: http://${HOST}:${PORT}`);
});
