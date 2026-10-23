import type { Country } from '../types';

// The ATSs give us only free-text location strings ("US, CA, Santa Clara",
// "Toronto, Canada", "Remote"). deriveCountry buckets a role for the US-only filter.
// It favors precision: an ambiguous string stays 'unknown' rather than being guessed
// non-US, so the filter can optionally include unknowns without dropping real US roles.
//
// Aggregation across a role's locations is US-availability semantics: if ANY location
// is in the US the role is 'US' (a req fanned across US + Canada is US-available).

const US_STATES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
  'delaware', 'florida', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas',
  'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
  'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
  'wisconsin', 'wyoming',
  // Note: 'georgia' is intentionally omitted (collides with the country Georgia);
  // US Georgia postings almost always carry an explicit "US" / "GA" token.
];

// Foreign country + common metro markers. Country names cover the Workday
// "City, Country" format; the metros catch strings that omit the country.
const FOREIGN = [
  'canada', 'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary', 'waterloo',
  'india', 'bengaluru', 'bangalore', 'hyderabad', 'pune', 'mumbai', 'delhi', 'gurgaon', 'noida', 'chennai',
  'israel', 'tel aviv', 'herzliya',
  'united kingdom', 'england', 'scotland', 'ireland', 'london', 'dublin', 'manchester', 'edinburgh',
  'germany', 'berlin', 'munich', 'france', 'paris', 'spain', 'madrid', 'barcelona',
  'italy', 'netherlands', 'amsterdam', 'poland', 'warsaw', 'krakow', 'romania', 'bucharest',
  'portugal', 'lisbon', 'sweden', 'stockholm', 'norway', 'denmark', 'copenhagen', 'finland', 'helsinki',
  'switzerland', 'zurich', 'austria', 'belgium', 'brussels', 'czech', 'prague', 'hungary', 'budapest',
  'greece', 'turkey', 'ukraine', 'china', 'shanghai', 'beijing', 'shenzhen',
  'japan', 'tokyo', 'korea', 'seoul', 'singapore', 'taiwan', 'taipei', 'hong kong',
  'australia', 'sydney', 'melbourne', 'new zealand', 'philippines', 'manila',
  'vietnam', 'thailand', 'bangkok', 'indonesia', 'jakarta', 'malaysia', 'kuala lumpur',
  'uae', 'dubai', 'abu dhabi', 'saudi', 'egypt', 'cairo', 'south africa', 'nigeria', 'lagos', 'kenya', 'nairobi',
  'frankfurt', 'hamburg', 'cologne', 'haifa', 'medellin', 'cali',
  'mexico', 'guadalajara', 'brazil', 'sao paulo', 'argentina', 'buenos aires',
  'chile', 'santiago', 'peru', 'lima', 'colombia', 'bogota', 'costa rica', 'san jose costa rica',
];

// Major US metros / tech hubs, for locations given as a bare city with no state or
// country (common on Ashby boards, e.g. OpenAI's "San Francisco"). Checked AFTER the
// foreign list so "San Jose, Costa Rica" resolves non-US before "san jose" → US.
const US_CITIES = [
  'san francisco', 'sf', 'new york', 'new york city', 'nyc', 'brooklyn', 'manhattan',
  'seattle', 'bellevue', 'redmond', 'austin', 'boston', 'cambridge', 'los angeles',
  'san jose', 'san diego', 'mountain view', 'palo alto', 'menlo park', 'sunnyvale',
  'santa clara', 'cupertino', 'san mateo', 'oakland', 'san bruno', 'culver city',
  'santa monica', 'chicago', 'denver', 'boulder', 'atlanta', 'arlington', 'reston',
  'herndon', 'mclean', 'pittsburgh', 'philadelphia', 'dallas', 'houston', 'phoenix',
  'miami', 'portland', 'minneapolis', 'detroit', 'nashville', 'raleigh', 'durham',
  'salt lake city', 'las vegas', 'sacramento', 'irvine',
];

const US_MARKER = /\b(united states|u\s?s\s?a|us|usa|u\s?s|america)\b/;

// Two-letter postal codes, matched only in the "City, ST" position (after a comma, as
// written in uppercase) — "Cincinnati, OH", "Austin, TX 78701". Checked after the
// foreign list so "Bengaluru, KA, IN" or "Toronto, ON, CA" still resolve non-US.
const STATE_CODES = new Set(
  ('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ ' +
    'NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR').split(' '),
);
const STATE_CODE_RE = /,\s*([A-Z]{2})\b/g;

function hasStateCode(loc: string): boolean {
  for (const m of loc.matchAll(STATE_CODE_RE)) if (STATE_CODES.has(m[1])) return true;
  return false;
}

function norm(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z\s]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

function classifyOne(loc: string): Country {
  const h = norm(loc);
  if (US_MARKER.test(h)) return 'US';
  if (US_STATES.some((st) => h.includes(` ${st} `))) return 'US';
  if (FOREIGN.some((c) => h.includes(` ${c} `))) return 'non-US';
  if (US_CITIES.some((c) => h.includes(` ${c} `))) return 'US';
  if (hasStateCode(loc)) return 'US';
  return 'unknown';
}

export function deriveCountry(locations: string[]): Country {
  let sawForeign = false;
  for (const loc of locations) {
    const c = classifyOne(loc);
    if (c === 'US') return 'US';
    if (c === 'non-US') sawForeign = true;
  }
  return sawForeign ? 'non-US' : 'unknown';
}
