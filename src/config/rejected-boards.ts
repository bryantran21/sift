// Boards that resolve but aren't the company's real careers board — junk test boards,
// a subsidiary's board, a foreign sales-agent board. Never ingested (loadSources drops
// them) and never accepted by `pnpm probe`. Add an entry when a probe result is reviewed
// and rejected; the key is `ats:slug` (slug lowercased).
const REJECTED = new Set([
  'lever:linkedin', // junk test board ("Anirban jobReq 3 - public")
  'lever:metlife', // MetLife Colombia sales agents, not the corporate board
  'greenhouse:aechelontechnology', // Aechelon (subsidiary), linked from Shield AI's site
]);

export function isRejectedBoard(ats: string, slug: string): boolean {
  return REJECTED.has(`${ats}:${slug.toLowerCase()}`);
}
