import type { MetadataRoute } from 'next';

// Web app manifest (served at /manifest.webmanifest) — makes sift installable to a phone
// home screen as a standalone app. Icons are SVG (modern Android Chrome accepts them);
// iOS uses the file-based apple-icon.png + apple-web-app meta from the root layout.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'sift · job radar',
    short_name: 'sift',
    description: 'Personal job radar — recency-sorted feed of roles worth seeing.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b0c0e',
    theme_color: '#0b0c0e',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
      { src: '/icon-maskable.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'maskable' },
      // PNG fallbacks for launchers that ignore SVG icons (src/app/pwa-icon/[size]).
      { src: '/pwa-icon/192', type: 'image/png', sizes: '192x192', purpose: 'any' },
      { src: '/pwa-icon/512', type: 'image/png', sizes: '512x512', purpose: 'any' },
      { src: '/pwa-icon/maskable-192', type: 'image/png', sizes: '192x192', purpose: 'maskable' },
      { src: '/pwa-icon/maskable-512', type: 'image/png', sizes: '512x512', purpose: 'maskable' },
    ],
  };
}
