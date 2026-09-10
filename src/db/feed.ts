import { and, desc, eq, isNull, isNotNull, sql, type SQL } from 'drizzle-orm';
import { getDb } from './client';
import { jobs, sources, runs } from './schema';
import type { Seniority, Tier, WorkMode } from '../types';

export interface FeedParams {
  q?: string;
  tier?: Tier;
  mode?: WorkMode;
  tag?: string; // quant | big-tech | fortune-500 | college
  recency?: 'green' | 'yellow' | 'red';
  seniority?: string; // intern | new-grad | mid | senior | staff+ (undefined = any level)
  company?: string;
  sort?: 'recent' | 'match'; // default recent; 'match' only meaningful with a résumé
  minMatch?: number; // only roles matching ≥ N of your skills (needs a résumé)
  page?: number;
}

export interface FeedRow {
  id: string;
  company: string;
  companyTier: number;
  title: string;
  locations: string[];
  workMode: WorkMode;
  applyUrl: string;
  ats: string;
  sourceSlug: string;
  postedAt: Date | null;
  firstSeenAt: Date;
  seenCount: number;
  category: string;
  seniority: string;
  relevanceScore: number;
  tags: string[] | null;
  // per-job résumé match: how many of the job's skills are in the résumé (null = no résumé)
  match: number | null;
}

export const PAGE_SIZE = 100;

// Hide listings older than this. A year-old "still open" req usually isn't hiring;
// keeping them out sharpens the feed. Reversible — the rows stay in the DB, just
// filtered from the feed. Keyed off COALESCE(posted_at, first_seen_at).
export const STALE_DAYS = Number(process.env.FEED_STALE_DAYS ?? 45);

// COALESCE(posted_at, first_seen_at) — the "Added" date the feed sorts and colors by.
const added = sql<Date>`coalesce(${jobs.postedAt}, ${jobs.firstSeenAt})`;
// Rows fresh enough to show (not older than STALE_DAYS).
const freshEnough = sql`${added} >= now() - ${STALE_DAYS} * interval '1 day'`;

function conditions(p: FeedParams, match: SQL | null): SQL[] {
  const c: SQL[] = [isNull(jobs.removedAt)];
  if (match && p.minMatch && p.minMatch > 0) c.push(sql`${match} >= ${p.minMatch}`);
  if (p.tier) c.push(eq(jobs.companyTier, p.tier));
  if (p.mode) c.push(eq(jobs.workMode, p.mode));
  if (p.tag) c.push(sql`${sources.tags} @> ${JSON.stringify([p.tag])}::jsonb`);
  // Tech + US + fresh are hard constraints of the feed, not user-toggleable filters.
  c.push(sql`${jobs.category} <> 'other'`);
  c.push(eq(jobs.country, 'US'));
  c.push(freshEnough);
  if (p.seniority) c.push(eq(jobs.seniority, p.seniority as Seniority));
  if (p.company) c.push(eq(jobs.company, p.company));
  if (p.q) {
    const like = `%${p.q}%`;
    c.push(sql`(${jobs.company} ilike ${like} or ${jobs.title} ilike ${like} or ${jobs.locations}::text ilike ${like})`);
  }
  if (p.recency === 'green') c.push(sql`${added} > now() - interval '24 hours'`);
  if (p.recency === 'yellow')
    c.push(sql`${added} <= now() - interval '24 hours' and ${added} > now() - interval '7 days'`);
  if (p.recency === 'red') c.push(sql`${added} <= now() - interval '7 days'`);
  return c;
}

export async function getFeed(
  p: FeedParams,
  resumeSkills?: string[],
): Promise<{ rows: FeedRow[]; total: number; page: number }> {
  const db = getDb();
  const page = Math.max(1, p.page ?? 1);
  const hasResume = !!(resumeSkills && resumeSkills.length);

  // How many of the job's skills are in the résumé — computed in SQL so sort + filter
  // work across the whole result set, not just the current page. Pass the résumé as a
  // single jsonb param (drizzle spreads a JS array into a param list, not a text[]).
  const resumeJson = JSON.stringify(resumeSkills ?? []);
  const match: SQL | null = hasResume
    ? sql`(select count(*)::int from jsonb_array_elements_text(${jobs.skills}) sk where ${resumeJson}::jsonb @> to_jsonb(sk))`
    : null;

  const where = and(...conditions(p, match));
  const orderBy =
    p.sort === 'match' && match ? [desc(match), desc(added)] : [desc(added)];

  const rows = (await db
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
      postedAt: jobs.postedAt,
      firstSeenAt: jobs.firstSeenAt,
      seenCount: jobs.seenCount,
      category: jobs.category,
      seniority: jobs.seniority,
      relevanceScore: jobs.relevanceScore,
      tags: sources.tags,
      match: match ?? sql<number | null>`null`,
    })
    .from(jobs)
    .leftJoin(sources, and(eq(sources.ats, jobs.ats), eq(sources.slug, jobs.sourceSlug)))
    .where(where)
    .orderBy(...orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)) as FeedRow[];

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(jobs)
    .leftJoin(sources, and(eq(sources.ats, jobs.ats), eq(sources.slug, jobs.sourceSlug)))
    .where(where);

  return { rows, total: total ?? 0, page };
}

// Distinct live companies, for the company filter dropdown.
export async function getCompanies(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ company: jobs.company })
    .from(jobs)
    .where(isNull(jobs.removedAt))
    .orderBy(jobs.company);
  return rows.map((r) => r.company);
}

export interface FeedMeta {
  sourcesOk: number;
  sourcesTotal: number;
  liveJobs: number;
  addedToday: number;
  lastSync: Date | null;
}

export async function getFeedMeta(): Promise<FeedMeta> {
  const db = getDb();

  const [health] = await db
    .select({
      total: sql<number>`count(*) filter (where ${sources.enabled})::int`,
      ok: sql<number>`count(*) filter (where ${sources.enabled} and ${sources.lastStatus} = 'ok')::int`,
    })
    .from(sources);

  const [jobsAgg] = await db
    .select({
      live: sql<number>`count(*) filter (where ${jobs.removedAt} is null and ${freshEnough})::int`,
      addedToday: sql<number>`count(*) filter (where ${jobs.removedAt} is null and ${jobs.firstSeenAt} >= date_trunc('day', now()))::int`,
    })
    .from(jobs);

  const [lastRun] = await db
    .select({ finishedAt: runs.finishedAt })
    .from(runs)
    .where(isNotNull(runs.finishedAt))
    .orderBy(desc(runs.id))
    .limit(1);

  return {
    sourcesOk: health?.ok ?? 0,
    sourcesTotal: health?.total ?? 0,
    liveJobs: jobsAgg?.live ?? 0,
    addedToday: jobsAgg?.addedToday ?? 0,
    lastSync: lastRun?.finishedAt ?? null,
  };
}
