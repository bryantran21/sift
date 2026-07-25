'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

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

export function FeedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const update = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      params.delete('page');
      router.replace(params.toString() ? `${pathname}?${params}` : pathname);
    },
    [router, pathname, sp],
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

  const hasFilters = ['q', 'tier', 'tag', 'mode', 'recency'].some((k) => sp.get(k));

  return (
    <div className="toolbar">
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: searchRef.current?.value ?? '' });
        }}
      >
        <span className="ic">⌕</span>
        <input
          ref={searchRef}
          key={sp.get('q') ?? ''}
          type="search"
          defaultValue={sp.get('q') ?? ''}
          placeholder="Search company, title, location  ( / )"
          aria-label="Search"
          autoComplete="off"
        />
      </form>
      <div className="selects">
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
