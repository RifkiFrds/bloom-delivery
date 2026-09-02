'use client';

/**
 * The `dynamic(ssr:false)` shim for the 3D chunk — Doc 01 §5.2 rule B5, B6.
 *
 * ── WHY A SEPARATE ONE-LINE MODULE ───────────────────────────────────────
 * `next/dynamic` with `ssr: false` must be called from a Client Component, and
 * the import specifier must be statically analysable for the bundler to split
 * the chunk. Inlining this into `Stage.tsx` would work, but keeping it here
 * means `scene3d/**` is referenced from exactly ONE file in the entire tree —
 * which is what makes rule B6 auditable by grep rather than by trust.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The 3D chunk is prefetched at `SEEKING_FACES` entry, so by the time the
 * unlock fires it is already in the cache and this import resolves instantly.
 */

import dynamic from 'next/dynamic';

import type { LiteBeat } from '@/lite/LiteStage';

export interface Scene3DProps {
  readonly beat: LiteBeat;
  readonly motionSafe: boolean;
  readonly dim: number;
}

const FlowerScene = dynamic(
  () => import('@/scene3d/FlowerScene').then((module) => module.FlowerScene),
  {
    ssr: false,
    // There is no spinner anywhere after the Start tap. The darken layer of the
    // unlock beat is still on screen while this resolves (Doc 01 §7.5).
    loading: () => null,
  },
);

export function Scene3D(props: Scene3DProps): React.ReactElement {
  return <FlowerScene {...props} />;
}
