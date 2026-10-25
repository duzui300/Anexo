import { chatCompletionsUrl, modelsUrl } from './config';
import { AiError, asAiError, mapHttpStatus } from './errors';
import { extractChatChunk, parseSseJson, SSE_DONE, SseDecoder } from './sse';
import type { ChatMessage, ProviderConfig } from './types';

export interface CompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  onDelta?: (text: string) => void;
}

export interface CompletionResult {
  text: string;
  usage: unknown;
}

function authHeaders(config: ProviderConfig, accept: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: accept,
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
  };
}

function requestBody(config: ProviderConfig, options: CompletionOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: options.messages,
    temperature: options.temperature ?? config.temperature,
    max_tokens: options.maxTokens ?? config.maxOutputTokens,
    stream: options.stream ?? false,
  };

  if (config.reasoningEffort !== 'default') {
    body.reasoning_effort =
      config.reasoningEffort === 'none' ? 'minimal' : config.reasoningEffort;
  }
  if (config.thinkingBudget > 0) {
    body.thinking = { type: 'enabled', budget_tokens: config.thinkingBudget };
  }

  return body;
}

function providerErrorMessage(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 500);
  if (value && typeof value === 'object') {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') return message.slice(0, 500);
  }
  return 'The provider returned an error.';
}

async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onDelta: ((text: string) => void) | undefined,
): Promise<CompletionResult> {
  const reader = body.getReader();
  const decoder = new SseDecoder();
  let text = '';
  let usage: unknown = null;
  let done = false;

  const handleEvents = (events: string[]) => {
    for (const data of events) {
      if (data === SSE_DONE) {
        done = true;
        return;
      }
      const parsed = parseSseJson(data);
      if (parsed === null) continue;

      const record = parsed as Record<string, unknown>;
      if (record.error) {
        throw new AiError('provider_error', providerErrorMessage(record.error));
      }

      const chunk = extractChatChunk(parsed);
      if (chunk.usage) usage = chunk.usage;
      if (chunk.text) {
        text += chunk.text;
        onDelta?.(chunk.text);
      }
      if (chunk.done) {
        done = true;
        return;
      }
    }
  };

  try {
    while (!done) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      handleEvents(decoder.push(value));
    }
    if (!done) handleEvents(decoder.flush());
  } finally {
    reader.releaseLock();
  }

  if (!text) throw new AiError('parse_error', 'The provider stream ended without text.');
  return { text, usage };
}

export async function completeChat(
  config: ProviderConfig,
  options: CompletionOptions,
): Promise<CompletionResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? config.timeoutMs);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const wantsStream = options.stream ?? false;
    const response = await fetch(chatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: authHeaders(config, wantsStream ? 'text/event-stream' : 'application/json'),
      body: JSON.stringify(requestBody(config, { ...options, stream: wantsStream })),
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw mapHttpStatus(response.status, detail);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!wantsStream || !contentType.includes('text/event-stream') || !response.body) {
      const json = (await response.json().catch(() => null)) as unknown;
      if (json === null) {
        throw new AiError('parse_error', 'The provider returned an invalid JSON response.');
      }
      const chunk = extractChatChunk(json);
      if (!chunk.text) {
        throw new AiError('parse_error', 'The provider response did not contain text.');
      }
      options.onDelta?.(chunk.text);
      return { text: chunk.text, usage: chunk.usage };
    }

    return await consumeStream(response.body, options.onDelta);
  } catch (error) {
    if (options.signal?.aborted) throw new AiError('aborted', 'The request was aborted.');
    if (timedOut) throw new AiError('timeout', 'The provider did not respond in time.');
    throw asAiError(error);
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

export interface ConnectionTestResult {
  latencyMs: number;
  models: number | null;
  reply: string | null;
}

export async function testProvider(config: ProviderConfig): Promise<ConnectionTestResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 30_000));

  try {
    const response = await fetch(modelsUrl(config.baseUrl), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });

    if (response.ok) {
      const json = (await response.json().catch(() => null)) as { data?: unknown } | null;
      return {
        latencyMs: Math.round(performance.now() - started),
        models: Array.isArray(json?.data) ? json.data.length : null,
        reply: null,
      };
    }

    if (response.status !== 404 && response.status !== 405) {
      throw mapHttpStatus(response.status, await response.text().catch(() => ''));
    }
  } catch (error) {
    if (error instanceof AiError) throw error;
    const mapped = asAiError(error);
    if (mapped.code !== 'network' && mapped.code !== 'timeout' && mapped.code !== 'aborted') {
      throw mapped;
    }
  } finally {
    globalThis.clearTimeout(timeout);
  }

  const result = await completeChat(config, {
    messages: [{ role: 'user', content: 'ping' }],
    maxTokens: 1,
    stream: false,
  });
  return {
    latencyMs: Math.round(performance.now() - started),
    models: null,
    reply: result.text.slice(0, 40),
  };
}
