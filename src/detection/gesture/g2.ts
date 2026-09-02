/**
 * G2 — one-hand Korean finger heart. Accepted from mercy level ≥ 1, and always
 * in Tripod Mode. Doc 03 §6.3.
 *
 * KNOWN FALSE POSITIVES, ACCEPTED: the "OK" sign and a pinch satisfy all four
 * conditions. The full context of such an unlock is that the two-face latch has
 * already closed (so two people are together), they have been trying for twenty
 * seconds, and they held a deliberate hand pose for nearly a second. That is a
 * benign failure. Tightening C2 further costs more true positives among people
 * making a genuine, slightly loose finger heart than it saves in false unlocks.
 *
 * Do not "fix" this without changing Doc 03 §8.2 first.
 */

import { G2 as T } from '../config';
import { allCurled, dist, indexBent, palmScale } from './metrics';
import { upperBound } from './hysteresis';
import { L, type Condition, type Hand, type VariantResult } from '../types';

export interface G2Input {
  readonly hand: Hand;
  readonly mercyMultiplier: number;
  readonly active: boolean;
}

export function evaluateG2(input: G2Input): VariantResult {
  const { hand, mercyMultiplier: m, active } = input;

  const s = palmScale(hand);
  const thumbTip = hand[L.THUMB_TIP];
  const indexTip = hand[L.INDEX_TIP];
  const complete = thumbTip !== undefined && indexTip !== undefined;

  const c1: Condition = {
    id: 'C1',
    label: 'hand large enough',
    pass: complete && s >= T.minPalmScale,
    value: s,
    threshold: T.minPalmScale,
    comparison: '>=',
  };

  if (!complete) {
    return { variant: 'G2', pass: false, conditions: [c1], failedAt: 'C1' };
  }

  const contact = dist(thumbTip, indexTip);
  const contactLimit = upperBound(T.thumbIndexContact * s * m, active);
  const c2: Condition = {
    id: 'C2',
    label: 'thumb-index contact',
    pass: contact <= contactLimit,
    value: contact,
    threshold: contactLimit,
    comparison: '<=',
  };

  const c3: Condition = {
    id: 'C3',
    label: 'index bent',
    pass: indexBent(hand),
    value: null,
    threshold: null,
    comparison: 'bool',
  };

  const c4: Condition = {
    id: 'C4',
    label: 'other fingers curled',
    pass: allCurled(hand),
    value: null,
    threshold: null,
    comparison: 'bool',
  };

  const conditions: readonly Condition[] = [c1, c2, c3, c4];
  const pass = conditions.every((condition) => condition.pass);
  const failedAt = conditions.find((condition) => !condition.pass)?.id ?? null;

  return { variant: 'G2', pass, conditions, failedAt };
}
