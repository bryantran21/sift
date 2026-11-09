'use client';

// The job / role-group detail views and the small pieces shared by the board and the table:
// the same panel renders in the board's right-hand pane, in the mobile drawer, and in the
// table view's drawer.

import { useEffect, useState, type ReactNode } from 'react';
import { ageLabel, recencyBucket } from '../lib/recency';
import { monogram } from '../lib/avatar';
import { shortLocation } from '../lib/short-location';
import { CompanyTracker } from './company-tracker';
import { industryLabel } from '../data/industries';
import { formatSalary, type SalaryPeriod } from '../ingest/salary';
import { baseTitleDisplay } from '../ingest/title-base';
import type { JdSummary, SectionKind } from '../lib/jd-summary';
import type { FeedRow } from '../db/feed';

export type FeedTableRow = FeedRow & { logo: string | null };

// ── small shared pieces ──────────────────────────────────────────────────────
export function Avatar({ company, logo, size }: { company: string; logo: string | null; size?: 'lg' }) {
  const cls = `ico${size === 'lg' ? ' ico-lg' : ''}`;
  if (logo) return <img className={cls} src={logo} alt="" />;
  const { ch, hue } = monogram(company);
  return (
    <span className={`${cls} mono-ico`} style={{ background: `hsl(${hue},36%,42%)` }}>
      {ch}
    </span>
  );
}

export function MatchBadge({ n }: { n: number | null }) {
  if (n == null) return <span className="match match-none">—</span>;
  const cls = n >= 5 ? 'match-hi' : n >= 2 ? 'match-mid' : n >= 1 ? 'match-lo' : 'match-none';
  return (
    <span className={`match ${cls}`} title={`${n} of your skills`}>
      {n}
    </span>
  );
}

// "Seattle, WA · Redmond, WA +19" — spellings unified and de-duplicated.
export function formatLocs(raw: string[], total?: number): string {
  if (!raw || raw.length === 0) return '—';
  // Some boards pack several places into one string: "Bellevue, WA; Santa Clara, CA".
  const locations = [...new Set(raw.flatMap((l) => l.split(/\s*;\s*/)).filter(Boolean).map(shortLocation))];
  const n = total ?? locations.length;
  if (n <= 2) return locations.slice(0, 2).join(' · ');
  return `${locations.slice(0, 2).join(' · ')} +${n - 2}`;
}

export function payLabel(min: number | null, max: number | null, period: SalaryPeriod | null): string | null {
  if (min == null || max == null || !period) return null;
  return formatSalary({ min, max, period });
}

export function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function effectiveDate(r: FeedTableRow): Date {
  return r.postedAt ? new Date(r.postedAt) : new Date(r.firstSeenAt);
}

export { ageLabel, recencyBucket, baseTitleDisplay, industryLabel };

const CATEGORY: Record<string, string> = {
  'quant-trading': 'Quant trading',
  'quant-research': 'Quant research',
  'quant-dev': 'Quant development',
  'ml-research': 'ML research',
  'ml-engineering': 'ML engineering',
  'swe-infra': 'Infrastructure',
  'swe-general': 'Software engineering',
  data: 'Data',
};
const SENIORITY: Record<string, string> = {
  intern: 'Intern',
  'new-grad': 'New grad',
  mid: 'Mid-level',
  senior: 'Senior',
  'staff+': 'Staff+',
};
const MODE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'In person' };

// A modal side drawer (used on narrow screens and by the table view).
export function DrawerShell({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={label}>
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </aside>
    </div>
  );
}

// ── job panel ────────────────────────────────────────────────────────────────
interface JobDetail {
  description: string;
  skills: string[];
  payByLocation: { location: string; min: number; max: number; period: SalaryPeriod }[];
  summary: JdSummary;
}

const SECTION_LABEL: Record<SectionKind, string> = {
  responsibilities: "What you'll do",
  requirements: "What they're looking for",
  nice: 'Nice to have',
  benefits: 'Benefits',
};

