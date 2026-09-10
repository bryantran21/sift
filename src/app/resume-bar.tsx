'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { extractSkills } from '../scoring/skills';

interface CompanyFit {
  company: string;
  score: number;
  roleCount: number;
  matched: string[];
  gaps: string[];
}

// Résumé + fit finder. The row on the feed shows status + the match sort/filter toggles;
// the ✦ button (and the masthead link, via ?fit=1) opens a modal that reads a résumé,
// extracts skills (stored server-side per device), auto-sorts the feed by match, and ranks
// companies by how well you fit their live roles.
export function ResumeBar({
  skillCount,
  sortByMatch,
  matchesOnly,
}: {
  skillCount: number;
  sortByMatch: boolean;
  matchesOnly: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [fits, setFits] = useState<CompanyFit[] | null>(null);
  const [resume, setResume] = useState('');
  const [busy, setBusy] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [justApplied, setJustApplied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Open when arriving with ?fit=1 (masthead link / deep link).
  const fitParam = sp.get('fit');
  useEffect(() => {
    if (fitParam === '1') setOpen(true);
  }, [fitParam]);

  const setParams = (patch: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete('page');
    router.replace(params.toString() ? `${pathname}?${params}` : pathname);
  };

  const close = () => {
    setOpen(false);
    setResume('');
    if (sp.get('fit')) setParams({ fit: '' });
  };

  // Load the ranked-companies list for a skill set.
  const score = async (sk: string[]) => {
    setScoring(true);
    try {
      const data = await fetch('/api/fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: sk }),
      }).then((r) => r.json());
      setFits(data.fits ?? []);
    } catch {
      setFits([]);
    } finally {
      setScoring(false);
    }
  };

  // When the modal opens, pull whatever skills are already saved for this device so the
  // ranking shows without re-uploading.
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const data = await fetch('/api/resume').then((r) => r.json());
        if (Array.isArray(data.skills) && data.skills.length) {
          setSkills(data.skills);
          void score(data.skills);
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Everything funnels here: persist skills, sort the feed by match, refresh grades, rank.
  const applySkills = (sk: string[]) => {
    setSkills(sk);
    setJustApplied(true);
    setParams({ sort: 'match', fit: sp.get('fit') ? '1' : '' });
    router.refresh(); // server recomputes the Match column with the new résumé
    void score(sk);
  };

  const savePaste = async () => {
    setBusy(true);
    try {
      const data = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: extractSkills(resume) }),
      }).then((r) => r.json());
      setResume('');
      applySkills(data.skills ?? []);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      alert('Please drop a PDF résumé (or paste the text).');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/resume', { method: 'POST', body: fd });
      if (!res.ok) {
        alert('Could not read that PDF — paste the text instead.');
        return;
      }
      const data = await res.json();
      applySkills(data.skills ?? []);
    } finally {
      setBusy(false);
    }
  };

  const clearResume = async () => {
    await fetch('/api/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: [] }),
    });
    setSkills([]);
    setFits(null);
    setJustApplied(false);
    setParams({ sort: '', minmatch: '', fit: sp.get('fit') ? '1' : '' });
    router.refresh();
  };

  const modal = open ? (
    <div className="fit-modal-backdrop" onClick={close}>
      <div className="fit-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Fit finder">
        <button className="drawer-close" onClick={close} aria-label="Close">
          ✕
        </button>
        <div className="fit-modal-title">✦ Fit finder</div>
        <p className="fit-intro" style={{ margin: '10px 0 16px' }}>
          Drop in your résumé (PDF) or paste the text. sift extracts your skills, grades every job,
          and ranks companies by how well you match their live roles. Only your skills are stored —
          never the file.
        </p>

        <div
          className={`fit-drop${dragOver ? ' over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void onFile(e.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0] ?? undefined)}
          />
          {busy ? 'Reading…' : '📄 Drop your résumé PDF here, or click to choose'}
        </div>

        <div className="fit-or">or paste text</div>

        <textarea
          className="fit-input"
          rows={5}
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          placeholder="Paste your résumé text here…"
          aria-label="Résumé text"
        />
        <div className="fit-actions">
          <button className="fit-btn" onClick={savePaste} disabled={busy || !resume.trim()}>
            Analyze paste
          </button>
          {skills.length > 0 ? (
            <button className="fit-btn ghost" onClick={clearResume}>
              Clear résumé
            </button>
          ) : null}
        </div>

        {justApplied && skills.length > 0 ? (
          <div className="fit-applied">✓ Feed sorted by best match — grading every job against your {skills.length} skills.</div>
        ) : null}

        {skills.length > 0 ? (
          <div className="fit-section" style={{ marginTop: 18 }}>
            <div className="drawer-label">Your skills ({skills.length})</div>
            <div className="chips">
              {skills.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {scoring ? <div className="drawer-muted" style={{ marginTop: 16 }}>Scoring…</div> : null}

        {fits && !scoring ? (
          fits.length === 0 ? (
            <div className="drawer-muted" style={{ marginTop: 16 }}>
              No matches yet — add more detail (technologies, tools) to your résumé.
            </div>
          ) : (
            <div className="fit-section">
              <div className="drawer-label">Companies ranked for you</div>
              <div className="fit-list">
                {fits.map((f) => (
                  <a
                    key={f.company}
                    className="fit-row"
                    href={`/?company=${encodeURIComponent(f.company)}`}
                    onClick={close}
                  >
                    <div className="fit-score" style={{ color: scoreColor(f.score) }}>
                      {f.score}
                    </div>
                    <div className="fit-main">
                      <div className="fit-co">
                        {f.company} <span className="fit-roles">· {f.roleCount} live roles</span>
                      </div>
                      {f.matched.length ? <div className="fit-matched">✓ {f.matched.join(' · ')}</div> : null}
                      {f.gaps.length ? <div className="fit-gaps">gaps: {f.gaps.join(' · ')}</div> : null}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  ) : null;

  if (skillCount === 0) {
    return (
      <div className="resumebar">
        <button className="rb-cta" onClick={() => setOpen(true)}>
          ✦ Add your résumé to grade every job for fit
        </button>
        {modal}
      </div>
    );
  }

  return (
    <div className="resumebar">
      <div className="rb-head">
        <span className="rb-status">✦ Grading against {skillCount} skills</span>
        <div className="rb-controls">
          <button
            className={`rb-toggle${sortByMatch ? ' on' : ''}`}
            onClick={() => setParams({ sort: sortByMatch ? '' : 'match' })}
          >
            Best match
          </button>
          <button
            className={`rb-toggle${matchesOnly ? ' on' : ''}`}
            onClick={() => setParams({ minmatch: matchesOnly ? '' : '1' })}
          >
            Matches only
          </button>
          <button className="rb-link" onClick={() => setOpen(true)}>
            edit
          </button>
          <button className="rb-link" onClick={clearResume}>
            clear
          </button>
        </div>
      </div>
      {modal}
    </div>
  );
}

function scoreColor(n: number): string {
  return n >= 70 ? 'var(--green)' : n >= 45 ? 'var(--amber)' : 'var(--faint)';
}
