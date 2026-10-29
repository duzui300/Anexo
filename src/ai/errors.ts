export type AiErrorCode =
  | 'not_configured'
  | 'host_permission_required'
  | 'unauthorized'
  | 'forbidden'
  | 'model_not_found'
  | 'rate_limited'
  | 'context_too_long'
  | 'invalid_request'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'provider_error'
  | 'parse_error';

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number | undefined;

  constructor(code: AiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
  }
}

export function asAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return new AiError(
        error.name === 'TimeoutError' ? 'timeout' : 'aborted',
        error.message || 'Request was aborted.',
      );
    }
    return new AiError('network', error.message);
  }
  return new AiError('provider_error', String(error));
}

export function errorPayload(error: unknown): { code: AiErrorCode; message: string } {
  const aiError = asAiError(error);
  return { code: aiError.code, message: aiError.message.slice(0, 500) };
}

export function mapHttpStatus(status: number, detail: string): AiError {
  const body = detail.slice(0, 800);
  const message = extractProviderMessage(body) ?? `Provider returned HTTP ${status}.`;

  if (status === 401) return new AiError('unauthorized', message, status);
  if (status === 403) return new AiError('forbidden', message, status);
  if (status === 404) return new AiError('model_not_found', message, status);
  if (status === 429) return new AiError('rate_limited', message, status);
  if (status === 400 || status === 422) {
    if (/context|too many tokens|maximum.*tokens|token limit/i.test(body)) {
      return new AiError('context_too_long', message, status);
    }
    return new AiError('invalid_request', message, status);
  }
  return new AiError('provider_error', message, status);
}

function extractProviderMessage(body: string): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown } | string;
      message?: unknown;
      detail?: unknown;
    };
    if (typeof parsed.error === 'string') return parsed.error.slice(0, 500);
    if (parsed.error && typeof parsed.error.message === 'string') {
      return parsed.error.message.slice(0, 500);
    }
    if (typeof parsed.message === 'string') return parsed.message.slice(0, 500);
    if (typeof parsed.detail === 'string') return parsed.detail.slice(0, 500);
  } catch {
    // Not JSON.
  }
  return body.trim().slice(0, 500) || null;
}
