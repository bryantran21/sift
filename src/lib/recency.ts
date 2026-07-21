// Recency indicator for the feed. "When was this released" uses the effective
// date — COALESCE(postedAt, firstSeenAt): the source's posting date when we have
// it, otherwise our first-sighting time. Buckets (per spec):
//
//   < 24h        → green   (fresh)
//   24h – 7 days → yellow  (aging)
//   > 7 days     → red     (stale)
//
// firstSeenAt becomes the reliable signal once ingest runs are persisted (Phase 2):
// it's when the job first showed up on *our* radar, independent of unreliable
// source timestamps.

export type Recency = 'green' | 'yellow' | 'red' | 'none';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

export function recencyBucket(effective: Date | null, now: Date = new Date()): Recency {
  if (!effective) return 'none';
  const age = now.getTime() - effective.getTime();
  if (age < DAY_MS) return 'green'; // includes future-dated postings
  if (age < WEEK_MS) return 'yellow';
  return 'red';
}

// Compact human age: "<1h", "6h", "3d", "2w".
export function ageLabel(effective: Date | null, now: Date = new Date()): string {
  if (!effective) return '—';
  const age = Math.max(0, now.getTime() - effective.getTime());
  if (age < HOUR_MS) return '<1h';
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)}h`;
  if (age < WEEK_MS) return `${Math.floor(age / DAY_MS)}d`;
  return `${Math.floor(age / WEEK_MS)}w`;
}
