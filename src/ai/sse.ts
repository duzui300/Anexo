export const SSE_DONE = '[DONE]';

/**
 * Incremental SSE frame decoder. Handles UTF-8 across chunk boundaries, CRLF,
 * multi-line data fields and frames without a trailing blank line at EOF.
 */
export class SseDecoder {
  private buffer = '';
  private readonly decoder = new TextDecoder();

  push(chunk: Uint8Array): string[] {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    return this.drain(false);
  }

  flush(): string[] {
    this.buffer += this.decoder.decode();
    return this.drain(true);
  }

  private drain(final: boolean): string[] {
    const normalized = this.buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = normalized.split('\n\n');
    this.buffer = final ? '' : (parts.pop() ?? '');

    const events: string[] = [];
    for (const part of parts) {
      const data = part
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data.length > 0) events.push(data);
    }
    return events;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function contentToText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';

  return value
    .map((part) => {
      if (typeof part === 'string') return part;
      const record = asRecord(part);
      return typeof record.text === 'string' ? record.text : '';
    })
    .join('');
}

export interface ChatChunk {
  text: string;
  usage: unknown;
  done: boolean;
}

export function extractChatChunk(payload: unknown): ChatChunk {
  const record = asRecord(payload);
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const choice = asRecord(choices[0]);
  const delta = asRecord(choice.delta);
  const message = asRecord(choice.message);

  const text =
    contentToText(delta.content) ||
    contentToText(message.content) ||
    (typeof choice.text === 'string' ? choice.text : '') ||
    (typeof record.output_text === 'string' ? record.output_text : '');

  const finishReason = choice.finish_reason;
  return {
    text,
    usage: record.usage ?? null,
    done: finishReason !== undefined && finishReason !== null,
  };
}

export function parseSseJson(data: string): unknown | null {
  if (data === SSE_DONE) return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}
