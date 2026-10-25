import { describe, expect, it } from 'vitest';
import { extractEnhanced } from '../../src/ai/prompts/optimizer';
import { parseFollowups } from '../../src/ai/prompts/followups';
import { extractChatChunk, parseSseJson, SseDecoder } from '../../src/ai/sse';

const encoder = new TextEncoder();

describe('SseDecoder', () => {
  it('reassembles frames split across chunks', () => {
    const decoder = new SseDecoder();
    expect(decoder.push(encoder.encode('data: {"a":'))).toEqual([]);
    expect(decoder.push(encoder.encode('1}\n\n'))).toEqual(['{"a":1}']);
  });

  it('handles CRLF and multiple data lines', () => {
    const decoder = new SseDecoder();
    const events = decoder.push(encoder.encode('data: line one\r\ndata: line two\r\n\r\n'));
    expect(events).toEqual(['line one\nline two']);
  });

  it('flushes a final frame without a trailing blank line', () => {
    const decoder = new SseDecoder();
    decoder.push(encoder.encode('data: last'));
    expect(decoder.flush()).toEqual(['last']);
  });

  it('preserves the [DONE] marker', () => {
    const decoder = new SseDecoder();
    expect(decoder.push(encoder.encode('data: [DONE]\n\n'))).toEqual(['[DONE]']);
  });
});

describe('extractChatChunk', () => {
  it('reads string deltas and usage', () => {
    expect(
      extractChatChunk({
        choices: [{ delta: { content: 'hello' }, finish_reason: null }],
        usage: { total_tokens: 3 },
      }),
    ).toEqual({ text: 'hello', usage: { total_tokens: 3 }, done: false });
  });

  it('reads content-block arrays and finish reasons', () => {
    expect(
      extractChatChunk({
        choices: [{ delta: { content: [{ type: 'text', text: 'a' }, { text: 'b' }] }, finish_reason: 'stop' }],
      }),
    ).toEqual({ text: 'ab', usage: null, done: true });
  });

  it('reads non-streaming message content', () => {
    expect(
      extractChatChunk({ choices: [{ message: { content: 'full' } }] }).text,
    ).toBe('full');
  });

  it('ignores malformed SSE data', () => {
    expect(parseSseJson('{oops')).toBeNull();
    expect(parseSseJson('[DONE]')).toBeNull();
  });
});

describe('prompt helpers', () => {
  it('extracts the enhanced block', () => {
    expect(extractEnhanced('<enhanced>Better prompt</enhanced>')).toBe('Better prompt');
    expect(extractEnhanced('plain')).toBe('plain');
  });

  it('parses follow-up JSON', () => {
    expect(parseFollowups('{"items":["a","b","c","d"]}')).toEqual(['a', 'b', 'c']);
    expect(parseFollowups('not json')).toEqual([]);
  });
});
