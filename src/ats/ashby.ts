import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson } from '../lib/http';

// Ashby public job-board API (§2). A single GET returns all published postings with
// descriptions — no pagination. Unblocks OpenAI, Ramp, Notion, Linear, and many
// AI-era startups.
//   GET https://api.ashbyhq.com/posting-api/job-board/{org}

interface AshbyJob {
  id: string;
  title?: string;
  location?: string | null;
  secondaryLocations?: { location?: string | null }[] | null;
  isRemote?: boolean;
  descriptionHtml?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
}

interface AshbyResponse {
  jobs?: AshbyJob[];
}

export function ashbyUrl(slug: string): string {
  return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=false`;
}

// Pure and fixture-testable.
export function parseAshby(payload: AshbyResponse, source: Source): RawJob[] {
  const jobs = payload.jobs ?? [];
  return jobs.map((j): RawJob => {
    const locations = [j.location, ...(j.secondaryLocations?.map((s) => s.location) ?? [])]
      .map((l) => (l ?? '').trim())
      .filter(Boolean);
    return {
      ats: 'ashby',
      sourceSlug: source.slug,
      company: source.company,
      companyTier: source.tier,
      tags: source.tags,
      atsJobId: j.id,
      reqNumber: null,
      title: (j.title ?? '').trim(),
      locations,
      workplaceType: j.isRemote ? 'remote' : null,
      description: j.descriptionHtml ?? null,
      descriptionFormat: 'html',
      applyUrl: j.applyUrl || j.jobUrl || `https://jobs.ashbyhq.com/${source.slug}/${j.id}`,
      postedAt: j.publishedAt ?? null,
      updatedAt: j.updatedAt ?? null,
    };
  });
}

export const ashbyAdapter: AtsAdapter = {
  id: 'ashby',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    const res = await httpJson<AshbyResponse>({ url: ashbyUrl(source.slug) });
    if (res.notModified || !res.data) return [];
    return parseAshby(res.data, source);
  },
};
