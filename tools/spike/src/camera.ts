/**
 * Camera acquisition — Doc 01 §4.1 stage 0, Doc 02 §2.5.
 *
 * Constraints are deliberate:
 *   720p not 1080p — halves decode cost, MediaPipe downsamples internally.
 *   audio: false    — requesting audio triggers a scarier two-device prompt
 *                     and adds a second permission to lose.
 *
 * The video element needs `playsInline muted autoPlay` — ALL THREE. Without
 * `playsInline`, iOS Safari takes the video fullscreen and the entire UI
 * disappears.
 *
 * Display is mirrored with CSS `scaleX(-1)`; INFERENCE RUNS ON THE RAW,
 * UNMIRRORED FRAME. The overlay canvas applies the same mirror. One
 * conversion, one place (Doc 03 §2.2).
 */

import { CAMERA } from './config';

/** The six distinct `getUserMedia` rejections, per Doc 01 §9.2. */
export type CameraErrorKind =
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'OverconstrainedError'
  | 'SecurityError'
  | 'AbortError'
  | 'Unsupported'
  | 'Unknown';

export class CameraError extends Error {
  constructor(
    readonly kind: CameraErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'CameraError';
  }
}

const TERMINAL: ReadonlySet<CameraErrorKind> = new Set([
  'NotFoundError',
  'SecurityError',
  'OverconstrainedError',
  'Unsupported',
]);

/** Terminal errors go to Lite, not into a retry loop (Doc 02 §4). */
export function isTerminalCameraError(kind: CameraErrorKind): boolean {
  return TERMINAL.has(kind);
}

function classify(error: unknown): CameraErrorKind {
  if (error instanceof DOMException || (error instanceof Error && 'name' in error)) {
    const { name } = error;
    switch (name) {
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
  return 'Unknown';
}

export interface CameraHandle {
  readonly stream: MediaStream;
  readonly video: HTMLVideoElement;
  readonly settings: MediaTrackSettings;
}

export async function acquireCamera(video: HTMLVideoElement): Promise<CameraHandle> {
  if (!window.isSecureContext) {
    throw new CameraError(
      'SecurityError',
      'Not a secure context. getUserMedia requires HTTPS — run the spike over the HTTPS dev server.',
    );
  }
  if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    throw new CameraError(
      'Unsupported',
      'navigator.mediaDevices.getUserMedia is unavailable.',
    );
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: CAMERA.width },
        height: { ideal: CAMERA.height },
        frameRate: { ideal: CAMERA.frameRate, max: CAMERA.frameRate },
      },
      audio: false,
    });
  } catch (error) {
    const kind = classify(error);
    throw new CameraError(kind, error instanceof Error ? error.message : String(error));
  }

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  await video.play();
  await waitForFirstFrame(video);

  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings() ?? {};

  return { stream, video, settings };
}

function waitForFirstFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(
        new CameraError(
          'AbortError',
          'Timed out waiting for the first camera frame (8 s).',
        ),
      );
    }, 8000);

    const finish = (): void => {
      window.clearTimeout(timeout);
      resolve();
    };

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      finish();
      return;
    }
    video.addEventListener('loadeddata', finish, { once: true });
  });
}

/**
 * Full teardown, in the order Doc 02 §2.15 requires.
 *
 * The caller MUST cancel the detection loop BEFORE calling this, or an
 * in-flight `detectForVideo` resolves against a closed task and throws.
 *
 * Returns true when every track reached `ended` — the assertion the production
 * teardown makes at Phase 5.
 */
export function releaseCamera(handle: CameraHandle | null): boolean {
  if (handle === null) return true;
  for (const track of handle.stream.getTracks()) track.stop();
  handle.video.srcObject = null;
  return handle.stream.getTracks().every((track) => track.readyState === 'ended');
}
