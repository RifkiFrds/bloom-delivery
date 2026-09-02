/**
 * ★ THE TEARDOWN ★ — Doc 02 §2.15, Doc 01 §2.1.
 *
 * ── THE ORDER IS NOT NEGOTIABLE ──────────────────────────────────────────
 *   1. capture the last frame        (it becomes "Save our photo")
 *   2. cancelAnimationFrame(loop)    BEFORE closing any task
 *   3. stream.getTracks().stop()     the indicator light goes out here
 *   4. faceDetector.close(); handLandmarker.close()
 *   5. ASSERT every track.readyState === 'ended'
 *
 * Cancelling the loop before closing the tasks is the whole point of the
 * ordering: an in-flight `detectForVideo` that resolves against a closed task
 * throws inside WASM, which surfaces as an unhandled error at the emotional
 * peak of the experience.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * This is also the memory strategy. Both MediaPipe tasks are closed and every
 * track stopped BEFORE the 3D scene allocates, which is what makes the
 * measurable heap drop a Phase 5 exit criterion rather than a hope.
 */

import { record } from '@/lib/diagnostics';

export interface TeardownTargets {
  /** Cancels the rAF loop. Must be idempotent. */
  readonly cancelLoop: () => void;
  readonly stream: MediaStream | null;
  readonly video: HTMLVideoElement | null;
  /** Closes both MediaPipe tasks. Must be idempotent. */
  readonly closeTasks: () => void;
}

export interface TeardownResult {
  /** True when every track reached `ended`. The camera light is off. */
  readonly assertionPassed: boolean;
  /** The last camera frame, un-mirrored, for "Save our photo". */
  readonly capturedFrame: HTMLCanvasElement | null;
  readonly trackStates: readonly string[];
}

/**
 * Capture the current video frame to an offscreen canvas.
 *
 * NOT mirrored. The preview is mirrored for display only; a saved photo with
 * mirrored text in it is the embarrassing version of this feature
 * (Doc 02 §2.21, Doc 04 §B.15).
 */
export function captureFrame(video: HTMLVideoElement | null): HTMLCanvasElement | null {
  if (video === null || video.videoWidth === 0 || video.videoHeight === 0) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context === null) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch {
    // A capture failure costs the photo, never the unlock.
    return null;
  }
}

export function teardownCamera(targets: TeardownTargets): TeardownResult {
  // 1 — the frame, while the stream is still live.
  const capturedFrame = captureFrame(targets.video);

  // 2 — the loop, BEFORE the tasks.
  targets.cancelLoop();

  // 3 — the tracks. The camera indicator light goes out on this line.
  const tracks = targets.stream?.getTracks() ?? [];
  for (const track of tracks) track.stop();

  // 4 — the tasks, now that nothing can be mid-inference.
  targets.closeTasks();

  if (targets.video !== null) {
    targets.video.srcObject = null;
    targets.video.removeAttribute('src');
    targets.video.load();
  }

  // 5 — the assertion. Recorded either way; never thrown. A failed assertion
  // must not break the gift, but it must be visible in the diagnostic.
  const trackStates = tracks.map((track) => track.readyState);
  const assertionPassed = trackStates.every((state) => state === 'ended');

  record(
    assertionPassed
      ? `teardown: ${String(tracks.length)} track(s) ended, tasks closed`
      : `teardown ASSERTION FAILED: ${trackStates.join(',')}`,
  );

  return { assertionPassed, capturedFrame, trackStates };
}
