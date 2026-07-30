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
}

export const PAGE_SIZE = 100;

// COALESCE(posted_at, first_seen_at) — the "Added" date the feed sorts and colors by.
const added = sql<Date>`coalesce(${jobs.postedAt}, ${jobs.firstSeenAt})`;

function conditions(p: FeedParams): SQL[] {
  const c: SQL[] = [isNull(jobs.removedAt)];
  if (p.tier) c.push(eq(jobs.companyTier, p.tier));
  if (p.mode) c.push(eq(jobs.workMode, p.mode));
  if (p.tag) c.push(sql`${sources.tags} @> ${JSON.stringify([p.tag])}::jsonb`);
  // Tech + US are hard constraints of the feed, not user-toggleable filters.
  c.push(sql`${jobs.category} <> 'other'`);
  c.push(eq(jobs.country, 'US'));
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

export async function getFeed(p: FeedParams): Promise<{ rows: FeedRow[]; total: number; page: number }> {
  const db = getDb();
  const page = Math.max(1, p.page ?? 1);
  const where = and(...conditions(p));

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
    })
    .from(jobs)
    .leftJoin(sources, and(eq(sources.ats, jobs.ats), eq(sources.slug, jobs.sourceSlug)))
    .where(where)
    .orderBy(desc(added))
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
      live: sql<number>`count(*) filter (where ${jobs.removedAt} is null)::int`,
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
