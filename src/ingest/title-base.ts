// The "base" role of a job title, with team / org / location decorations stripped, so
// near-identical postings group into one feed row:
//   "Software Development Engineer, AWS Lambda"                  → software development engineer
//   "AWS Marketplace - Software Development Engineer, Marketplace" → software development engineer
//   "Alarm & Accessories - Sr. Embedded SDE , Ring"               → senior embedded sde
//   "Data Engineer II, Sales Data Services (SDS)"                 → data engineer ii
// Levels stay (SDE vs SDE II vs Senior SDE are different roles); abbreviations expand
// (Sr. → senior, Dev → development) so spelling variants land together.

const SEPARATORS = /\s+[-–—|/]\s+|\s*[,(:|]\s*|\)\s*/;
const ROLE_NOUN =
  /\b(engineer|engineering|developer|scientist|analyst|architect|manager|designer|researcher|consultant|specialist|lead|director|intern|internship|co-?op|sde|swe|sre|programmer|technician|administrator|associate|staff|principal|fellow)\b/i;

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bsr\b\.?/g, 'senior'],
  [/\bjr\b\.?/g, 'junior'],
  [/\bdev\b/g, 'development'],
  [/\beng\b/g, 'engineer'],
  [/\bmgr\b/g, 'manager'],
  [/\bassoc\b/g, 'associate'],
];

// The role segment, in its original casing (for display).
export function baseTitleDisplay(title: string): string {
  const segments = title
    .split(SEPARATORS)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segments.length) return title.trim();
  return segments.find((s) => ROLE_NOUN.test(s)) ?? segments[0]!;
}

// The normalized grouping key.
export function baseTitle(title: string): string {
  let t = baseTitleDisplay(title).toLowerCase();
  for (const [re, to] of ABBREVIATIONS) t = t.replace(re, to);
  return t
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
