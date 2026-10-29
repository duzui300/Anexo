export type TimeBucket = 'today' | 'yesterday' | 'previousWeek' | 'previousMonth' | 'older';

export const TIME_BUCKET_ORDER: readonly TimeBucket[] = [
  'today',
  'yesterday',
  'previousWeek',
  'previousMonth',
  'older',
];

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function bucketForTime(timestamp: number | null, now = Date.now()): TimeBucket {
  if (timestamp === null) return 'older';

  const today = startOfDay(now);
  if (timestamp >= today) return 'today';
  if (timestamp >= addDays(today, -1)) return 'yesterday';
  if (timestamp >= addDays(today, -7)) return 'previousWeek';
  if (timestamp >= addDays(today, -30)) return 'previousMonth';
  return 'older';
}

export interface TimeGroup<T> {
  bucket: TimeBucket;
  items: T[];
}

export function groupByTimeBucket<T>(
  items: readonly T[],
  getTime: (item: T) => number | null,
  now = Date.now(),
): TimeGroup<T>[] {
  const groups = new Map<TimeBucket, T[]>();
  for (const item of items) {
    const bucket = bucketForTime(getTime(item), now);
    const bucketItems = groups.get(bucket);
    if (bucketItems) bucketItems.push(item);
    else groups.set(bucket, [item]);
  }

  return TIME_BUCKET_ORDER.filter((bucket) => groups.has(bucket)).map((bucket) => ({
    bucket,
    items: groups.get(bucket)!,
  }));
}
