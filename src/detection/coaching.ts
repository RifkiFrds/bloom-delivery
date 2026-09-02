/**
 * Coaching state derivation — Doc 04 §B.9, Doc 03 §9.2. PURE.
 *
 * ── FIRST MATCH WINS, IN A FIXED PRIORITY ORDER ──────────────────────────
 *  1 TOO_DARK         no other coaching can help while the frame is unreadable
 *  2 NO_FACES         0 faces for 1.0 s
 *  3 ONE_FACE         1 face for 1.5 s, pre-latch
 *  4 NO_HANDS         post-latch, 0 hands for 1.5 s
 *  5 HANDS_TOO_SMALL  S below the size gate
 *  6 ALMOST           closeness >= 0.65
 *  7 HOLDING          hold > 0 — the ring speaks, the text does not
 *  8 IDLE             the default instruction
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `ALMOST` is worth more than the other seven combined. It is the only feedback
 * that tells the user their gesture is WORKING, and it is what converts random
 * flailing into deliberate adjustment. It is given the strongest visual
 * treatment of any coaching state.
 *
 * A 1.5 s minimum dwell is applied by the stateful wrapper below. Without it a
 * 15 Hz signal produces a strobing HUD and floods the `aria-live` region, which
 * makes the app unusable with a screen reader (Doc 04 §F.4).
 */

import { CLOSENESS, COACHING, G1 as G1_CONFIG } from './config';
import type { CoachingState } from './types';

export interface CoachingInput {
  readonly tooDark: boolean;
  readonly faceCount: number;
  readonly handCount: number;
  readonly togetherConfirmed: boolean;
  /** Largest palm scale seen this tick. 0 when no hands are present. */
  readonly maxPalmScale: number;
  readonly closeness: number;
  readonly holdMs: number;
  /** ms the current face count has persisted. */
  readonly faceDwellMs: number;
  /** ms zero hands has persisted, post-latch. */
  readonly noHandsDwellMs: number;
}

/** The derivation. Pure, and therefore testable against every fixture clip. */
export function deriveCoaching(input: CoachingInput): CoachingState {
  if (input.tooDark) return 'TOO_DARK';

  if (input.faceCount === 0 && input.faceDwellMs >= COACHING.noFacesAfterMs) {
    return 'NO_FACES';
  }

  if (
    !input.togetherConfirmed &&
    input.faceCount === 1 &&
    input.faceDwellMs >= COACHING.oneFaceAfterMs
  ) {
    return 'ONE_FACE';
  }

  if (
    input.togetherConfirmed &&
    input.handCount === 0 &&
    input.noHandsDwellMs >= COACHING.noHandsAfterMs
  ) {
    return 'NO_HANDS';
  }

  if (
    input.togetherConfirmed &&
    input.handCount > 0 &&
    input.maxPalmScale > 0 &&
    input.maxPalmScale < G1_CONFIG.minPalmScale
  ) {
    return 'HANDS_TOO_SMALL';
  }

  if (input.closeness >= CLOSENESS.almostThreshold) return 'ALMOST';

  if (input.holdMs > 0) return 'HOLDING';

  return 'IDLE';
}

/**
 * Applies the 1.5 s minimum dwell.
 *
 * Deliberately NOT pure — the dwell is inherently stateful — but it is a thin
 * shell around a pure function, so the derivation itself stays testable.
 *
 * `TOO_DARK` bypasses the dwell in one direction only: it may INTERRUPT
 * another state immediately, because it is the one condition where every other
 * message is actively misleading.
 */
export class CoachingFilter {
  private current: CoachingState = 'IDLE';
  private since = 0;

  update(input: CoachingInput, nowMs: number): CoachingState {
    const next = deriveCoaching(input);
    if (next === this.current) return this.current;

    const dwelled = nowMs - this.since >= COACHING.minDwellMs;
    if (dwelled || next === 'TOO_DARK' || this.since === 0) {
      this.current = next;
      this.since = nowMs;
    }
    return this.current;
  }

  get value(): CoachingState {
    return this.current;
  }

  reset(): void {
    this.current = 'IDLE';
    this.since = 0;
  }
}

/**
 * Face-count dwell tracking — how long the CURRENT count has persisted.
 *
 * Separate from the coaching filter because the two answer different questions:
 * this one is "how long has the world looked like this", the filter is "how
 * long have I been saying this".
 */
export class DwellTracker {
  private lastValue = -1;
  private elapsed = 0;

  update(value: number, dtMs: number): number {
    if (value === this.lastValue) {
      this.elapsed += dtMs;
    } else {
      this.lastValue = value;
      this.elapsed = 0;
    }
    return this.elapsed;
  }

  reset(): void {
    this.lastValue = -1;
    this.elapsed = 0;
  }
}
