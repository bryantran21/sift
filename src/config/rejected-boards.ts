// Boards that are never ingested (loadSources drops them) and never accepted by
// `pnpm probe` — so a company with one is reclassified (blocked, or a different board).
// Key is `ats:slug` (slug lowercased). Three reasons:
//   decoy   — resolves, but isn't the company's real careers board
//   blocked — the platform refuses our requests (HTTP 403 even when paced, from CI too)
//   gone    — the board no longer exists (HTTP 404 run after run)
// Gone/blocked entries are dated: re-check them now and then (`pnpm sources:check all`
// after removing an entry) — boards do come back.
type Reason = 'decoy' | 'blocked' | 'gone';

const DISABLED: Record<string, Reason> = {
  // decoys
  'lever:linkedin': 'decoy', // junk test board ("Anirban jobReq 3 - public")
  'lever:metlife': 'decoy', // MetLife Colombia sales agents, not the corporate board
  'greenhouse:aechelontechnology': 'decoy', // Aechelon (subsidiary), linked from Shield AI's site

  // blocked (2026-11): these Eightfold tenants answer the public search API with 403
  'eightfold:bcg': 'blocked',
  'eightfold:hsbc': 'blocked',
  'eightfold:libertymutual': 'blocked',
  'eightfold:mlp': 'blocked', // Millennium
  'eightfold:newyorklife': 'blocked',

  // gone (2026-11): 404 on every run
  'greenhouse:oldmissioncapital': 'gone', // moved to ashby:old-mission-capital
  'greenhouse:postman': 'gone',
  'greenhouse:scoutai': 'gone',
  'ashby:atomicsemi': 'gone',
  'ashby:egra': 'gone',
  'ashby:hiive': 'gone',
  'ashby:klarity-ai': 'gone',
  'ashby:lynk': 'gone',
  'ashby:mach': 'gone',
  'ashby:maximor': 'gone',
  'ashby:odin-dynamics': 'gone',
  'ashby:pryzm': 'gone',
  'lever:calstart': 'gone',
  'lever:cirrus': 'gone',
};

export function isRejectedBoard(ats: string, slug: string): boolean {
  return `${ats}:${slug.toLowerCase()}` in DISABLED;
}

export function disabledReason(ats: string, slug: string): Reason | null {
  return DISABLED[`${ats}:${slug.toLowerCase()}`] ?? null;
}
