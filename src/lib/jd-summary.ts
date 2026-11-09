// Turn a plain-text job description into the at-a-glance summary the job panel shows:
// what you'll do / what they want / nice-to-haves as short bullet lists, plus benefits,
// visa sponsorship, clearance, and years of experience. Heuristic and pure — descriptions
// keep one block (heading, bullet, paragraph) per line after HTML stripping, and headings
// are short standalone lines ("What you'll do:", "Minimum Qualifications", "Benefits").

export type SectionKind = 'responsibilities' | 'requirements' | 'nice' | 'benefits';

export interface JdSection {
  kind: SectionKind;
  title: string; // as written in the posting
  bullets: string[];
}

export interface JdSummary {
  sections: JdSection[];
  benefits: string[];
  sponsorship: 'no' | 'yes' | null; // visa sponsorship, when the posting says
  clearance: boolean; // requires a security clearance
  experience: string | null; // "5+ yrs", "3–5 yrs"
}

// Checked in order: "Preferred Qualifications" is nice-to-have, not a requirement.
const HEADINGS: [RegExp, SectionKind | 'other'][] = [
  [/\b(about (us|the team|the company|[a-z]+)|who we are|our (mission|story|culture)|equal (employment )?opportunity|eeo|compensation|salary|pay range|location|logistics)\b/i, 'other'],
  [/\b(preferred|nice[- ]to[- ]haves?|bonus points|stand out|desired|ideally|pluses|a plus)\b/i, 'nice'],
  [/\b(benefits?|perks|what we offer|we offer|why join)\b/i, 'benefits'],
  [/\b(responsibilit\w*|what (you('|’)?ll|you will) (do|work on|be doing|own)|in this role|the role|your role|day[- ]to[- ]day|key duties|duties|role expectations|your impact|what the job involves|you will:?)$|\b(responsibilit\w*|what (you('|’)?ll|you will) (do|work on|be doing|own)|in this role|day[- ]to[- ]day|key duties|role expectations|your impact)\b/i, 'responsibilities'],
  [/\b(requirements?|qualifications?|what (you('|’)?ll|you will) need|looking for|who you are|you bring|must[- ]haves?|apply if you have|about you|what we need)\b/i, 'requirements'],
];
// Broad words that only mark a heading on a short line ("Skills", "Your experience:") —
// otherwise "Experience with OAuth, SAML, or OIDC" (a bullet) would read as a heading.
const WEAK_REQUIREMENTS = /\b(skills|experience|you have)\b/i;

const MAX_BULLETS = 8;
const MAX_BULLET_LEN = 240;

function headingKind(line: string): SectionKind | 'other' | null {
  const l = line.replace(/[:：]\s*$/, '').trim();
  // A heading is a short standalone line that isn't a sentence.
  if (l.length < 3 || l.length > 90 || /[.!?;]$/.test(l) || /^[-•*·▪◦–]/.test(l)) return null;
  const words = l.split(/\s+/).length;
  const colon = /[:：]\s*$/.test(line);
  if (words > 12) return null;
  // Headings don't list things; "Experience with OAuth, SAML, or OIDC" is a bullet.
  if (l.includes(',') && !colon) return null;
  for (const [re, kind] of HEADINGS) if (re.test(l)) return kind;
  if (WEAK_REQUIREMENTS.test(l) && (words <= 4 || colon)) return 'requirements';
  return null;
}

function cleanBullet(line: string): string {
  let b = line.replace(/^\s*([-•*·▪◦–]|\d+[.)])\s*/, '').trim();
  if (b.length > MAX_BULLET_LEN) b = `${b.slice(0, MAX_BULLET_LEN - 1).trimEnd()}…`;
  return b;
}

const BENEFITS: [RegExp, string][] = [
  [/\b(medical|health (insurance|plans?|coverage|benefits)|dental|vision)\b/i, 'Health insurance'],
  [/401\s?\(?k\)?|retirement (plan|options|savings|benefits)/i, '401(k) / retirement'],
  [/\b(equity|stock options|rsus?|esop|ownership stake)\b/i, 'Equity'],
  [/\b(parental|maternity|paternity) leave\b/i, 'Parental leave'],
  [/\b(annual|performance|sign[- ]on|signing|target) bonus\b/i, 'Bonus'],
  [/\b(education|tuition|learning|professional development|career growth)\b.{0,20}\b(reimbursement|stipend|budget|funds|allowance)\b|\bfunds for your career/i, 'Learning budget'],
  [/\b(fully remote|remote[- ]first|work from (home|anywhere))\b/i, 'Remote-friendly'],
];

const NO_SPONSOR =
  /(not (be )?(able|eligible) to (provide |offer )?(visa )?sponsor|unable to (provide |offer )?(visa )?sponsor|will not (provide |offer )?(visa )?sponsor|(does|do|is) not (provide |offer )?(visa )?sponsor|no (visa |h-?1b )?sponsorship|without (the need for )?(current or future |any )?(employer |visa )?sponsorship|sponsorship (is )?not (available|provided|offered))/i;
const YES_SPONSOR =
  /(visa sponsorship (is )?available|(will|can|able to|happy to) sponsor|we sponsor|sponsorship (is )?available|h-?1b (transfer|sponsorship)s? (is |are )?(available|supported|welcome))/i;
const CLEARANCE = /\b(security clearance|ts\/sci|top secret|secret clearance|active clearance|clearance (is )?required)\b/i;

function yearsOfExperience(text: string): string | null {
  const range = text.match(/\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\+?\s*years?\b/i);
  const plus = text.match(/\b(\d{1,2})\+\s*years?\b|\b(\d{1,2})\s*or more years?\b|\b(?:minimum of|at least)\s*(\d{1,2})\s*years?\b/i);
  // Prefer whichever appears first; years beyond ~20 are tenure/history, not a requirement.
  const r = range && Number(range[1]) <= 20 && Number(range[2]) <= 25 ? range : null;
  const p = plus ? Number(plus[1] ?? plus[2] ?? plus[3]) : null;
  const pOk = p !== null && p <= 20 ? plus : null;
  if (r && (!pOk || (r.index ?? 0) <= (pOk.index ?? 0))) return `${r[1]}–${r[2]} yrs`;
  if (pOk) return `${p}+ yrs`;
  return null;
}

export function summarizeJd(text: string | null | undefined): JdSummary {
  const empty: JdSummary = { sections: [], benefits: [], sponsorship: null, clearance: false, experience: null };
  if (!text || !text.trim()) return empty;

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections: JdSection[] = [];
  let current: JdSection | null = null;
  let currentKind: SectionKind | 'other' | null = null;

  for (const line of lines) {
    const kind = headingKind(line);
    if (kind) {
      currentKind = kind;
      current = kind === 'other' ? null : { kind, title: line.replace(/[:：]\s*$/, ''), bullets: [] };
      if (current) sections.push(current);
      continue;
    }
    if (current && currentKind !== 'other' && current.bullets.length < MAX_BULLETS) {
      const b = cleanBullet(line);
      if (b.length >= 3) current.bullets.push(b);
    }
  }

  // Merge same-kind sections ("Minimum Qualifications" + "Who You Are") and drop empties.
  const merged: JdSection[] = [];
  for (const s of sections) {
    if (!s.bullets.length) continue;
    const prev = merged.find((m) => m.kind === s.kind);
    if (prev) prev.bullets.push(...s.bullets.slice(0, MAX_BULLETS - prev.bullets.length));
    else merged.push(s);
  }
  const order: SectionKind[] = ['responsibilities', 'requirements', 'nice', 'benefits'];
  merged.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  const benefits = BENEFITS.filter(([re]) => re.test(text)).map(([, label]) => label);
  if (/unlimited (pto|paid time off|vacation|time off)/i.test(text)) benefits.push('Unlimited PTO');
  else if (/\b(paid time off|pto|vacation|time off|paid holidays)\b/i.test(text)) benefits.push('Paid time off');

  const requirementsText = merged
    .filter((s) => s.kind === 'requirements')
    .flatMap((s) => s.bullets)
    .join('\n');

  return {
    sections: merged,
    benefits,
    sponsorship: NO_SPONSOR.test(text) ? 'no' : YES_SPONSOR.test(text) ? 'yes' : null,
    clearance: CLEARANCE.test(text),
    experience: yearsOfExperience(requirementsText) ?? yearsOfExperience(text),
  };
}
