/**
 * The 🤟 pose — thumb, index and pinky out, middle and ring folded. PURE.
 *
 * ── THIS IS NOT PART OF THE UNLOCK GATE ──────────────────────────────────
 * It decides ONE thing: whether the hero mask appears. It cannot unlock
 * anything, it emits no FSM event, and it does not touch G1, G2, G3, the hold
 * timer, the N-of-M buffer or any threshold in `detection/config`.
 *
 * The gift is still opened by the two-hand heart and nothing else. This is a
 * display trigger that happens to live next to the gesture code because it
 * reads the same landmarks.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Built from the same primitive as every other condition — a tip compared
 * against its own PIP, both measured from the wrist. Scale-free, rotation-free,
 * no calibration (Doc 03 §6.1).
 */

import { G2 } from '../config';
import { dist, palmScale } from './metrics';
import { L, type Hand } from '../types';

/** A finger is extended when its tip is FURTHER from the wrist than its PIP. */
function extended(hand: Hand, pip: number, tip: number): boolean {
  const wrist = hand[L.WRIST];
  const pipPoint = hand[pip];
  const tipPoint = hand[tip];
  if (wrist === undefined || pipPoint === undefined || tipPoint === undefined) {
    return false;
  }
  return dist(tipPoint, wrist) > dist(pipPoint, wrist);
}

function folded(hand: Hand, pip: number, tip: number): boolean {
  const wrist = hand[L.WRIST];
  const pipPoint = hand[pip];
  const tipPoint = hand[tip];
  if (wrist === undefined || pipPoint === undefined || tipPoint === undefined) {
    return false;
  }
  return dist(tipPoint, wrist) < dist(pipPoint, wrist);
}

/**
 * True for the 🤟 sign.
 *
 * The size gate is G2's, not G1's: this is a ONE-HAND pose, so it inherits the
 * one-hand threshold rather than the pair threshold.
 */
export function isHornsPose(hand: Hand): boolean {
  if (palmScale(hand) < G2.minPalmScale) return false;

  return (
    extended(hand, L.THUMB_IP, L.THUMB_TIP) &&
    extended(hand, L.INDEX_PIP, L.INDEX_TIP) &&
    extended(hand, L.PINKY_PIP, L.PINKY_TIP) &&
    folded(hand, L.MIDDLE_PIP, L.MIDDLE_TIP) &&
    folded(hand, L.RING_PIP, L.RING_TIP)
  );
}

/** True when ANY visible hand is making it. */
export function anyHorns(hands: readonly Hand[]): boolean {
  for (const hand of hands) {
    if (isHornsPose(hand)) return true;
  }
  return false;
}
