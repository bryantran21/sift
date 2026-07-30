'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { monogram } from '../lib/avatar';

const TAGS: [string, string][] = [
  ['', 'All tags'],
  ['quant', 'Quant'],
  ['big-tech', 'Big Tech'],
  ['fortune-500', 'Fortune 500'],
  ['college', 'College'],
];
const TIERS: [string, string][] = [
  ['', 'All tiers'],
  ['1', 'Tier 1'],
  ['2', 'Tier 2'],
  ['3', 'Tier 3'],
];
const MODES: [string, string][] = [
  ['', 'Any mode'],
  ['remote', 'Remote'],
  ['hybrid', 'Hybrid'],
  ['onsite', 'Onsite'],
  ['unknown', 'Unknown'],
];
const RECENCY: [string, string][] = [
  ['', 'Any age'],
  ['green', '< 24h'],
  ['yellow', '< 7 days'],
  ['red', '> 7 days'],
];

export interface CompanyOpt {
  name: string;
  logo: string | null;
}

export function FeedFilters({ companies = [] }: { companies?: CompanyOpt[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  // Read the LIVE URL (not the `sp` snapshot) so rapid successive updates — e.g. a
  // debounced search clear racing an immediate dropdown change — merge onto the
  // latest params instead of clobbering each other with a stale snapshot.
  const update = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      params.delete('page');
      router.replace(params.toString() ? `${pathname}?${params}` : pathname);
    },
    [router, pathname],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Debounced live search: the input drives `q` directly so the visible box always
  // matches the URL. Previously `q` changed only on Enter, so clearing the box left a
  // stale `q` that other filter changes carried along — emptying the feed.
  const [text, setText] = useState(sp.get('q') ?? '');
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlQ = sp.get('q') ?? '';
  useEffect(() => {
    // reflect external `q` changes (e.g. the Clear link) without clobbering typing
    if (document.activeElement !== searchRef.current) setText(urlQ);
  }, [urlQ]);

  const onSearch = (v: string) => {
    setText(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    // Clear immediately so it can't race a subsequent filter change; debounce typing.
    if (v.trim() === '') {
      update({ q: '' });
      return;
    }
    qTimer.current = setTimeout(() => update({ q: v.trim() }), 300);
  };
  const flushSearch = () => {
    if (qTimer.current) clearTimeout(qTimer.current);
    update({ q: text.trim() });
  };

  const hasFilters = ['q', 'tier', 'tag', 'mode', 'recency', 'company'].some((k) => sp.get(k));

  return (
    <div className="toolbar">
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          flushSearch();
        }}
      >
        <span className="ic">⌕</span>
        <input
          ref={searchRef}
          type="search"
          value={text}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search company, title, location  ( / )"
          aria-label="Search"
          autoComplete="off"
        />
      </form>
      <div className="selects">
        <CompanyPicker
          companies={companies}
          value={sp.get('company') ?? ''}
          onChange={(v) => update({ company: v })}
        />
        <Ctrl name="tag" value={sp.get('tag') ?? ''} opts={TAGS} onChange={(v) => update({ tag: v })} />
        <Ctrl name="tier" value={sp.get('tier') ?? ''} opts={TIERS} onChange={(v) => update({ tier: v })} />
        <Ctrl name="mode" value={sp.get('mode') ?? ''} opts={MODES} onChange={(v) => update({ mode: v })} />
        <Ctrl name="recency" value={sp.get('recency') ?? ''} opts={RECENCY} onChange={(v) => update({ recency: v })} />
        {hasFilters ? (
          <a className="clear" href={pathname}>
            Clear
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Ctrl({
  name,
  value,
  opts,
  onChange,
}: {
  name: string;
  value: string;
  opts: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <select className="ctrl" name={name} value={value} onChange={(e) => onChange(e.target.value)} aria-label={name}>
      {opts.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

// Native <select> can't render logos, so this is a custom dropdown: a trigger that
// shows the picked company's logo + name, and a filterable popup of logo rows.
function CompanyPicker({
  companies,
  value,
  onChange,
}: {
  companies: CompanyOpt[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies;
  }, [companies, query]);

  const selected = companies.find((c) => c.name === value) ?? null;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="picker" ref={rootRef}>
      <button
        type="button"
        className="ctrl picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? <Avatar company={selected.name} logo={selected.logo} /> : null}
        <span className="picker-label">{selected ? selected.name : 'All companies'}</span>
        <span className="picker-caret">▾</span>
      </button>
      {open ? (
        <div className="picker-menu" role="listbox">
          <input
            ref={inputRef}
            className="picker-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter companies…"
            aria-label="Filter companies"
          />
          <div className="picker-list">
            <button
              type="button"
              className={`picker-opt${value === '' ? ' sel' : ''}`}
              onClick={() => pick('')}
            >
              <span className="picker-opt-name">All companies</span>
            </button>
            {filtered.map((c) => (
              <button
                type="button"
                key={c.name}
                className={`picker-opt${c.name === value ? ' sel' : ''}`}
                onClick={() => pick(c.name)}
              >
                <Avatar company={c.name} logo={c.logo} />
                <span className="picker-opt-name">{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 ? <div className="picker-empty">No match</div> : null}
          </div>
        </div>
      ) : null}
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
