'use client';

import { useState } from 'react';
import {
  Avatar,
  DrawerShell,
  MatchBadge,
  RowPanel,
  ageLabel,
  baseTitleDisplay,
  effectiveDate,
  fmtDate,
  formatLocs,
  industryLabel,
  payLabel,
  recencyBucket,
  type FeedTableRow,
} from './job-panels';

export type { FeedTableRow };

// The dense table view (?view=table). The board (feed-board.tsx) is the default.
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
        <DrawerShell label="Job details" onClose={() => setSelected(null)}>
          <RowPanel row={selected} cooldownUntil={cooldowns[selected.company]} />
        </DrawerShell>
      ) : null}
    </>
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
  const effective = effectiveDate(r);
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
              {r.company}
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
