/**
 * Camera acquisition — Doc 01 §4.1 stage 0, Doc 02 §2.5.
 *
 * Constraints are deliberate:
 *   720p not 1080p — halves decode cost, MediaPipe downsamples internally.
 *   audio: false    — requesting audio triggers a scarier two-device prompt
 *                     and adds a second permission to lose.
 *
 * ── THE USER-ACTIVATION RULE ─────────────────────────────────────────────
 * `getUserMedia` must be called SYNCHRONOUSLY inside the click handler. Any
 * `await` before the call breaks iOS Safari's user-activation requirement and
 * the prompt never appears. `acquireCamera` therefore performs no async work
 * of its own before the call — the video element is attached afterwards.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Display is mirrored with CSS `scaleX(-1)`; INFERENCE RUNS ON THE RAW,
 * UNMIRRORED FRAME. The overlay canvas applies the same mirror. One conversion,
 * one place (Doc 03 §2.2).
 */

import type { CameraErrorKind } from '@/machine';
import { CAMERA } from '../config';

export class CameraError extends Error {
  constructor(
    readonly kind: CameraErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'CameraError';
  }
}

/**
 * The six distinct `getUserMedia` rejections, mapped to their branch.
 *
 * Legacy aliases are included because older WebViews — the ones most likely to
 * be in play here — still throw the pre-standard names.
 */
export function classifyCameraError(error: unknown): CameraErrorKind {
  if (error instanceof CameraError) return error.kind;
  if (!(error instanceof Error)) return 'Unknown';

  switch (error.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'NotAllowedError';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'NotFoundError';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'NotReadableError';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'OverconstrainedError';
    case 'SecurityError':
      return 'SecurityError';
    case 'AbortError':
      return 'AbortError';
    default:
      return 'Unknown';
  }
}

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: 'user',
    width: { ideal: CAMERA.width },
    height: { ideal: CAMERA.height },
    frameRate: { ideal: CAMERA.frameRate, max: CAMERA.frameRate },
  },
  audio: false,
};

/**
 * Request the stream. NOTHING may be awaited before `getUserMedia` here.
 *
 * Rejects with a `CameraError` carrying the classified kind, so the caller maps
 * one value to one screen rather than re-sniffing a DOMException.
 */
export async function requestStream(): Promise<MediaStream> {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    throw new CameraError(
      'SecurityError',
      'getUserMedia requires a secure context (https).',
    );
  }
  // `mediaDevices` is typed non-nullish but is genuinely absent in insecure
  // contexts and inside several in-app WebViews — the exact case this guard
  // exists to catch.
  if (
    !('mediaDevices' in navigator) ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    throw new CameraError('Unsupported', 'navigator.mediaDevices is unavailable.');
  }

  try {
    return await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
  } catch (error) {
    throw new CameraError(
      classifyCameraError(error),
      error instanceof Error ? error.message : String(error),
    );
  }
}

export interface CameraHandle {
  readonly stream: MediaStream;
  readonly video: HTMLVideoElement;
  readonly settings: MediaTrackSettings;
}

/**
 * Attach an acquired stream to the preview element and wait for the first
 * decoded frame.
 *
 * `playsInline muted autoPlay` — ALL THREE. Without `playsInline`, iOS Safari
 * takes the video fullscreen and the entire UI disappears (Doc 04 §B.5).
 */
export async function attachStream(
  stream: MediaStream,
  video: HTMLVideoElement,
): Promise<CameraHandle> {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  try {
    await video.play();
  } catch (error) {
    throw new CameraError(
      'AbortError',
      `The preview could not start: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  await waitForFirstFrame(video);

  const track = stream.getVideoTracks()[0];
  return { stream, video, settings: track?.getSettings() ?? {} };
}

function waitForFirstFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (): void => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadeddata', done);
      resolve();
    };

    const timeout = window.setTimeout(() => {
      video.removeEventListener('loadeddata', done);
      reject(
        new CameraError('AbortError', 'Timed out waiting for the first camera frame.'),
      );
    }, CAMERA.firstFrameTimeoutMs);

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      done();
      return;
    }
    video.addEventListener('loadeddata', done);
  });
}
