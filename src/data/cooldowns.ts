import type { ApplicationEventType } from '../db/schema';

// Interview/application cooldowns: how long after a rejection or failed assessment
// before a company will reconsider you. The clock starts from the rejection / last-
// interview date. Grounded in the public FAANG cooldown lists (LeetCode discuss #771157
// and Blind) plus the leonstaff big-tech guide; anything not listed falls back to the
// default and is shown as "approx". These are estimates, not guarantees.
export const DEFAULT_COOLDOWN_MONTHS = 6;

// A cooldown length in months — a fixed number, or a [min, max] range where public
// reports genuinely disagree (e.g. Meta: ~6mo per recent recruiters, 12mo historically).
type Months = number | [number, number];

interface CooldownEntry {
  oa?: Months; // after a failed online assessment / phone screen
  onsite?: Months; // after a failed onsite / full loop
  months?: Months; // general fallback for this company (0 = no cooldown)
}

// Keys are normalized (lowercased, alphanumerics only). Aliases (facebook/meta,
// snap/snapchat, twitter/x) map to the same policy. Add more as they're confirmed.
const COOLDOWNS: Record<string, CooldownEntry> = {
  // Stage-aware big tech (phone/OA vs onsite)
  amazon: { oa: 6, onsite: 12 }, // ~6mo after an OA miss; ~12mo (up to 24mo) after a full debrief
  google: { oa: 6, onsite: 12 }, // 6mo from a phone screen; 12mo from onsite
  palantir: { oa: 6, onsite: 12 },
  meta: { months: [6, 12] }, // recruiters cite ~6mo now; historically 1yr, same role/team
  facebook: { months: [6, 12] },
  apple: { onsite: 6, months: 0 }, // 6mo only if you fail the onsite; a different team = no wait

  // No cooldown — you can interview with multiple teams in parallel
  microsoft: { months: 0 },
  netflix: { months: 0 },

  // Flat "from first interview" cooldowns (LeetCode / Blind lists)
  linkedin: { months: 12 },
  snap: { months: 12 },
  snapchat: { months: 12 },
  spotify: { months: 6 },
  uber: { months: 6 },
  lyft: { months: 6 },
  oracle: { months: 6 }, // same org branch (e.g. OCI); other orgs unaffected
  walmart: { months: 6 },
  tesla: { months: 6 },
  twitter: { months: 6 },
  x: { months: 6 },

  // Grounded elsewhere
  nvidia: { months: 12 },
  openai: { months: 12 },
  anthropic: { months: 4 }, // 3–6mo
};

function norm(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function isKnownCooldown(company: string): boolean {
  return norm(company) in COOLDOWNS;
}

// Which event types start a cooldown, and the stage they map to.
export function eventStage(type: ApplicationEventType): 'oa' | 'onsite' | 'general' | null {
  if (type === 'oa') return 'oa';
  if (type === 'interview') return 'onsite';
  if (type === 'rejected') return 'general';
  return null; // 'applied' / 'offer' don't start a cooldown
}

// Raw cooldown length for a company + stage (a number, or a [min, max] range).
export function cooldownMonths(company: string, stage: 'oa' | 'onsite' | 'general'): Months {
  const e = COOLDOWNS[norm(company)];
  if (!e) return DEFAULT_COOLDOWN_MONTHS;
  const pick =
    stage === 'oa'
      ? e.oa ?? e.months ?? e.onsite
      : stage === 'onsite'
        ? e.onsite ?? e.months ?? e.oa
        : e.months ?? e.onsite ?? e.oa;
  return pick ?? DEFAULT_COOLDOWN_MONTHS;
}

const lo = (m: Months): number => (Array.isArray(m) ? m[0] : m);
const hi = (m: Months): number => (Array.isArray(m) ? m[1] : m);

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

export interface CooldownStatus {
  company: string;
  endsAt: string; // ISO — conservative (latest) end date
  endsAtMin: string; // ISO — earliest you might be eligible again
  active: boolean; // now < endsAt (latest)
  months: number; // = monthsMax, kept for existing consumers
  monthsMin: number;
  monthsMax: number;
  isRange: boolean; // monthsMin !== monthsMax
  basisType: ApplicationEventType;
  basisDate: string; // ISO
  approx: boolean; // using the default (company not in the known map)
}

interface EventLike {
  company: string;
  type: ApplicationEventType;
  eventAt: Date | string;
}

// Compute a company's cooldown from the most recent cooldown-triggering event.
// Returns null if nothing triggers one (or the company has no cooldown, e.g. Apple/MSFT).
export function computeCooldown(company: string, events: EventLike[]): CooldownStatus | null {
  const triggers = events
    .filter((e) => eventStage(e.type) !== null)
    .map((e) => ({ type: e.type, at: new Date(e.eventAt) }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const basis = triggers[0];
  if (!basis) return null;

  const m = cooldownMonths(company, eventStage(basis.type)!);
  const monthsMin = lo(m);
  const monthsMax = hi(m);
  if (monthsMax <= 0) return null;

  const endsAtMin = addMonths(basis.at, monthsMin);
  const endsAtMax = addMonths(basis.at, monthsMax);
  return {
    company,
    endsAt: endsAtMax.toISOString(),
    endsAtMin: endsAtMin.toISOString(),
    active: Date.now() < endsAtMax.getTime(),
    months: monthsMax,
    monthsMin,
    monthsMax,
    isRange: monthsMin !== monthsMax,
    basisType: basis.type,
    basisDate: basis.at.toISOString(),
    approx: !isKnownCooldown(company),
  };
}
