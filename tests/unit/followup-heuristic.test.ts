import { describe, expect, it } from 'vitest';
import { heuristicFollowups } from '@/domain/followup-heuristic';

describe('heuristicFollowups', () => {
  it('returns nothing for an empty answer', () => {
    expect(heuristicFollowups('')).toEqual([]);
    expect(heuristicFollowups('   ')).toEqual([]);
  });

  it('returns at most three generic suggestions', () => {
    const items = heuristicFollowups('The answer is 42.');
    expect(items).toHaveLength(3);
    expect(items).toContain('What are the trade-offs?');
  });

  it('prefers a code-specific question for code answers', () => {
    const items = heuristicFollowups('Try this:\n```ts\nconst x = 1;\n```\nThen run it.');
    expect(items[0]).toMatch(/code/i);
    expect(items).toHaveLength(3);
  });

  it('deduplicates suggestions and respects the limit', () => {
    const items = heuristicFollowups('See the documentation at https://example.com', 2);
    expect(items).toHaveLength(2);
    expect(new Set(items).size).toBe(items.length);
  });
});
