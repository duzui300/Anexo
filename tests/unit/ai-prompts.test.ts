import { describe, expect, it } from 'vitest';
import { buildPrompt, parseFollowups } from '@/ai/prompts';

describe('buildPrompt', () => {
  it('builds follow-up prompts with enough room for JSON', () => {
    const prompt = buildPrompt({ kind: 'followups', context: 'User: hi\nAssistant: hello' });
    expect(prompt.messages[0]?.role).toBe('system');
    expect(prompt.messages[0]?.content).toContain('exactly three');
    expect(prompt.maxTokens).toBeGreaterThanOrEqual(600);
  });

  it('builds optimizer prompts without answering the request', () => {
    const prompt = buildPrompt({ kind: 'optimizer', input: 'write a haiku', context: [] });
    expect(prompt.messages[0]?.content).toContain('<enhanced>');
    expect(prompt.maxTokens).toBe(700);
  });
});

describe('parseFollowups', () => {
  it('parses a JSON object with items', () => {
    expect(parseFollowups('{"items":["A","B","C"]}')).toEqual(['A', 'B', 'C']);
  });

  it('handles fenced JSON and whitespace', () => {
    expect(parseFollowups('```json\n{"items":[" A ","B"]}\n```')).toEqual(['A', 'B']);
  });

  it('returns an empty list for malformed output', () => {
    expect(parseFollowups('no json here')).toEqual([]);
    expect(parseFollowups('{"items":"nope"}')).toEqual([]);
  });
});
