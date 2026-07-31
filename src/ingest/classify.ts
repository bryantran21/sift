import type { Category } from '../types';

// Stage-1 tech classification: a deterministic, title-driven heuristic that maps a
// posting to the Category enum. The feed's "tech only" filter keys off this — any
// role that isn't clearly software / data / ML / quant / hardware-eng lands in
// 'other' and is hidden by default. Title-only on purpose: job descriptions mention
// technologies for non-tech roles (a marketing JD that says "SQL"), which would
// wreck precision. Order matters — the first matching rule wins.

// Each rule is [test, category]. Tests run against a normalized, space-padded title.
const RULES: [RegExp, Category][] = [
  // ── Quant ──────────────────────────────────────────────────────────────────
  [/\bquant(itative)?\b.*\b(trader|trading)\b|\b(trader|trading)\b.*\bquant/, 'quant-trading'],
  [/\bquant(itative)?\b.*\b(research(er)?|scientist)\b/, 'quant-research'],
  [/\bquant(itative)?\b.*\b(dev(eloper)?|engineer|software|programmer)\b/, 'quant-dev'],
  [/\bquant(itative)?\b/, 'quant-dev'],

  // ── Machine learning / AI ──────────────────────────────────────────────────
  [/\b(machine learning|deep learning|\bml\b|\bai\b|nlp|computer vision|llm|generative ai)\b.*\b(research(er)?|scientist)\b/, 'ml-research'],
  [/\bresearch scientist\b/, 'ml-research'],
  [/\b(machine learning|deep learning|\bml\b|mlops|computer vision|nlp|llm|generative ai|applied (ai|ml)|ai)\b/, 'ml-engineering'],

  // ── Data ───────────────────────────────────────────────────────────────────
  [/\bdata (scientist|analyst|engineer|science|analytics)\b/, 'data'],
  [/\b(analytics|business intelligence|\bbi\b) (engineer|developer|analyst|lead|manager)\b/, 'data'],

  // ── Infrastructure / platform / reliability / security ─────────────────────
  // "platform" / "infrastructure" require an eng qualifier so product/business
  // titles ("Platform Management", "Product Platform") don't leak in.
  [/\b((infrastructure|platform) (engineer|engineering|architect)|devops|\bsre\b|site reliability|systems? engineer|distributed systems|cloud (engineer|architect)|kubernetes|networking (engineer|architect)|database (engineer|administrator)|security engineer)\b/, 'swe-infra'],

  // ── General & hardware software/eng ────────────────────────────────────────
  // "software … engineer/developer" covers SDE / "software development engineer".
  // "member of technical staff" is the generalist eng/research title at OpenAI,
  // Anthropic, xAI, etc.; "research engineer" is likewise a core eng role there.
  [/\bswe\b|\bsoftware\b.*\b(engineer|developer|dev)\b|\bmember of technical staff\b|\bresearch engineer\b|\b(full[- ]?stack|front[- ]?end|back[- ]?end|web (engineer|developer)|mobile (engineer|developer)|ios|android|embedded|firmware|programmer|game (engineer|developer)|graphics engineer)\b/, 'swe-general'],
  // Hardware / silicon / EE engineering (chip companies) — still "tech".
  [/\b(hardware|silicon|asic|fpga|\brtl\b|vlsi|verification|signal integrity|power (integrity|management|design)|analog|circuit|chip|semiconductor)\b.*\bengineer/, 'swe-general'],
];

export function classifyCategory(title: string): Category {
  const hay = ` ${title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  for (const [test, category] of RULES) {
    if (test.test(hay)) return category;
  }
  return 'other';
}

// Whether a category counts as a "tech" role for the default feed filter.
export function isTechCategory(category: Category): boolean {
  return category !== 'other';
}
