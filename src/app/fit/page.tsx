'use client';

import { useEffect, useRef, useState } from 'react';
import { extractSkills } from '../../scoring/skills';

interface CompanyFit {
  company: string;
  score: number;
  roleCount: number;
  matched: string[];
  gaps: string[];
}

export default function FitPage() {
  const [resume, setResume] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [fits, setFits] = useState<CompanyFit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Restore the résumé skills saved for this device (server-side, durable).
  useEffect(() => {
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
  }, []);

  const score = async (sk: string[]) => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const persistAndScore = async (sk: string[]) => {
    setSkills(sk);
    try {
      await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: sk }),
      });
    } catch {
      /* score anyway */
    }
    void score(sk);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      alert('Please drop a PDF résumé (or paste the text below).');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/resume', { method: 'POST', body: fd });
      if (!res.ok) {
        alert('Could not read that PDF — paste the text instead.');
        return;
      }
      const data = await res.json();
      const sk: string[] = data.skills ?? [];
      setSkills(sk);
      void score(sk);
    } finally {
      setUploading(false);
    }
  };

  const clear = async () => {
    setResume('');
    setSkills([]);
    setFits(null);
    try {
      await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: [] }),
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="wrap">
      <header className="masthead">
        <div className="brand">
          <span className="mark">sift</span>
          <span className="tag">fit finder</span>
        </div>
        <a className="clear" href="/">
          ← back to feed
        </a>
      </header>

      <p className="fit-intro">
        Drop in your résumé (PDF) or paste the text. sift extracts your skills and ranks companies
        by how well you match their live roles. We keep only the skills, never the file.
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
        {uploading ? 'Reading your résumé…' : '📄 Drop your résumé PDF here, or click to choose'}
      </div>

      <div className="fit-or">or paste text</div>

      <textarea
        className="fit-input"
        value={resume}
        onChange={(e) => setResume(e.target.value)}
        placeholder="Paste your résumé text here…"
        rows={6}
        aria-label="Résumé text"
      />
      <div className="fit-actions">
        <button className="fit-btn" onClick={() => persistAndScore(extractSkills(resume))} disabled={!resume.trim()}>
          Analyze paste
        </button>
        {skills.length > 0 ? (
          <button className="fit-btn ghost" onClick={clear}>
            Clear
          </button>
        ) : null}
      </div>

      {skills.length > 0 ? (
        <div className="fit-section">
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

      {loading ? <div className="drawer-muted">Scoring…</div> : null}

      {fits && !loading ? (
        fits.length === 0 ? (
          <div className="drawer-muted">No matches yet — add more detail (technologies, tools) to your résumé.</div>
        ) : (
          <div className="fit-section">
            <div className="drawer-label">Companies ranked for you</div>
            <div className="fit-list">
              {fits.map((f) => (
                <a key={f.company} className="fit-row" href={`/?company=${encodeURIComponent(f.company)}`}>
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
    </main>
  );
}

function scoreColor(n: number): string {
  return n >= 70 ? 'var(--green)' : n >= 45 ? 'var(--amber)' : 'var(--faint)';
}
