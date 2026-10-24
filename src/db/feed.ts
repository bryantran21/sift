import { and, desc, eq, inArray, isNull, isNotNull, sql, type SQL } from 'drizzle-orm';
import { getDb } from './client';
import { jobs, sources, runs } from './schema';
import type { LocationPay, Seniority, Tier, WorkMode } from '../types';
import { shortLocation } from '../lib/short-location';

export interface FeedParams {
  q?: string;
  tier?: Tier;
  mode?: WorkMode;
  tag?: string; // quant | big-tech | fortune-500 | college
  industry?: string; // src/data/industries.ts key (airlines, retail, tech, …)
  recency?: 'green' | 'yellow' | 'red';
  seniority?: string; // intern | new-grad | mid | senior | staff+ (undefined = any level)
  company?: string; // single-company deep link (fit modal / tracker)
  companies?: string[]; // multi-company watchlist checklist (empty/undefined = all)
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
  industry: string; // from the source; 'tech' when unknown
  // per-job résumé match: how many of the job's skills are in the résumé (null = no résumé);
  // for a group, the best member's
  match: number | null;
  // Grouping: near-identical postings (same company + base role, e.g. Amazon's 100+
  // "Software Development Engineer, <team>") collapse into one row. The row's other fields
  // are the group's most recent posting.
  groupSize: number; // 1 = a single posting
  titleBase: string; // the group key
  locationCount: number; // distinct locations across the group
  topLocations: string[]; // the group's locations, most common first
  // Pay: the group's annual span, or the single posting's own range
  payMin: number | null;
  payMax: number | null;
  payPeriod: 'year' | 'hour' | 'month' | null;
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
  if (p.industry) c.push(sql`coalesce(${sources.industry}, 'tech') = ${p.industry}`);
  // Tech + US + fresh are hard constraints of the feed, not user-toggleable filters.
  c.push(sql`${jobs.category} <> 'other'`);
  c.push(eq(jobs.country, 'US'));
  c.push(freshEnough);
  if (p.seniority) c.push(eq(jobs.seniority, p.seniority as Seniority));
  // Company filter: union of the single-company deep link and the multi-select watchlist.
  const cos = [...new Set([...(p.companies ?? []), ...(p.company ? [p.company] : [])])];
  if (cos.length) c.push(inArray(jobs.company, cos));
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
  const from = sql`${jobs} left join ${sources} on ${sources.ats} = ${jobs.ats} and ${sources.slug} = ${jobs.sourceSlug}`;

  // Group near-identical postings in SQL so paging, sorting, and filters all operate on
  // groups across the whole result set. Rows ingested before title_base existed fall back
  // to their normalized title (so nothing wrongly merges before the next ingest).
  const groups = sql`
    select ${jobs.company} as company, ${groupKey} as title_base,
      count(*)::int as n,
      max(${added}) as latest,
      ${match ? sql`max(${match})` : sql`null::int`} as match,
      min(${jobs.salaryMin}) filter (where ${jobs.salaryPeriod} = 'year') as pay_min,
      max(${jobs.salaryMax}) filter (where ${jobs.salaryPeriod} = 'year') as pay_max,
      (array_agg(${jobs.id} order by ${added} desc))[1] as lead_id,
      jsonb_agg(${jobs.locations}) as locs
    from ${from}
    where ${where}
    group by ${jobs.company}, ${groupKey}`;
  const order = p.sort === 'match' && match ? sql`g.match desc nulls last, g.latest desc` : sql`g.latest desc`;

  const raw = (await db.execute(sql`
    with g as (${groups})
    select g.n, g.title_base, g.latest, g.match, g.pay_min, g.pay_max, g.locs,
      l.id, l.company, l.company_tier, l.title, l.locations, l.work_mode, l.apply_url, l.ats,
      l.source_slug, l.posted_at, l.first_seen_at, l.seen_count, l.category, l.seniority,
      l.relevance_score, l.salary_min, l.salary_max, l.salary_period,
      s.tags, coalesce(s.industry, 'tech') as industry
    from g
    join jobs l on l.id = g.lead_id
    left join sources s on s.ats = l.ats and s.slug = l.source_slug
    order by ${order}
    limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`)) as unknown as GroupRow[];

  const [{ total }] = (await db.execute(
    sql`select count(*)::int as total from (select 1 from ${from} where ${where} group by ${jobs.company}, ${groupKey}) t`,
  )) as unknown as { total: number }[];

