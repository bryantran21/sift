# sift — Personal Job Radar

A self-hosted, single-user job aggregator. It pulls postings straight from ATS
JSON APIs, deduplicates them, scores them for relevance, suppresses low-signal
noise, and presents a recency-sorted feed. The goal is **speed and signal**:
surface the roles worth seeing within hours, and aggressively hide the rest.

> Status: Greenhouse **and** Workday adapters live, **45 sources** (~8,900 jobs),
> fan-out collapse and a recency indicator working, plus a company-browser UI. Still
> console-only — persistence + the real feed are gated on a database (Phase 2).

## Stack

- **Ingest:** TypeScript worker, run standalone via `pnpm ingest` (tsx)
- **DB:** Postgres via Drizzle ORM (schema + migrations ready; writes land Phase 2)
- **Web:** Next.js 15 + Tailwind (Phase 5)
- **Deploy:** Vercel (web) + Railway (Postgres, cron worker) — Phase 10

## Prerequisites

- Node 20+ (developed on Node 25)
- pnpm (`npm install -g pnpm`)
- Postgres — only needed from Phase 2 onward. Phase 1's ingest is console-only.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL when you reach Phase 2
```

## Commands

| Command             | What it does                                                     |
| ------------------- | --------------------------------------------------------------- |
| `pnpm ingest`       | Fetch all sources, normalize, print a report (no DB writes yet) |
| `pnpm test`         | Run adapter/normalization tests against recorded fixtures       |
| `pnpm typecheck`    | `tsc --noEmit`                                                   |
| `pnpm db:generate`  | Generate SQL migrations from the schema (no DB needed)          |
| `pnpm db:migrate`   | Apply migrations (needs `DATABASE_URL`)                         |
| `pnpm db:studio`    | Drizzle Studio (needs `DATABASE_URL`)                           |

## Layout

```
sources.yaml            # the hand-curated source list — the primary asset
drizzle/                # generated SQL migrations
src/
  types.ts              # core domain types (no runtime deps)
  db/
    schema.ts           # Drizzle tables: sources, jobs, runs, job_sightings, user_state
    client.ts           # lazy Postgres/Drizzle client
  ats/
    greenhouse.ts       # Greenhouse adapter (pure parser + fetch)
    registry.ts         # ats -> adapter lookup
    greenhouse.test.ts  # fixture-based tests
    __fixtures__/       # recorded API payloads
  config/
    sources.ts          # loads + validates sources.yaml (zod)
  ingest/
    run.ts              # `pnpm ingest` entry point
    normalize.ts        # RawJob -> NormalizedJob (HTML strip, ids, title/loc/mode)
  lib/
    http.ts             # JSON fetch: User-Agent, ETag/If-Modified-Since, timeout
    concurrency.ts      # mapLimit + jitter
    html.ts             # HTML/entity -> plain text
    hash.ts             # stable ids + content hashes
```

## Build order

1. ✅ Schema + migrations + Greenhouse adapter + 10 sources, printing to console
2. 🔸 `sources.yaml` expanded to 45 boards + company browser; persistence + diffing pending (needs DB)
3. ✅ Fan-out collapse and dedupe
4. ⬜ Classification (Stage 1)
5. ⬜ UI: table, filters, search, actions
6. ⬜ Blocklist + relevance scoring + hidden-jobs audit view
7. ✅ Workday adapter (pulled forward)
8. ⬜ Ghost detection (needs sighting history)
9. ⬜ LLM classification fallback
10. ⬜ Cron + deploy

Bonus, out of order: a company-browser UI (`pnpm build:browser`), favicon
fetching (`pnpm build:logos`), and a recency indicator (green/yellow/red by age).
