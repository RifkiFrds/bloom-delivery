/**
 * Gesture selection — Doc 01 §4.1 stages 5–6, Doc 03 §6.7. PURE.
 *
 *   accepted := (mercy 0)  G1
 *             | (mercy ≥1) G1 ∨ G2(A) ∨ G2(B) ∨ G3
 *
 * G1 is evaluated at EVERY level, including 2 and 3. Detection keeps running at
 * every level, and if the heart lands at t = 100 s it still wins — the softening
 * adds alternatives, it never removes the intended one (Doc 04 §B.9).
 *
 * ── WHY THERE IS NO CONFIDENCE SCORE HERE ────────────────────────────────
 * The gate is a boolean conjunction of geometric conditions. A weighted sum
 * would let a strongly-satisfied condition compensate for a violated one, which
 * is exactly how a high-five with unusually curled fingers sneaks through. Hard
 * conjunctions cannot be gamed that way, they are trivially explainable in the
 * debug HUD ("C5 failed"), and they are what makes the coaching derivation
 * possible at all (Doc 03 §6.6).
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { MercyLevel } from '@/machine';
import { acceptsFingerHeart, mercyMultiplier } from '../config';
import type { GestureVariant, Hand, VariantResult } from '../types';
import { rawCloseness } from './closeness';
import { evaluateG1 } from './g1';
import { evaluateG2 } from './g2';
import { evaluateG3 } from './g3';

export interface SelectionInput {
  readonly hands: readonly Hand[];
  readonly mercyLevel: MercyLevel;
  /** True when the gesture was accepted on the previous tick — see hysteresis. */
  readonly active: boolean;
  /** Landscape phone: both hands are free, so G2 is accepted at every level. */
  readonly tripodMode: boolean;
}

export interface SelectionResult {
  readonly accepted: boolean;
  readonly variant: GestureVariant | null;
  readonly g1: VariantResult | null;
  readonly g2: readonly VariantResult[];
  readonly g3: VariantResult | null;
  /**
   * Raw closeness from the variant the user is CLOSEST to satisfying, so the
   * "almost there" signal tracks what they are actually attempting rather than
   * always reporting G1 (Doc 03 §6.5).
   */
  readonly closeness: number;
}

const EMPTY: SelectionResult = {
  accepted: false,
  variant: null,
  g1: null,
  g2: [],
  g3: null,
  closeness: 0,
};

export function selectGesture(input: SelectionInput): SelectionResult {
  const { hands, mercyLevel, active, tripodMode } = input;
  if (hands.length === 0) return EMPTY;

  const m = mercyMultiplier(mercyLevel);
  const fingerHeartAllowed = acceptsFingerHeart(mercyLevel, tripodMode);

  const handA = hands[0];
  const handB = hands[1];

  const g1 =
    handA !== undefined && handB !== undefined
      ? evaluateG1({ handA, handB, mercyMultiplier: m, active })
      : null;

  // G2 and G3 are always EVALUATED — the debug HUD shows them at every level,
  // which is what makes a "why didn't it unlock" question answerable — but they
  // are only ACCEPTED from mercy ≥ 1.
  const g2: VariantResult[] = [];
  for (const hand of hands) {
    g2.push(evaluateG2({ hand, mercyMultiplier: m, active }));
  }

  const g3 =
    handA !== undefined && handB !== undefined
      ? evaluateG3({ handA, handB, mercyMultiplier: m, active })
      : null;

  let variant: GestureVariant | null = null;
  if (g1?.pass === true) variant = 'G1';
  else if (fingerHeartAllowed && g3?.pass === true) variant = 'G3';
  else if (fingerHeartAllowed && g2.some((result) => result.pass)) variant = 'G2';

  return {
    accepted: variant !== null,
    variant,
    g1,
    g2,
    g3,
    closeness: bestCloseness(g1, g2, g3, fingerHeartAllowed),
  };
}

/**
 * The highest closeness across the variants the user could currently unlock
 * with. Reporting only G1's would tell someone making a finger heart at mercy 2
 * that they are nowhere near, while they are in fact one frame from unlocking.
 */
function bestCloseness(
  g1: VariantResult | null,
  g2: readonly VariantResult[],
  g3: VariantResult | null,
  fingerHeartAllowed: boolean,
): number {
  let best = g1 === null ? 0 : rawCloseness(g1.conditions);
  if (!fingerHeartAllowed) return best;

  for (const result of g2) {
    best = Math.max(best, rawCloseness(result.conditions));
  }
  if (g3 !== null) best = Math.max(best, rawCloseness(g3.conditions));
  return best;
}
