import { createHash } from 'node:crypto';

// Deterministic id for a posting. Stable across ingest runs so the diff engine can
// recognize the same req over time, and independent of volatile fields like the
// description (which ATSs edit constantly). Built from ats + company + atsJobId.
export function stableId(parts: Array<string | number>): string {
  const key = parts.map((p) => String(p).trim().toLowerCase()).join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 20);
}

// Hash of the (normalized) description text — used to detect JD changes and to
// help fan-out dedupe (§6a) spot postings that share a body.
export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}
