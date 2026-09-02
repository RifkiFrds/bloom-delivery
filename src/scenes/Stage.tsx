'use client';

/**
 * ★ THE PHASE B STAGE ★ — the one place that chooses 3D or Lite.
 * Doc 01 §2.1, §5.1, §5.6, Doc 05 §2.1 rule B6.
 *
 * ── THE ONE SANCTIONED BOUNDARY ──────────────────────────────────────────
 * `scene3d/` is unreachable from Phase A by ESLint rule. This module is the
 * single crossing, and it crosses through `dynamic(..., { ssr: false })` so the
 * chunk is only fetched when `renderTier === 'full'`.
 *
 * That is what keeps three.js, R3F and drei out of the Phase A bundle entirely.
 * A user on the Lite path — no WebGL2, no camera, a denied permission — never
 * downloads a byte of it.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Both implementations receive the same `beat`, which is derived from the FSM
 * state, so they cannot drift out of step.
 *
 * `DEGRADE_TO_LITE` and a failed WebGL context restore both set
 * `renderTier = 'lite'`, and this component swaps implementation MID-SEQUENCE at
 * the current beat. The user is never told (Doc 01 §7.5).
 */

import { LiteStage, type LiteBeat } from '@/lite/LiteStage';
import { selectContext, selectMotionSafe, useMachineStore } from '@/store/machineStore';
import { Scene3D } from './Scene3D';

export interface StageProps {
  readonly beat: LiteBeat;
  readonly dim?: number;
}

export function Stage({ beat, dim = 0 }: StageProps): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const { renderTier } = useMachineStore(selectContext);

  if (renderTier === 'full') {
    return <Scene3D beat={beat} motionSafe={motionSafe} dim={dim} />;
  }

  return <LiteStage beat={beat} motionSafe={motionSafe} dim={dim} />;
}
