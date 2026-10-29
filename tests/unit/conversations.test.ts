import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatGptApiError } from '../../src/chatgpt/client';
import {
  checkBackend,
  deleteConversation,
  listConversations,
  normalizeConversationDetail,
  normalizeConversationSummary,
  toTimestamp,
} from '../../src/chatgpt/conversations';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toTimestamp', () => {
  it('normalizes seconds, milliseconds and ISO strings', () => {
    expect(toTimestamp(1_700_000_000)).toBe(1_700_000_000_000);
    expect(toTimestamp(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(toTimestamp('2026-10-01T00:00:00.000Z')).toBe(Date.parse('2026-10-01T00:00:00.000Z'));
    expect(toTimestamp('nope')).toBeNull();
    expect(toTimestamp(undefined)).toBeNull();
  });
});

describe('normalizeConversationSummary', () => {
  it('normalizes a typical list item', () => {
    expect(
      normalizeConversationSummary({
        id: 'conv-1',
        title: 'Hello',
        create_time: 1_700_000_000,
        update_time: '2026-10-01T00:00:00.000Z',
        is_archived: false,
        is_starred: true,
        gizmo_id: 'g-1',
      }),
    ).toEqual({
      id: 'conv-1',
      title: 'Hello',
      createTime: 1_700_000_000_000,
      updateTime: Date.parse('2026-10-01T00:00:00.000Z'),
      isArchived: false,
      isStarred: true,
      gizmoId: 'g-1',
    });
  });

  it('rejects items without an id', () => {
    expect(normalizeConversationSummary({ title: 'x' })).toBeNull();
  });

  it('accepts conversation_id as a fallback', () => {
    expect(normalizeConversationSummary({ conversation_id: 'conv-2' })?.id).toBe('conv-2');
  });
});

describe('normalizeConversationDetail', () => {
  it('walks the active branch from current_node', () => {
    const detail = normalizeConversationDetail({
      id: 'conv-1',
      title: 'Branch',
      current_node: 'a3',
      mapping: {
        a1: {
          id: 'a1',
          parent: null,
          children: ['a2'],
          message: {
            id: 'm1',
            author: { role: 'user' },
            create_time: 1,
            content: { parts: ['first'] },
          },
        },
        a2: {
          id: 'a2',
          parent: 'a1',
          children: ['a3'],
          message: {
            id: 'm2',
            author: { role: 'assistant' },
            create_time: 2,
            content: { parts: ['second'] },
          },
        },
        a3: {
          id: 'a3',
          parent: 'a2',
          children: [],
          message: {
            id: 'm3',
            author: { role: 'user' },
            create_time: 3,
            content: { parts: ['third'] },
          },
        },
      },
    });

    expect(detail?.messages.map((message) => message.text)).toEqual(['first', 'second', 'third']);
    expect(detail?.messages.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('falls back to walking roots when current_node is missing', () => {
    const detail = normalizeConversationDetail({
      id: 'conv-2',
      mapping: {
        r: {
          id: 'r',
          parent: null,
          children: ['c'],
          message: { id: 'm1', author: { role: 'user' }, content: { parts: ['root'] } },
        },
        c: {
          id: 'c',
          parent: 'r',
          children: [],
          message: { id: 'm2', author: { role: 'assistant' }, content: { parts: ['child'] } },
        },
      },
    });
    expect(detail?.messages.map((message) => message.text)).toEqual(['root', 'child']);
  });

  it('skips empty messages and unknown roles', () => {
    const detail = normalizeConversationDetail({
      id: 'conv-3',
      current_node: 'a2',
      mapping: {
        a1: {
          id: 'a1',
          parent: null,
          message: { id: 'm1', author: { role: 'tool' }, content: { parts: [''] } },
        },
        a2: {
          id: 'a2',
          parent: 'a1',
          message: { id: 'm2', author: { role: 'critic' }, content: { parts: ['kept'] } },
        },
      },
    });
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.messages[0]?.role).toBe('unknown');
  });
});

describe('backend calls', () => {
  it('lists conversations with the expected query', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/auth/session') {
        return jsonResponse({
          accessToken: 'session-token',
          expires: new Date(Date.now() + 3_600_000).toISOString(),
        });
      }
      return jsonResponse({ items: [{ id: 'c1', title: 'T' }] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const items = await listConversations({ limit: 5, offset: 10 });
    expect(items[0]?.id).toBe('c1');

    const conversationCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/backend-api/conversations'),
    );
    const requested = new URL(String(conversationCall?.[0]));
    expect(requested.pathname).toBe('/backend-api/conversations');
    expect(requested.searchParams.get('limit')).toBe('5');
    expect(requested.searchParams.get('offset')).toBe('10');
    expect(requested.searchParams.get('order')).toBe('updated');

    const headers = new Headers(conversationCall?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer session-token');
  });

  it('deletes through the id endpoint and tolerates an already-deleted chat', async () => {
    const calls: { path: string; method: string | undefined }[] = [];
    let status = 204;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/auth/session') {
        return jsonResponse({
          accessToken: 'session-token',
          expires: new Date(Date.now() + 3_600_000).toISOString(),
        });
      }
      calls.push({ path: url.pathname, method: init?.method });
      return new Response(null, { status });
    });
    vi.stubGlobal('fetch', fetchMock);

    await deleteConversation('conv-1');
    expect(calls).toEqual([{ path: '/backend-api/conversation/id/conv-1', method: 'DELETE' }]);

    status = 404;
    await expect(deleteConversation('conv-1')).resolves.toBeUndefined();
  });

  it('maps an unauthorized response to ChatGptApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'unauthorized' }, 401)),
    );
    await expect(checkBackend()).rejects.toBeInstanceOf(ChatGptApiError);
  });

  it('parses the ChatGPT plan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          accounts: {
            default: { account: { plan_type: 'plus' } },
          },
        }),
      ),
    );
    await expect(checkBackend()).resolves.toEqual({ ok: true, plan: 'plus' });
  });
});
