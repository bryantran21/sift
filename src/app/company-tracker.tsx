'use client';

import { useEffect, useState } from 'react';

interface TrackedEvent {
  id: number;
  company: string;
  type: string;
  eventAt: string;
  notes: string | null;
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

const TYPES: [string, string][] = [
  ['applied', 'Applied'],
  ['oa', 'OA / screen'],
  ['interview', 'Interview'],
  ['rejected', 'Rejected'],
  ['offer', 'Offer'],
];

export function CompanyTracker({ company }: { company: string }) {
  const [events, setEvents] = useState<TrackedEvent[]>([]);
  const [cooldowns, setCooldowns] = useState<CooldownStatus[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const apply = (d: { events?: TrackedEvent[]; cooldowns?: CooldownStatus[] }) => {
    setEvents(d.events ?? []);
    setCooldowns(d.cooldowns ?? []);
  };

  useEffect(() => {
    fetch('/api/track')
      .then((r) => r.json())
      .then(apply)
      .catch(() => {});
  }, []);

  const myEvents = events.filter((e) => e.company === company);
  const cd = cooldowns.find((c) => c.company === company);

  const log = async (type: string) => {
    setBusy(true);
    try {
      const d = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, type, eventAt: new Date(date + 'T12:00:00').toISOString() }),
      }).then((r) => r.json());
      apply(d);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    const d = await fetch(`/api/track?id=${id}`, { method: 'DELETE' }).then((r) => r.json());
    apply(d);
  };

  return (
    <div className="drawer-section">
      <div className="drawer-label">Application tracker</div>

      {cd && cd.active ? (
        <div className="cd-warn">
          ⚠️ In cooldown until <strong>{fmtDate(cd.endsAt)}</strong> — about {cd.months} months from your{' '}
          {labelFor(cd.basisType)} on {fmtDate(cd.basisDate)}
          {cd.approx ? ' (approx — no confirmed policy for this company)' : ''}.
        </div>
      ) : cd && !cd.active ? (
        <div className="cd-ok">✓ Cooldown ended {fmtDate(cd.endsAt)} — you should be eligible again.</div>
      ) : null}

      <div className="track-log">
        <input
          type="date"
          className="track-date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Event date"
        />
        {TYPES.map(([t, lbl]) => (
          <button key={t} className="track-btn" disabled={busy} onClick={() => void log(t)}>
            {lbl}
          </button>
        ))}
      </div>

      {myEvents.length ? (
        <div className="track-events">
          {myEvents.map((e) => (
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
      ) : (
        <div className="rb-note">Log where you are with {company} — I&apos;ll estimate when you can reapply.</div>
      )}
    </div>
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
