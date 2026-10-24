'use client';

import { useEffect, useState } from 'react';
import { recencyBucket, ageLabel } from '../lib/recency';
import { monogram } from '../lib/avatar';
import { CompanyTracker } from './company-tracker';
import { industryLabel } from '../data/industries';
import { formatSalary, type SalaryPeriod } from '../ingest/salary';
import { baseTitleDisplay } from '../ingest/title-base';
import { shortLocation } from '../lib/short-location';
import type { FeedRow } from '../db/feed';

export type FeedTableRow = FeedRow & { logo: string | null };

interface JobDetail {
  id: string;
  company: string;
  companyTier: number;
  title: string;
  locations: string[];
  workMode: string;
  applyUrl: string;
  ats: string;
  category: string;
  seniority: string;
  description: string;
  skills: string[];
}

export function FeedTable({
  rows,
  showMatch = false,
  cooldowns = {},
}: {
  rows: FeedTableRow[];
  showMatch?: boolean;
  cooldowns?: Record<string, string>;
}) {
  const [selected, setSelected] = useState<FeedTableRow | null>(null);

  return (
    <>
      <table>
        <thead>
          <tr>
            {showMatch ? <th className="th-match">Match</th> : null}
            <th>Company</th>
            <th>Title</th>
            <th>Locations</th>
            <th>Pay</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showMatch ? 6 : 5}>
                <div className="empty">No roles match these filters.</div>
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <Row
                key={r.id}
                r={r}
                showMatch={showMatch}
                cooldownUntil={cooldowns[r.company]}
                onOpen={() => setSelected(r)}
              />
            ))
          )}
        </tbody>
      </table>
      {selected ? (
        selected.groupSize > 1 ? (
          <GroupDrawer row={selected} onClose={() => setSelected(null)} />
        ) : (
          <JobDrawer row={selected} onClose={() => setSelected(null)} />
        )
      ) : null}
    </>
  );
}

function MatchBadge({ n }: { n: number | null }) {
  if (n == null) return <span className="match match-none">—</span>;
  const cls = n >= 5 ? 'match-hi' : n >= 2 ? 'match-mid' : n >= 1 ? 'match-lo' : 'match-none';
  return (
    <span className={`match ${cls}`} title={`${n} of your skills`}>
      {n}
    </span>
  );
}

