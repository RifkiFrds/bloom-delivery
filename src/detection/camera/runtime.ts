/**
 * Camera runtime — the stateful owner of the stream. Doc 01 §4.1 stage 0.
 *
 * Framework-free by rule (Doc 01 §2.1 B1): it emits FSM events on the bus and
 * exposes plain methods. It never renders and never touches the store.
 *
 * ── THE SEQUENCING PROBLEM THIS SOLVES ───────────────────────────────────
 * `getUserMedia` must be called synchronously inside a user gesture, but the
 * `<video>` element it will feed does not exist yet at that moment — the camera
 * stage mounts a state later, on `LOADING_DETECTION`.
 *
 * So acquisition and attachment are split. `acquire()` runs inside the gesture
 * and holds the stream; `bindVideo()` is called by the camera stage when it
 * mounts, and attachment happens at whichever of the two arrives last. Neither
 * has to know about the other's timing.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { bus } from '@/events/bus';
import { record } from '@/lib/diagnostics';
import { attachStream, CameraError, classifyCameraError, requestStream } from './acquire';
import { bindLifecycle } from './lifecycle';
import { teardownCamera, type TeardownResult } from './teardown';

export class CameraRuntime {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private detachLifecycle: (() => void) | null = null;
  private requesting = false;
  private attached = false;
  private torndown = false;
  /** `TRACK_ENDED` gets exactly one silent automatic re-acquisition. */
  private reacquired = false;
  /** A `TRACK_RECOVERED` may only follow a mute we actually observed. */
  private muteSeen = false;
  /** The 120 s cap is deliberate and permanent — no recovery past it. */
  private capped = false;
  private capturedFrame: HTMLCanvasElement | null = null;

  /**
   * Called from the `camera.acquire` effect, which the reducer dispatches
   * synchronously inside the user's tap. Nothing may be awaited before
   * `requestStream()` or iOS Safari's user-activation window closes.
   *
   * Idempotent: a second call while a request is in flight, or after a stream
   * exists, is a no-op rather than a second prompt.
   */
  acquire(): void {
    if (this.stream !== null) return;
    this.request('initial');
  }

  /**
   * Re-acquire after an interruption. Announces itself with `TRACK_RECOVERED`,
   * NOT `PERMISSION_GRANTED`.
   *
   * ── WHY THE TWO PATHS ARE SEPARATE ─────────────────────────────────────
   * `PERMISSION_GRANTED` is only legal in `REQUESTING_CAMERA`. A recovery
   * happens from `CAMERA_INTERRUPTED`, and the stream resolves ASYNCHRONOUSLY —
   * so by the time it arrives the machine is in whatever state the interruption
   * came from. Emitting `PERMISSION_GRANTED` there is an illegal transition,
   * which throws in development.
   *
   * On failure this emits NOTHING. Doc 02 §2.14: after a second failed
   * re-acquisition "the escape hatch remains the way forward" — the machine
   * stays in `CAMERA_INTERRUPTED` rather than being pushed somewhere new.
   * ─────────────────────────────────────────────────────────────────────────
   */
  reacquire(): void {
    if (this.capped) {
      record('camera: re-acquisition refused — 120 s cap reached');
      return;
    }
    this.reacquired = false;
    this.request('recover');
  }

  private request(mode: 'initial' | 'recover'): void {
    if (this.torndown || this.requesting) return;
    this.requesting = true;

    if (mode === 'recover') {
      this.stream = null;
      this.attached = false;
    }

    requestStream().then(
      (stream) => {
        this.requesting = false;
        if (this.torndown) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        this.stream = stream;
        this.muteSeen = false;
        this.bindTrackLifecycle(stream);
        record(`camera: stream ${mode === 'initial' ? 'acquired' : 'recovered'}`);
        bus.emit(
          mode === 'initial'
            ? { type: 'PERMISSION_GRANTED' }
            : { type: 'TRACK_RECOVERED' },
        );
        void this.attachIfPossible();
      },
      (error: unknown) => {
        this.requesting = false;
        const kind = classifyCameraError(error);
        record(`camera: ${mode} request failed — ${kind}`);

        // A failed RECOVERY is not a new permission outcome. Staying put is the
        // designed behaviour; the escape hatch is already on screen.
        if (mode === 'recover') return;

        if (kind === 'NotAllowedError') {
          bus.emit({ type: 'PERMISSION_DENIED' });
          return;
        }
        bus.emit({ type: 'CAMERA_FAILED', kind });
      },
    );
  }

  /** True while a permission prompt may be on screen. Gates the retry CTA. */
  isRequesting(): boolean {
    return this.requesting;
  }

  hasStream(): boolean {
    return this.stream !== null;
  }

  /** Called by the camera stage on mount. Attaches immediately if ready. */
  bindVideo(element: HTMLVideoElement | null): void {
    this.video = element;
    if (element !== null) void this.attachIfPossible();
  }

  private async attachIfPossible(): Promise<void> {
    if (this.attached || this.torndown) return;
    const { stream, video } = this;
    if (stream === null || video === null) return;

    this.attached = true;
    try {
      await attachStream(stream, video);
      record('camera: preview attached');
    } catch (error) {
      this.attached = false;
      const kind = error instanceof CameraError ? error.kind : 'Unknown';
      record(`camera: attach failed (${kind})`);
      // NOT `CAMERA_FAILED`: attachment only happens once the camera stage has
      // mounted, which is `LOADING_DETECTION` at the earliest, and
      // `CAMERA_FAILED` is legal only in `REQUESTING_CAMERA`. A stream that
      // cannot be attached is a camera we have lost, which is precisely what
      // `TRACK_ENDED` means.
      bus.emit({ type: 'TRACK_ENDED' });
    }
  }

  private bindTrackLifecycle(stream: MediaStream): void {
    this.detachLifecycle?.();
    this.detachLifecycle = bindLifecycle(stream, {
      onMuted: () => {
        record('camera: track muted');
        this.muteSeen = true;
        bus.emit({ type: 'TRACK_MUTED' });
      },
      onUnmuted: () => {
        // Some platforms fire `unmute` spontaneously as the stream starts.
        // `TRACK_RECOVERED` is legal only in `CAMERA_INTERRUPTED`, so it may
        // only follow a mute we actually saw.
        if (!this.muteSeen) {
          record('camera: spurious unmute ignored');
          return;
        }
        this.muteSeen = false;
        record('camera: track unmuted');
        bus.emit({ type: 'TRACK_RECOVERED' });
      },
      onEnded: () => {
        record('camera: track ended');

        // Doc 02 §2.14 E4 places the automatic re-acquisition inside
        // CAMERA_INTERRUPTED's ENTRY, so the machine moves there FIRST. The
        // earlier arrangement retried before emitting, which meant a successful
        // retry emitted its result into `SEEKING_FACES` — an illegal pair.
        bus.emit({ type: 'TRACK_ENDED' });

        if (!this.reacquired && !this.capped) {
          this.reacquired = true;
          record('camera: automatic re-acquisition (1 of 1)');
          this.request('recover');
        }
      },
      onCap: () => {
        // Doc 04 §B.9: the camera goes HARD OFF at 120 s, for battery, thermal
        // and privacy hygiene. Emitting an event without stopping the tracks
        // left it running.
        record('camera: 120 s hard cap reached — stopping tracks');
        this.capped = true;
        for (const track of stream.getTracks()) track.stop();
        bus.emit({ type: 'TRACK_ENDED' });
      },
    });
  }

  /** True once the 120 s cap has fired. The camera never comes back. */
  isCapped(): boolean {
    return this.capped;
  }

  currentVideo(): HTMLVideoElement | null {
    return this.video;
  }

  currentStream(): MediaStream | null {
    return this.stream;
  }

  /** The last live frame, un-mirrored. Survives into `RESTING`. */
  frame(): HTMLCanvasElement | null {
    return this.capturedFrame;
  }

  /**
   * The ordered teardown (Doc 02 §2.15). Idempotent, so `REPLAY_TAPPED` can
   * route through `UNLOCKING` with every step a no-op.
   */
  teardown(cancelLoop: () => void, closeTasks: () => void): TeardownResult {
    if (this.torndown) {
      return {
        assertionPassed: true,
        capturedFrame: this.capturedFrame,
        trackStates: [],
      };
    }
    this.torndown = true;

    this.detachLifecycle?.();
    this.detachLifecycle = null;

    const result = teardownCamera({
      cancelLoop,
      stream: this.stream,
      video: this.video,
      closeTasks,
    });

    this.capturedFrame = result.capturedFrame;
    this.stream = null;
    this.attached = false;
    return result;
  }

  isTorndown(): boolean {
    return this.torndown;
  }
}

/** One per session. The camera is a singleton resource; so is its owner. */
export const cameraRuntime = new CameraRuntime();
