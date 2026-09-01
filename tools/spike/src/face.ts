/**
 * Face gate — Doc 03 §3.
 *
 * The gate is a COUNT, not an identity system. There is deliberately no IoU
 * association, no track IDs, no birth/death counters, no bounding-box EMA:
 *
 *   - `SEEKING_FACES` needs `count >= 2`, latched once via N-of-M (8 of 10).
 *   - `SEEKING_GESTURE` needs only `count >= 1` as liveness (5 of 10).
 *
 * Track identity would only be needed to bind specific hands to specific faces.
 * The togetherness latch removes that need — and with it several hundred lines
 * of the most bug-prone code in a system like this.
 *
 * `>= 2` rather than `== 2` is deliberate: a poster, a TV, a mirror or a
 * passer-by adding a third face must not CLOSE the gate. The `width >= 0.10`
 * filter already removes small background faces, which is the majority of
 * spurious detections.
 */

import { FACE } from './config';
import { RingBuffer } from './nofm';
import type { FaceBox } from './types';

export function faceValid(box: FaceBox, relaxed: boolean): boolean {
  const minScore = relaxed
    ? FACE.minDetectionConfidenceRelaxed
    : FACE.minDetectionConfidence;
  return box.score >= minScore && box.width >= FACE.minBoxWidth;
}

export function countValidFaces(boxes: readonly FaceBox[], relaxed: boolean): number {
  let count = 0;
  for (const box of boxes) {
    if (faceValid(box, relaxed)) count += 1;
  }
  return count;
}

export interface FaceGateState {
  readonly validCount: number;
  /** Permanent for the session once set. */
  readonly togetherConfirmed: boolean;
  /** True on the tick the latch closes. Fires once. */
  readonly justLatched: boolean;
  readonly liveness: boolean;
  /** ms of continuous single-face presence, pre-latch. */
  readonly soloElapsedMs: number;
  readonly soloTimeout: boolean;
}

export class FaceGate {
  private readonly latchBuffer = new RingBuffer(FACE.latchWindow, FACE.latchRequired);
  private readonly livenessBuffer = new RingBuffer(
    FACE.livenessWindow,
    FACE.livenessRequired,
  );

  private latched = false;
  private soloElapsedMs = 0;
  private soloFired = false;
  private latchedAtMs: number | null = null;

  /**
   * @param faceInferenceRan false when face detection was dropped for
   *   performance (Doc 03 §3.4). Liveness is then ASSUMED TRUE — the latch has
   *   already established presence.
   */
  update(
    boxes: readonly FaceBox[],
    dtMs: number,
    relaxed: boolean,
    faceInferenceRan: boolean,
    nowMs: number,
  ): FaceGateState {
    if (!faceInferenceRan) {
      return {
        validCount: -1,
        togetherConfirmed: this.latched,
        justLatched: false,
        liveness: true,
        soloElapsedMs: this.soloElapsedMs,
        soloTimeout: false,
      };
    }

    const validCount = countValidFaces(boxes, relaxed);

    const latchSatisfied = this.latchBuffer.push(validCount >= FACE.latchMinCount);
    this.livenessBuffer.push(validCount >= FACE.livenessMinCount);

    let justLatched = false;
    if (!this.latched && latchSatisfied) {
      this.latched = true;
      this.latchedAtMs = nowMs;
      justLatched = true;
    }

    if (!this.latched && validCount === 1) {
      this.soloElapsedMs += dtMs;
    } else if (validCount !== 1) {
      this.soloElapsedMs = 0;
    }

    let soloTimeout = false;
    if (!this.latched && !this.soloFired && this.soloElapsedMs >= FACE.soloTimeoutMs) {
      this.soloFired = true;
      soloTimeout = true;
    }

    return {
      validCount,
      togetherConfirmed: this.latched,
      justLatched,
      liveness: this.latched ? this.livenessBuffer.satisfied : latchSatisfied,
      soloElapsedMs: this.soloElapsedMs,
      soloTimeout,
    };
  }

  /** For the measurement report: ms from first tick to latch. */
  latchedAt(): number | null {
    return this.latchedAtMs;
  }

  reset(): void {
    this.latchBuffer.reset();
    this.livenessBuffer.reset();
    this.latched = false;
    this.soloElapsedMs = 0;
    this.soloFired = false;
    this.latchedAtMs = null;
  }
}
