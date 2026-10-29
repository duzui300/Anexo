import { getChatGptAccessToken, invalidateChatGptAccessToken } from './auth';

const BASE_URL = 'https://chatgpt.com/backend-api';

export class ChatGptApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ChatGptApiError';
    this.status = status;
  }
}

export interface ChatGptRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Same-origin requests to ChatGPT's internal web API. Uses the user's own ChatGPT session via
 * cookies plus the bearer token returned by `/api/auth/session`. The token is required: without it
 * the conversation list endpoint returns an empty page instead of an error. This is unofficial and
 * may break without notice.
 */
export async function chatGptFetch(
  path: string,
  init: RequestInit = {},
  options: ChatGptRequestOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs); // NOSONAR: timeout cleanup below
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    for (let attempt = 0; ; attempt += 1) {
      const token = await getChatGptAccessToken(attempt > 0);
      const headers = new Headers(init.headers);
      headers.set('Accept', 'application/json');
      if (init.body !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        credentials: 'include',
        headers,
        signal: controller.signal,
        redirect: 'error',
      });

      if (response.status === 401 && attempt === 0) {
        invalidateChatGptAccessToken(token);
        continue;
      }

      if (!response.ok) {
        throw new ChatGptApiError(response.status, `ChatGPT request failed (${response.status})`);
      }

      return response;
    }
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

export async function chatGptJson<T>(
  path: string,
  init: RequestInit = {},
  options: ChatGptRequestOptions = {},
): Promise<T> {
  const response = await chatGptFetch(path, init, options);
  return (await response.json()) as T;
}
