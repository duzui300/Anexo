import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 11435);
const HOST = process.env.HOST ?? '127.0.0.1';

let lastRequest = null;

const MODELS = [
  'mock-ok',
  'mock-optimizer',
  'mock-followups',
  'mock-401',
  'mock-429',
  'mock-slow',
  'mock-abort',
];

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(body));
}

function sseHead(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
}

function sendDelta(res, text) {
  res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text } }] })}\n\n`);
}

function sendDone(res) {
  res.write(
    `data: ${JSON.stringify({
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
    })}\n\n`,
  );
  res.write('data: [DONE]\n\n');
  res.end();
}

function textFor(model) {
  switch (model) {
    case 'mock-optimizer':
      return '<enhanced>Rewrite this as a clear, detailed prompt with explicit scope and output format.</enhanced>';
    case 'mock-followups':
      return '{"items":["Tell me more","Show me an example","Go deeper"]}';
    default:
      return 'Hello from the Anexo mock provider.';
  }
}

function streamText(res, model) {
  const text = textFor(model);
  const chunks = text.match(/.{1,12}/gs) ?? [text];
  let i = 0;
  const timer = setInterval(() => {
    if (i >= chunks.length) {
      clearInterval(timer);
      sendDone(res);
      return;
    }
    sendDelta(res, chunks[i] ?? '');
    i += 1;
  }, 30);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/v1/_last') {
    json(res, 200, lastRequest ?? {});
    return;
  }

  if (req.method === 'GET' && url.pathname === '/v1/models') {
    json(res, 200, {
      object: 'list',
      data: MODELS.map((id) => ({ id, object: 'model', created: 0, owned_by: 'anexo-mock' })),
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { error: { message: 'Invalid JSON', type: 'invalid_request_error' } });
      return;
    }

    const model = String(payload?.model ?? 'mock-ok');
    lastRequest = {
      model,
      stream: payload?.stream === true,
      reasoning_effort: payload?.reasoning_effort ?? null,
      thinking: payload?.thinking ?? null,
      max_tokens: payload?.max_tokens ?? null,
      temperature: payload?.temperature ?? null,
      messageCount: Array.isArray(payload?.messages) ? payload.messages.length : 0,
      firstRole: payload?.messages?.[0]?.role ?? null,
      hasAuth: Boolean(req.headers.authorization),
    };

    if (model === 'mock-401') {
      json(res, 401, { error: { message: 'Invalid API key', type: 'authentication_error' } });
      return;
    }
    if (model === 'mock-429') {
      json(res, 429, { error: { message: 'Rate limit reached', type: 'rate_limit_error' } });
      return;
    }
    if (model === 'mock-abort') {
      sseHead(res);
      sendDelta(res, 'This stream will never finish.');
      return;
    }
    if (model === 'mock-slow') {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    if (payload?.stream === true) {
      sseHead(res);
      streamText(res, model);
      return;
    }

    json(res, 200, {
      id: 'chatcmpl-anexo-mock',
      object: 'chat.completion',
      created: 0,
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: textFor(model) },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
    });
    return;
  }

  json(res, 404, { error: { message: 'Not found', type: 'invalid_request_error' } });
});

server.listen(PORT, HOST, () => {
  console.log(`Anexo mock OpenAI-compatible server: http://${HOST}:${PORT}/v1`);
});
