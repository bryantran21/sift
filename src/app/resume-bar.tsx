'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { extractSkills } from '../scoring/skills';

// Résumé input on the feed: add/edit/clear your résumé (stored server-side per device),
// and toggle the match-based sort + "matches only" filter. When a résumé is set, the feed
// grades every job (the Match column) and these controls become useful.
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
  const [resume, setResume] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setParams = (patch: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete('page');
    router.replace(params.toString() ? `${pathname}?${params}` : pathname);
  };

  const done = () => {
    setBusy(false);
    setOpen(false);
    setResume('');
    router.refresh(); // server recomputes grades with the new résumé
  };

  const savePaste = async () => {
    setBusy(true);
    try {
      await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: extractSkills(resume) }),
      });
    } finally {
      done();
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
      if (!res.ok) alert('Could not read that PDF — paste the text instead.');
    } finally {
      done();
    }
  };

  const clearResume = async () => {
    await fetch('/api/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: [] }),
    });
    setParams({ sort: '', minmatch: '' });
    router.refresh();
  };

  const editor = (
    <div className="rb-editor">
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
        {busy ? 'Reading…' : '📄 Drop your résumé PDF, or click to choose'}
      </div>
      <textarea
        className="fit-input"
        rows={4}
        value={resume}
        onChange={(e) => setResume(e.target.value)}
        placeholder="…or paste your résumé text"
        aria-label="Résumé text"
      />
      <div className="fit-actions">
        <button className="fit-btn" onClick={savePaste} disabled={busy || !resume.trim()}>
          Save paste
        </button>
        <button className="fit-btn ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <div className="rb-note">Only your extracted skills are stored — never the file.</div>
    </div>
  );

  if (skillCount === 0) {
    return (
      <div className="resumebar">
        {open ? (
          editor
        ) : (
          <button className="rb-cta" onClick={() => setOpen(true)}>
            ✦ Add your résumé to grade every job for fit
          </button>
        )}
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
          <button className="rb-link" onClick={() => setOpen((o) => !o)}>
            edit
          </button>
          <button className="rb-link" onClick={clearResume}>
            clear
          </button>
        </div>
      </div>
      {open ? editor : null}
    </div>
  );
}
