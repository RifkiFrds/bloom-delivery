/**
 * Coordinate space — the mandatory preprocessing step (Doc 03 §2.1).
 *
 * MediaPipe normalizes each axis independently: x ∈ [0,1] of width,
 * y ∈ [0,1] of height. In a 9:16 frame those units are NOT isotropic — a
 * vertical distance of 0.1 is 1.78× longer in pixels than a horizontal one.
 *
 *     x' = x
 *     y' = y × (videoHeight / videoWidth)
 *
 * Every distance downstream is Euclidean in this square-corrected space, in
 * units of FRAME WIDTH.
 *
 * Skipping this makes every threshold in the spec wrong by the aspect ratio.
 * It is the most commonly skipped step in MediaPipe gesture work and it is the
 * reason such code "works on the laptop and not on the phone".
 *
 * Applied exactly once, at ingest. Nothing downstream re-normalizes.
 *
 * PURE. Ported unchanged from the Phase 0 spike (Doc 05 P4.1) so the geometry
 * that was calibrated against real devices is the geometry that ships.
 */

import type { Point, Hand } from '../types';

/** Minimal shape of a MediaPipe normalized landmark. */
interface RawLandmark {
  readonly x: number;
  readonly y: number;
}

/** The aspect factor for a given video element or intrinsic size. */
export function aspectFactor(videoWidth: number, videoHeight: number): number {
  if (videoWidth <= 0) return 1;
  return videoHeight / videoWidth;
}

/** Square-corrects one landmark. */
export function correctPoint(landmark: RawLandmark, factor: number): Point {
  return { x: landmark.x, y: landmark.y * factor };
}

/** Square-corrects a full 21-landmark hand. */
export function correctHand(landmarks: readonly RawLandmark[], factor: number): Hand {
  const out: Point[] = new Array<Point>(landmarks.length);
  for (let i = 0; i < landmarks.length; i += 1) {
    const landmark = landmarks[i];
    if (landmark === undefined) continue;
    out[i] = { x: landmark.x, y: landmark.y * factor };
  }
  return out;
}

/**
 * Square-corrects a face bounding box.
 *
 * MediaPipe's FaceDetector reports the box in PIXELS, not normalized units, so
 * it is divided by the video width first. The result is in frame-width units,
 * which is what the `minBoxWidth >= 0.10` filter expects (Doc 03 §3.2).
 */
export function correctFaceBox(
  box: { originX: number; originY: number; width: number; height: number },
  videoWidth: number,
  factor: number,
): { x: number; y: number; width: number; height: number } {
  const scale = videoWidth > 0 ? 1 / videoWidth : 1;
  return {
    x: box.originX * scale,
    y: box.originY * scale * factor,
    width: box.width * scale,
    height: box.height * scale * factor,
  };
}
