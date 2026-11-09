# sift todo

Living list. Newest decisions at the top of each section; check items off as they ship.

## Now: email alerts

Decided (2026-11-09):

- Anyone can sign up; built for a small user base.
- Follow **specific companies**. Per company, pick **instant**, **daily**, or **weekly**.
- Instant = sent at the end of each ingest run that finds new jobs (currently every 2–6 h, because GitHub delays scheduled runs).
- Send from `alerts@sift.bhtran.com` through **Resend** (free tier: 3,000/month, 100/day). DNS for bhtran.com is on Vercel; there are no existing mail records, so nothing conflicts.
- Postal address: skipped for now. Alerts people ask for, with no ads, likely aren't "commercial" under CAN-SPAM. Add a PO box before adding any ads or promotions.

**You (about 10 min):**
- [ ] Create a Resend account and add the domain `sift.bhtran.com`.
- [ ] Paste Resend's DNS records into Vercel → Domains → bhtran.com → DNS Records, and wait for "verified".
- [ ] Put the Resend API key in Vercel env (`RESEND_API_KEY`) and in GitHub Actions secrets.

**Build (about 1 day, 3 PRs):**
- [ ] PR 1, sign-up (about 3 h): `subscribers` + `subscriptions` tables, sign-up form, double opt-in confirmation email, settings page, one-click unsubscribe (`List-Unsubscribe` header).
- [ ] PR 2, sender (about 3 h): `pnpm alerts:send --mode instant|daily|weekly`, a per-subscription "last sent" watermark, the board's role grouping, and hooks in GitHub Actions (after ingest, daily ~9am ET, Mondays).
- [ ] PR 3, polish (about 2 h): "Get alerts" button on the board, bounce/complaint webhook → suppress address, test send.

## Later

- [ ] Self-healing ingest: auto-disable boards that return 404 several runs in a row (about 45 min). Current dead boards: Beacon Software, Firetiger, Tempo, Tilde Research (404), Cloudforce (timeout).
- [ ] Run ingest more often / more reliably than GitHub's cron allows (makes "instant" alerts faster).
- [ ] Decide on the uncommitted `scripts/score-resume.ts` + `src/scoring/resume.ts`: keep (commit) or delete.
- [ ] Blocked careers sites (Radancy, Taleo, etc.): bespoke JSON adapters, one company at a time. See `docs/coverage-report.md`.

## Done

- [x] 2026-11-09: UI revisions: light/dark toggle (follows OS until clicked); removed Tags and Tiers filters and the T1 badge; fixed-grid filter bar (no reflow when a filter is picked); Clear also clears a saved company watchlist; "Any mode" is now "Any work setting".
- [x] 2026-11-09: Prod outage fixes: transaction pooler (#33), no query pipelining (#34).
- [x] Board view (#32), grouping + pay by location, F500 + industries, blocked list, robust ingest.
