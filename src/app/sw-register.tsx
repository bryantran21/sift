'use client';

import { useEffect } from 'react';

// Registers the service worker so the app is installable and has an offline shell.
// No-ops where service workers aren't supported (or on http).
export function SwRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (document.readyState === 'complete') onLoad();
    else {
      window.addEventListener('load', onLoad, { once: true });
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);
  return null;
}
