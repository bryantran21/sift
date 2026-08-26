'use client';

import { useEffect, useState } from 'react';
import { extractSkills } from '../../scoring/skills';

interface CompanyFit {
  company: string;
  score: number;
  roleCount: number;
  matched: string[];
  gaps: string[];
}

const KEY = 'sift.resumeSkills';

export default function FitPage() {
  const [resume, setResume] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [fits, setFits] = useState<CompanyFit[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Restore a previously-analyzed skill set (résumé itself never leaves the browser).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const arr = JSON.parse(saved) as string[];
        if (Array.isArray(arr) && arr.length) {
          setSkills(arr);
          void score(arr);
        }
      }
    } catch {
      /* localStorage unavailable — fine */
    }
  }, []);

  const score = async (sk: string[]) => {
    setLoading(true);
    try {
      const res = await fetch('/api/fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: sk }),
      });
      const data = await res.json();
      setFits(data.fits ?? []);
    } catch {
      setFits([]);
    } finally {
      setLoading(false);
    }
  };

  const analyze = () => {
    const sk = extractSkills(resume);
    setSkills(sk);
    try {
      localStorage.setItem(KEY, JSON.stringify(sk));
    } catch {
      /* ignore */
    }
    void score(sk);
  };

  const clear = () => {
    setResume('');
    setSkills([]);
    setFits(null);
    try {
      localStorage.removeItem(KEY);
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
        Paste your résumé. sift extracts your skills <strong>in your browser</strong> (the
        text never leaves this page) and ranks companies by how well you match their live roles.
      </p>

      <textarea
        className="fit-input"
        value={resume}
        onChange={(e) => setResume(e.target.value)}
        placeholder="Paste your résumé text here…"
        rows={8}
        aria-label="Résumé text"
      />
      <div className="fit-actions">
        <button className="fit-btn" onClick={analyze} disabled={!resume.trim()}>
          Analyze fit
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
