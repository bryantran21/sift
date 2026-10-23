# Adding companies

The company registry (`src/data/companies.ts` + `src/data/brands.ts`) is the source of
truth. A company with a verified job board is ingested automatically. No YAML editing.

## Add a company (about 1 minute)

1. **Add one line** to `src/data/brands.ts`, under its industry:

   ```ts
   brand('Delta Air Lines', 'delta.com', 'airlines'),
   // optional: tag, and extras such as aliases or a careers URL the probe can't guess
   brand('Walt Disney', 'thewaltdisneycompany.com', 'media', 'fortune-500', {
     aliases: ['Disney'],
     careers: 'https://www.disneycareers.com/en/search-jobs',
   }),
   ```

2. **Probe it:**

   ```bash
   pnpm probe "Delta Air Lines"
   ```

   The probe looks for an existing source, then reads the careers page for a board
   link, then tries slugs (only accepted when the board validates as this company).
   It writes the result to `src/data/probe-results.json` and refreshes
   `docs/coverage-report.md`:

   - **live / workday** → a verified board on a supported platform: Greenhouse, Lever,
     Ashby, SmartRecruiters, Workday, Eightfold, Oracle HCM or Phenom. From the next
     ingest, it's pulled in automatically.
   - **blocked** → no supported board. The careers platform it found is recorded
     (Radancy, iCIMS, SuccessFactors, Taleo…) and the company shows up in the
     coverage report.

   If a result is wrong (a decoy or a subsidiary's board), add its `ats:slug` to
   `src/config/rejected-boards.ts` and re-probe. Rejected boards are never ingested.

3. **Commit** `brands.ts` and `probe-results.json`. To update labels in prod right away
   instead of waiting for the next ingest, run `pnpm sources:sync`.

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm probe` | Re-probe every registry company that isn't live |
| `pnpm probe all` | Re-probe everything (catches boards that moved or broke) |
| `pnpm probe industry:airlines` | Re-probe one industry |
| `pnpm probe platform:phenom` | Re-probe companies last blocked on a platform (after adding its adapter) |
| `pnpm sources:check` | Dry-run the registry-wired boards (no DB writes): jobs, tech/US yield, timing, failures |
| `pnpm sources:check all` | The same, for every source the ingest fetches |
| `pnpm sources:sync --show` | Push source config + industries to the DB and list the non-tech labels |

## How sources are merged

`loadSources()` (`src/config/sources.ts`) builds the ingest list from three layers.
Earlier layers win:

1. `sources.yaml`: hand-curated boards and the custom adapters (Amazon, Netflix)
2. **the registry**: every probe-verified board (`registrySources()`)
3. `sources.generated.yaml`: bulk startup boards from `pnpm import:sources`

Layers are de-duplicated by `ats:slug`, rejected boards are dropped, and a company with
a curated board never gets a second registry board.

## How the enterprise adapters stay reliable

- **Tech search.** Workday, Eightfold, Oracle and Phenom boards at non-tech companies
  (retail, airlines, banks…) get `search` terms (`TECH_SEARCH`). The adapter queries
  "software", "data scientist", etc. directly instead of paging through thousands of
  store and warehouse roles. If a site ignores search terms, the adapter falls back to
  the whole board.
- **US-only results.** Each adapter applies the board's own US filter: Workday's country
  facet (or US-city facet), Oracle's "United States" location node, Phenom's country
  aggregation, or Eightfold's `location` parameter. Multi-location ("5 Locations") and
  blank-location postings still land in the US feed. If the server rejects a filter,
  the adapter drops it automatically.
- **Retries.** `httpJson` retries 429 and 5xx errors twice with backoff, honoring
  `Retry-After`.
- **Politeness.** All Eightfold requests share one paced queue, because eightfold.ai
  blocks bursts.

## Industries

Industry keys live in `src/data/industries.ts`. A source's industry comes from its
registry entry. Unknown companies (the bulk-imported startups) default to Tech.
