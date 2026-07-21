import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson } from '../lib/http';

// Greenhouse board API (§2). The list endpoint with `content=true` returns every
// job — description included — in a single response, so no pagination is needed.
// `content` is HTML with its entities encoded; normalization turns it into text.

interface GreenhouseJob {
  id: number;
  internal_job_id?: number;
  requisition_id?: string | null;
  title: string;
  updated_at?: string | null;
  first_published?: string | null;
  absolute_url: string;
  location?: { name?: string | null } | null;
  content?: string | null;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
  meta?: { total?: number };
}

// Pure and fixture-testable: raw payload -> RawJob[]. No network here.
export function parseGreenhouse(payload: GreenhouseResponse, source: Source): RawJob[] {
  const jobs = payload.jobs ?? [];
  return jobs.map((j): RawJob => {
    const location = j.location?.name?.trim();
    return {
      ats: 'greenhouse',
      sourceSlug: source.slug,
      company: source.company,
      companyTier: source.tier,
      tags: source.tags,
      atsJobId: String(j.id),
      reqNumber: j.requisition_id ?? null,
      title: (j.title ?? '').trim(),
      locations: location ? [location] : [],
      workplaceType: null,
      description: j.content ?? null,
      descriptionFormat: 'html',
      applyUrl: j.absolute_url,
      postedAt: j.first_published ?? null,
      updatedAt: j.updated_at ?? null,
    };
  });
}

export function greenhouseUrl(slug: string): string {
  return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
}

export const greenhouseAdapter: AtsAdapter = {
  id: 'greenhouse',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    const res = await httpJson<GreenhouseResponse>({ url: greenhouseUrl(source.slug) });
    if (res.notModified || !res.data) return [];
    return parseGreenhouse(res.data, source);
  },
};
