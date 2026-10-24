// Core domain types, kept free of runtime imports so both the DB schema and the
// ingest pipeline can depend on them without cycles.

export type Ats =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'workable'
  | 'workday'
  // Generic enterprise career platforms (public JSON APIs behind their career sites).
  | 'eightfold'
  | 'oraclehcm'
  | 'phenom'
  // Bespoke big-tech adapters (custom career-site JSON APIs, 1:1 with a company).
  | 'amazon'
  | 'netflix';

export type Tier = 1 | 2 | 3;

// One posted pay range for one location ("Pasadena, CA: $142,800–$193,200/yr").
export interface LocationPay {
  location: string;
  min: number;
  max: number;
  period: 'year' | 'hour' | 'month';
}

export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'unknown';

// Coarse location bucket derived from the free-text location strings (no structured
// country data comes from the ATSs). 'US' means at least one location is in the US.
export type Country = 'US' | 'non-US' | 'unknown';

// Stage-1 classification output (see §5). Rules land in Phase 4.
export type Category =
  | 'quant-trading'
  | 'quant-research'
  | 'quant-dev'
  | 'ml-research'
  | 'ml-engineering'
  | 'swe-infra'
  | 'swe-general'
  | 'data'
  | 'other';

export type Seniority = 'intern' | 'new-grad' | 'mid' | 'senior' | 'staff+' | 'unknown';

// A single hand-curated entry from sources.yaml.
export interface Source {
  company: string;
  ats: Ats;
  slug: string;
  tier: Tier;
  tags: string[];
  enabled: boolean;
  industry?: string; // optional override; normally resolved from the company registry
  search?: string[]; // Workday: query these terms instead of paging the whole board
  // Workday needs coordinates discovered from the careers URL (Phase 7).
  tenant?: string;
  shard?: string;
  // Board id within the platform: Workday site, Eightfold `domain` param, Oracle siteNumber,
  // Phenom refNum.
  site?: string;
  // Eightfold / Oracle HCM / Phenom API host (starbucks.eightfold.ai, jpmc.fa.oraclecloud.com,
  // careers.adobe.com).
  host?: string;
}

// What an adapter emits: the source's fields plus the raw, un-normalized posting.
export interface RawJob {
  ats: Ats;
  sourceSlug: string;
  company: string;
  companyTier: Tier;
  tags: string[];
  atsJobId: string;
  reqNumber: string | null; // ATS requisition id, often shared across a fan-out (§6a)
  title: string;
  locations: string[];
  workplaceType: string | null; // raw remote/hybrid/onsite hint, if the ATS gives one
  description: string | null; // raw; may be HTML, markdown, or plain text
  descriptionFormat: 'html' | 'text' | 'markdown';
  applyUrl: string;
  postedAt: string | null; // ISO string from source, often null
  updatedAt: string | null;
  // Set when the adapter *knows* the country (e.g. Workday queried with its US-only facet),
  // so "5 Locations" or a blank location still lands in the US feed.
  country?: Country;
}

// The shared interface every ATS adapter implements (§2).
export interface AtsAdapter {
  id: Ats;
  fetchJobs(source: Source): Promise<RawJob[]>;
}

// Output of normalization: structural fields resolved. Classification and scoring
// carry defaults until their phases (4 and 6); persistence fields (firstSeenAt,
// seenCount, …) are assigned by the DB layer in Phase 2.
export interface NormalizedJob {
  id: string; // stable content hash
  company: string;
  companyTier: Tier;
  title: string;
  normalizedTitle: string; // grouping key for fan-out collapse (Phase 3)
  titleBase: string; // role without team/org decorations — the feed's grouping key
  locations: string[];
  country: Country; // derived bucket for the US-only filter
  workMode: WorkMode;
  description: string; // plain text, HTML stripped
  descriptionHash: string;
  applyUrl: string;
  ats: Ats;
  atsJobId: string;
  reqNumber: string | null;
  sourceSlug: string;
  postedAt: Date | null;
  category: Category;
  seniority: Seniority;
  skills: string[]; // tech skills extracted from title + description (for résumé fit)
  salary: { min: number; max: number; period: 'year' | 'hour' | 'month' } | null; // posted pay
  payByLocation: LocationPay[]; // per-location pay lines, when the posting lists them
  relevanceScore: number;
  filterFlags: string[];
}
