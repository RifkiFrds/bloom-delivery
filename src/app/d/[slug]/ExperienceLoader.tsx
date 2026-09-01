'use client';

/**
 * Client shim for `dynamic(..., { ssr: false })`.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 * Doc 01 §5.2 rule B7 says `use client` appears exactly once, at
 * ExperienceRoot. Next 15 makes that literally impossible: `ssr: false` in
 * `next/dynamic` is rejected inside a Server Component and must live in a
 * Client Component.
 *
 * This is a framework-imposed shim, not a second boundary. It holds no logic,
 * no state and no imports beyond the loader itself — the actual client boundary
 * is still ExperienceRoot. The alternative (dropping `ssr: false` and guarding
 * every `window` access) would violate rule B5, which requires everything
 * camera-dependent to be excluded from server rendering.
 * ─────────────────────────────────────────────────────────────────────────
 */

import dynamic from 'next/dynamic';

const ExperienceRoot = dynamic(() => import('@/app/ExperienceRoot'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="font-display text-2xl">🌷</span>
    </div>
  ),
});

export function ExperienceLoader(): React.ReactElement {
  return <ExperienceRoot />;
}
