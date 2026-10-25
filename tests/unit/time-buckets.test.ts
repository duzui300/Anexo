import { describe, expect, it } from 'vitest';
import { bucketForTime, groupByTimeBucket } from '../../src/domain/time-buckets';

const now = new Date(2026, 9, 24, 15, 30).getTime();

function at(month: number, day: number, hour = 12): number {
  return new Date(2026, month - 1, day, hour).getTime();
}

describe('bucketForTime', () => {
  it('classifies calendar days relative to today', () => {
    expect(bucketForTime(at(10, 24), now)).toBe('today');
    expect(bucketForTime(at(10, 23), now)).toBe('yesterday');
    expect(bucketForTime(at(10, 21), now)).toBe('previousWeek');
    expect(bucketForTime(at(10, 17), now)).toBe('previousWeek');
    expect(bucketForTime(at(10, 16), now)).toBe('previousMonth');
    expect(bucketForTime(at(10, 10), now)).toBe('previousMonth');
    expect(bucketForTime(at(9, 1), now)).toBe('older');
  });

  it('treats missing timestamps as older', () => {
    expect(bucketForTime(null, now)).toBe('older');
  });
});

describe('groupByTimeBucket', () => {
  it('returns groups in display order and skips empty buckets', () => {
    const items = [
      { id: 'old', time: at(9, 1) },
      { id: 'today', time: at(10, 24) },
      { id: 'week', time: at(10, 20) },
      { id: 'yesterday', time: at(10, 23) },
    ];
    const groups = groupByTimeBucket(items, (item) => item.time, now);
    expect(groups.map((group) => group.bucket)).toEqual([
      'today',
      'yesterday',
      'previousWeek',
      'older',
    ]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['today']);
  });
});
