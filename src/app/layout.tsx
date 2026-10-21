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
  themeColor: '#0b0c0e',
  // Fill the notch area so the standalone app looks native edge-to-edge.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
