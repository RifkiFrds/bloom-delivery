/**
 * Next configuration — PRD v2 §Security & Privacy.
 *
 * ── THE PRIVACY GUARANTEE, ENFORCED ──────────────────────────────────────
 * `connect-src 'self'` is what makes "your camera stays on your phone" true
 * rather than aspirational. Zero fetch / XHR / WebSocket / sendBeacon to any
 * other origin, structurally. This is also why the MediaPipe runtime and models
 * are self-hosted and why fonts come from next/font rather than a CDN.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `wasm-unsafe-eval` is required by MediaPipe and is the one concession.
 */

const csp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'" +
    (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), payment=()',
  },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Models and WASM are content-stable and large: cache hard.
        source: '/vision/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/models/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