export function JobPanel({ row, cooldownUntil }: { row: FeedTableRow; cooldownUntil?: string }) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'summary' | 'full'>('summary');

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError(false);
    setTab('summary');
    fetch(`/api/job/${encodeURIComponent(row.id)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d: JobDetail) => alive && setDetail(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [row.id]);

  const summary = detail?.summary;
  const sections = (summary?.sections ?? []).filter((s) => s.kind !== 'benefits');
  const showSummary = tab === 'summary' && sections.length > 0;
  const pay = payLabel(row.payMin, row.payMax, row.payPeriod);
  const added = effectiveDate(row);

  return (
    <div className="jp">
      <div className="jp-head">
        <Avatar company={row.company} logo={row.logo} size="lg" />
        <div className="jp-co">
          <div className="jp-co-name">
            {row.company} {row.companyTier === 1 ? <span className="badge tier1">T1</span> : null}
          </div>
          <div className="jp-co-sub">{industryLabel(row.industry)}</div>
        </div>
        <a className="jp-apply" href={row.applyUrl} target="_blank" rel="noopener noreferrer">
          Apply ↗
        </a>
      </div>

      <h2 className="jp-title">{row.title}</h2>
      <div className="jp-sub">
        {CATEGORY[row.category] ?? 'Tech'} · added {ageLabel(added)} ago · via {row.ats}
      </div>

      <div className="jp-chips">
        {MODE[row.workMode] ? <span className="jp-chip">{MODE[row.workMode]}</span> : null}
        <span className="jp-chip">📍 {formatLocs(row.locations)}</span>
        {pay ? <span className="jp-chip jp-chip-pay">{pay}</span> : null}
        {SENIORITY[row.seniority] ? <span className="jp-chip">{SENIORITY[row.seniority]}</span> : null}
        {row.match != null ? <span className="jp-chip">✦ {row.match} skills match</span> : null}
        {cooldownUntil ? (
          <span className="jp-chip jp-chip-warn">⏳ cooldown until {new Date(cooldownUntil).toLocaleDateString()}</span>
        ) : null}
      </div>

      <div className="jp-body">
        <div className="jp-main">
          <div className="jp-about">
            <span className="jp-h">About the job</span>
            {sections.length > 0 ? (
              <div className="seg" role="tablist">
                <button className={tab === 'summary' ? 'on' : ''} onClick={() => setTab('summary')} role="tab">
                  Summary
                </button>
                <button className={tab === 'full' ? 'on' : ''} onClick={() => setTab('full')} role="tab">
                  Full posting
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="drawer-muted">Couldn&apos;t load the posting. Open it on the source site.</div>
          ) : !detail ? (
            <div className="drawer-muted">Loading…</div>
          ) : showSummary ? (
            sections.map((s) => (
              <div className="jp-sec" key={s.kind}>
                <div className="jp-sec-h" title={s.title}>
                  {SECTION_LABEL[s.kind]}
                </div>
                <ul>
                  {s.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ))
          ) : detail.description.trim() ? (
            <div className="jd">{detail.description}</div>
          ) : (
            <div className="drawer-muted">No description available — view the full posting on the source site.</div>
          )}

          <CompanyTracker company={row.company} />
        </div>

        <aside className="jp-side">
          <div className="jp-h">At a glance</div>
          <Glance label="Experience" value={summary?.experience ?? SENIORITY[row.seniority] ?? '—'} />
          <Glance
            label="Work authorization"
            value={
              summary?.sponsorship === 'no'
                ? 'No visa sponsorship'
                : summary?.sponsorship === 'yes'
                  ? 'Sponsors visas'
                  : 'Not stated'
            }
            tone={summary?.sponsorship === 'no' ? 'warn' : summary?.sponsorship === 'yes' ? 'good' : undefined}
          />
          {summary?.clearance ? <Glance label="Clearance" value="Security clearance required" tone="warn" /> : null}

          {detail && detail.skills.length > 0 ? (
            <div className="jp-glance-block">
              <div className="jp-glance-label">Skills</div>
              <div className="chips">
                {detail.skills.slice(0, 14).map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {summary && summary.benefits.length > 0 ? (
            <div className="jp-glance-block">
              <div className="jp-glance-label">Benefits</div>
              <ul className="jp-checks">
                {summary.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail && detail.payByLocation.length > 1 ? (
            <div className="jp-glance-block">
              <div className="jp-glance-label">Pay by location</div>
              <ul className="jp-paylist">
                {detail.payByLocation.map((p) => (
                  <li key={p.location}>
                    <span>{p.location}</span>
                    <span className="mono">{payLabel(p.min, p.max, p.period)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Glance({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'good' }) {
  return (
    <div className="jp-glance-block">
      <div className="jp-glance-label">{label}</div>
      <div className={`jp-glance-value${tone ? ` ${tone}` : ''}`}>{value}</div>
    </div>
  );
}

// ── group panel ──────────────────────────────────────────────────────────────
interface GroupMember {
  id: string;
  title: string;
  locations: string[];
  applyUrl: string;
  workMode: string;
  added: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod | null;
  payByLocation: { location: string; min: number; max: number; period: SalaryPeriod }[];
}

// Pay per location across a group's postings: for each location, the span of the posted
// ranges (per pay period) and how many postings list it. A posting that lists its own
// per-city pay lines (Amazon) contributes those; otherwise its single range applies to
// each of its locations. Pure.
export function payByLocation(members: GroupMember[]) {
  const byLoc = new Map<string, { roles: number; min: number | null; max: number | null; period: SalaryPeriod | null }>();
  const add = (rawLoc: string, min: number | null, max: number | null, period: SalaryPeriod | null) => {
    const loc = shortLocation(rawLoc);
    const cur = byLoc.get(loc) ?? { roles: 0, min: null, max: null, period: null };
    cur.roles++;
    if (min != null && max != null && period) {
      // Keep one period per location; annual wins over hourly/monthly.
      if (!cur.period || (cur.period !== 'year' && period === 'year')) {
        cur.period = period;
        cur.min = min;
        cur.max = max;
      } else if (cur.period === period) {
        cur.min = Math.min(cur.min!, min);
        cur.max = Math.max(cur.max!, max);
      }
    }
    byLoc.set(loc, cur);
  };
  for (const m of members) {
    if (m.payByLocation?.length) {
      for (const p of m.payByLocation) add(p.location, p.min, p.max, p.period);
    } else {
      for (const loc of m.locations.length ? m.locations : ['—']) add(loc, m.salaryMin, m.salaryMax, m.salaryPeriod);
    }
  }
  return [...byLoc.entries()]
    .map(([location, v]) => ({ location, ...v }))
    .sort((a, b) => b.roles - a.roles || a.location.localeCompare(b.location));
}

// A role group (e.g. all of Amazon's "Software Development Engineer" reqs): pay by
// location, then every posting with its team, city, pay, and a link.
export function GroupPanel({ row, cooldownUntil }: { row: FeedTableRow; cooldownUntil?: string }) {
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setMembers(null);
    setError(false);
    const q = new URLSearchParams({ company: row.company, base: row.titleBase });
    fetch(`/api/group?${q}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d: { members: GroupMember[] }) => alive && setMembers(d.members))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [row.company, row.titleBase]);

  const pay = payLabel(row.payMin, row.payMax, row.payPeriod);
  const locs = members ? payByLocation(members) : [];

  return (
    <div className="jp">
      <div className="jp-head">
        <Avatar company={row.company} logo={row.logo} size="lg" />
        <div className="jp-co">
          <div className="jp-co-name">
            {row.company} {row.companyTier === 1 ? <span className="badge tier1">T1</span> : null}
          </div>
          <div className="jp-co-sub">{industryLabel(row.industry)}</div>
        </div>
      </div>

      <h2 className="jp-title">{baseTitleDisplay(row.title)}</h2>
      <div className="jp-sub">
        {row.groupSize} open roles
        {row.locationCount > 1 ? ` across ${row.locationCount} locations` : row.topLocations[0] ? ` in ${row.topLocations[0]}` : ''} —
        pick a team below
      </div>

      <div className="jp-chips">
        {pay ? <span className="jp-chip jp-chip-pay">{pay}</span> : null}
        {SENIORITY[row.seniority] ? <span className="jp-chip">{SENIORITY[row.seniority]}</span> : null}
        {row.match != null ? <span className="jp-chip">✦ up to {row.match} skills match</span> : null}
        {cooldownUntil ? (
          <span className="jp-chip jp-chip-warn">⏳ cooldown until {new Date(cooldownUntil).toLocaleDateString()}</span>
        ) : null}
      </div>

      <CompanyTracker company={row.company} />

      {error ? (
        <div className="drawer-muted">Couldn&apos;t load the postings in this group.</div>
      ) : !members ? (
        <div className="drawer-muted">Loading postings…</div>
      ) : (
        <>
          <div className="drawer-section">
            <div className="drawer-label">Pay by location</div>
            <table className="grp-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Pay</th>
                  <th>Roles</th>
                </tr>
              </thead>
              <tbody>
                {locs.map((l) => (
                  <tr key={l.location}>
                    <td>{l.location}</td>
                    <td className="mono">{payLabel(l.min, l.max, l.period) ?? '—'}</td>
                    <td className="mono">{l.roles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="drawer-section">
            <div className="drawer-label">All postings ({members.length})</div>
            <div className="grp-list">
              {members.map((m) => (
                <a key={m.id} className="grp-item" href={m.applyUrl} target="_blank" rel="noopener noreferrer">
                  <div className="grp-item-title">
                    {m.title} <span className="ext">↗</span>
                  </div>
                  <div className="grp-item-meta">
                    <span>{formatLocs(m.locations)}</span>
                    {payLabel(m.salaryMin, m.salaryMax, m.salaryPeriod) ? (
                      <span className="mono">{payLabel(m.salaryMin, m.salaryMax, m.salaryPeriod)}</span>
                    ) : null}
                    <span className="mono">{fmtDate(new Date(m.added))}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// The right panel for a row, whichever kind it is.
export function RowPanel({ row, cooldownUntil }: { row: FeedTableRow; cooldownUntil?: string }) {
  return row.groupSize > 1 ? (
    <GroupPanel row={row} cooldownUntil={cooldownUntil} />
  ) : (
    <JobPanel row={row} cooldownUntil={cooldownUntil} />
  );
}
