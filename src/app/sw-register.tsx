'use client';

import { useEffect } from 'react';

// Registers the service worker so the app is installable and has an offline shell.
// No-ops where service workers aren't supported (or on http).
export function SwRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // Dev builds serve un-hashed chunk URLs, so the worker's cache-first asset cache would
    // pin stale JS (new server HTML + old client code → hydration errors). Production only;
    // in dev, remove any worker a previous production-mode run left behind.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (document.readyState === 'complete') onLoad();
    else {
      window.addEventListener('load', onLoad, { once: true });
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);
  return null;
}
