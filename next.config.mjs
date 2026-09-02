/**
 * Next configuration — PRD v2 §Security & Privacy.
 *
 * ── THE CSP LIVES IN `src/middleware.ts`, NOT HERE ───────────────────────
 * It needs a per-request nonce, because Next's App Router emits inline scripts
 * carrying the RSC flight payload and `script-src 'self'` blocks them — which
 * left the application permanently un-hydrated. A static header cannot carry a
 * nonce, so the policy moved to middleware. See that file for the full
 * reasoning.
 *
 * Everything below is a header whose value does not vary per request.
 * ─────────────────────────────────────────────────────────────────────────
 */

const securityHeaders = [
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
