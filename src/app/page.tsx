import { getFeed, getFeedMeta, getCompanies, PAGE_SIZE, type FeedRow, type FeedParams } from '../db/feed';
import { logoFor } from '../lib/logos';
import { monogram } from '../lib/avatar';
import { recencyBucket, ageLabel } from '../lib/recency';
import type { Seniority, WorkMode } from '../types';
import { FeedFilters } from './feed-filters';

export const dynamic = 'force-dynamic';

const WORK_MODES: WorkMode[] = ['remote', 'hybrid', 'onsite', 'unknown'];
const SENIORITIES: Seniority[] = ['intern', 'new-grad', 'mid', 'senior', 'staff+'];

type SP = Record<string, string | string[] | undefined>;

function parse(sp: SP): FeedParams {
  const g = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const tier = Number(g('tier'));
  const mode = g('mode');
  const rec = g('recency');
  const level = g('level');
  return {
    q: g('q')?.trim() || undefined,
    tier: tier === 1 || tier === 2 || tier === 3 ? tier : undefined,
    mode: WORK_MODES.includes(mode as WorkMode) ? (mode as WorkMode) : undefined,
    tag: g('tag') || undefined,
    recency: rec === 'green' || rec === 'yellow' || rec === 'red' ? rec : undefined,
    seniority: SENIORITIES.includes(level as Seniority) ? level : undefined,
    company: g('company')?.trim() || undefined,
    page: Math.max(1, Number(g('page')) || 1),
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const params = parse(sp);
  const [meta, feed, companyNames] = await Promise.all([getFeedMeta(), getFeed(params), getCompanies()]);
  const companies = companyNames.map((name) => ({ name, logo: logoFor(name) }));

  const totalPages = Math.max(1, Math.ceil(feed.total / PAGE_SIZE));
  const healthWarn = meta.sourcesOk < meta.sourcesTotal;

  return (
    <main className="wrap">
      <header className="masthead">
        <div className="brand">
          <span className="mark">sift</span>
          <span className="tag">job radar</span>
        </div>
        <div className="metrics">
          <div className="metric">
            <span className="v mono">{meta.liveJobs.toLocaleString()}</span>
            <span className="k">live roles</span>
          </div>
          <div className="metric">
            <span className="v mono">{meta.addedToday.toLocaleString()}</span>
            <span className="k">added today</span>
          </div>
          <div className="metric">
            <span className={`v health${healthWarn ? ' warn' : ''}`}>
              <span className="dot" />
              {meta.sourcesOk} of {meta.sourcesTotal}
            </span>
            <span className="k">sources healthy</span>
          </div>
          <div className="metric">
            <span className="v" style={{ fontSize: 14 }}>{relTime(meta.lastSync)}</span>
            <span className="k">last sync</span>
          </div>
        </div>
      </header>

      <FeedFilters companies={companies} />

      <div className="tablewrap">
        <div className="scroll">
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
              {feed.rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty">No roles match these filters.</div>
                  </td>
                </tr>
              ) : (
                feed.rows.map((r) => <Row key={r.id} r={r} />)
              )}
            </tbody>
          </table>
        </div>
        <div className="showing">
          <span>
            Showing {feed.rows.length ? (params.page! - 1) * PAGE_SIZE + 1 : 0}–
            {(params.page! - 1) * PAGE_SIZE + feed.rows.length} of {feed.total.toLocaleString()} · sorted newest first
          </span>
          <Pager sp={sp} page={params.page!} totalPages={totalPages} />
        </div>
      </div>
    </main>
  );
}

function Row({ r }: { r: FeedRow }) {
  const effective = r.postedAt ?? r.firstSeenAt;
  const bucket = recencyBucket(effective);
  return (
    <tr>
      <td>
        <div className="co">
          <Icon company={r.company} />
          <div>
            <div className="name">
              {r.company} {r.companyTier === 1 ? <span className="badge tier1">T1</span> : null}
            </div>
            <div className="slug mono">{r.ats}</div>
          </div>
        </div>
      </td>
      <td>
        <a className="jtitle" href={r.applyUrl} target="_blank" rel="noopener noreferrer" title={r.title}>
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

function Icon({ company }: { company: string }) {
  const logo = logoFor(company);
  if (logo) return <img className="ico" src={logo} alt="" />;
  const { ch, hue } = monogram(company);
  return (
    <span className="ico mono-ico" style={{ background: `hsl(${hue},36%,42%)` }}>
      {ch}
    </span>
  );
}

function Pager({ sp, page, totalPages }: { sp: SP; page: number; totalPages: number }) {
  const href = (n: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === 'string' && k !== 'page') params.set(k, v);
    }
    params.set('page', String(n));
    return `/?${params}`;
  };
  return (
    <div className="pager">
      {page > 1 ? <a href={href(page - 1)}>‹ Prev</a> : <span className="disabled">‹ Prev</span>}
      <span>
        {page} / {totalPages}
      </span>
      {page < totalPages ? <a href={href(page + 1)}>Next ›</a> : <span className="disabled">Next ›</span>}
    </div>
  );
}

function formatLocs(locations: string[]): string {
  if (!locations || locations.length === 0) return '—';
  if (locations.length <= 2) return locations.join(' · ');
  return `${locations.slice(0, 2).join(' · ')} +${locations.length - 2}`;
}

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 10);
}

function relTime(d: Date | null): string {
  if (!d) return 'never';
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
