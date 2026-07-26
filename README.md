# sift — Personal Job Radar

A self-hosted, single-user job aggregator. It pulls postings straight from ATS
JSON APIs, collapses duplicate and fanned-out listings, tracks when each role first
appears, and presents a recency-sorted, filterable feed. The goal is **speed and
signal**: surface the roles worth seeing within hours — with relevance scoring and
aggressive noise-suppression as the next milestones.

## Status

**Working today:**

- **Two live ATS adapters** — Greenhouse and Workday — across **45 curated sources**
  (~9,000 raw postings per run).
- **Fan-out collapse**: ~9,000 postings → ~7,100 unique roles — duplicate city/req
  listings merged into one row with a `locations` array.
- **Persistence + idempotent diffing** into Postgres: new / still-live / reappeared /
  disappeared tracking, plus an append-only `job_sightings` history. Running twice in
  a row yields zero new jobs.
- **Recency indicator** — green `< 24h` · yellow `< 7d` · red `> 7d`, off
  `COALESCE(posted_at, first_seen_at)`.
- **Next.js feed** at `/`: a recency-sorted table reading live from the DB, with
  URL-synced filters (tag / tier / work mode / recency), fuzzy search, company
  favicons, and apply links.
- **Scheduled ingest** via GitHub Actions, every 30 minutes — no local machine needed.
- A separate **company-browser** tool for curating the source list.

**Not built yet:** classification (category/seniority), relevance scoring, the agency
blocklist, ghost/evergreen detection, the LLM classification fallback, and the feed's
row actions (save / applied / hide) + job detail view.

## Stack

- **Web:** Next.js 15 (App Router) + Tailwind v4 — server components read the DB directly.
- **DB:** Postgres via Drizzle ORM (running on Supabase).
- **Ingest:** standalone TypeScript worker (`pnpm ingest`, via tsx).
- **Scheduler:** GitHub Actions cron (`.github/workflows/ingest.yml`), every 30 min.
- **Deploy target:** Vercel (web).

## Prerequisites

- Node 20+ (developed on Node 25)
- pnpm (`npm install -g pnpm`)
- A Postgres database — Supabase, Neon, or local. Use the **connection pooler** string
  (IPv4) so it also works from GitHub Actions.

## Setup

```bash
pnpm install
cp .env.example .env.local     # set DATABASE_URL to your Postgres pooler string
pnpm db:check                  # verify the connection (never prints the URL)
pnpm db:migrate                # create the schema
pnpm ingest                    # fetch + collapse + persist
pnpm dev                       # feed at http://localhost:3000
```

## Commands

| Command                | What it does                                              |
| ---------------------- | -------------------------------------------------------- |
| `pnpm dev`             | Run the Next.js feed (dev)                               |
| `pnpm build` / `start` | Production build / serve                                 |
| `pnpm ingest`          | Fetch all sources → normalize → collapse → persist + diff |
| `pnpm db:check`        | Verify `DATABASE_URL` connects (never prints the URL)    |
| `pnpm db:stats`        | Snapshot: jobs / sightings / runs / recency              |
| `pnpm db:migrate`      | Apply migrations                                         |
| `pnpm db:generate`     | Generate SQL migrations from the schema                  |
| `pnpm db:studio`       | Drizzle Studio                                           |
| `pnpm test`            | Adapter / normalize / collapse tests (recorded fixtures) |
| `pnpm typecheck`       | `tsc --noEmit`                                           |
| `pnpm build:browser`   | Regenerate the company-browser HTML from `companies.ts`  |
| `pnpm build:logos`     | Fetch + inline company favicons → `src/data/logos.json`  |

## How it runs

GitHub Actions runs `pnpm ingest` every 30 minutes: it fetches all healthy sources
concurrently (concurrency 8, polite jitter), normalizes and collapses them, then
diffs against the current live set and writes to Postgres — recording a `runs` row
and one `job_sightings` row per role seen. The Next.js feed reads that data live and
sorts newest-first. Nothing of yours needs to stay on.

## Layout

```
sources.yaml                  # hand-curated source list — the primary asset
.github/workflows/ingest.yml  # 30-min scheduled ingest
drizzle/                      # generated SQL migrations
src/
  env.ts                      # loads .env.local for tsx scripts + drizzle-kit
  types.ts                    # core domain types
  app/                        # Next.js feed: layout, page (feed), feed-filters, globals.css
  db/
    schema.ts                 # tables: sources, jobs, runs, job_sightings, user_state
    client.ts                 # lazy Postgres/Drizzle client
    feed.ts                   # feed queries (filters, recency, pagination)
  ats/
    greenhouse.ts, workday.ts # adapters (pure parser + fetch) + registry + fixture tests
  config/sources.ts           # loads + validates sources.yaml (zod)
  data/
    companies.ts              # full company universe for the browser tool
    logos.json                # generated favicons (gitignored)
  ingest/
    run.ts                    # `pnpm ingest` entry
    normalize.ts              # RawJob -> NormalizedJob
    collapse.ts               # fan-out collapse
    persist.ts                # persistence + diffing
  lib/
    http · concurrency · html · hash · recency · similarity · logos
scripts/
  check-db.ts · db-stats.ts             # DB health + snapshot
  build-company-browser.ts · fetch-logos.ts  # company-browser page + favicons
```

## Roadmap

**Done:** schema + migrations · Greenhouse + Workday adapters · 45 sources · fan-out
collapse · persistence + idempotent diffing · sighting history · recency indicator ·
the feed table/filters/search · scheduled ingest (GitHub Actions).

**Next:** Stage-1 classification (category + seniority) · relevance scoring + the
agency blocklist · the feed's row actions + job detail view · ghost/evergreen
detection (uses the sighting history) · an LLM classification fallback · the Vercel
web deploy.
