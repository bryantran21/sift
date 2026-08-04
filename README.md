# sift — Job Radar

**→ [sift.bhtran.com](https://sift.bhtran.com)**

A live feed of **tech jobs in the US**, pulled straight from company hiring systems and
sorted newest-first. sift skips the job-board noise: it reads each company's ATS feed
directly, collapses duplicate/fanned-out postings into one row, classifies and filters
to real engineering roles, and surfaces them within hours of going up.

Just **[open the site](https://sift.bhtran.com)** — there's nothing to install.

## What it does

- **Tech + US, always.** The feed is hard-scoped to software / ML / data / quant / hardware
  engineering roles located in the US — no sales, no ops, no overseas listings to wade through.
- **Filter fast.** By **company** (with logos), **experience level** (intern → new-grad →
  mid → senior → staff+), tag (quant · big-tech · fortune-500 · college), tier, work mode,
  and recency. Plus instant fuzzy search over company / title / location.
- **Click a role for the details.** A side panel shows the full job description with the
  **required skills & technologies auto-extracted**, so you can size up a posting without
  leaving the feed.
- **Fresh only.** Postings older than ~6 weeks are hidden (a year-old "still open" req isn't
  really hiring), and dead listings are pruned automatically.
- **Deduped & recency-ranked.** The same req fanned across ten cities becomes one row; a
  colored dot flags how fresh each posting is.

## Coverage

Curated companies pulled through **six adapters** — Greenhouse, Workday, Ashby, Lever, plus
bespoke integrations for Amazon and Netflix — including OpenAI, Anthropic, NVIDIA, Amazon,
Netflix, Palantir, Stripe, Databricks, xAI, Ramp, and the major quant shops (Jane Street,
Citadel-tier trading firms, Two Sigma, Optiver, IMC, …). New sources are added regularly.

The list refreshes automatically: a scheduled job re-reads every company feed **every 30
minutes**, and a daily pass prunes anything stale. Nothing needs to stay running on your end.

## Stack

Next.js 15 (App Router) + Tailwind on Vercel · Postgres (Supabase) via Drizzle ORM ·
ingest + prune workers run on GitHub Actions cron.

---

## Development

For contributors. The app is deployed — you only need this to hack on it locally.

```bash
pnpm install
cp .env.example .env.local     # DATABASE_URL (transaction pooler) + MIGRATION_DATABASE_URL
pnpm db:migrate                # apply schema
pnpm ingest                    # fetch + collapse + persist
pnpm dev                       # local feed at http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `pnpm ingest` | Fetch all sources → classify → collapse → persist + diff |
| `pnpm db:prune` | Prune old sightings + long-gone jobs |
| `pnpm test` / `pnpm typecheck` | Adapter/normalize fixtures · `tsc --noEmit` |
| `pnpm db:migrate` / `db:generate` / `db:studio` | Drizzle migrations / studio |
| `pnpm build:logos` | Refresh company favicons → `src/data/logos.json` |

**Adding a company:** drop an entry in `sources.yaml` (validated by zod) for any supported
ATS — no code needed. A new ATS means a small adapter in `src/ats/` (mirror `greenhouse.ts`)
registered in `src/ats/registry.ts`.

**Layout:** `sources.yaml` (the curated source list) · `src/ats/` (adapters) ·
`src/ingest/` (normalize · classify · collapse · persist) · `src/db/` (schema · feed
queries) · `src/app/` (Next.js feed + job-detail panel) · `.github/workflows/`
(ingest + prune crons).
