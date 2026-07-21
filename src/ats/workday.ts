import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson } from '../lib/http';
import { jitter } from '../lib/concurrency';

// Workday CXS API (§2). Unlike the GET boards, Workday is a paginated POST:
//   POST https://{tenant}.wd{shard}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
//   body { appliedFacets:{}, limit, offset, searchText:"" }
// The list response carries title/location/postedOn/reqId but NO description — the
// JD lives behind a per-job detail call, deferred to keep request volume sane.

const PAGE_SIZE = 20;
// Safety cap. Giant enterprises list thousands of (mostly irrelevant) roles; the
// relevance filter trims later, so we don't need every page. ~400 recent postings
// per board is plenty for a personal radar. Tune per-need.
const MAX_PAGES = 20;

interface WorkdayPosting {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}

interface WorkdayResponse {
  total?: number;
  jobPostings?: WorkdayPosting[];
}

function baseUrl(source: Source): string {
  return `https://${source.tenant}.wd${source.shard}.myworkdayjobs.com`;
}

export function cxsUrl(source: Source): string {
  return `${baseUrl(source)}/wday/cxs/${source.tenant}/${source.site}/jobs`;
}

// Pure and fixture-testable.
export function parseWorkday(postings: WorkdayPosting[], source: Source): RawJob[] {
  const siteBase = `${baseUrl(source)}/${source.site}`;
  const out: RawJob[] = [];
  for (const p of postings) {
    if (!p.externalPath) continue; // can't build an apply URL without it
    const reqId = p.bulletFields?.find((b) => b && b.trim()) ?? p.externalPath;
    const location = p.locationsText?.trim();
    out.push({
      ats: 'workday',
      sourceSlug: source.slug,
      company: source.company,
      companyTier: source.tier,
      tags: source.tags,
      atsJobId: reqId,
      reqNumber: null, // Workday's list reqId is per-posting, not shared across a fan-out
      title: (p.title ?? '').trim(),
      locations: location ? [location] : [],
      workplaceType: null,
      description: null, // list endpoint has no JD; detail enrichment is a later add
      descriptionFormat: 'text',
      applyUrl: siteBase + p.externalPath,
      postedAt: parsePostedOn(p.postedOn ?? null),
      updatedAt: null,
    });
  }
  return out;
}

// Workday reports recency as prose ("Posted Today", "Posted 3 Days Ago",
// "Posted 30+ Days Ago"). Approximate it to an ISO date; fall back to null.
export function parsePostedOn(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  const d = new Date();
  if (t.includes('today')) return d.toISOString();
  if (t.includes('yesterday')) {
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }
  const days = t.match(/(\d+)\+?\s*day/);
  if (days?.[1]) {
    d.setDate(d.getDate() - parseInt(days[1], 10));
    return d.toISOString();
  }
  const months = t.match(/(\d+)\+?\s*month/);
  if (months?.[1]) {
    d.setMonth(d.getMonth() - parseInt(months[1], 10));
    return d.toISOString();
  }
  return null;
}

export const workdayAdapter: AtsAdapter = {
  id: 'workday',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    if (!source.tenant || !source.shard || !source.site) {
      throw new Error(`Workday source "${source.company}" is missing tenant/shard/site`);
    }
    const url = cxsUrl(source);
    const jobs: RawJob[] = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await jitter(200); // polite paging within a single board
      const res = await httpJson<WorkdayResponse>({
        url,
        method: 'POST',
        body: { appliedFacets: {}, limit: PAGE_SIZE, offset, searchText: '' },
      });
      const postings = res.data?.jobPostings;
      if (!postings || postings.length === 0) break;
      // Workday only reports `total` on the first page; later pages return 0. Read
      // it once so the loop doesn't terminate early. (`limit` is capped at 20.)
      if (page === 0 && typeof res.data?.total === 'number' && res.data.total > 0) {
        total = res.data.total;
      }
      jobs.push(...parseWorkday(postings, source));
      offset += PAGE_SIZE;
      if (offset >= total) break; // reached the count from page 0
      if (postings.length < PAGE_SIZE) break; // short page = last page
    }
    return jobs;
  },
};