function Row({
  r,
  showMatch,
  cooldownUntil,
  onOpen,
}: {
  r: FeedTableRow;
  showMatch: boolean;
  cooldownUntil?: string;
  onOpen: () => void;
}) {
  const effective = r.postedAt ? new Date(r.postedAt) : new Date(r.firstSeenAt);
  const bucket = recencyBucket(effective);
  return (
    <tr className="clickrow" onClick={onOpen}>
      {showMatch ? (
        <td className="td-match">
          <MatchBadge n={r.match} />
        </td>
      ) : null}
      <td>
        <div className="co">
          <Avatar company={r.company} logo={r.logo} />
          <div>
            <div className="name">
              {r.company} {r.companyTier === 1 ? <span className="badge tier1">T1</span> : null}
              {cooldownUntil ? (
                <span
                  className="cd-badge"
                  title={`In cooldown until ${new Date(cooldownUntil).toLocaleDateString()}`}
                >
                  ⏳
                </span>
              ) : null}
            </div>
            <div className="slug">
              <span className="ind">{industryLabel(r.industry)}</span>
              <span className="mono"> · {r.ats}</span>
            </div>
          </div>
        </div>
      </td>
      <td>
        {r.groupSize > 1 ? (
          // A group: opens the drawer listing every posting, so no external link here.
          <span className="jtitle" title={`${r.groupSize} postings — click to see all`}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {baseTitleDisplay(r.title)}
            </span>
            <span className="grp-badge">{r.groupSize} roles</span>
          </span>
        ) : (
          <a
            className="jtitle"
            href={r.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={r.title}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
            <span className="ext">↗</span>
          </a>
        )}
      </td>
      <td>
        <div className="locs">
          {r.groupSize > 1 ? formatLocs(r.topLocations, r.locationCount) : formatLocs(r.locations)}
        </div>
      </td>
      <td>
        <span className="pay mono">{payLabel(r.payMin, r.payMax, r.payPeriod) ?? '—'}</span>
      </td>
      <td>
        <span className="added">
          <span className={`rdot r-${bucket}`} />
          <span className="date mono">{fmtDate(effective)}</span>
          <span className="age mono">{ageLabel(effective)}</span>
        </span>
      </td>
    </tr>
  );
}

function JobDrawer({ row, onClose }: { row: FeedTableRow; onClose: () => void }) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    setDetail(null);
    fetch(`/api/job/${encodeURIComponent(row.id)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d: JobDetail) => {
        if (alive) setDetail(d);
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [row.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const skills = detail?.skills ?? [];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Job details">
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="drawer-head">
          <Avatar company={row.company} logo={row.logo} />
          <div>
            <div className="drawer-title">{row.title}</div>
            <div className="drawer-sub">
              {row.company} · {formatLocs(row.locations)}
            </div>
          </div>
        </div>

        <div className="drawer-meta">
          <span className="pill">{industryLabel(row.industry)}</span>
          {payLabel(row.payMin, row.payMax, row.payPeriod) ? (
            <span className="pill pay-pill">{payLabel(row.payMin, row.payMax, row.payPeriod)}</span>
          ) : null}
          {row.seniority && row.seniority !== 'unknown' ? <span className="pill">{row.seniority}</span> : null}
          {row.category && row.category !== 'other' ? <span className="pill">{row.category}</span> : null}
          {row.workMode && row.workMode !== 'unknown' ? <span className="pill">{row.workMode}</span> : null}
        </div>

        <CompanyTracker company={row.company} />

        {skills.length > 0 ? (
          <div className="drawer-section">
            <div className="drawer-label">Skills &amp; technologies</div>
            <div className="chips">
              {skills.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="drawer-section">
          <div className="drawer-label">Description</div>
          {loading ? (
            <div className="drawer-muted">Loading…</div>
          ) : error ? (
            <div className="drawer-muted">Couldn&apos;t load the description. Open it on the source site below.</div>
          ) : detail && detail.description.trim() ? (
            <div className="jd">{detail.description}</div>
          ) : (
            <div className="drawer-muted">No description available — view the full posting on the source site.</div>
          )}
        </div>

        <a className="drawer-apply" href={row.applyUrl} target="_blank" rel="noopener noreferrer">
          Open on {row.ats} ↗
        </a>
      </aside>
    </div>
  );
}

function Avatar({ company, logo }: { company: string; logo: string | null }) {
  if (logo) return <img className="ico" src={logo} alt="" />;
  const { ch, hue } = monogram(company);
  return (
    <span className="ico mono-ico" style={{ background: `hsl(${hue},36%,42%)` }}>
      {ch}
    </span>
  );
}

// "Seattle, WA · Redmond, WA +19" — spellings unified and de-duplicated.
function formatLocs(raw: string[], total?: number): string {
  if (!raw || raw.length === 0) return '—';
  const locations = [...new Set(raw.map(shortLocation))];
  const n = total ?? locations.length;
  if (n <= 2) return locations.slice(0, 2).join(' · ');
  return `${locations.slice(0, 2).join(' · ')} +${n - 2}`;
}

function payLabel(min: number | null, max: number | null, period: SalaryPeriod | null): string | null {
  if (min == null || max == null || !period) return null;
  return formatSalary({ min, max, period });
}

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

// The expanded view of a group: pay by location, then every posting with its team, city,
// pay, and a link — e.g. all of Amazon's "Software Development Engineer" reqs in one place.
function GroupDrawer({ row, onClose }: { row: FeedTableRow; onClose: () => void }) {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pay = payLabel(row.payMin, row.payMax, row.payPeriod);
  const locs = members ? payByLocation(members) : [];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Role group">
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="drawer-head">
          <Avatar company={row.company} logo={row.logo} />
          <div>
            <div className="drawer-title">{baseTitleDisplay(row.title)}</div>
            <div className="drawer-sub">
              {row.company} · {row.groupSize} roles · {row.locationCount} locations
            </div>
          </div>
        </div>

        <div className="drawer-meta">
          <span className="pill">{industryLabel(row.industry)}</span>
          {pay ? <span className="pill pay-pill">{pay}</span> : null}
          {row.seniority && row.seniority !== 'unknown' ? <span className="pill">{row.seniority}</span> : null}
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
      </aside>
    </div>
  );
}

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}
