import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './client';
import { jobs, sources } from './schema';
import { htmlToText } from '../lib/html';
import { contentHash } from '../lib/hash';
import { httpJson } from '../lib/http';
import { extractSkills } from '../scoring/skills';

export interface JobDetail {
  id: string;
  company: string;
  companyTier: number;
  title: string;
  locations: string[];
  workMode: string;
  applyUrl: string;
  ats: string;
  category: string;
  seniority: string;
  postedAt: Date | null;
  firstSeenAt: Date;
  description: string; // plain text, HTML stripped
  skills: string[]; // extracted from the description
}

// One job by id, for the detail panel. Greenhouse rows already carry the JD; Workday
// rows store '' (the list feed has no description), so we lazily fetch + cache the JD
// from the Workday CXS detail endpoint on first open — only for jobs actually viewed.
export async function getJobDetail(id: string): Promise<JobDetail | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: jobs.id,
      company: jobs.company,
      companyTier: jobs.companyTier,
      title: jobs.title,
      locations: jobs.locations,
      workMode: jobs.workMode,
      applyUrl: jobs.applyUrl,
      ats: jobs.ats,
      sourceSlug: jobs.sourceSlug,
      category: jobs.category,
      seniority: jobs.seniority,
      postedAt: jobs.postedAt,
      firstSeenAt: jobs.firstSeenAt,
      description: jobs.description,
    })
    .from(jobs)
    .where(eq(jobs.id, id))
    .limit(1);

  if (!row) return null;

  let description = row.description ?? '';
  if (!description.trim() && row.ats === 'workday') {
    description = await enrichWorkdayJd(row.sourceSlug, row.applyUrl, row.id);
  }

  const { sourceSlug, ...rest } = row;
  return { ...rest, description, skills: extractSkills(description) };
}

interface WorkdayDetail {
  jobPostingInfo?: { jobDescription?: string };
}

// Fetch the JD from Workday's CXS detail endpoint and cache it on the row. Best-effort:
// on any failure returns '' and leaves the row unchanged (panel falls back to the link).
async function enrichWorkdayJd(sourceSlug: string, applyUrl: string, jobId: string): Promise<string> {
  try {
    const db = getDb();
    const [src] = await db
      .select({ config: sources.config })
      .from(sources)
      .where(and(eq(sources.ats, 'workday'), eq(sources.slug, sourceSlug)))
      .limit(1);
    const cfg = (src?.config ?? {}) as Record<string, string>;
    const { tenant, shard, site } = cfg;
    if (!tenant || !shard || !site) return '';

    // applyUrl = https://{tenant}.wd{shard}.myworkdayjobs.com/{site}{externalPath};
    // the CXS detail path is everything from "/job/" onward.
    const idx = applyUrl.indexOf('/job/');
    if (idx < 0) return '';
    const jobPath = applyUrl.slice(idx + '/job/'.length);
    const url = `https://${tenant}.wd${shard}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/job/${jobPath}`;

    const res = await httpJson<WorkdayDetail>({ url });
    const html = res.data?.jobPostingInfo?.jobDescription;
    if (!html) return '';
    const text = htmlToText(html);
    if (!text.trim()) return '';

    // cache it so subsequent opens are instant
    await db
      .update(jobs)
      .set({ description: text, descriptionHash: contentHash(text), updatedAt: sql`now()` })
      .where(eq(jobs.id, jobId));
    return text;
  } catch {
    return '';
  }
}
