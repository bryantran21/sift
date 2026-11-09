'use client';

import { useEffect, useState } from 'react';

// Light / dark toggle. With no saved choice the page follows the OS setting (CSS
// prefers-color-scheme); clicking pins an explicit theme in localStorage. The inline
// script in layout.tsx applies a saved choice before first paint, so there's no flash.
export const THEME_KEY = 'sift_theme';

type Theme = 'light' | 'dark';

function resolved(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(resolved()), []);

  const flip = () => {
    const next: Theme = resolved() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode: still flips for this page view */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={flip}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={theme === 'light' ? 'Dark mode' : 'Light mode'}
    >
      {/* Rendered after mount so server and client markup match. */}
      {theme === null ? '' : theme === 'light' ? '☾' : '☀'}
    </button>
  );
}
