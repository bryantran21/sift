'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { monogram } from '../lib/avatar';

// The company watchlist is stored locally (per browser) so a curated set of companies
// sticks across visits without an account. It's mirrored into the `companies` URL param
// so the server filters across the whole feed (not just the current page).
const WATCHLIST_KEY = 'sift_watchlist';

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function saveWatchlist(list: string[]): void {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch {
    /* ignore (private mode / disabled storage) */
  }
}

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
const LEVELS: [string, string][] = [
  ['', 'Any level'],
  ['intern', 'Intern'],
  ['new-grad', 'New Grad'],
  ['mid', 'Mid'],
  ['senior', 'Senior'],
  ['staff+', 'Staff+'],
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

  // The active company scope = the multi-select watchlist (`companies`) plus any single
  // `company` deep link (from the fit modal / tracker).
  const selectedCompanies = useMemo(() => {
    const multi = (sp.get('companies') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const single = sp.get('company')?.trim();
    return [...new Set([...multi, ...(single ? [single] : [])])];
  }, [sp]);

  const setCompanies = useCallback(
    (next: string[]) => {
      saveWatchlist(next);
      update({ companies: next.join(','), company: '' });
    },
    [update],
  );

  // On first load, re-apply the saved watchlist if the URL isn't already company-scoped.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('companies') || params.get('company')) return;
    const saved = loadWatchlist();
    if (saved.length) update({ companies: saved.join(',') });
  }, [update]);

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

  const hasFilters = ['q', 'level', 'tier', 'tag', 'mode', 'recency', 'company', 'companies'].some((k) =>
    sp.get(k),
  );

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
        <CompanyChecklist companies={companies} selected={selectedCompanies} onChange={setCompanies} />
        <Ctrl name="level" value={sp.get('level') ?? ''} opts={LEVELS} onChange={(v) => update({ level: v })} />
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

// A multi-select company watchlist: tick the companies you want and the feed narrows to
// just those (server-side, across all pages). Native <select> can't do logos + checkboxes,
// so this is a custom popup. Selection is mirrored to localStorage by the parent.
function CompanyChecklist({
  companies,
  selected,
  onChange,
}: {
  companies: CompanyOpt[];
  selected: string[];
  onChange: (next: string[]) => void;
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

  const selSet = useMemo(() => new Set(selected), [selected]);

  // Selected companies float to the top of the list so your set is easy to review.
  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies;
    return [...list].sort((a, b) => {
      const as = selSet.has(a.name) ? 0 : 1;
      const bs = selSet.has(b.name) ? 0 : 1;
      return as - bs || a.name.localeCompare(b.name);
    });
  }, [companies, query, selSet]);

  const toggle = (name: string) => {
    onChange(selSet.has(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  };

  const count = selected.length;
  const label = count === 0 ? 'All companies' : count === 1 ? selected[0] : `${count} companies`;

  return (
    <div className="picker" ref={rootRef}>
      <button
        type="button"
        className="ctrl picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {count > 0 ? <span className="picker-count">{count}</span> : null}
        <span className="picker-label">{label}</span>
        <span className="picker-caret">▾</span>
      </button>
      {open ? (
        <div className="picker-menu" role="listbox" aria-multiselectable="true">
          <input
            ref={inputRef}
            className="picker-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter companies…"
            aria-label="Filter companies"
          />
          <div className="picker-foot">
            <span className="picker-foot-count">{count > 0 ? `${count} selected` : 'Showing all'}</span>
            {count > 0 ? (
              <button type="button" className="picker-foot-btn" onClick={() => onChange([])}>
                Clear
              </button>
            ) : null}
          </div>
          <div className="picker-list">
            {ordered.map((c) => {
              const on = selSet.has(c.name);
              return (
                <button
                  type="button"
                  key={c.name}
                  className={`picker-opt${on ? ' sel' : ''}`}
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(c.name)}
                >
                  <span className={`picker-check${on ? ' on' : ''}`}>{on ? '✓' : ''}</span>
                  <Avatar company={c.name} logo={c.logo} />
                  <span className="picker-opt-name">{c.name}</span>
                </button>
              );
            })}
            {ordered.length === 0 ? <div className="picker-empty">No match</div> : null}
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
