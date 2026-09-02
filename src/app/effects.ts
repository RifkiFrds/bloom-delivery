/**
 * Effect wiring — the one place where declarative effect descriptors meet the
 * layers that can actually perform them (Doc 01 §3, layer 3).
 *
 * ── WHY THE REDUCER RETURNS DESCRIPTORS INSTEAD OF DOING THINGS ──────────
 * The machine stays pure and total, so the entire experience is deterministically
 * testable by replaying an event log with no camera, no audio and no WebGL. All
 * of the impurity lives here, in a module that owns no state of its own.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * This module is allowed to read the store, because two effects are genuinely
 * policy rather than mechanism:
 *   · the `TOGETHER_CONFIRMED` beat extends while the hand model is in flight
 *   · `camera.teardown` is a no-op on replay (`skipCameraStage`)
 * Putting either in the framework-free layers would require them to reach
 * upward, which is the coupling this arrangement exists to prevent.
 */

import { audio } from '@/audio/manager';
import { unlockAudio } from '@/audio/unlock';
import { cameraRuntime } from '@/detection/camera/runtime';
import { BEATS_TOGETHER_MAX_MS } from '@/machine/timing';
import { mercyTimer } from '@/detection/mercy';
import { detectionRuntime } from '@/detection/runtime';
import { bus } from '@/events/bus';
import { prefetchBundle } from '@/lib/assets';
import { record } from '@/lib/diagnostics';
import { write } from '@/lib/persistence';
import { cancelAllTimers, cancelTimer, startTimer } from '@/lib/timers';
import type { TimerId } from '@/machine';
import { effectRunner, useMachineStore } from '@/store/machineStore';

/** Which event each named beat emits when it elapses (Doc 02 §2 "T" rows). */
const TIMER_EVENT: Readonly<Record<TimerId, () => void>> = {
  modelTimeout: () => {
    bus.emit({ type: 'MODELS_FAILED' });
  },
  togetherBeat: () => {
    endTogetherBeat();
  },
  unlockBeat: () => {
    bus.emit({ type: 'SEQUENCE_STEP_DONE' });
  },
  deliveryBeat: () => {
    bus.emit({ type: 'SEQUENCE_STEP_DONE' });
  },
  bloomBeat: () => {
    bus.emit({ type: 'SEQUENCE_STEP_DONE' });
  },
  messageBeat: () => {
    bus.emit({ type: 'SEQUENCE_STEP_DONE' });
  },
  letterSettle: () => {
    bus.emit({ type: 'SEQUENCE_STEP_DONE' });
  },
};

let togetherBeatStartedAt = 0;

/**
 * The `TOGETHER_CONFIRMED` beat — 1.2 s, extending to 5 s while the hand model
 * is still downloading (Doc 02 §2.11, Doc 01 §7.2).
 *
 * The user reads a celebration; the system is finishing a 7.5 MB download. Both
 * purposes are deliberate and neither is disclosed.
 *
 * Past 5 s without the model the beat stops re-arming and the scene surfaces the
 * escape hatch, because `canSeekGesture` can no longer be satisfied and a
 * gesture stage that cannot see hands is indistinguishable from a broken product
 * (Doc 01 §7.5).
 */
function endTogetherBeat(): void {
  const { context } = useMachineStore.getState();
  const elapsed = Date.now() - togetherBeatStartedAt;

  if (!context.handModelReady && elapsed < BEATS_TOGETHER_MAX_MS) {
    startTimer('togetherBeat', 200, TIMER_EVENT.togetherBeat);
    return;
  }
  bus.emit({ type: 'SEQUENCE_STEP_DONE' });
}

let registered = false;

/**
 * Idempotent. Called from the client root before the first event is emitted.
 */
