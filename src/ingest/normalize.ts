import type { NormalizedJob, RawJob, WorkMode } from '../types';
import { htmlToText } from '../lib/html';
import { contentHash, stableId } from '../lib/hash';

export function normalizeJob(raw: RawJob): NormalizedJob {
  const description =
    raw.descriptionFormat === 'html' ? htmlToText(raw.description) : (raw.description ?? '').trim();

  return {
    id: stableId([raw.ats, raw.company, raw.atsJobId]),
    company: raw.company,
    companyTier: raw.companyTier,
    title: raw.title,
    normalizedTitle: normalizeTitle(raw.title),
    locations: dedupeLocations(raw.locations),
    workMode: inferWorkMode(raw, description),
    description,
    descriptionHash: contentHash(description),
    applyUrl: raw.applyUrl,
    ats: raw.ats,
    atsJobId: raw.atsJobId,
    reqNumber: raw.reqNumber,
    sourceSlug: raw.sourceSlug,
    postedAt: parseDate(raw.postedAt),
    // Filled in by later phases; defaults keep the shape honest for now.
    category: 'other',
    seniority: 'unknown',
    relevanceScore: 0,
    filterFlags: [],
  };
}

// Grouping key for fan-out collapse (§6a): lowercase, drop parentheticals (usually
// locations), year suffixes, and req ids, then reduce to bare alphanumerics.
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ') // (San Francisco), (2025), (Req 1234)
    .replace(/\[.*?\]/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ') // bare year suffixes
    .replace(/\breq[-#\s]?\d+\b/gi, ' ') // req ids
    .replace(/#\s?\d+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferWorkMode(raw: RawJob, description: string): WorkMode {
  if (raw.workplaceType) {
    const w = raw.workplaceType.toLowerCase();
    if (w.includes('remote')) return 'remote';
    if (w.includes('hybrid')) return 'hybrid';
    if (w.includes('onsite') || w.includes('on-site') || w.includes('in office')) return 'onsite';
  }
  const hay = `${raw.title} ${raw.locations.join(' ')}`.toLowerCase();
  if (/\bremote\b/.test(hay)) return 'remote';
  if (/\bhybrid\b/.test(hay)) return 'hybrid';
  if (/\bfully remote\b|\bremote[- ]first\b/.test(description.toLowerCase())) return 'remote';
  return 'unknown';
}

function dedupeLocations(locs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of locs) {
    const trimmed = l.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
