import { describe, expect, it } from 'vitest';
import {
  approximateBytes,
  clipText,
  contentFingerprint,
  hashString,
  normalizeWhitespace,
  tailText,
} from '../../src/domain/text';

describe('normalizeWhitespace', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeWhitespace('  hello\n\n  world\t ')).toBe('hello world');
  });
});

describe('hashString', () => {
  it('is deterministic and 8 hex characters', () => {
    expect(hashString('anexo')).toBe(hashString('anexo'));
    expect(hashString('anexo')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('differs for different input', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('clipText', () => {
  it('returns the input when it fits', () => {
    expect(clipText('hello', 10)).toBe('hello');
  });

  it('appends a marker when clipped', () => {
    expect(clipText('hello world', 8)).toBe('hello w…');
    expect(clipText('hello world', 8)).toHaveLength(8);
  });

  it('handles a zero budget', () => {
    expect(clipText('hello', 0)).toBe('');
  });
});

describe('approximateBytes', () => {
  it('counts ASCII as one byte each', () => {
    expect(approximateBytes('abc')).toBe(3);
  });

  it('counts multi-byte code points', () => {
    expect(approximateBytes('é')).toBe(2);
    expect(approximateBytes('汉')).toBe(3);
    expect(approximateBytes('😀')).toBe(4);
  });
});

describe('contentFingerprint', () => {
  it('ignores whitespace differences', () => {
    expect(contentFingerprint('hello  world')).toBe(contentFingerprint('hello world'));
  });

  it('combines a hash and a length', () => {
    expect(contentFingerprint('hello')).toMatch(/^[0-9a-f]{8}:\d+$/);
  });
});

describe('tailText', () => {
  it('returns the last code points without splitting emoji', () => {
    expect(tailText('a😀b', 2)).toBe('😀b');
    expect(tailText('abc', 0)).toBe('');
  });
});
