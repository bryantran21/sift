import { sql, inArray } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import type { Source } from '../types';
import type { RunSourceStatus } from '../db/schema';
import type { CollapsedJob } from './collapse';

// Phase 2 persistence + diffing (§7). One run:
//   1. upsert sources (config + health);
//   2. open a runs row;
//   3. diff collapsed roles against the current live set →
//      new (insert, firstSeenAt=now) · still-live (bump lastSeenAt/seenCount) ·
//      reappeared (clear removedAt, repostCount++) · disappeared (set removedAt);
//   4. append a job_sightings row per role seen (history for ghost detection);
//   5. close the runs row with counts + duration + per-source status.
// Idempotent: running twice in a row yields zero new jobs.

export interface SourceOutcome {
  source: Source;
  ok: boolean;
  jobCount: number;
  ms: number;
  error?: string;
  etag?: string | null;
  lastModified?: string | null;
}

export interface PersistInput {
  sources: Source[];
  outcomes: SourceOutcome[];
  roles: CollapsedJob[];
  startedAt: number;
}

export interface PersistResult {
  runId: number;
  newCount: number;
  stillLiveCount: number;
  reappearedCount: number;
  disappearedCount: number;
}

const CHUNK = 500;

export async function persistRun(input: PersistInput): Promise<PersistResult> {
  const db = getDb();
  const now = new Date();

  // 1. Snapshot the current table BEFORE writing, so the diff is against last run.
  const existing = await db
    .select({ id: schema.jobs.id, removedAt: schema.jobs.removedAt })
    .from(schema.jobs);
  const prev = new Map(existing.map((r) => [r.id, r.removedAt] as const));
  const runIds = new Set(input.roles.map((r) => r.id));

  // 2. Classify each role against the snapshot.
  let newCount = 0;
  let reappearedCount = 0;
  let stillLiveCount = 0;
  for (const r of input.roles) {
    if (!prev.has(r.id)) newCount++;
    else if (prev.get(r.id) != null) reappearedCount++;
    else stillLiveCount++;
  }
  const disappearedIds = [...prev.entries()]
    .filter(([id, removedAt]) => removedAt == null && !runIds.has(id))
    .map(([id]) => id);

  // 3. Upsert sources (config from YAML) + open the run row.
  await upsertSources(db, input.sources);
  await updateSourceHealth(db, input.outcomes, now);

  const okCount = input.outcomes.filter((o) => o.ok).length;
  const [run] = await db
    .insert(schema.runs)
    .values({
      startedAt: new Date(input.startedAt),
      sourcesTotal: input.outcomes.length,
      sourcesOk: okCount,
      sourcesError: input.outcomes.length - okCount,
    })
    .returning({ id: schema.runs.id });
  const runId = run!.id;

  // 4. Upsert jobs. One statement handles new + still-live + reappeared: on conflict
  // we bump lastSeenAt/seenCount, clear removedAt, and increment repostCount only if
  // the row was previously removed. firstSeenAt is untouched on conflict.
  for (const batch of chunk(input.roles, CHUNK)) {
    await db
      .insert(schema.jobs)
      .values(batch.map(toRow))
      .onConflictDoUpdate({
        target: schema.jobs.id,
        set: {
          title: sql`excluded.title`,
          normalizedTitle: sql`excluded.normalized_title`,
          locations: sql`excluded.locations`,
          country: sql`excluded.country`,
          workMode: sql`excluded.work_mode`,
          category: sql`excluded.category`,
          description: sql`excluded.description`,
          descriptionHash: sql`excluded.description_hash`,
          applyUrl: sql`excluded.apply_url`,
          companyTier: sql`excluded.company_tier`,
          postedAt: sql`least(${schema.jobs.postedAt}, excluded.posted_at)`,
          lastSeenAt: sql`now()`,
          seenCount: sql`${schema.jobs.seenCount} + 1`,
          repostCount: sql`${schema.jobs.repostCount} + case when ${schema.jobs.removedAt} is not null then 1 else 0 end`,
          removedAt: sql`null`,
          updatedAt: sql`now()`,
        },
      });
  }

  // 5. Append sightings (jobs now exist, so the FK holds).
  for (const batch of chunk(input.roles, CHUNK)) {
    await db.insert(schema.jobSightings).values(batch.map((r) => ({ jobId: r.id, runId, seenAt: now })));
  }

  // 6. Mark disappeared reqs (kept, not deleted).
  for (const batch of chunk(disappearedIds, CHUNK)) {
    await db
      .update(schema.jobs)
      .set({ removedAt: now, updatedAt: now })
      .where(inArray(schema.jobs.id, batch));
  }

  // 7. Close the run.
  await db
    .update(schema.runs)
    .set({
      finishedAt: now,
      durationMs: Date.now() - input.startedAt,
      newCount,
      stillLiveCount,
      reappearedCount,
      disappearedCount: disappearedIds.length,
      sourceStatus: input.outcomes.map(toStatus),
    })
    .where(sql`${schema.runs.id} = ${runId}`);

  return { runId, newCount, stillLiveCount, reappearedCount, disappearedCount: disappearedIds.length };
}

