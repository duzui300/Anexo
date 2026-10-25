const SESSION_URL = '/api/auth/session';

interface SessionPayload {
  accessToken?: unknown;
  expires?: unknown;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
let pending: Promise<string | null> | null = null;

/**
 * ChatGPT's web app signs backend-api calls with a short-lived bearer token that is
 * returned by `/api/auth/session`. Cookies alone are not enough: the list endpoint
 * silently returns an empty page without it. The token is only kept in this content
 * script's memory; it is never written to extension storage or exposed to the page.
 */
function jwtExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const parsed = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof parsed.exp === 'number' && Number.isFinite(parsed.exp)) {
      return parsed.exp * 1000;
    }
  } catch {
    // Not a JWT; fall back to the session expiry below.
  }
  return null;
}

function sessionExpiry(expires: unknown): number | null {
  if (typeof expires === 'string') {
    const parsed = Date.parse(expires);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

async function fetchSessionToken(): Promise<string | null> {
  try {
    const response = await fetch(SESSION_URL, {
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const data = (await response.json().catch(() => null)) as SessionPayload | null;
    const token = typeof data?.accessToken === 'string' ? data.accessToken : '';
    if (!token) return null;

    const expiresAt =
      jwtExpiry(token) ?? sessionExpiry(data?.expires) ?? Date.now() + 5 * 60_000;
    cached = {
      token,
      expiresAt: Math.min(expiresAt, Date.now() + 55 * 60_000),
    };
    return token;
  } catch {
    return null;
  }
}

export async function getChatGptAccessToken(force = false): Promise<string | null> {
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  if (!pending) {
    pending = fetchSessionToken().finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function invalidateChatGptAccessToken(token?: string | null): void {
  if (!token || cached?.token === token) cached = null;
}

/** Test-only visibility into the cache without exposing the token. */
export function hasCachedAccessToken(): boolean {
  return cached !== null && cached.expiresAt > Date.now();
}
