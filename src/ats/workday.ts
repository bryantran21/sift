import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson } from '../lib/http';
import { jitter } from '../lib/concurrency';
import { deriveCountry } from '../ingest/location';

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

// A facet value is either a leaf ({descriptor, id}) or a nested sub-facet with its own
// facetParameter and values (e.g. locationMainGroup → "Country/Region" → countries).
interface WorkdayFacetValue {
  descriptor?: string;
  id?: string;
  count?: number;
  facetParameter?: string;
  values?: WorkdayFacetValue[];
}

interface WorkdayFacet {
  facetParameter?: string;
  values?: WorkdayFacetValue[];
}

interface WorkdayResponse {
  total?: number;
  jobPostings?: WorkdayPosting[];
  facets?: WorkdayFacet[];
}

type AppliedFacets = Record<string, string[]>;

// Every facet node, including sub-facets nested inside values (tenants differ: Fifth Third
// has a top-level Location_Country; Otis nests it under locationMainGroup → Country/Region).
function facetNodes(facets: WorkdayFacet[] | undefined): { param: string; values: WorkdayFacetValue[] }[] {
  const out: { param: string; values: WorkdayFacetValue[] }[] = [];
  const walk = (param: string | undefined, values: WorkdayFacetValue[] | undefined) => {
    if (!values) return;
    if (param) out.push({ param, values });
    for (const v of values) if (v.values) walk(v.facetParameter ?? param, v.values);
  };
  for (const f of facets ?? []) walk(f.facetParameter, f.values);
  return out;
}

// Applied facets that restrict a board to US postings, found from its facet list.
// Applying them makes every result US by construction: multi-location posts ("5 Locations")
// and blank locations stay in the US feed, and global giants stop spending the page
// budget on non-US roles. Pure and fixture-testable.
//   1. a country facet (Location_Country, locationCountry, …) → its "United States" value
//   2. else a location facet (cities/sites) → every value that resolves to the US
export function usCountryFacet(facets: WorkdayFacet[] | undefined): AppliedFacets | null {
  const nodes = facetNodes(facets);
  for (const n of nodes) {
    if (!/country/i.test(n.param)) continue;
    const us = n.values.find((v) => v.id && /^united states/i.test(v.descriptor ?? ''));
    if (us?.id) return { [n.param]: [us.id] };
  }
  for (const n of nodes) {
    if (!/location/i.test(n.param) || /country|distance/i.test(n.param)) continue;
    const ids = n.values
      .filter((v) => v.id && !v.values && deriveCountry([v.descriptor ?? '']) === 'US')
      .map((v) => v.id!);
    if (ids.length) return { [n.param]: ids };
  }
  return null;
}

function baseUrl(source: Source): string {
  return `https://${source.tenant}.wd${source.shard}.myworkdayjobs.com`;
}

export function cxsUrl(source: Source): string {
  return `${baseUrl(source)}/wday/cxs/${source.tenant}/${source.site}/jobs`;
}

// Pure and fixture-testable. `usOnly` marks results fetched through the US facet.
export function parseWorkday(postings: WorkdayPosting[], source: Source, usOnly = false): RawJob[] {
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
      ...(usOnly ? { country: 'US' as const } : {}),
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

// Per-term page cap in search mode: a tech term at a non-tech giant is a few pages at most.
const MAX_SEARCH_PAGES = 5;

// Read the board's facets (one unfiltered 1-row request), derive a US filter, then confirm
// the server accepts it with a second 1-row request. Some tenants reject a facet they
// advertise (HTTP 400/500) or return nothing through it; then we use the unfiltered board.
async function discoverUsFacet(source: Source): Promise<AppliedFacets | null> {
  const req = (appliedFacets: AppliedFacets) =>
    httpJson<WorkdayResponse>({
      url: cxsUrl(source),
      method: 'POST',
      body: { appliedFacets, limit: 1, offset: 0, searchText: '' },
    });
  const facet = usCountryFacet((await req({})).data?.facets);
  if (!facet) return null;
  try {
    const check = await req(facet);
    return (check.data?.total ?? 0) > 0 ? facet : null;
  } catch {
    return null;
  }
}

// Page through one query (searchText '' = the whole board, newest first).
async function fetchQuery(
  source: Source,
  searchText: string,
  maxPages: number,
  appliedFacets: AppliedFacets,
): Promise<WorkdayPosting[]> {
  const url = cxsUrl(source);
  const postings: WorkdayPosting[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await jitter(200); // polite paging within a single board
    const res = await httpJson<WorkdayResponse>({
      url,
      method: 'POST',
      body: { appliedFacets, limit: PAGE_SIZE, offset, searchText },
    });
    const batch = res.data?.jobPostings;
    if (!batch || batch.length === 0) break;
    // Workday only reports `total` on the first page; later pages return 0. Read
    // it once so the loop doesn't terminate early. (`limit` is capped at 20.)
    if (page === 0 && typeof res.data?.total === 'number' && res.data.total > 0) total = res.data.total;
    postings.push(...batch);
    offset += PAGE_SIZE;
    if (offset >= total) break; // reached the count from page 0
    if (batch.length < PAGE_SIZE) break; // short page = last page
  }
  return postings;
}

export const workdayAdapter: AtsAdapter = {
  id: 'workday',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    if (!source.tenant || !source.shard || !source.site) {
      throw new Error(`Workday source "${source.company}" is missing tenant/shard/site`);
    }
    // US only when the board exposes a country facet (the feed is US-only anyway).
    const usFacet = await discoverUsFacet(source).catch(() => null);
    const facets = usFacet ?? {};
    const usOnly = usFacet !== null;

    // Search mode (non-tech giants): one query per tech term, deduped by posting path.
    // Otherwise the whole board, newest first, up to MAX_PAGES.
    if (source.search?.length) {
      const byPath = new Map<string, WorkdayPosting>();
      for (const term of source.search) {
        for (const p of await fetchQuery(source, term, MAX_SEARCH_PAGES, facets)) {
          if (p.externalPath && !byPath.has(p.externalPath)) byPath.set(p.externalPath, p);
        }
        await jitter(200);
      }
      // Some sites ignore searchText (every term returns nothing) — fall back to the board.
      if (byPath.size > 0) return parseWorkday([...byPath.values()], source, usOnly);
    }
    return parseWorkday(await fetchQuery(source, '', MAX_PAGES, facets), source, usOnly);
  },
};
