/**
 * Root layout — Doc 01 §5.2, Doc 02 §6.5, PRD v2 §Security & Privacy.
 *
 * Fonts are self-hosted via `next/font`: NO Google Fonts network request at
 * runtime, which would also break `connect-src 'self'`.
 *
 * Robots: `noindex, nofollow, noarchive, nosnippet` plus the header in
 * `next.config.mjs` (defence in depth — the meta tag alone is not honoured by
 * every crawler).
 *
 * Open Graph carries a TEASER ONLY. WhatsApp, Instagram and iMessage generate
 * preview cards from these tags; if they contained the recipient's name or the
 * message, the surprise would be spoiled in the chat thread before the link was
 * ever tapped.
 */

import type { Metadata, Viewport } from 'next';
import { Fredoka, Plus_Jakarta_Sans } from 'next/font/google';

import { LETTER_LANG } from '@/content/letter';
import './globals.css';

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-fredoka',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'A delivery is waiting 🌷',
  description: 'But it only opens for two.',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
  openGraph: {
    title: 'A delivery is waiting 🌷',
    description: 'But it only opens for two.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFF8E8',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang={LETTER_LANG} className={`${fredoka.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
