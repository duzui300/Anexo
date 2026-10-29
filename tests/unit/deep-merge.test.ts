import { describe, expect, it } from 'vitest';
import { mergeDeep } from '../../src/domain/deep-merge';

describe('mergeDeep', () => {
  it('merges nested objects', () => {
    const base = { a: { b: 1, c: 2 }, d: 3 };
    expect(mergeDeep(base, { a: { b: 10 } })).toEqual({ a: { b: 10, c: 2 }, d: 3 });
  });

  it('replaces arrays', () => {
    const base = { list: [1, 2, 3] };
    expect(mergeDeep(base, { list: [9] })).toEqual({ list: [9] });
  });

  it('keeps the base when the patch is undefined', () => {
    const base = { a: 1 };
    expect(mergeDeep(base, undefined)).toBe(base);
  });

  it('does not mutate either input', () => {
    const base = { a: { b: 1 } };
    const patch = { a: { b: 2 } };
    const result = mergeDeep(base, patch);
    expect(base.a.b).toBe(1);
    expect(patch.a.b).toBe(2);
    expect(result.a.b).toBe(2);
    expect(result).not.toBe(base);
  });
});
