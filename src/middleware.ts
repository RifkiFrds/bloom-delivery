import { NextResponse, type NextRequest } from 'next/server';

/**
 * The Content Security Policy — PRD v2 §Security & Privacy.
 *
 * ── WHY THIS MOVED OUT OF `next.config.mjs` ──────────────────────────────
 * The static header there was `script-src 'self' 'wasm-unsafe-eval'`, which is
 * correct in spirit and BROKE THE APPLICATION: Next's App Router always emits
 * inline `<script>self.__next_f.push(...)</script>` tags carrying the RSC flight
 * payload. `'self'` does not permit inline scripts, so hydration never ran and
 * the experience sat on its loading fallback forever — in production as well as
 * in development. The Playwright smoke suite is what surfaced it.
 *
 * The two ways out are `'unsafe-inline'` and a per-request nonce. This takes the
 * nonce, because `'unsafe-inline'` would remove the XSS protection the header
 * exists to provide, and a nonce costs one middleware invocation.
 *
 * `'strict-dynamic'` lets the nonced bootstrap load the chunks it needs without
 * enumerating every hashed filename — which is the only workable arrangement
 * when the bundler renames chunks on every build.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── THE LINE THAT ACTUALLY CARRIES THE PRIVACY PROMISE ───────────────────
 * `connect-src 'self'` is what makes "your camera stays on your phone" true
 * rather than aspirational: zero fetch, XHR, WebSocket or sendBeacon to any
 * other origin, structurally. It is also why the MediaPipe runtime and models
 * are self-hosted and why fonts come from `next/font` rather than a CDN.
 *
 * `wasm-unsafe-eval` is required by MediaPipe and is the one concession.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A consequence worth stating: a per-request nonce means every route is
 * rendered dynamically. That costs nothing here — this application has one
 * recipient, and there is no CDN cache worth preserving.
 */

function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // `strict-dynamic` makes the nonce transitive to the chunks Next loads.
    // Browsers that do not support it fall back to `'self'`, which still serves
    // every non-inline chunk correctly.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${
      isDev ? " 'unsafe-eval'" : ''
    }`,
    // Tailwind and Framer Motion both write inline styles at runtime. Style
    // injection is not a script-execution vector, and `connect-src` still
    // prevents anything from leaving the device.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ');
}

export function middleware(request: NextRequest): NextResponse {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development');

  // Next reads `x-nonce` off the REQUEST and stamps it onto every script tag it
  // emits. Without this the response header would name a nonce that nothing
  // carries, which fails exactly as loudly as no nonce at all.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except the static asset paths, which are served straight from
     * disk and carry no inline scripts:
     *   _next/static  ·  _next/image  ·  favicon  ·  /vision  ·  /audio  ·  /models
     */
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|vision|audio|models|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
