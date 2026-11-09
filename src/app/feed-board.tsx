'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Avatar,
  DrawerShell,
  MatchBadge,
  RowPanel,
  ageLabel,
  baseTitleDisplay,
  effectiveDate,
  formatLocs,
  payLabel,
  recencyBucket,
  type FeedTableRow,
} from './job-panels';

const MODE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'In person' };
const NARROW = '(max-width: 860px)';

// The default feed view: job cards on the left, the selected job in full on the right
// (like a mail client) — easier to scan and engage with than a dense table. ↑/↓ move
// through the list. On narrow screens a card opens the job in a drawer instead.
export function FeedBoard({
  rows,
  showMatch = false,
  cooldowns = {},
}: {
  rows: FeedTableRow[];
  showMatch?: boolean;
  cooldowns?: Record<string, string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // New page / new filters → select the first result again.
  useEffect(() => {
    setSelectedId((cur) => (cur && rows.some((r) => r.id === cur) ? cur : (rows[0]?.id ?? null)));
  }, [rows]);

  const select = useCallback((id: string, fromKeyboard = false) => {
    setSelectedId(id);
    if (window.matchMedia(NARROW).matches) setDrawerOpen(true);
    if (fromKeyboard) {
      listRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  }, []);

  // ↑/↓ move the selection (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (drawerOpen || !rows.length) return;
      e.preventDefault();
      const i = rows.findIndex((r) => r.id === selectedId);
      const next = rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (next) {
        setSelectedId(next.id);
        listRef.current?.querySelector(`[data-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: 'nearest' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, selectedId, drawerOpen]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  if (!rows.length) return <div className="board-empty">No roles match these filters.</div>;

  return (
    <div className="board">
      <div className="board-list" ref={listRef} role="listbox" aria-label="Jobs">
        {rows.map((r) => (
          <JobCard
            key={r.id}
            r={r}
            active={r.id === selectedId}
            showMatch={showMatch}
            cooldown={!!cooldowns[r.company]}
            onSelect={() => select(r.id)}
          />
        ))}
      </div>

      <section className="board-pane" aria-label="Selected job">
        {selected ? <RowPanel key={selected.id} row={selected} cooldownUntil={cooldowns[selected.company]} /> : null}
      </section>

      {drawerOpen && selected ? (
        <DrawerShell label="Job details" onClose={() => setDrawerOpen(false)}>
          <RowPanel row={selected} cooldownUntil={cooldowns[selected.company]} />
        </DrawerShell>
      ) : null}
    </div>
  );
}

function JobCard({
  r,
  active,
  showMatch,
  cooldown,
  onSelect,
}: {
  r: FeedTableRow;
  active: boolean;
  showMatch: boolean;
  cooldown: boolean;
  onSelect: () => void;
}) {
  const grouped = r.groupSize > 1;
  const added = effectiveDate(r);
  const pay = payLabel(r.payMin, r.payMax, r.payPeriod);
  const where = grouped ? formatLocs(r.topLocations, r.locationCount) : formatLocs(r.locations);
  return (
    <button
      type="button"
      className={`jcard${active ? ' on' : ''}`}
      onClick={onSelect}
      role="option"
      aria-selected={active}
      data-id={r.id}
    >
      <Avatar company={r.company} logo={r.logo} />
      <div className="jcard-main">
        <div className="jcard-title">
          <span className="jcard-title-text">{grouped ? baseTitleDisplay(r.title) : r.title}</span>
          {grouped ? <span className="grp-badge">{r.groupSize} roles</span> : null}
        </div>
        <div className="jcard-co">
          {r.company}
          {r.companyTier === 1 ? <span className="badge tier1">T1</span> : null}
          {cooldown ? (
            <span className="cd-badge" title="You're in a cooldown with this company">
              ⏳
            </span>
          ) : null}
        </div>
        <div className="jcard-loc">
          {where}
          {MODE[r.workMode] ? ` · ${MODE[r.workMode]}` : ''}
        </div>
        <div className="jcard-foot">
          {pay ? <span className="jcard-pay">{pay}</span> : null}
          <span className="jcard-age">
            <span className={`rdot r-${recencyBucket(added)}`} />
            {ageLabel(added)}
          </span>
        </div>
      </div>
      {showMatch ? (
        <div className="jcard-match">
          <MatchBadge n={r.match} />
        </div>
      ) : null}
    </button>
  );
}
