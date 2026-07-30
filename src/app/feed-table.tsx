'use client';

import { useEffect, useState } from 'react';
import { recencyBucket, ageLabel } from '../lib/recency';
import { monogram } from '../lib/avatar';
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

export function FeedTable({ rows }: { rows: FeedTableRow[] }) {
  const [selected, setSelected] = useState<FeedTableRow | null>(null);

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Title</th>
            <th>Locations</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <div className="empty">No roles match these filters.</div>
              </td>
            </tr>
          ) : (
            rows.map((r) => <Row key={r.id} r={r} onOpen={() => setSelected(r)} />)
          )}
        </tbody>
      </table>
      {selected ? <JobDrawer row={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function Row({ r, onOpen }: { r: FeedTableRow; onOpen: () => void }) {
  const effective = r.postedAt ? new Date(r.postedAt) : new Date(r.firstSeenAt);
  const bucket = recencyBucket(effective);
  return (
    <tr className="clickrow" onClick={onOpen}>
      <td>
        <div className="co">
          <Avatar company={r.company} logo={r.logo} />
          <div>
            <div className="name">
              {r.company} {r.companyTier === 1 ? <span className="badge tier1">T1</span> : null}
            </div>
            <div className="slug mono">{r.ats}</div>
          </div>
        </div>
      </td>
      <td>
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
      </td>
      <td>
        <div className="locs">{formatLocs(r.locations)}</div>
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
          {row.seniority && row.seniority !== 'unknown' ? <span className="pill">{row.seniority}</span> : null}
          {row.category && row.category !== 'other' ? <span className="pill">{row.category}</span> : null}
          {row.workMode && row.workMode !== 'unknown' ? <span className="pill">{row.workMode}</span> : null}
        </div>

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

function formatLocs(locations: string[]): string {
  if (!locations || locations.length === 0) return '—';
  if (locations.length <= 2) return locations.join(' · ');
  return `${locations.slice(0, 2).join(' · ')} +${locations.length - 2}`;
}

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}