function toRow(r: CollapsedJob) {
  return {
    id: r.id,
    company: r.company,
    companyTier: r.companyTier,
    title: r.title,
    normalizedTitle: r.normalizedTitle,
    locations: r.locations,
    country: r.country,
    workMode: r.workMode,
    description: r.description,
    descriptionHash: r.descriptionHash,
    applyUrl: r.applyUrl,
    ats: r.ats,
    atsJobId: r.atsJobId,
    sourceSlug: r.sourceSlug,
    postedAt: r.postedAt,
    category: r.category,
    seniority: r.seniority,
    relevanceScore: r.relevanceScore,
    filterFlags: r.filterFlags,
  };
}

function toStatus(o: SourceOutcome): RunSourceStatus {
  return {
    company: o.source.company,
    ats: o.source.ats,
    slug: o.source.slug,
    ok: o.ok,
    jobCount: o.jobCount,
    ms: o.ms,
    error: o.error,
  };
}

async function upsertSources(db: ReturnType<typeof getDb>, sources: Source[]): Promise<void> {
  if (sources.length === 0) return;
  const rows = sources.map((s) => {
    const config: Record<string, string> =
      s.ats === 'workday'
        ? { tenant: s.tenant ?? '', shard: s.shard ?? '', site: s.site ?? '' }
        : {};
    return {
      company: s.company,
      ats: s.ats,
      slug: s.slug,
      tier: s.tier,
      tags: s.tags,
      config,
      enabled: s.enabled,
    };
  });
  await db
    .insert(schema.sources)
    .values(rows)
    .onConflictDoUpdate({
      target: [schema.sources.ats, schema.sources.slug],
      set: {
        company: sql`excluded.company`,
        tier: sql`excluded.tier`,
        tags: sql`excluded.tags`,
        config: sql`excluded.config`,
        enabled: sql`excluded.enabled`,
        updatedAt: sql`now()`,
      },
    });
}

async function updateSourceHealth(
  db: ReturnType<typeof getDb>,
  outcomes: SourceOutcome[],
  now: Date,
): Promise<void> {
  for (const o of outcomes) {
    const set = o.ok
      ? {
          lastStatus: 'ok' as const,
          lastSuccessAt: now,
          lastError: null,
          etag: o.etag ?? null,
          lastModified: o.lastModified ?? null,
          updatedAt: now,
        }
      : { lastStatus: 'error' as const, lastError: o.error ?? 'unknown error', updatedAt: now };
    await db
      .update(schema.sources)
      .set(set)
      .where(sql`${schema.sources.ats} = ${o.source.ats} and ${schema.sources.slug} = ${o.source.slug}`);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
