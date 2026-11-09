import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SwRegister } from './sw-register';

export const metadata: Metadata = {
  title: 'sift · job radar',
  description: 'Personal job radar — recency-sorted feed of roles worth seeing.',
  applicationName: 'sift',
  manifest: '/manifest.webmanifest',
  // iOS: run standalone (no Safari chrome) when launched from the home screen.
  appleWebApp: {
    capable: true,
    title: 'sift',
    statusBarStyle: 'black-translucent',
  },
  // Legacy iOS standalone flag (Next only emits the modern `mobile-web-app-capable`);
  // older iOS Safari still needs this to launch home-screen apps without browser chrome.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b0c0e' },
    { media: '(prefers-color-scheme: light)', color: '#f5f6f8' },
  ],
  // Fill the notch area so the standalone app looks native edge-to-edge.
  viewportFit: 'cover',
};

// Applies a saved light/dark choice before first paint (no flash of the wrong theme).
// Without one, CSS follows the OS via prefers-color-scheme. See theme-toggle.tsx.
const THEME_SCRIPT = `try{var t=localStorage.getItem('sift_theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
