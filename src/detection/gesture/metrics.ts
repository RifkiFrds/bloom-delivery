/**
 * Pure geometric metrics — Doc 03 §6.1.
 *
 * Zero side effects, zero imports beyond types. Ported verbatim from the Phase 0
 * spike at task P4.1, so the geometry calibrated against real devices is the
 * geometry that ships. The fixture suite tests these against landmark JSON.
 *
 * All inputs are already square-corrected (see `space.ts`).
 */

import { L, type Hand, type Point, type CurlFinger } from '../types';

export function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Palm scale — the universal normalizer.
 *
 *     S = dist(landmark 0, landmark 9)     wrist → middle-finger MCP
 *
 * Scale-invariant, rotation-stable, unaffected by finger pose (MCP joints do
 * not move relative to the wrist). EVERY threshold is a multiple of S.
 *
 * This is also the single most important measured quantity in the project:
 * Phase 0 exists primarily to establish whether S ≥ 0.045 at the real pose.
 */
export function palmScale(hand: Hand): number {
  const wrist = hand[L.WRIST];
  const middleMcp = hand[L.MIDDLE_MCP];
  if (wrist === undefined || middleMcp === undefined) return 0;
  return dist(wrist, middleMcp);
}

/** MCP / PIP / TIP indices per curl-tested finger. */
const FINGER_JOINTS: Record<CurlFinger, { pip: number; tip: number }> = {
  middle: { pip: L.MIDDLE_PIP, tip: L.MIDDLE_TIP },
  ring: { pip: L.RING_PIP, tip: L.RING_TIP },
  pinky: { pip: L.PINKY_PIP, tip: L.PINKY_TIP },
};

/**
 * A finger is curled when its TIP is closer to the wrist than its own PIP.
 *
 *     curled(h, f) = dist(TIP_f, wrist) < dist(PIP_f, wrist)
 *
 * A comparison of two distances with NO threshold at all — scale-free,
 * rotation-free, needs no calibration. The cheapest reliable curl test
 * available, and what rejects open palms and splayed fingers across every
 * variant (Doc 03 §6.1).
 */
export function curled(hand: Hand, finger: CurlFinger): boolean {
  const joints = FINGER_JOINTS[finger];
  const wrist = hand[L.WRIST];
  const pip = hand[joints.pip];
  const tip = hand[joints.tip];
  if (wrist === undefined || pip === undefined || tip === undefined) return false;
  return dist(tip, wrist) < dist(pip, wrist);
}

/** G2 C3 — the index finger is bent: tip closer to the wrist than its PIP. */
export function indexBent(hand: Hand): boolean {
  const wrist = hand[L.WRIST];
  const pip = hand[L.INDEX_PIP];
  const tip = hand[L.INDEX_TIP];
  if (wrist === undefined || pip === undefined || tip === undefined) return false;
  return dist(tip, wrist) < dist(pip, wrist);
}

/** All three curl-tested fingers are curled (G1 C7 / G2 C4). */
export function allCurled(hand: Hand): boolean {
  return curled(hand, 'middle') && curled(hand, 'ring') && curled(hand, 'pinky');
}

/** Compact per-finger curl readout for the HUD, e.g. "mrp" / "m-p". */
export function curlSignature(hand: Hand): string {
  return (
    (curled(hand, 'middle') ? 'm' : '-') +
    (curled(hand, 'ring') ? 'r' : '-') +
    (curled(hand, 'pinky') ? 'p' : '-')
  );
}

/** Unit vector wrist → middle-finger MCP. Zero vector for a degenerate hand. */
export function palmDir(hand: Hand): Point {
  const wrist = hand[L.WRIST];
  const middleMcp = hand[L.MIDDLE_MCP];
  if (wrist === undefined || middleMcp === undefined) return { x: 0, y: 0 };
  const dx = middleMcp.x - wrist.x;
  const dy = middleMcp.y - wrist.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

/** Angle between two unit vectors, in degrees, clamped to [0, 180]. */
export function angleBetweenDeg(a: Point, b: Point): number {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
  return (Math.acos(dot) * 180) / Math.PI;
}

/**
 * Mean y of two points.
 *
 * Used by G1 C4 (vertical order). In screen space y grows DOWNWARD, so
 * `midY(thumbs) > midY(indices)` means the thumb junction sits BELOW the index
 * junction — the point of the heart at the bottom, the lobes at the top.
 */
export function midY(a: Point, b: Point): number {
  return (a.y + b.y) / 2;
}

/** Palm centroid — used for overlay placement only, never for gating. */
export function palmCentroid(hand: Hand): Point {
  const indices = [L.WRIST, L.INDEX_MCP, L.MIDDLE_MCP, L.RING_MCP, L.PINKY_MCP];
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const index of indices) {
    const point = hand[index];
    if (point === undefined) continue;
    sx += point.x;
    sy += point.y;
    n += 1;
  }
  if (n === 0) return { x: 0, y: 0 };
  return { x: sx / n, y: sy / n };
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
