import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson } from '../lib/http';
import { jitter } from '../lib/concurrency';

// Bespoke adapter for Netflix's careers site (Eightfold-powered). The list endpoint
// returns positions but no job description (like Workday) — the JD panel falls back to
// the source link for these until detail-enrichment is added. Constrained to US.
//   GET https://explore.jobs.netflix.net/api/apply/v2/jobs?domain=netflix.com&start=&num=&location=United States

const HOST = 'https://explore.jobs.netflix.net';
const DOMAIN = 'netflix.com';
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

interface EightfoldPosition {
  id?: number | string;
  ats_job_id?: string;
  display_job_id?: string;
  name?: string;
  location?: string | null;
  locations?: string[] | null;
  t_update?: number | null;
  t_create?: number | null;
  canonicalPositionUrl?: string | null;
  job_description?: string | null;
}

interface EightfoldResponse {
  positions?: EightfoldPosition[];
  count?: number;
}

export function netflixUrl(start: number): string {
  const p = new URLSearchParams({
    domain: DOMAIN,
    start: String(start),
    num: String(PAGE_SIZE),
    location: 'United States',
    sort_by: 'timestamp',
  });
  return `${HOST}/api/apply/v2/jobs?${p.toString()}`;
}

// Pure and fixture-testable. Eightfold locations look like "New York,New York,USA".
export function parseNetflix(payload: EightfoldResponse, source: Source): RawJob[] {
  const positions = payload.positions ?? [];
  return positions.map((p): RawJob => {
    const t = p.t_update ?? p.t_create ?? null;
    const raw = p.locations && p.locations.length ? p.locations : p.location ? [p.location] : [];
    const locations = raw.map((l) => l.replace(/,/g, ', ').trim()).filter(Boolean);
    return {
      ats: 'netflix',
      sourceSlug: source.slug,
      company: source.company,
      companyTier: source.tier,
      tags: source.tags,
      atsJobId: String(p.ats_job_id || p.display_job_id || p.id || ''),
      reqNumber: null,
      title: (p.name ?? '').trim(),
      locations,
      workplaceType: null,
      description: p.job_description || null, // list endpoint omits the JD
      descriptionFormat: 'html',
      applyUrl: p.canonicalPositionUrl || (p.id ? `${HOST}/careers/job/${p.id}` : ''),
      postedAt: t ? new Date(t * 1000).toISOString() : null,
      updatedAt: null,
    };
  });
}

export const netflixAdapter: AtsAdapter = {
  id: 'netflix',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    const out: RawJob[] = [];
    let count = Number.POSITIVE_INFINITY;
    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await jitter(250);
      const res = await httpJson<EightfoldResponse>({ url: netflixUrl(page * PAGE_SIZE) });
      const positions = res.data?.positions ?? [];
      if (positions.length === 0) break;
      out.push(...parseNetflix(res.data!, source));
      if (page === 0 && typeof res.data?.count === 'number') count = res.data.count;
      if ((page + 1) * PAGE_SIZE >= count) break;
    }
    return out;
  },
};
