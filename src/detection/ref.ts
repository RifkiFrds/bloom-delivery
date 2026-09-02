/**
 * ★ THE DETECTION REF ★ — Doc 01 §6.3, the load-bearing performance decision.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 * The detection loop writes THIS OBJECT at 15 Hz and never calls `setState`.
 * The HUD reads it inside its own `requestAnimationFrame`. Zustand sees ~8
 * writes across an entire session.
 *
 * A per-frame `setState` would produce 30–60 React commits per second during
 * the single most performance-sensitive phase, on the weakest devices, while
 * two neural networks are running. That is a defect, not a style preference
 * (Doc 01 §2.1 rule B4).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ONE module-level mutable object, mutated in place. Not replaced per tick:
 * allocating a fresh snapshot at 15 Hz is 900 objects per minute of garbage in
 * the hot path, and Doc 03 §11.4 budgets ZERO per-tick allocations.
 *
 * Readers must therefore treat every field as a live value and copy anything
 * they intend to hold across a frame.
 */

import type {
  CoachingState,
  DetectionMode,
  FaceBox,
  GestureVariant,
  Hand,
  VariantResult,
} from './types';
import type { MercyLevel } from '@/machine';

export interface DetectionSnapshot {
  // ── Loop ────────────────────────────────────────────────────────────────
  tick: number;
  timestampMs: number;
  mode: DetectionMode;
  running: boolean;

  // ── Face stage ──────────────────────────────────────────────────────────
  faceCount: number;
  faceBoxes: readonly FaceBox[];
  togetherConfirmed: boolean;
  liveness: boolean;
  soloElapsedMs: number;

  // ── Gesture stage ───────────────────────────────────────────────────────
  handCount: number;
  hands: readonly Hand[];
  palmScales: readonly number[];
  g1: VariantResult | null;
  g2: readonly VariantResult[];
  g3: VariantResult | null;
  /** The variant that produced the current acceptance, if any. */
  acceptedVariant: GestureVariant | null;
  /** Raw per-tick acceptance, before N-of-M. */
  accepted: boolean;
  /** Post N-of-M. This is what drives GESTURE_ENTER / GESTURE_EXIT. */
  gesturePresent: boolean;
  /** Chronological N-of-M window, oldest → newest. Debug HUD only. */
  nofmWindow: readonly boolean[];
  closeness: number;
  holdMs: number;
  /** `hold / 900`. The ring reads THIS, lerped — never a spring (Doc 04 §B.10). */
  holdProgress: number;
  mercyLevel: MercyLevel;
  /** Active elapsed ms in the gesture stage. Pauses with the mercy timer. */
  gestureElapsedMs: number;

  // ── Environment ─────────────────────────────────────────────────────────
  lumaY: number;
  tooDark: boolean;
  coaching: CoachingState;

  // ── Performance (debug HUD, Doc 03 §10.2) ───────────────────────────────
  inferenceMs: number;
  inferenceP50: number;
  inferenceP95: number;
  effectiveHz: number;
  intervalMs: number;
  droppedFaceTicks: number;
  faceDelegate: string;
  handDelegate: string;
}

/** Fresh values for a new session. Kept separate so `resetRef` cannot drift. */
function blank(): DetectionSnapshot {
  return {
    tick: 0,
    timestampMs: 0,
    mode: 'idle',
    running: false,

    faceCount: 0,
    faceBoxes: [],
    togetherConfirmed: false,
    liveness: false,
    soloElapsedMs: 0,

    handCount: 0,
    hands: [],
    palmScales: [],
    g1: null,
    g2: [],
    g3: null,
    acceptedVariant: null,
    accepted: false,
    gesturePresent: false,
    nofmWindow: [],
    closeness: 0,
    holdMs: 0,
    holdProgress: 0,
    mercyLevel: 0,
    gestureElapsedMs: 0,

    lumaY: 255,
    tooDark: false,
    coaching: 'IDLE',

    inferenceMs: 0,
    inferenceP50: 0,
    inferenceP95: 0,
    effectiveHz: 0,
    intervalMs: 0,
    droppedFaceTicks: 0,
    faceDelegate: '—',
    handDelegate: '—',
  };
}

/**
 * The single instance. Imported directly by the loop (writer) and by the HUD
 * components (readers). There is deliberately no getter, no subscription and no
 * event: a subscription is how a 15 Hz signal becomes a 15 Hz render.
 */
export const detectionRef: DetectionSnapshot = blank();

/** Restore every field. Called at detection start and at teardown. */
export function resetDetectionRef(): void {
  Object.assign(detectionRef, blank());
}

/**
 * Debug-only accounting of React commits, so the ≤ 2 renders/second budget is
 * observable rather than assumed (Doc 05 §12).
 */
const renderStamps: number[] = [];

export function noteRender(nowMs: number): void {
  renderStamps.push(nowMs);
  while (renderStamps.length > 0 && nowMs - (renderStamps[0] ?? 0) > 1000) {
    renderStamps.shift();
  }
}

export function rendersPerSecond(): number {
  return renderStamps.length;
}
