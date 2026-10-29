import { describe, expect, it } from 'vitest';
import {
  baseUrlPath,
  chatCompletionsUrl,
  normalizeBaseUrl,
  permissionPattern,
} from '../../src/ai/config';

describe('normalizeBaseUrl', () => {
  it('accepts HTTPS providers and trims trailing slashes', () => {
    expect(baseUrlPath('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1');
  });

  it('accepts HTTP only for local hosts', () => {
    expect(normalizeBaseUrl('http://127.0.0.1:11435/v1').port).toBe('11435');
    expect(normalizeBaseUrl('http://localhost:11434/v1').hostname).toBe('localhost');
    expect(() => normalizeBaseUrl('http://example.com/v1')).toThrow(/HTTPS/);
  });

  it('rejects credentials', () => {
    expect(() => normalizeBaseUrl('https://user:pass@example.com/v1')).toThrow(/credentials/);
  });
});

describe('provider URLs', () => {
  it('builds chat completion URLs with and without a path', () => {
    expect(chatCompletionsUrl('http://127.0.0.1:11435/v1')).toBe(
      'http://127.0.0.1:11435/v1/chat/completions',
    );
    expect(chatCompletionsUrl('https://api.openai.com')).toBe(
      'https://api.openai.com/chat/completions',
    );
  });

  it('uses host-only permission patterns because match patterns cannot contain ports', () => {
    expect(permissionPattern('http://127.0.0.1:11435/v1')).toBe('http://127.0.0.1/*');
    expect(permissionPattern('https://api.openai.com/v1')).toBe('https://api.openai.com/*');
  });
});
