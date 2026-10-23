import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson, HttpError } from '../lib/http';

// Generic Eightfold careers adapter (Starbucks, Qualcomm, Lockheed Martin, Northrop
// Grumman, PayPal, …). Eightfold serves two API generations behind its career sites:
//   PCSX (current): GET https://{host}/api/pcsx/search?domain={site}&query=&location=United States&start=N
//                   10 positions/page, relevance-ranked, `query` filters
//   v2   (legacy):  GET https://{host}/api/apply/v2/jobs?domain={site}&start=N&num=100&location=United States
// PCSX tenants answer v2 with "Not authorized for PCSX", so try PCSX first and fall back.
// Both requests are constrained to the US, so results are marked US. The list endpoints
// carry no job description.

const PCSX_PAGE = 10;
const PCSX_PAGES_BOARD = 20; // whole board: ~200 positions
const PCSX_PAGES_TERM = 3; // search mode: the 30 most relevant per term
const V2_PAGE = 100;
const V2_PAGES = 5;

// Every tenant sits on eightfold.ai's shared infrastructure, which blocks bursts (429,
// then 403). So all Eightfold requests — across every board in a run — go through one
// paced queue: one at a time, at least MIN_GAP_MS apart. Slower, but polite and reliable.
const MIN_GAP_MS = 700;
let queue: Promise<unknown> = Promise.resolve();
let lastAt = 0;
function paced<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

interface PcsxPosition {
  id?: number | string;
  displayJobId?: string;
  atsJobId?: string;
  name?: string;
  locations?: string[];
  postedTs?: number | null;
  creationTs?: number | null;
  positionUrl?: string;
  workLocationOption?: string | null;
}

interface PcsxResponse {
  data?: { positions?: PcsxPosition[]; count?: number };
}

interface V2Position {
  id?: number | string;
  ats_job_id?: string;
  display_job_id?: string;
  name?: string;
  location?: string | null;
  locations?: string[] | null;
  t_update?: number | null;
  t_create?: number | null;
  canonicalPositionUrl?: string | null;
}

interface V2Response {
  positions?: V2Position[];
  count?: number;
}

export function pcsxUrl(source: Source, query: string, start: number): string {
  const p = new URLSearchParams({ domain: source.site ?? '', query, location: 'United States', start: String(start) });
  return `https://${source.host}/api/pcsx/search?${p}`;
}

export function v2Url(source: Source, start: number): string {
  const p = new URLSearchParams({
    domain: source.site ?? '',
    start: String(start),
    num: String(V2_PAGE),
    location: 'United States',
    sort_by: 'timestamp',
  });
  return `https://${source.host}/api/apply/v2/jobs?${p}`;
}

function base(source: Source): Omit<RawJob, 'atsJobId' | 'title' | 'locations' | 'applyUrl' | 'postedAt' | 'workplaceType'> {
  return {
    ats: 'eightfold',
    sourceSlug: source.slug,
    company: source.company,
    companyTier: source.tier,
    tags: source.tags,
    reqNumber: null,
    description: null, // list endpoints omit the JD
    descriptionFormat: 'text',
    updatedAt: null,
    country: 'US', // every request is constrained to location=United States
  };
}

const iso = (ts: number | null | undefined) => (ts ? new Date(ts * 1000).toISOString() : null);

// Pure and fixture-testable.
export function parsePcsx(positions: PcsxPosition[], source: Source): RawJob[] {
  return positions.map((p) => ({
    ...base(source),
    atsJobId: String(p.displayJobId || p.atsJobId || p.id || ''),
    title: (p.name ?? '').trim(),
    locations: (p.locations ?? []).filter(Boolean),
    workplaceType: p.workLocationOption ?? null,
    applyUrl: `https://${source.host}${p.positionUrl ?? `/careers/job/${p.id}`}`,
    postedAt: iso(p.postedTs ?? p.creationTs),
  }));
}

export function parseV2(positions: V2Position[], source: Source): RawJob[] {
  return positions.map((p) => {
    const raw = p.locations?.length ? p.locations : p.location ? [p.location] : [];
    return {
      ...base(source),
      atsJobId: String(p.ats_job_id || p.display_job_id || p.id || ''),
      title: (p.name ?? '').trim(),
      locations: raw.map((l) => l.replace(/,/g, ', ').trim()).filter(Boolean),
      workplaceType: null,
      applyUrl: p.canonicalPositionUrl || `https://${source.host}/careers/job/${p.id}`,
      postedAt: iso(p.t_update ?? p.t_create),
    };
  });
}

// One PCSX query, paged. Returns null when the tenant doesn't speak PCSX.
async function fetchPcsx(source: Source, query: string, maxPages: number): Promise<PcsxPosition[] | null> {
  const out: PcsxPosition[] = [];
  for (let page = 0; page < maxPages; page++) {
    let res;
    try {
      res = await paced(() => httpJson<PcsxResponse>({ url: pcsxUrl(source, query, page * PCSX_PAGE) }));
    } catch (e) {
      const status = e instanceof HttpError ? e.status : null;
      // 404 on the first page = not a PCSX tenant → let v2 try. A block or rate limit
      // (403/429) is not that: surface it on page 0, keep what we have after that.
      if (page === 0) {
        if (status === 404) return null;
        throw e;
      }
      return out;
    }
    const positions = res.data?.data?.positions;
    if (!positions) return page === 0 ? null : out;
    out.push(...positions);
    const count = res.data?.data?.count ?? 0;
    if (positions.length < PCSX_PAGE || (page + 1) * PCSX_PAGE >= count) break;
  }
  return out;
}

async function fetchV2(source: Source): Promise<V2Position[]> {
  const out: V2Position[] = [];
  let count = Number.POSITIVE_INFINITY;
  for (let page = 0; page < V2_PAGES; page++) {
    const res = await paced(() => httpJson<V2Response>({ url: v2Url(source, page * V2_PAGE) }));
    const positions = res.data?.positions ?? [];
    if (!positions.length) break;
    out.push(...positions);
    if (page === 0 && typeof res.data?.count === 'number') count = res.data.count;
    if ((page + 1) * V2_PAGE >= count) break;
  }
  return out;
}

export const eightfoldAdapter: AtsAdapter = {
  id: 'eightfold',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    if (!source.host || !source.site) throw new Error(`Eightfold source "${source.company}" needs host and site`);

    // Search mode (non-tech giants): the most relevant positions per tech term.
    if (source.search?.length) {
      const byId = new Map<string, PcsxPosition>();
      let pcsx = true;
      for (const term of source.search) {
        let positions: PcsxPosition[] | null;
        try {
          positions = await fetchPcsx(source, term, PCSX_PAGES_TERM);
        } catch (e) {
          if (byId.size > 0) break; // throttled mid-run: keep the terms we already have
          throw e;
        }
        if (positions === null) {
          pcsx = byId.size > 0;
          break;
        }
        for (const p of positions) byId.set(String(p.id), p);
      }
      if (pcsx) return parsePcsx([...byId.values()], source);
    } else {
      const positions = await fetchPcsx(source, '', PCSX_PAGES_BOARD);
      if (positions !== null) return parsePcsx(positions, source);
    }
    return parseV2(await fetchV2(source), source);
  },
};
