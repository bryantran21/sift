import type { ApplicationEventType } from '../db/schema';

// Interview/application cooldowns: how long after a rejection or failed assessment
// before a company will reconsider you. The clock starts from the rejection / last-
// interview date. Numbers are grounded in public guidance (the leonstaff big-tech
// cooldown guide + widely-reported norms); anything not listed falls back to the
// default and is shown as "approx". These are estimates, not guarantees.
export const DEFAULT_COOLDOWN_MONTHS = 6;

interface CooldownEntry {
  oa?: number; // months after a failed online assessment / phone screen
  onsite?: number; // months after a failed onsite / full loop
  months?: number; // general fallback for this company
}

// Keys are normalized (lowercased). Add more as they're confirmed.
const COOLDOWNS: Record<string, CooldownEntry> = {
  amazon: { oa: 6, onsite: 12 }, // "6mo for OA failure; 12mo after a full debrief"
  google: { oa: 6, onsite: 12 }, // "6mo for screens, 12mo for onsite"
  palantir: { oa: 6, onsite: 12 }, // "6mo technical screen; 1yr onsite"
  meta: { months: 9 }, // 6–12mo, hard block on the same role/team
  nvidia: { months: 12 },
  openai: { months: 12 },
  anthropic: { months: 4 }, // 3–6mo
  apple: { months: 0 }, // teams operate independently — no company-wide cooldown
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

export function cooldownMonths(company: string, stage: 'oa' | 'onsite' | 'general'): number {
  const e = COOLDOWNS[norm(company)];
  if (!e) return DEFAULT_COOLDOWN_MONTHS;
  if (stage === 'oa') return e.oa ?? e.months ?? e.onsite ?? DEFAULT_COOLDOWN_MONTHS;
  if (stage === 'onsite') return e.onsite ?? e.months ?? e.oa ?? DEFAULT_COOLDOWN_MONTHS;
  return e.months ?? e.onsite ?? e.oa ?? DEFAULT_COOLDOWN_MONTHS;
}

export interface CooldownStatus {
  company: string;
  endsAt: string; // ISO
  active: boolean; // now < endsAt
  months: number;
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
// Returns null if nothing triggers one (or the company has no cooldown, e.g. Apple).
export function computeCooldown(company: string, events: EventLike[]): CooldownStatus | null {
  const triggers = events
    .filter((e) => eventStage(e.type) !== null)
    .map((e) => ({ type: e.type, at: new Date(e.eventAt) }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const basis = triggers[0];
  if (!basis) return null;

  const months = cooldownMonths(company, eventStage(basis.type)!);
  if (months <= 0) return null;

  const endsAt = new Date(basis.at);
  endsAt.setMonth(endsAt.getMonth() + months);
  return {
    company,
    endsAt: endsAt.toISOString(),
    active: Date.now() < endsAt.getTime(),
    months,
    basisType: basis.type,
    basisDate: basis.at.toISOString(),
    approx: !isKnownCooldown(company),
  };
}
