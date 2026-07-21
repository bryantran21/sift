// Core domain types, kept free of runtime imports so both the DB schema and the
// ingest pipeline can depend on them without cycles.

export type Ats =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'workable'
  | 'workday';

export type Tier = 1 | 2 | 3;

export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'unknown';

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
  // Workday needs coordinates discovered from the careers URL (Phase 7).
  tenant?: string;
  shard?: string;
  site?: string;
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
  locations: string[];
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
  relevanceScore: number;
  filterFlags: string[];
}
