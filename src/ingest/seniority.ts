import type { Seniority } from '../types';

// Title-driven seniority heuristic → the Seniority enum, powering the feed's
// experience-level filter (intern · new-grad/entry · mid · senior · staff+). Same
// approach and rationale as classify.ts: deterministic, title-only (descriptions are
// noisy), first matching rule wins. Roman-numeral and Arabic levels are read as
// Engineer I → entry, II → mid, III → senior, IV/V → staff+. Titles with no level
// signal stay 'unknown' (still shown under "Any level").

const LEVEL = '(engineer|developer|dev|swe|scientist|analyst|programmer)';

// Order matters — most senior / most specific first so "Senior Staff" → staff+ and a
// bare level number doesn't outrank an explicit word.
const RULES: [RegExp, Seniority][] = [
  [/\bintern(ship)?\b|\bco op\b/, 'intern'],
  [new RegExp(`\\b(staff|principal|distinguished|fellow)\\b|\\b${LEVEL} (iv|v|4|5)\\b`), 'staff+'],
  [new RegExp(`\\bsenior\\b|\\bsr\\b|\\blead\\b|\\b${LEVEL} (iii|3)\\b`), 'senior'],
  [new RegExp(`\\bnew ?grad(uate)?\\b|\\bentry[- ]?level\\b|\\b(junior|jr|apprentice)\\b|\\buniversity (grad|graduate|hire)\\b|\\bearly career\\b|\\b${LEVEL} (i|1)\\b`), 'new-grad'],
  [new RegExp(`\\bmid[- ]?level\\b|\\bintermediate\\b|\\b${LEVEL} (ii|2)\\b`), 'mid'],
];

export function classifySeniority(title: string): Seniority {
  const hay = ` ${title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  for (const [test, seniority] of RULES) {
    if (test.test(hay)) return seniority;
  }
  return 'unknown';
}
