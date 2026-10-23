import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson } from '../lib/http';
import { jitter } from '../lib/concurrency';

// Generic Phenom career-site adapter (Adobe, Cisco, CVS Health, Lowe's, P&G, RTX, PNC,
// United Airlines, …). Phenom sites load results from a public widgets endpoint:
//   POST https://{host}/widgets   { ddoKey: "refineSearch", refNum: {site}, keywords, from, size,
//                                  selected_fields: { country: ["United States of America"] }, … }
// `refNum` (the site id) is embedded in every Phenom page as "refNum":"ADOBUS". The board's
// country aggregation tells us how it spells the US; selecting it makes results US-only.

const PAGE = 50;
const PAGES_TERM = 2; // search mode: ~100 most recent per term
const PAGES_BOARD = 8; // whole board: ~400 most recent

interface PhenomJob {
  jobId?: string;
  reqId?: string;
  title?: string;
  location?: string;
  cityStateCountry?: string;
  multi_location?: string[];
  country?: string;
  postedDate?: string;
  applyUrl?: string;
  descriptionTeaser?: string;
}

interface PhenomResponse {
  refineSearch?: {
    status?: number;
    totalHits?: number;
    data?: { jobs?: PhenomJob[]; aggregations?: { field?: string; value?: Record<string, number> }[] };
  };
}

export function phenomBody(source: Source, keywords: string, from: number, size: number, country: string | null) {
  return {
    lang: 'en_us',
    deviceType: 'desktop',
    country: 'us',
    pageName: 'search-results',
    ddoKey: 'refineSearch',
    sortBy: 'Most recent',
    subsearch: '',
    from,
    jobs: true,
    counts: true,
    all_fields: ['country'],
    size,
    clearAll: false,
    jdsource: 'facets',
    isSliderEnable: false,
    siteType: 'external',
    keywords,
    global: true,
    selected_fields: country ? { country: [country] } : {},
    locationData: {},
    refNum: source.site,
  };
}

async function search(source: Source, keywords: string, from: number, size: number, country: string | null) {
  const res = await httpJson<PhenomResponse>({
    url: `https://${source.host}/widgets`,
    method: 'POST',
    body: phenomBody(source, keywords, from, size, country),
  });
  return res.data?.refineSearch;
}

const isUsName = (c: string | undefined) => !!c && /^(united states|usa|us)\b/i.test(c);

// Pure and fixture-testable. `usOnly` = fetched with the US country selected.
export function parsePhenom(jobs: PhenomJob[], source: Source, usOnly = false): RawJob[] {
  return jobs
    .filter((j) => usOnly || isUsName(j.country))
    .map((j): RawJob => {
      const id = j.jobId || j.reqId || '';
      const locations = j.multi_location?.length ? j.multi_location : [j.cityStateCountry || j.location || ''];
      return {
        ats: 'phenom',
        sourceSlug: source.slug,
        company: source.company,
        companyTier: source.tier,
        tags: source.tags,
        atsJobId: id,
        reqNumber: j.reqId ?? null,
        title: (j.title ?? '').trim(),
        locations: locations.filter(Boolean),
        workplaceType: null,
        description: j.descriptionTeaser ?? null, // the list only carries a teaser
        descriptionFormat: 'text',
        applyUrl: j.applyUrl || `https://${source.host}/us/en/job/${id}`,
        postedAt: j.postedDate ? new Date(j.postedDate.replace('+0000', 'Z')).toISOString() : null,
        updatedAt: null,
        ...(usOnly ? { country: 'US' as const } : {}),
      };
    });
}

async function fetchQuery(source: Source, keywords: string, maxPages: number, country: string | null) {
  const out: PhenomJob[] = [];
  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await jitter(200);
    const rs = await search(source, keywords, page * PAGE, PAGE, country);
    const jobs = rs?.data?.jobs ?? [];
    out.push(...jobs);
    if (jobs.length < PAGE || (page + 1) * PAGE >= (rs?.totalHits ?? 0)) break;
  }
  return out;
}

export const phenomAdapter: AtsAdapter = {
  id: 'phenom',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    if (!source.host || !source.site) throw new Error(`Phenom source "${source.company}" needs host and site (refNum)`);
    // How this board spells the US in its country aggregation ("United States of America", …).
    const probe = await search(source, '', 0, 1, null);
    const countries = probe?.data?.aggregations?.find((a) => a.field === 'country')?.value ?? {};
    const us = Object.keys(countries).find(isUsName) ?? null;

    if (source.search?.length) {
      const byId = new Map<string, PhenomJob>();
      for (const term of source.search) {
        for (const j of await fetchQuery(source, term, PAGES_TERM, us)) byId.set(j.jobId || j.reqId || '', j);
        await jitter(200);
      }
      if (byId.size > 0) return parsePhenom([...byId.values()], source, us !== null);
    }
    return parsePhenom(await fetchQuery(source, '', PAGES_BOARD, us), source, us !== null);
  },
};
