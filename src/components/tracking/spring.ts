/**
 * Spring integration for tracked points — PURE.
 *
 * ── WHY A SPRING AND NOT THE EXPONENTIAL APPROACH ────────────────────────
 * `approach()` (an exponential ease) removes the 15 Hz staircase but always
 * decelerates into the target, so a hand moving at constant speed trails behind
 * it by a fixed distance. The overlay looks correct when still and laggy when
 * moving — which is exactly when people look at it.
 *
 * A spring carries VELOCITY. It keeps up with sustained motion, settles without
 * overshoot at `gentle`'s damping, and absorbs the per-tick jitter that makes
 * raw MediaPipe output read as a debug view.
 *
 * The constants come from `motion/tokens` — Doc 04 §C.3: "ad-hoc
 * stiffness/damping values are a review-blocking defect. Every spring in the
 * codebase references one of these four."
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── STABILITY ────────────────────────────────────────────────────────────
 * Semi-implicit Euler diverges when `stiffness × dt²` grows past ~1. A frame
 * that takes 64 ms (a dropped frame, a backgrounded tab returning) would send
 * every landmark to infinity, and the overlay would never recover because NaN
 * is sticky. So the step is subdivided into slices no longer than 8 ms.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Operates in place on `Float32Array`s. No allocation, no objects — this runs
 * over ~50 tracked values at 60 Hz.
 */

import { spring, type SpringName } from '@/motion/tokens';

/** Longest slice the integrator will take. Below the divergence threshold. */
const MAX_SLICE_S = 0.008;

export interface SpringConstants {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

export function springConstants(name: SpringName): SpringConstants {
  const token = spring[name];
  return { stiffness: token.stiffness, damping: token.damping, mass: token.mass };
}

/**
 * Advances `position` and `velocity` toward `target` for `count` entries.
 *
 * @param dtSec elapsed seconds. Values above ~0.1 s are clamped by the caller;
 *   this function subdivides whatever it is given.
 */
export function integrate(
  position: Float32Array,
  velocity: Float32Array,
  target: Float32Array,
  count: number,
  constants: SpringConstants,
  dtSec: number,
): void {
  if (dtSec <= 0) return;

  const slices = Math.max(1, Math.ceil(dtSec / MAX_SLICE_S));
  const step = dtSec / slices;
  const { stiffness, damping, mass } = constants;

  for (let slice = 0; slice < slices; slice += 1) {
    for (let i = 0; i < count; i += 1) {
      const p = position[i] ?? 0;
      const v = velocity[i] ?? 0;
      const acceleration = (stiffness * ((target[i] ?? 0) - p) - damping * v) / mass;
      const nextVelocity = v + acceleration * step;
      velocity[i] = nextVelocity;
      position[i] = p + nextVelocity * step;
    }
  }
}

/**
 * Teleports a range to its target with zero velocity.
 *
 * Used when a hand or face FIRST appears. Without it the new point springs in
 * from wherever the previous occupant of that slot left off, which reads as a
 * landmark flying across the screen rather than a hand arriving.
 */
export function snap(
  position: Float32Array,
  velocity: Float32Array,
  target: Float32Array,
  count: number,
): void {
  for (let i = 0; i < count; i += 1) {
    position[i] = target[i] ?? 0;
    velocity[i] = 0;
  }
}

/**
 * A scalar spring, for the values that are not point arrays — mask opacity,
 * glow strength, the guide's radius. Returns the new position; the caller keeps
 * velocity in a one-element array so this still allocates nothing.
 */
export function integrateScalar(
  position: number,
  velocity: Float32Array,
  slot: number,
  target: number,
  constants: SpringConstants,
  dtSec: number,
): number {
  if (dtSec <= 0) return position;

  const slices = Math.max(1, Math.ceil(dtSec / MAX_SLICE_S));
  const step = dtSec / slices;
  const { stiffness, damping, mass } = constants;
  let p = position;
  let v = velocity[slot] ?? 0;

  for (let slice = 0; slice < slices; slice += 1) {
    const acceleration = (stiffness * (target - p) - damping * v) / mass;
    v += acceleration * step;
    p += v * step;
  }

  velocity[slot] = v;
  return p;
}
