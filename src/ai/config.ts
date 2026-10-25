import type { AiSettings } from '@/data/schema';
import { AiError } from './errors';
import type { ProviderConfig } from './types';

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

export function normalizeBaseUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new AiError('not_configured', 'Set an AI provider base URL in Options.');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new AiError('invalid_request', 'The provider base URL is not a valid URL.');
  }

  if (url.username || url.password) {
    throw new AiError('invalid_request', 'The provider base URL must not contain credentials.');
  }

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHost(url.hostname))) {
    throw new AiError(
      'invalid_request',
      'The provider must use HTTPS. HTTP is allowed only for localhost or 127.0.0.1.',
    );
  }

  url.search = '';
  url.hash = '';
  return url;
}

export function baseUrlPath(raw: string): string {
  const url = normalizeBaseUrl(raw);
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function chatCompletionsUrl(raw: string): string {
  return `${baseUrlPath(raw)}/chat/completions`;
}

export function modelsUrl(raw: string): string {
  return `${baseUrlPath(raw)}/models`;
}

/** Chrome match patterns do not support ports, so use the host only. */
export function permissionPattern(raw: string): string {
  const url = normalizeBaseUrl(raw);
  return `${url.protocol}//${url.hostname}/*`;
}

export function buildProviderConfig(ai: AiSettings, apiKey: string): ProviderConfig {
  if (!apiKey) throw new AiError('not_configured', 'Add an API key in Options.');
  if (!ai.model.trim()) throw new AiError('not_configured', 'Set a model name in Options.');

  return {
    baseUrl: ai.baseUrl,
    model: ai.model.trim(),
    apiKey,
    temperature: ai.temperature,
    maxOutputTokens: ai.maxOutputTokens,
    timeoutMs: ai.timeoutMs,
    stream: ai.stream,
    reasoningEffort: ai.reasoningEffort,
    thinkingBudget: ai.thinkingBudget,
  };
}