export function registerEffectHandlers(): void {
  if (registered) return;
  registered = true;

  // ── Audio ───────────────────────────────────────────────────────────────
  // MUST run synchronously inside the Start click. See `audio/unlock.ts`.
  effectRunner.register('audio.unlock', () => {
    unlockAudio();
  });
  effectRunner.register('audio.play', (effect) => {
    if (effect.kind !== 'audio.play') return;
    audio.playMusic(effect.fadeMs);
  });
  effectRunner.register('audio.setMuted', (effect) => {
    if (effect.kind !== 'audio.setMuted') return;
    audio.setMuted(effect.muted);
  });

  // ── Assets ──────────────────────────────────────────────────────────────
  effectRunner.register('assets.prefetch', (effect) => {
    if (effect.kind !== 'assets.prefetch') return;
    // The audio bundle is loaded by Howler itself, which decodes as well as
    // fetches; a raw prefetch would download the same bytes twice.
    if (effect.bundle === 'audio') {
      audio.load();
      return;
    }
    prefetchBundle(effect.bundle);
  });

  // ── Camera ──────────────────────────────────────────────────────────────
  effectRunner.register('camera.acquire', () => {
    cameraRuntime.acquire();
  });
  // Attachment is driven by whichever of the stream and the <video> element
  // arrives last, so this effect only has to nudge the runtime.
  effectRunner.register('camera.attach', () => {
    cameraRuntime.bindVideo(cameraRuntime.currentVideo());
  });
  // The 120 s cap is armed inside `bindLifecycle` at acquisition, because it is
  // an absolute camera-on budget rather than a per-stage one.
  effectRunner.register('camera.armCap', () => {
    record('camera: 120 s cap armed');
  });

  effectRunner.register('camera.teardown', () => {
    performTeardown();
  });

  // ── Persistence ─────────────────────────────────────────────────────────
  effectRunner.register('persist.write', (effect) => {
    if (effect.kind !== 'persist.write') return;
    write(effect.key, effect.value);
  });

  // ── Timers ──────────────────────────────────────────────────────────────
  effectRunner.register('timer.start', (effect) => {
    if (effect.kind !== 'timer.start') return;
    if (effect.id === 'togetherBeat') togetherBeatStartedAt = Date.now();
    startTimer(effect.id, effect.ms, TIMER_EVENT[effect.id]);
  });
  effectRunner.register('timer.cancel', (effect) => {
    if (effect.kind !== 'timer.cancel') return;
    cancelTimer(effect.id);
  });

  // ── Diagnostics ─────────────────────────────────────────────────────────
  effectRunner.register('diagnostic.record', (effect) => {
    if (effect.kind !== 'diagnostic.record') return;
    record(effect.message);
  });

  // ── Detection ───────────────────────────────────────────────────────────
  effectRunner.register('detection.start', () => {
    detectionRuntime.start();
  });
  effectRunner.register('detection.stop', () => {
    detectionRuntime.cancelLoop();
  });
  effectRunner.register('detection.enableHands', () => {
    detectionRuntime.enableHands();
  });

  // Pausing covers three things at once, and all three must move together: the
  // loop, the AudioContext (iOS suspends it anyway), and — via `mercy.pause` —
  // the patience budget. A phone call must not cost the user any of them.
  effectRunner.register('detection.pause', () => {
    detectionRuntime.pause();
    audio.onHidden();
  });
  effectRunner.register('detection.resume', () => {
    detectionRuntime.resume();
    audio.onVisible();
  });

  // ── Mercy ───────────────────────────────────────────────────────────────
  effectRunner.register('mercy.start', () => {
    mercyTimer.start();
  });
  effectRunner.register('mercy.pause', () => {
    mercyTimer.pause();
  });
  effectRunner.register('mercy.resume', () => {
    mercyTimer.resume();
  });

  // The teardown needs the detection layer's two cancellation callbacks, in
  // the order `camera/teardown.ts` fixes: cancel the loop, THEN close the tasks.
  registerDetectionTeardown(detectionRuntime.cancelLoop, detectionRuntime.closeTasks);
}

/**
 * `UNLOCKING` entry. The ORDER is fixed in `camera/teardown.ts`; this function
 * only supplies the two cancellation callbacks and the replay short-circuit.
 */
function performTeardown(): void {
  const { context } = useMachineStore.getState();

  // Replay re-enters UNLOCKING with `skipCameraStage`, and every teardown step
  // is then a no-op — the camera is never re-requested after the first unlock
  // (Doc 02 §2.21).
  if (context.skipCameraStage) {
    record('teardown: skipped (replay)');
    return;
  }

  cancelAllTimers();
  mercyTimer.stop();
  const result = cameraRuntime.teardown(cancelDetectionLoop, closeVisionTasks);
  record(`teardown: assertion ${result.assertionPassed ? 'passed' : 'FAILED'}`);
}

// Replaced by the detection layer once it exists. Kept as named functions so
// the teardown ordering contract is readable at the call site.
let cancelDetectionLoop: () => void = () => {
  /* no loop yet */
};
let closeVisionTasks: () => void = () => {
  /* no tasks yet */
};

/** The detection layer registers its own cancellation into the teardown. */
export function registerDetectionTeardown(
  cancelLoop: () => void,
  closeTasks: () => void,
): void {
  cancelDetectionLoop = cancelLoop;
  closeVisionTasks = closeTasks;
}
