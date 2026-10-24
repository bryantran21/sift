// Pull the posted pay range out of a job description. US pay-transparency laws mean most
// postings state one, in wildly varying formats:
//   "$100K–$120K" · "$195000 - $255000" · "$175,000 to $230,000 annually" · "$21.50/hour"
//   "$5,000 - $10,000 per month" · Amazon's "from $129,300/year … up to $223,600/year"
//   "Denver: $70,000; Long Beach: $80,000" (one value per city)
// and amid money that isn't pay: "$200 million Series B", "saved $1B", "earn $15,000
// for a referral", Canadian ranges ("… CAD"). Every amount needs pay context nearby, a
// plausible magnitude for its period, and no non-USD marker.
import type { LocationPay } from '../types';

export type { LocationPay };
export type SalaryPeriod = 'year' | 'hour' | 'month';

export interface Salary {
  min: number;
  max: number;
  period: SalaryPeriod;
}

const MONEY = String.raw`\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|m|b|million|billion|thousand)?\b`;
// A range "$X - $Y" / "$X to $Y" / "$X and $Y", else a single amount.
const RANGE_RE = new RegExp(`${MONEY}\\s*(?:-|to|and)\\s*${MONEY}`, 'gi');
const SINGLE_RE = new RegExp(MONEY, 'gi');
// No dollar sign, currency spelled after: "142,800.00 - 193,200.00 USD annually" (Amazon).
const NUM = String.raw`(\d{1,3}(?:,\d{3})*(?:\.\d+)?)`;
const USD_RANGE_RE = new RegExp(`${NUM}\\s*-\\s*${NUM}\\s*USD\\b`, 'gi');
// One pay line per location: "USA, CA, PASADENA - 142,800.00 - 193,200.00 USD annually".
const LOCATION_PAY_RE = new RegExp(
  String.raw`^[ \t]*([A-Za-z][A-Za-z .,'()-]{2,60}?)\s+-\s+${NUM}\s*-\s*${NUM}\s*USD\b[ \t]*([a-z ]*)`,
  'gim',
);

const PAY_CONTEXT = /salary|\bpay\b|compensation|\bwage|\bote\b|base|annual|hourly|per (year|hour|month)|\/\s*(yr|year|hr|hour)|range/i;
const NON_USD_AFTER = /^\s*(cad|gbp|eur|aud|inr|sgd|chf|jpy|nzd|mxn)\b/i;
const NON_USD_BEFORE = /(canada|canadian|toronto|vancouver|united kingdom|\buk\b|london|europe|cad|£|€)[^$]{0,40}$/i;

