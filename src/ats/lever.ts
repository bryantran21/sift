import type { AtsAdapter, RawJob, Source } from '../types';
import { httpJson } from '../lib/http';

// Lever public postings API (§2). A single GET returns all postings (top-level JSON
// array) with descriptions. Unblocks Netflix and many mid-size startups.
//   GET https://api.lever.co/v0/postings/{org}?mode=json

interface LeverPosting {
  id: string;
  text?: string; // the title
  categories?: { location?: string | null; team?: string | null; commitment?: string | null };
  workplaceType?: string | null; // 'remote' | 'on-site' | 'hybrid'
  description?: string | null; // HTML — the intro only
  // The structured sections ("What You'll Do", "Who You Are"), each a heading + <li> HTML,
  // and the closing block (often the pay range). Both live outside `description`.
  lists?: { text?: string | null; content?: string | null }[] | null;
  additional?: string | null; // HTML
  hostedUrl?: string | null;
  applyUrl?: string | null;
  createdAt?: number | null; // ms epoch
}

export function leverUrl(slug: string): string {
  return `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
}

// The full posting: intro, then each list under its own heading, then the closing block.
// Lever splits these into separate fields; without the lists the requirements (and often
// the pay range in `additional`) were lost.
export function leverDescription(p: LeverPosting): string | null {
  const parts = [p.description ?? ''];
  for (const l of p.lists ?? []) {
    if (!l.content?.trim()) continue;
    parts.push(`<h3>${l.text ?? ''}</h3><ul>${l.content}</ul>`);
  }
  if (p.additional?.trim()) parts.push(p.additional);
  const html = parts.filter((s) => s.trim()).join('\n');
  return html || null;
}

// Pure and fixture-testable. Lever returns a bare array, not a wrapper object.
export function parseLever(postings: LeverPosting[], source: Source): RawJob[] {
  return (postings ?? []).map((p): RawJob => {
    const location = p.categories?.location?.trim();
    return {
      ats: 'lever',
      sourceSlug: source.slug,
      company: source.company,
      companyTier: source.tier,
      tags: source.tags,
      atsJobId: p.id,
      reqNumber: null,
      title: (p.text ?? '').trim(),
      locations: location ? [location] : [],
      workplaceType: p.workplaceType ?? null,
      description: leverDescription(p),
      descriptionFormat: 'html',
      applyUrl: p.hostedUrl || p.applyUrl || '',
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      updatedAt: null,
    };
  });
}

export const leverAdapter: AtsAdapter = {
  id: 'lever',
  async fetchJobs(source: Source): Promise<RawJob[]> {
    const res = await httpJson<LeverPosting[]>({ url: leverUrl(source.slug) });
    if (res.notModified || !res.data) return [];
    return parseLever(res.data, source);
  },
};
