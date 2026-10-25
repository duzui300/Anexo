import { describe, expect, it } from 'vitest';
import { mapHttpStatus } from '@/ai/errors';

const errorBody = (message: string) => JSON.stringify({ error: { message } });

describe('mapHttpStatus', () => {
  it('maps authentication and permission failures', () => {
    expect(mapHttpStatus(401, errorBody('Invalid API key')).code).toBe('unauthorized');
    expect(mapHttpStatus(403, errorBody('Forbidden')).code).toBe('forbidden');
  });

  it('maps missing models and rate limits', () => {
    expect(mapHttpStatus(404, errorBody('Model not found')).code).toBe('model_not_found');
    const limited = mapHttpStatus(429, errorBody('Rate limit reached'));
    expect(limited.code).toBe('rate_limited');
    expect(limited.message).toBe('Rate limit reached');
  });

  it('distinguishes context overflow from other invalid requests', () => {
    expect(
      mapHttpStatus(400, errorBody('This model maximum context length is 8192 tokens')).code,
    ).toBe('context_too_long');
    expect(mapHttpStatus(422, errorBody('Invalid field')).code).toBe('invalid_request');
  });

  it('falls back to provider errors for server failures', () => {
    const failure = mapHttpStatus(503, 'Service unavailable');
    expect(failure.code).toBe('provider_error');
    expect(failure.message).toContain('Service unavailable');
  });
});