function amount(num: string, suffix: string | undefined): number | null {
  const s = (suffix ?? '').toLowerCase();
  if (s === 'm' || s === 'b' || s === 'million' || s === 'billion') return null; // funding, not pay
  const n = parseFloat(num.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return s === 'k' || s === 'thousand' ? n * 1000 : n;
}

function periodOf(before: string, after: string, max: number): SalaryPeriod {
  const near = `${before.slice(-60)} ${after}`.toLowerCase();
  if (/\bhour|\/\s*hr\b|hourly/.test(near)) return 'hour';
  if (/\bmonth|monthly/.test(near)) return 'month';
  if (max < 300) return 'hour'; // "$25—$28 USD" — only an hourly rate is that small
  return 'year';
}

function plausible(min: number, max: number, period: SalaryPeriod): boolean {
  if (min > max || max / min > 5) return false;
  if (period === 'year') return min >= 20_000 && max <= 2_000_000;
  if (period === 'hour') return min >= 7 && max <= 500;
  return min >= 1_000 && max <= 100_000; // month
}

function normalize(text: string): string {
  return text
    .replace(/[‒-―−]/g, '-') // en/em dashes, minus → hyphen
    .replace(/ /g, ' ');
}

export function parseSalary(description: string | null | undefined): Salary | null {
  if (!description) return null;
  const text = normalize(description);
  const found: Salary[] = [];
  const consumed: [number, number][] = [];

  const accept = (start: number, end: number, lo: number | null, hi: number | null) => {
    if (lo === null || hi === null) return;
    // Wide lookback: some postings list every state before the range ("…in CA, CO, …, DC is: $X—$Y").
    const before = text.slice(Math.max(0, start - 320), start);
    const after = text.slice(end, end + 40);
    if (!PAY_CONTEXT.test(before) && !PAY_CONTEXT.test(after)) return;
    if (NON_USD_AFTER.test(after) || NON_USD_BEFORE.test(before)) return;
    const period = periodOf(before, after, hi);
    if (!plausible(lo, hi, period)) return;
    found.push({ min: lo, max: hi, period });
  };

  for (const m of text.matchAll(RANGE_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    consumed.push([start, end]);
    let lo = amount(m[1], m[2]);
    const hi = amount(m[3], m[4]);
    // "$100-$120K": the suffix on the high end applies to both.
    if (lo !== null && hi !== null && !m[2] && m[4] && /^k|thousand$/i.test(m[4]) && lo < 1000) lo *= 1000;
    accept(start, end, lo, hi);
  }
  for (const m of text.matchAll(SINGLE_RE)) {
    const start = m.index ?? 0;
    if (consumed.some(([a, b]) => start >= a && start < b)) continue; // part of a range
    const v = amount(m[1], m[2]);
    accept(start, start + m[0].length, v, v);
  }
  // "N - N USD": the currency code is itself the pay signal, so no keyword is required.
  for (const m of text.matchAll(USD_RANGE_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const lo = amount(m[1], undefined);
    const hi = amount(m[2], undefined);
    if (lo === null || hi === null) continue;
    const period = periodOf(text.slice(Math.max(0, start - 60), start), text.slice(end, end + 40), hi);
    if (plausible(lo, hi, period)) found.push({ min: lo, max: hi, period });
  }
  if (!found.length) return null;

  // Several ranges (per-state, per-city, or Amazon's low/high market) → one overall span,
  // in the most common period (annual wins ties).
  const counts = new Map<SalaryPeriod, number>();
  for (const f of found) counts.set(f.period, (counts.get(f.period) ?? 0) + 1);
  const period = (['year', 'hour', 'month'] as const).reduce((best, p) =>
    (counts.get(p) ?? 0) > (counts.get(best) ?? 0) ? p : best,
  );
  const same = found.filter((f) => f.period === period);
  // Hourly keeps cents ($21.50); annual/monthly round to whole dollars.
  const round = (n: number) => (period === 'hour' ? Math.round(n * 100) / 100 : Math.round(n));
  return {
    min: round(Math.min(...same.map((f) => f.min))),
    max: round(Math.max(...same.map((f) => f.max))),
    period,
  };
}

// "USA, CA, PASADENA" → "Pasadena, CA"; anything else is title-cased as-is.
function prettyLocation(raw: string): string {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const title = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  if (parts[0]?.toUpperCase() === 'USA' && parts.length >= 3) {
    return `${title(parts.slice(2).join(', '))}, ${parts[1]!.toUpperCase()}`;
  }
  return parts.map((p) => (p.length === 2 ? p.toUpperCase() : title(p))).join(', ');
}

// Per-location pay lines, when a posting lists them (Amazon: one line per city it hires
// in). Empty when the posting gives a single range.
export function parsePayByLocation(description: string | null | undefined): LocationPay[] {
  if (!description) return [];
  const out: LocationPay[] = [];
  for (const m of normalize(description).matchAll(LOCATION_PAY_RE)) {
    const loc = m[1]!.trim();
    if (!loc.includes(',')) continue; // a location line, not a sentence fragment
    const lo = amount(m[2]!, undefined);
    const hi = amount(m[3]!, undefined);
    if (lo === null || hi === null) continue;
    const period: SalaryPeriod = /hour/i.test(m[4] ?? '') ? 'hour' : /month/i.test(m[4] ?? '') ? 'month' : periodOf('', m[4] ?? '', hi);
    if (plausible(lo, hi, period)) out.push({ location: prettyLocation(loc), min: lo, max: hi, period });
  }
  return out;
}

// Compact display: "$129k–$224k/yr", "$25–$28/hr", "$300k/yr".
export function formatSalary(s: { min: number; max: number; period: SalaryPeriod } | null): string | null {
  if (!s) return null;
  const unit = s.period === 'year' ? '/yr' : s.period === 'hour' ? '/hr' : '/mo';
  const f = (n: number) =>
    s.period === 'year' || n >= 10_000 ? `$${Math.round(n / 1000)}k` : `$${n % 1 ? n.toFixed(2) : n}`;
  return s.min === s.max ? `${f(s.min)}${unit}` : `${f(s.min)}–${f(s.max)}${unit}`;
}
