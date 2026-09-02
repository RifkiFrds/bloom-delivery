/**
 * G1 — two-hand heart, formed by ONE HAND FROM EACH PERSON. The PRIMARY,
 * coached gesture. Doc 03 §6.2.
 *
 * Requires two detected hands `A` and `B` in ANY ownership arrangement.
 * Handedness is ignored entirely (Doc 03 §2.5): it is unreliable when the two
 * hands belong to different people, and no condition below needs it.
 *
 * C5 (aperture) and C6 (mirrored posture) are the false-positive workhorses.
 * C2 and C3 alone are satisfied by any two hands brought together — clasped,
 * praying, shaking, high-fiving. C5 demands the WRISTS STAY APART while the
 * FINGERTIPS MEET, which is the defining topology of a heart and of almost
 * nothing else. C6 demands the palms face each other rather than the same
 * direction, removing the entire parallel-palm family. Protect these two
 * during calibration.
 */

import { G1 as T, HYSTERESIS } from './config';
import { allCurled, angleBetweenDeg, dist, midY, palmDir, palmScale } from './metrics';
import { L, type Condition, type Hand, type VariantResult } from './types';

export interface G1Input {
  readonly handA: Hand;
  readonly handB: Hand;
  /** Mercy multiplier `M`: 1.00 at level 0, 1.25 at level ≥ 1. */
  readonly mercyMultiplier: number;
  /**
   * True when the gesture was accepted on the previous tick.
   *
   * Hysteresis (Doc 03 §7.1) applies to DISTANCE-BASED conditions only:
   * enter at `T`, exit only past `T × 1.30`. Boolean conditions (C4, C7) and
   * the angle range (C6) have no metric to hover on a boundary, so they are
   * not widened.
   */
  readonly active: boolean;
}

/** Widen an upper-bound threshold while active. */
function upper(threshold: number, active: boolean): number {
  return active ? threshold * HYSTERESIS.exitMultiplier : threshold;
}

/** Widen a lower-bound threshold while active. */
function lower(threshold: number, active: boolean): number {
  return active ? threshold / HYSTERESIS.exitMultiplier : threshold;
}

function firstFailure(conditions: readonly Condition[]): string | null {
  for (const condition of conditions) {
    if (!condition.pass) return condition.id;
  }
  return null;
}

export function evaluateG1(input: G1Input): VariantResult {
  const { handA, handB, mercyMultiplier: m, active } = input;

  const sA = palmScale(handA);
  const sB = palmScale(handB);
  const sBar = (sA + sB) / 2;

  const a4 = handA[L.THUMB_TIP];
  const b4 = handB[L.THUMB_TIP];
  const a8 = handA[L.INDEX_TIP];
  const b8 = handB[L.INDEX_TIP];
  const a0 = handA[L.WRIST];
  const b0 = handB[L.WRIST];

  // A malformed hand fails C1 rather than throwing: the loop must never crash
  // on a partial landmark array.
  const complete =
    a4 !== undefined &&
    b4 !== undefined &&
    a8 !== undefined &&
    b8 !== undefined &&
    a0 !== undefined &&
    b0 !== undefined;

  const minScale = Math.min(sA, sB);
  const c1: Condition = {
    id: 'C1',
    label: 'hands large enough',
    pass: complete && sA >= T.minPalmScale && sB >= T.minPalmScale,
    value: minScale,
    threshold: T.minPalmScale,
    comparison: '>=',
  };

  if (!complete) {
    const conditions = [c1];
    return { variant: 'G1', pass: false, conditions, failedAt: 'C1' };
  }

  const thumbJunction = dist(a4, b4);
  const thumbLimit = upper(T.thumbJunction * sBar * m, active);
  const c2: Condition = {
    id: 'C2',
    label: 'thumb junction',
    pass: thumbJunction <= thumbLimit,
    value: thumbJunction,
    threshold: thumbLimit,
    comparison: '<=',
  };

  const indexJunction = dist(a8, b8);
  const indexLimit = upper(T.indexJunction * sBar * m, active);
  const c3: Condition = {
    id: 'C3',
    label: 'index junction',
    pass: indexJunction <= indexLimit,
    value: indexJunction,
    threshold: indexLimit,
    comparison: '<=',
  };

  // y grows downward: thumbs BELOW indices → point of the heart at the bottom.
  const c4: Condition = {
    id: 'C4',
    label: 'vertical order',
    pass: midY(a4, b4) > midY(a8, b8),
    value: null,
    threshold: null,
    comparison: 'bool',
  };

  const aperture = dist(a0, b0);
  const apertureLimit = lower((T.aperture * sBar) / m, active);
  const c5: Condition = {
    id: 'C5',
    label: 'aperture',
    pass: aperture >= apertureLimit,
    value: aperture,
    threshold: apertureLimit,
    comparison: '>=',
  };

  const palmAngle = angleBetweenDeg(palmDir(handA), palmDir(handB));
  const c6: Condition = {
    id: 'C6',
    label: 'mirrored posture',
    pass: palmAngle >= T.palmAngleMinDeg && palmAngle <= T.palmAngleMaxDeg,
    value: palmAngle,
    threshold: T.palmAngleMinDeg,
    comparison: 'range',
  };

  const c7: Condition = {
    id: 'C7',
    label: 'fingers curled',
    pass: allCurled(handA) && allCurled(handB),
    value: null,
    threshold: null,
    comparison: 'bool',
  };

  const conditions: readonly Condition[] = [c1, c2, c3, c4, c5, c6, c7];
  const pass = conditions.every((condition) => condition.pass);

  return { variant: 'G1', pass, conditions, failedAt: firstFailure(conditions) };
}
