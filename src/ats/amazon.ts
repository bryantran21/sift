import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson } from '../lib/http';
import { jitter } from '../lib/concurrency';

// Bespoke adapter for Amazon's public careers search API (amazon.jobs). Unlike the
// generic ATS adapters this is 1:1 with one company and hits a company-specific JSON
// endpoint. Constrained to US + software/ML/data categories to bound volume (Amazon
// lists tens of thousands of roles); sift's title classifier filters the rest.
//   GET https://www.amazon.jobs/en/search.json?category[]=…&normalized_country_code[]=USA
// The `slug` in sources.yaml is ignored — the endpoint is fixed.

const PAGE_SIZE = 100;
const MAX_PAGES = 5; // ~500 most-recent tech roles is plenty for a radar
const CATEGORIES = ['software-development', 'machine-learning-science', 'data-science'];

interface AmazonJob {
  id?: string;
  id_icims?: string;
  title?: string;
  job_path?: string;
  location?: string | null;
  normalized_location?: string | null;
  posted_date?: string | null;
  description?: string | null;
  basic_qualifications?: string | null;
  preferred_qualifications?: string | null;
}

interface AmazonResponse {
  jobs?: AmazonJob[];
  hits?: number;
}

export function amazonUrl(offset: number): string {
  const p = new URLSearchParams({
    result_limit: String(PAGE_SIZE),
    offset: String(offset),
    sort: 'recent',
  });
  for (const c of CATEGORIES) p.append('category[]', c);
  p.append('normalized_country_code[]', 'USA');
  return `https://www.amazon.jobs/en/search.json?${p.toString()}`;
}

// Pure and fixture-testable.
export function parseAmazon(payload: AmazonResponse, source: Source): RawJob[] {
  const jobs = payload.jobs ?? [];
  return jobs.map((j): RawJob => {
    const description = [j.description, j.basic_qualifications, j.preferred_qualifications]
      .filter((s) => s && s.trim())
      .join('\n\n');
    const location = (j.normalized_location || j.location || '').trim();
    return {
      ats: 'amazon',
      sourceSlug: source.slug,
      company: source.company,
      companyTier: source.tier,
      tags: source.tags,
      atsJobId: j.id_icims || j.id || '',
      reqNumber: null,
      title: (j.title ?? '').trim(),
      locations: location ? [location] : [],
      workplaceType: null,
      description: description || null,
      descriptionFormat: 'html',
      applyUrl: j.job_path ? `https://www.amazon.jobs${j.job_path}` : '',
      postedAt: parseAmazonDate(j.posted_date ?? null),
      updatedAt: null,
    };
  });
}

// Amazon reports "July 30, 2026" — parse to ISO, fall back to null.
export function parseAmazonDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const amazonAdapter: AtsAdapter = {
  id: 'amazon',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    const out: RawJob[] = [];
    let hits = Number.POSITIVE_INFINITY;
    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await jitter(250);
      const res = await httpJson<AmazonResponse>({ url: amazonUrl(page * PAGE_SIZE) });
      const jobs = res.data?.jobs ?? [];
      if (jobs.length === 0) break;
      out.push(...parseAmazon(res.data!, source));
      if (page === 0 && typeof res.data?.hits === 'number') hits = res.data.hits;
      if ((page + 1) * PAGE_SIZE >= hits) break;
    }
    return out;
  },
};
