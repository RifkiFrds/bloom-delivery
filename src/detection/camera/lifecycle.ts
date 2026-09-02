/**
 * Camera lifecycle — Doc 02 §2.5 X2, §2.14, Doc 01 §9.2.
 *
 * Three things can take the camera away without the app doing anything:
 *
 *   `track.onmute`   a phone call, an app switch, an OS-level interruption
 *   `track.onended`  the track was revoked outright
 *   the 120 s cap    our own hygiene rule — battery, thermals, privacy
 *
 * The first two produce `CAMERA_INTERRUPTED`, which PAUSES the mercy timers.
 * A phone call must not cost the user their patience budget (Doc 02 §6.2).
 *
 * On `TRACK_ENDED` the caller re-acquires automatically ONCE before any UI is
 * shown (Doc 01 §9.5 principle 3); this module only reports the edge.
 */

import { CAMERA } from '../config';

export interface LifecycleCallbacks {
  readonly onMuted: () => void;
  readonly onEnded: () => void;
  readonly onUnmuted: () => void;
  /** The 120 s absolute cap elapsed. The escape hatch becomes the way forward. */
  readonly onCap: () => void;
}

/**
 * Binds track listeners and the absolute cap. Returns the detach function.
 *
 * The cap is armed at acquisition, not at gesture-stage entry: it is an
 * absolute camera-on budget, not a per-stage one.
 */
export function bindLifecycle(
  stream: MediaStream,
  callbacks: LifecycleCallbacks,
): () => void {
  const tracks = stream.getVideoTracks();

  const handleMute = (): void => {
    callbacks.onMuted();
  };
  const handleUnmute = (): void => {
    callbacks.onUnmuted();
  };
  const handleEnded = (): void => {
    callbacks.onEnded();
  };

  for (const track of tracks) {
    track.addEventListener('mute', handleMute);
    track.addEventListener('unmute', handleUnmute);
    track.addEventListener('ended', handleEnded);
  }

  const capTimer = window.setTimeout(() => {
    callbacks.onCap();
  }, CAMERA.hardCapMs);

  return () => {
    window.clearTimeout(capTimer);
    for (const track of tracks) {
      track.removeEventListener('mute', handleMute);
      track.removeEventListener('unmute', handleUnmute);
      track.removeEventListener('ended', handleEnded);
    }
  };
}

/** True while at least one video track is live and unmuted. */
export function isStreamHealthy(stream: MediaStream | null): boolean {
  if (stream === null) return false;
  return stream
    .getVideoTracks()
    .some((track) => track.readyState === 'live' && !track.muted);
}
