import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson } from '../lib/http';
import { jitter } from '../lib/concurrency';

// SmartRecruiters public postings API (§2). A paginated GET per company, filtered to
// US postings. Unblocks Western Digital and many mid/large enterprises. The list
// endpoint has no full JD (like Workday) — the detail call is deferred.
//   GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings?country=us&limit=&offset=
// The sources.yaml `slug` is the SmartRecruiters companyId (e.g. "WesternDigital").

const PAGE_SIZE = 100;
const MAX_PAGES = 5;

interface SrLocation {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  remote?: boolean;
  hybrid?: boolean;
  fullLocation?: string | null;
}

interface SrPosting {
  id?: string;
  name?: string;
  refNumber?: string;
  releasedDate?: string | null;
  location?: SrLocation | null;
}

interface SrResponse {
  content?: SrPosting[];
  totalFound?: number;
}

export function smartRecruitersUrl(companyId: string, offset: number): string {
  const p = new URLSearchParams({ country: 'us', limit: String(PAGE_SIZE), offset: String(offset) });
  return `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(companyId)}/postings?${p.toString()}`;
}

function locationString(loc: SrLocation | null | undefined): string {
  if (!loc) return '';
  if (loc.fullLocation) return loc.fullLocation;
  return [loc.city, loc.region, loc.country].filter(Boolean).join(', ');
}

// Pure and fixture-testable.
export function parseSmartRecruiters(payload: SrResponse, source: Source): RawJob[] {
  const content = payload.content ?? [];
  return content.map((p): RawJob => {
    const loc = locationString(p.location);
    const remote = p.location?.remote ? 'remote' : p.location?.hybrid ? 'hybrid' : null;
    return {
      ats: 'smartrecruiters',
      sourceSlug: source.slug,
      company: source.company,
      companyTier: source.tier,
      tags: source.tags,
      atsJobId: p.id ?? '',
      reqNumber: p.refNumber ?? null,
      title: (p.name ?? '').trim(),
      locations: loc ? [loc] : [],
      workplaceType: remote,
      description: null, // list endpoint omits the JD
      descriptionFormat: 'text',
      applyUrl: p.id ? `https://jobs.smartrecruiters.com/${source.slug}/${p.id}` : '',
      postedAt: p.releasedDate ?? null,
      updatedAt: null,
    };
  });
}

export const smartRecruitersAdapter: AtsAdapter = {
  id: 'smartrecruiters',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    const out: RawJob[] = [];
    let total = Number.POSITIVE_INFINITY;
    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await jitter(250);
      const res = await httpJson<SrResponse>({ url: smartRecruitersUrl(source.slug, page * PAGE_SIZE) });
      const content = res.data?.content ?? [];
      if (content.length === 0) break;
      out.push(...parseSmartRecruiters(res.data!, source));
      if (page === 0 && typeof res.data?.totalFound === 'number') total = res.data.totalFound;
      if ((page + 1) * PAGE_SIZE >= total) break;
    }
    return out;
  },
};
