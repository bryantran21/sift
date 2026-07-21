import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
  bigserial,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Ats, Category, Seniority, Tier, WorkMode } from '../types';

// Enums are plain text columns (not pg enums) on purpose: categories and seniority
// buckets are defined in the editable rules file and will change over time, and
// altering pg enums in migrations is painful. Type-safety comes from `$type<…>()`.

// ── sources ──────────────────────────────────────────────────────────────────
// sources.yaml is the source of truth for config; each run upserts into this table
// so runtime health (last success/error) and conditional-request caches (ETag /
// Last-Modified) have a home that the UI can read.
export const sources = pgTable(
  'sources',
  {
    id: serial('id').primaryKey(),
    company: text('company').notNull(),
    ats: text('ats').$type<Ats>().notNull(),
    slug: text('slug').notNull(),
    tier: integer('tier').$type<Tier>().notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    // Extra coordinates for ATSs like Workday (tenant/shard/site).
    config: jsonb('config').$type<Record<string, string>>().notNull().default({}),
    enabled: boolean('enabled').notNull().default(true),

    // runtime health, surfaced as "N of M sources healthy"
    lastStatus: text('last_status').$type<'ok' | 'error' | 'never'>().notNull().default('never'),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastError: text('last_error'),

    // conditional-request caching (§2)
    etag: text('etag'),
    lastModified: text('last_modified'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sources_ats_slug_uq').on(t.ats, t.slug)],
);

// ── jobs ─────────────────────────────────────────────────────────────────────
// One row per live req (after fan-out collapse). Disappeared reqs are kept with
// `removedAt` set, never deleted — history powers ghost detection and auditing.
export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(), // stable content hash
    company: text('company').notNull(),
    companyTier: integer('company_tier').$type<Tier>().notNull(),
    title: text('title').notNull(),
    normalizedTitle: text('normalized_title').notNull(),
    locations: jsonb('locations').$type<string[]>().notNull().default([]),
    workMode: text('work_mode').$type<WorkMode>().notNull().default('unknown'),
    description: text('description').notNull().default(''),
    descriptionHash: text('description_hash').notNull().default(''),
    applyUrl: text('apply_url').notNull(),
    ats: text('ats').$type<Ats>().notNull(),
    atsJobId: text('ats_job_id').notNull(),
    sourceSlug: text('source_slug').notNull(),

    postedAt: timestamp('posted_at', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    seenCount: integer('seen_count').notNull().default(1),
    repostCount: integer('repost_count').notNull().default(0),

    category: text('category').$type<Category>().notNull().default('other'),
    seniority: text('seniority').$type<Seniority>().notNull().default('unknown'),
    relevanceScore: integer('relevance_score').notNull().default(0),
    filterFlags: jsonb('filter_flags').$type<string[]>().notNull().default([]),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // grouping key for fan-out collapse
    index('jobs_company_norm_title_idx').on(t.company, t.normalizedTitle),
    // "live set" lookups during diffing
    index('jobs_removed_at_idx').on(t.removedAt),
    // feed ordering: COALESCE(posted_at, first_seen_at) desc
    index('jobs_posted_at_idx').on(t.postedAt),
    index('jobs_first_seen_idx').on(t.firstSeenAt),
    index('jobs_relevance_idx').on(t.relevanceScore),
  ],
);

// ── runs ─────────────────────────────────────────────────────────────────────
// One row per ingest run, with counts and per-source status for the health header.
export const runs = pgTable('runs', {
  id: serial('id').primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),

  newCount: integer('new_count').notNull().default(0),
  stillLiveCount: integer('still_live_count').notNull().default(0),
  disappearedCount: integer('disappeared_count').notNull().default(0),
  reappearedCount: integer('reappeared_count').notNull().default(0),

  sourcesTotal: integer('sources_total').notNull().default(0),
  sourcesOk: integer('sources_ok').notNull().default(0),
  sourcesError: integer('sources_error').notNull().default(0),
  sourceStatus: jsonb('source_status').$type<RunSourceStatus[]>().notNull().default([]),

  error: text('error'),
});

export interface RunSourceStatus {
  company: string;
  ats: Ats;
  slug: string;
  ok: boolean;
  jobCount: number;
  ms: number;
  error?: string;
}

// ── job_sightings ────────────────────────────────────────────────────────────
// Append-only: every run records that it saw a given job. This history is what
// makes ghost/evergreen detection (§6b) possible and cannot be reconstructed later.
export const jobSightings = pgTable(
  'job_sightings',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    runId: integer('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('job_sightings_job_idx').on(t.jobId, t.seenAt),
    index('job_sightings_run_idx').on(t.runId),
  ],
);

// ── user_state ───────────────────────────────────────────────────────────────
// Single user, no auth: saved / applied / hidden / notes keyed to a device cookie.
export const userState = pgTable(
  'user_state',
  {
    id: serial('id').primaryKey(),
    deviceId: text('device_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    saved: boolean('saved').notNull().default(false),
    applied: boolean('applied').notNull().default(false),
    hidden: boolean('hidden').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_state_device_job_uq').on(t.deviceId, t.jobId)],
);
