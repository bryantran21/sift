import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson } from '../lib/http';
import { jitter } from '../lib/concurrency';

// Oracle Recruiting Cloud ("Oracle HCM") career sites — JPMorgan, American Express,
// Marriott, Hilton, Honeywell, Kroger, Texas Instruments, … — read requisitions from a
// public REST resource:
//   GET https://{host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions
//       ?onlyData=true&expand=requisitionList.secondaryLocations
//       &finder=findReqs;siteNumber={site},limit=25,offset=N[,keyword="…"][,selectedLocationsFacet={id}]
// The board's locations facet has a "United States" node; selecting it makes every result
// US. If a board doesn't expose one, US postings are kept client-side instead.

const PAGE = 25;
const PAGES_TERM = 4; // search mode: ~100 most recent per term
const PAGES_BOARD = 12; // whole board: ~300 most recent

interface OracleLocation {
  Name?: string;
  CountryCode?: string;
}

interface OracleReq {
  Id: string;
  Title?: string;
  PostedDate?: string;
  PrimaryLocation?: string;
  PrimaryLocationCountry?: string;
  WorkplaceType?: string;
  ShortDescriptionStr?: string;
  ExternalResponsibilitiesStr?: string;
  ExternalQualificationsStr?: string;
  secondaryLocations?: OracleLocation[];
}

interface OracleItem {
  TotalJobsCount?: number;
  requisitionList?: OracleReq[];
  locationsFacet?: { Id?: number; Name?: string }[];
}

interface OracleResponse {
  items?: OracleItem[];
}

function apiUrl(source: Source, finder: string, expand: string): string {
  return (
    `https://${source.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&expand=${expand}&finder=findReqs;siteNumber=${source.site},${finder}`
  );
}

export function oracleUrl(source: Source, offset: number, keyword: string, usFacetId: number | null): string {
  let finder = `limit=${PAGE},offset=${offset},sortBy=POSTING_DATES_DESC`;
  if (keyword) finder += `,keyword=%22${encodeURIComponent(keyword)}%22`;
  if (usFacetId) finder += `,selectedLocationsFacet=${usFacetId}`;
  return apiUrl(source, finder, 'requisitionList.secondaryLocations');
}

const isUs = (r: OracleReq) =>
  r.PrimaryLocationCountry === 'US' || (r.secondaryLocations ?? []).some((l) => l.CountryCode === 'US');

// Pure and fixture-testable. `usOnly` = fetched through the US facet.
export function parseOracle(reqs: OracleReq[], source: Source, usOnly = false): RawJob[] {
  return reqs
    .filter((r) => usOnly || isUs(r))
    .map((r): RawJob => {
      const locations = [r.PrimaryLocation, ...(r.secondaryLocations ?? []).map((l) => l.Name)].filter(
        (l): l is string => !!l,
      );
      const description = [r.ShortDescriptionStr, r.ExternalResponsibilitiesStr, r.ExternalQualificationsStr]
        .filter(Boolean)
        .join('\n\n');
      return {
        ats: 'oraclehcm',
        sourceSlug: source.slug,
        company: source.company,
        companyTier: source.tier,
        tags: source.tags,
        atsJobId: r.Id,
        reqNumber: null,
        title: (r.Title ?? '').trim(),
        locations: [...new Set(locations)],
        workplaceType: r.WorkplaceType || null,
        description: description || null,
        descriptionFormat: 'html',
        applyUrl: `https://${source.host}/hcmUI/CandidateExperience/en/sites/${source.site}/job/${r.Id}`,
        postedAt: r.PostedDate ? new Date(`${r.PostedDate}T00:00:00Z`).toISOString() : null,
        updatedAt: null,
        country: 'US',
      };
    });
}

// The id of the board's "United States" location facet node, if it has one.
async function discoverUsFacet(source: Source): Promise<number | null> {
  const res = await httpJson<OracleResponse>({
    url: apiUrl(source, 'facetsList=LOCATIONS,limit=1,offset=0', 'locationsFacet'),
  });
  const us = res.data?.items?.[0]?.locationsFacet?.find((l) => /^united states$/i.test(l.Name ?? ''));
  return us?.Id ?? null;
}

async function fetchQuery(source: Source, keyword: string, maxPages: number, usFacetId: number | null) {
  const out: OracleReq[] = [];
  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await jitter(200);
    const res = await httpJson<OracleResponse>({ url: oracleUrl(source, page * PAGE, keyword, usFacetId) });
    const item = res.data?.items?.[0];
    const reqs = item?.requisitionList ?? [];
    out.push(...reqs);
    if (reqs.length < PAGE || (page + 1) * PAGE >= (item?.TotalJobsCount ?? 0)) break;
  }
  return out;
}

export const oracleHcmAdapter: AtsAdapter = {
  id: 'oraclehcm',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    if (!source.host || !source.site) throw new Error(`Oracle HCM source "${source.company}" needs host and site`);
    const usFacetId = await discoverUsFacet(source).catch(() => null);

    if (source.search?.length) {
      const byId = new Map<string, OracleReq>();
      for (const term of source.search) {
        for (const r of await fetchQuery(source, term, PAGES_TERM, usFacetId)) byId.set(r.Id, r);
        await jitter(200);
      }
      if (byId.size > 0) return parseOracle([...byId.values()], source, usFacetId !== null);
    }
    return parseOracle(await fetchQuery(source, '', PAGES_BOARD, usFacetId), source, usFacetId !== null);
  },
};
