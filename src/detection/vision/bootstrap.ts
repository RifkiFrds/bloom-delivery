/**
 * MediaPipe task bootstrap — Doc 03 §3.1, §4.1, Doc 02 §2.8, Doc 01 §4.1.
 *
 * ── SPLIT LOADING IS THE POINT OF THIS MODULE ────────────────────────────
 *   face_detector.task    ~230 KB   BLOCKING
 *   hand_landmarker.task  ~7.5 MB   BACKGROUND
 *
 * Blocking the camera stage on 7.5 MB is a fifteen-second stare at a loader on
 * 4G. Blocking on 230 KB means the camera appears in ~2 s and the hand model
 * lands while the pair is getting into position.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Assets are SELF-HOSTED from /public/vision. Never a CDN: a third-party outage
 * at the emotional peak of a one-shot gift is an unacceptable dependency, and
 * self-hosting is what keeps `connect-src 'self'` intact (Doc 01 §7.3).
 *
 * GPU delegate with CPU fallback on init failure. That fallback path was
 * exercised for real in Phase 0 rather than discovered in production.
 */

import { FaceDetector, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

import { record } from '@/lib/diagnostics';
import { ASSETS, FACE, HANDS } from '../config';
import type { Delegate } from '../types';

/** `WasmFileset` is not exported by the package; derive it from the resolver. */
type VisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

let fileset: VisionFileset | null = null;

async function resolveFileset(): Promise<VisionFileset> {
  fileset ??= await FilesetResolver.forVisionTasks(ASSETS.wasmPath);
  return fileset;
}

export interface FaceDetectorHandle {
  readonly detector: FaceDetector;
  readonly delegate: Delegate;
}

export interface HandLandmarkerHandle {
  readonly landmarker: HandLandmarker;
  readonly delegate: Delegate;
}

/** Blocking. ~230 KB. `LOADING_DETECTION` waits on this and nothing else. */
export async function createFaceDetector(): Promise<FaceDetectorHandle> {
  const vision = await resolveFileset();

  const build = async (delegate: Delegate): Promise<FaceDetector> =>
    FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: ASSETS.faceModel, delegate },
      runningMode: 'VIDEO',
      minDetectionConfidence: FACE.minDetectionConfidence,
      minSuppressionThreshold: FACE.minSuppressionThreshold,
    });

  try {
    return { detector: await build('GPU'), delegate: 'GPU' };
  } catch (error) {
    record(
      `vision: FaceDetector GPU delegate failed, using CPU — ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { detector: await build('CPU'), delegate: 'CPU' };
  }
}

/** Background. ~7.5 MB. NEVER block the camera stage on this. */
export async function createHandLandmarker(): Promise<HandLandmarkerHandle> {
  const vision = await resolveFileset();

  const build = async (delegate: Delegate): Promise<HandLandmarker> =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: ASSETS.handModel, delegate },
      runningMode: 'VIDEO',
      numHands: HANDS.numHands,
      minHandDetectionConfidence: HANDS.minHandDetectionConfidence,
      minHandPresenceConfidence: HANDS.minHandPresenceConfidence,
      minTrackingConfidence: HANDS.minTrackingConfidence,
    });

  try {
    return { landmarker: await build('GPU'), delegate: 'GPU' };
  } catch (error) {
    record(
      `vision: HandLandmarker GPU delegate failed, using CPU — ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { landmarker: await build('CPU'), delegate: 'CPU' };
  }
}

/**
 * One blank inference per model.
 *
 * First-call latency is 5–10× steady state. Doing it here prevents a visible
 * stall on the user's first real frame and keeps the p50/p95 readings honest
 * rather than skewed by a single cold outlier.
 */
export function warmUp(
  face: FaceDetector | null,
  hands: HandLandmarker | null,
  video: HTMLVideoElement,
  timestampMs: number,
): void {
  try {
    face?.detectForVideo(video, timestampMs);
  } catch {
    /* a cold warm-up failure is not fatal; the real loop reports it */
  }
  try {
    hands?.detectForVideo(video, timestampMs + 1);
  } catch {
    /* as above */
  }
}

/**
 * Relax hand confidence at mercy level ≥ 1 (Doc 03 §6.7).
 *
 * This is an OPTION UPDATE on the existing task, not a re-instantiation — the
 * 7.5 MB model stays resident and there is no reload stall mid-gesture.
 */
export function relaxHandConfidence(landmarker: HandLandmarker): void {
  try {
    void landmarker.setOptions({
      minHandDetectionConfidence: HANDS.minHandDetectionConfidenceRelaxed,
    });
    record('vision: hand confidence relaxed to 0.40 (mercy ≥ 1)');
  } catch {
    // A refused option update costs sensitivity, never the session.
  }
}

export { FaceDetector, HandLandmarker };
