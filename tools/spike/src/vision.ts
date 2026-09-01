/**
 * MediaPipe task bootstrap — Doc 03 §3.1, §4.1, Doc 02 §2.8.
 *
 * Assets are SELF-HOSTED from /public/vision (Doc 01 §7.3). Never a CDN: a
 * third-party outage at the emotional peak of a one-shot gift is an
 * unacceptable dependency, and self-hosting is what keeps `connect-src 'self'`
 * intact.
 *
 * Split loading is the point of this module:
 *   face_detector.task   ~230 KB  BLOCKING
 *   hand_landmarker.task ~7.5 MB  BACKGROUND
 * Blocking the camera stage on 7.5 MB means a 15-second stare at a loader on
 * 4G. Blocking on 230 KB means the camera appears in ~2 s.
 *
 * GPU delegate with CPU fallback on init failure. The fallback path must be
 * exercised in Phase 0, not discovered in Phase 3.
 */

import {
  FaceDetector,
  FilesetResolver,
  HandLandmarker,
  type FaceDetectorResult,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

import { ASSETS, FACE, HANDS } from './config';

export type Delegate = 'GPU' | 'CPU';

export interface VisionBootstrapEvents {
  onProgress?: (label: string, ratio: number) => void;
  onWarning?: (message: string) => void;
}

/** `WasmFileset` is not exported by the package; derive it from the resolver. */
type VisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

let fileset: VisionFileset | null = null;

async function resolveFileset(): Promise<VisionFileset> {
  if (fileset !== null) return fileset;
  fileset = await FilesetResolver.forVisionTasks(ASSETS.wasmPath);
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

/** Blocking. ~230 KB. */
export async function createFaceDetector(
  events: VisionBootstrapEvents = {},
): Promise<FaceDetectorHandle> {
  const vision = await resolveFileset();
  events.onProgress?.('face model', 0.5);

  const build = async (delegate: Delegate): Promise<FaceDetector> =>
    FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: ASSETS.faceModel, delegate },
      runningMode: 'VIDEO',
      minDetectionConfidence: FACE.minDetectionConfidence,
      minSuppressionThreshold: FACE.minSuppressionThreshold,
    });

  try {
    const detector = await build('GPU');
    events.onProgress?.('face model', 1);
    return { detector, delegate: 'GPU' };
  } catch (error) {
    events.onWarning?.(
      `FaceDetector GPU delegate failed, falling back to CPU: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    const detector = await build('CPU');
    events.onProgress?.('face model', 1);
    return { detector, delegate: 'CPU' };
  }
}

/** Background. ~7.5 MB. Never block the camera stage on this. */
export async function createHandLandmarker(
  events: VisionBootstrapEvents = {},
): Promise<HandLandmarkerHandle> {
  const vision = await resolveFileset();
  events.onProgress?.('hand model', 0.5);

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
    const landmarker = await build('GPU');
    events.onProgress?.('hand model', 1);
    return { landmarker, delegate: 'GPU' };
  } catch (error) {
    events.onWarning?.(
      `HandLandmarker GPU delegate failed, falling back to CPU: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    const landmarker = await build('CPU');
    events.onProgress?.('hand model', 1);
    return { landmarker, delegate: 'CPU' };
  }
}

/**
 * One blank inference per model.
 *
 * First-call latency is 5–10× steady state. Doing it here prevents a visible
 * stall on the user's first real frame, and it keeps the p50/p95 measurements
 * honest rather than skewed by a single cold outlier.
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
    /* a cold warm-up failure is not fatal; the real loop will report it */
  }
  try {
    hands?.detectForVideo(video, timestampMs + 1);
  } catch {
    /* as above */
  }
}

export type { FaceDetectorResult, HandLandmarkerResult };
