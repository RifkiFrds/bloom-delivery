/**
 * Hysteresis — Doc 03 §7.1, Doc 05 P4.5.
 *
 *   enter:  metric <= T
 *   exit:   metric >  T × 1.30
 *
 * Without this, a metric hovering on the boundary produces `GESTURE_ENTER` /
 * `GESTURE_EXIT` chatter several times per second — a flickering progress ring
 * and an unusable hold timer.
 *
 * ── HYSTERESIS AND N-OF-M SOLVE DIFFERENT PROBLEMS ───────────────────────
 * Hysteresis handles a metric SITTING on a threshold. N-of-M handles a frame
 * being DROPPED. They operate at different layers — hysteresis on individual
 * distance conditions, N-of-M on the final boolean — and both are required.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Applies to DISTANCE-BASED conditions only. Boolean conditions (G1 C4, C7,
 * G2 C3, C4) and the angle range (G1 C6) have no metric that can hover on a
 * boundary, so widening them would only lower the bar.
 */

import { HYSTERESIS } from '../config';

/** Widen an upper bound (`metric <= T`) while the gesture is already active. */
export function upperBound(threshold: number, active: boolean): number {
  return active ? threshold * HYSTERESIS.exitMultiplier : threshold;
}

/** Widen a lower bound (`metric >= T`) while the gesture is already active. */
export function lowerBound(threshold: number, active: boolean): number {
  return active ? threshold / HYSTERESIS.exitMultiplier : threshold;
}