  return { rows: raw.map(toFeedRow), total: total ?? 0, page };
}

const groupKey = sql`coalesce(nullif(${jobs.titleBase}, ''), ${jobs.normalizedTitle})`;

interface GroupRow {
  n: number;
  title_base: string;
  latest: Date | string;
  match: number | null;
  pay_min: number | null;
  pay_max: number | null;
  locs: string[][];
  id: string;
  company: string;
  company_tier: number;
  title: string;
  locations: string[];
  work_mode: WorkMode;
  apply_url: string;
  ats: string;
  source_slug: string;
  posted_at: Date | string | null;
  first_seen_at: Date | string;
  seen_count: number;
  category: string;
  seniority: string;
  relevance_score: number;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: 'year' | 'hour' | 'month' | null;
  tags: string[] | null;
  industry: string;
}

// Locations across a group, most common first, with spellings unified ("Seattle,
// Washington, USA" and "US, WA, Seattle" both count as "Seattle, WA").
function rankLocations(locs: string[][]): string[] {
  const freq = new Map<string, number>();
  for (const arr of locs ?? []) {
    for (const raw of new Set((arr ?? []).map(shortLocation))) freq.set(raw, (freq.get(raw) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
}

function toFeedRow(r: GroupRow): FeedRow {
  const grouped = r.n > 1;
  const top = grouped ? rankLocations(r.locs) : r.locations;
  const groupPay = grouped && r.pay_min != null && r.pay_max != null;
  return {
    id: r.id,
    company: r.company,
    companyTier: r.company_tier,
    title: r.title,
    locations: r.locations,
    workMode: r.work_mode,
    applyUrl: r.apply_url,
    ats: r.ats,
    sourceSlug: r.source_slug,
    // A group shows its most recent posting's date.
    postedAt: grouped ? new Date(r.latest) : r.posted_at ? new Date(r.posted_at) : null,
    firstSeenAt: new Date(r.first_seen_at),
    seenCount: r.seen_count,
    category: r.category,
    seniority: r.seniority,
    relevanceScore: r.relevance_score,
    tags: r.tags,
    industry: r.industry,
    match: r.match,
    groupSize: r.n,
    titleBase: r.title_base,
    locationCount: top.length,
    topLocations: top.slice(0, 12),
    payMin: groupPay ? r.pay_min : r.salary_min,
    payMax: groupPay ? r.pay_max : r.salary_max,
    payPeriod: groupPay ? 'year' : r.salary_period,
  };
}

export interface GroupMember {
  id: string;
  title: string;
  locations: string[];
  applyUrl: string;
  workMode: WorkMode;
  added: Date;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: 'year' | 'hour' | 'month' | null;
  payByLocation: LocationPay[];
}

// Every live posting in a group (company + base role), most recent first — the drawer's
// expanded view. Applies the feed's hard constraints (tech, US, fresh), not user filters.
export async function getGroupMembers(company: string, titleBase: string): Promise<GroupMember[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      locations: jobs.locations,
      applyUrl: jobs.applyUrl,
      workMode: jobs.workMode,
      added,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      salaryPeriod: jobs.salaryPeriod,
      payByLocation: jobs.payByLocation,
    })
    .from(jobs)
    .where(
      and(
        isNull(jobs.removedAt),
        eq(jobs.company, company),
        sql`${groupKey} = ${titleBase}`,
        sql`${jobs.category} <> 'other'`,
        eq(jobs.country, 'US'),
        freshEnough,
      ),
    )
    .orderBy(desc(added))
    .limit(500);
  return rows.map((r) => ({ ...r, added: new Date(r.added) }));
}

export interface CompanyIndustry {
  company: string;
  industry: string;
}

// Distinct live companies with their industry, for the company checklist (grouped by
// industry) and the industry filter.
export async function getCompanies(): Promise<CompanyIndustry[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({
      company: jobs.company,
      industry: sql<string>`coalesce(${sources.industry}, 'tech')`,
    })
    .from(jobs)
    .leftJoin(sources, and(eq(sources.ats, jobs.ats), eq(sources.slug, jobs.sourceSlug)))
    .where(isNull(jobs.removedAt))
    .orderBy(jobs.company);
  // A company with boards in two industries (rare) keeps its first label.
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.company) ? false : (seen.add(r.company), true)));
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
