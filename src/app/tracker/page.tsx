'use client';

import { useEffect, useState } from 'react';

interface TrackedEvent {
  id: number;
  company: string;
  type: string;
  eventAt: string;
}
interface CooldownStatus {
  company: string;
  endsAt: string;
  active: boolean;
  months: number;
  basisType: string;
  basisDate: string;
  approx: boolean;
}

export default function TrackerPage() {
  const [events, setEvents] = useState<TrackedEvent[]>([]);
  const [cooldowns, setCooldowns] = useState<CooldownStatus[]>([]);
  const [loaded, setLoaded] = useState(false);

  const apply = (d: { events?: TrackedEvent[]; cooldowns?: CooldownStatus[] }) => {
    setEvents(d.events ?? []);
    setCooldowns(d.cooldowns ?? []);
    setLoaded(true);
  };

  useEffect(() => {
    fetch('/api/track')
      .then((r) => r.json())
      .then(apply)
      .catch(() => setLoaded(true));
  }, []);

  const remove = async (id: number) => {
    const d = await fetch(`/api/track?id=${id}`, { method: 'DELETE' }).then((r) => r.json());
    apply(d);
  };

  const byCompany = new Map<string, TrackedEvent[]>();
  for (const e of events) {
    const arr = byCompany.get(e.company) ?? [];
    arr.push(e);
    byCompany.set(e.company, arr);
  }

  return (
    <main className="wrap">
      <header className="masthead">
        <div className="brand">
          <span className="mark">sift</span>
          <span className="tag">application tracker</span>
        </div>
        <a className="clear" href="/">
          ← back to feed
        </a>
      </header>

      <p className="fit-intro">
        Log where you are with each company — I estimate when a cooldown lets you reapply. Add
        events from any job&apos;s panel on the feed. Cooldowns start from your rejection / last
        interview; big-tech numbers are grounded, everything else is an approximate default.
      </p>

      {loaded && cooldowns.length > 0 ? (
        <div className="fit-section">
          <div className="drawer-label">Cooldowns</div>
          <div className="fit-list">
            {cooldowns.map((c) => (
              <a key={c.company} className="fit-row" href={`/?company=${encodeURIComponent(c.company)}`}>
                <div className="fit-score" style={{ color: c.active ? 'var(--amber)' : 'var(--green)', fontSize: 20 }}>
                  {c.active ? '⏳' : '✓'}
                </div>
                <div className="fit-main">
                  <div className="fit-co">{c.company}</div>
                  <div className={c.active ? 'fit-gaps' : 'fit-matched'}>
                    {c.active
                      ? `In cooldown until ${fmtDate(c.endsAt)} · ~${c.months}mo from your ${labelFor(
                          c.basisType,
                        )} on ${fmtDate(c.basisDate)}${c.approx ? ' (approx)' : ''}`
                      : `Eligible again — cooldown ended ${fmtDate(c.endsAt)}`}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {loaded && byCompany.size > 0 ? (
        <div className="fit-section">
          <div className="drawer-label">Logged events</div>
          <div className="fit-list">
            {[...byCompany.entries()].map(([company, evs]) => (
              <div key={company} className="fit-row" style={{ display: 'block' }}>
                <div className="fit-co">{company}</div>
                <div className="track-events">
                  {evs.map((e) => (
                    <div key={e.id} className="track-ev">
                      <span>
                        {labelFor(e.type)} · {fmtDate(e.eventAt)}
                      </span>
                      <button className="rb-link" onClick={() => void remove(e.id)} aria-label="Remove">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : loaded ? (
        <div className="drawer-muted">
          Nothing tracked yet. Open a job on the feed and use its “Application tracker” to log an
          OA, interview, or rejection.
        </div>
      ) : null}
    </main>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function labelFor(t: string): string {
  return (
    ({ applied: 'application', oa: 'OA', interview: 'interview', rejected: 'rejection', offer: 'offer' } as Record<
      string,
      string
    >)[t] ?? t
  );
}
