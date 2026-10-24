// Compact, canonical US location for display and for grouping pay by city. ATSs spell the
// same place many ways — "Seattle, Washington, USA", "US, WA, Seattle", "USA, WA, SEATTLE",
// "Seattle, WA, United States" — and they should all read (and merge) as "Seattle, WA".
// Anything that isn't recognizably a US city/state pair is returned unchanged.

const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA',
  michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'puerto rico': 'PR',
};
const CODES = new Set(Object.values(STATES));
const COUNTRY = /^(usa|us|u\.s\.a?\.?|united states( of america)?)$/i;
const REMOTE = /^(work (at|from) home|remote|virtual|telecommute)$/i;

function stateCode(part: string): string | null {
  const p = part.trim();
  if (/^[A-Za-z]{2}$/.test(p) && CODES.has(p.toUpperCase())) return p.toUpperCase();
  return STATES[p.toLowerCase()] ?? null;
}

function titleCase(s: string): string {
  // Only re-case shouting ("SEATTLE"); leave mixed case ("McLean") alone.
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;
}

export function shortLocation(loc: string): string {
  const parts = loc
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !COUNTRY.test(p));
  if (parts.length !== 2) return loc.trim();
  const [a, b] = parts as [string, string];
  const bState = stateCode(b);
  // "Work At Home, Illinois" × 50 states (CVS) → one "Remote (US)".
  if (bState && REMOTE.test(a)) return 'Remote (US)';
  if (bState) return `${titleCase(a)}, ${bState}`; // "Seattle, Washington" / "Seattle, WA"
  const aState = stateCode(a);
  if (aState) return `${titleCase(b)}, ${aState}`; // "WA, Seattle" (US, WA, Seattle)
  return loc.trim();
}
