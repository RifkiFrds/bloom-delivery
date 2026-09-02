/**
 * @vitest-environment jsdom
 *
 * ★ THE LIFECYCLE RULE ★
 *
 * ── A LIFECYCLE SIGNAL RESTORES A SUBSYSTEM. IT NEVER STARTS ONE. ────────
 * `mercy.pause` / `mercy.resume` and `detection.pause` / `detection.resume`
 * are dispatched by the ANY-STATE `VISIBILITY_HIDDEN` / `VISIBILITY_VISIBLE`
 * rows. They therefore arrive in EVERY state, including ones where the
 * subsystem was never started.
 *
 * Two runtime crashes came from breaking this rule:
 *
 *   `Illegal transition: no row for (SEEKING_FACES, MERCY_TICK)`
 *     — `MercyTimer.resume()` was keyed on `handle === null` alone, so tabbing
 *       away and back during the face stage STARTED the ladder from zero, and
 *       twenty seconds later it emitted into a state with no row for it.
 *
 *   and the same shape in `DetectionLoop`, where a pause arriving before the
 *   loop had ever run left `paused = true`, so the next resume started an rAF
 *   with no models loaded.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * These tests are the guard rail. They use fake timers, so they measure the
 * lifecycle logic rather than the wall clock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MercyTimer, levelFor } from '@/detection/mercy';
import { DetectionLoop } from '@/detection/vision/loop';
import { bus } from '@/events/bus';
import { MERCY } from '@/detection/config';
import type { MachineEvent } from '@/machine';

function captureMercyTicks(): { readonly ticks: MachineEvent[]; stop: () => void } {
  const ticks: MachineEvent[] = [];
  const unsubscribe = bus.subscribe((event) => {
    if (event.type === 'MERCY_TICK') ticks.push(event);
  });
  return { ticks, stop: unsubscribe };
}

describe('MercyTimer — the ladder only runs during the gesture stage', () => {
  let capture: ReturnType<typeof captureMercyTicks>;

  beforeEach(() => {
    vi.useFakeTimers();
    capture = captureMercyTicks();
  });

  afterEach(() => {
    capture.stop();
    vi.useRealTimers();
  });

  /** ★ The exact regression: this produced MERCY_TICK in SEEKING_FACES. ★ */
  it('resume() before start() does NOTHING', () => {
    const timer = new MercyTimer();
    timer.resume();

    expect(timer.running).toBe(false);
    vi.advanceTimersByTime(MERCY.thresholdsMs[3] + 5000);
    expect(capture.ticks).toHaveLength(0);
  });

  it('a pause/resume pair before start() does NOTHING', () => {
    const timer = new MercyTimer();
    // Exactly what a visibility change during SEEKING_FACES dispatches.
    timer.pause();
    timer.resume();

    expect(timer.running).toBe(false);
    vi.advanceTimersByTime(MERCY.thresholdsMs[1] + 1000);
    expect(capture.ticks).toHaveLength(0);
  });

  it('resume() after stop() does NOTHING', () => {
    const timer = new MercyTimer();
    timer.start();
    timer.stop();
    timer.resume();

    expect(timer.running).toBe(false);
    vi.advanceTimersByTime(MERCY.thresholdsMs[1] + 1000);
    expect(capture.ticks).toHaveLength(0);
  });

  it('start() arms it, and the rungs fire in order', () => {
    const timer = new MercyTimer();
    timer.start();
    expect(timer.running).toBe(true);

    vi.advanceTimersByTime(MERCY.thresholdsMs[1] + 500);
    expect(capture.ticks).toHaveLength(1);
    expect(timer.currentLevel).toBe(1);

    vi.advanceTimersByTime(MERCY.thresholdsMs[2] - MERCY.thresholdsMs[1]);
    expect(timer.currentLevel).toBe(2);

    timer.stop();
  });

  /**
   * A phone call must not cost the user their patience budget (Doc 02 §6.2).
   * The paused span contributes nothing to the accumulator.
   */
  it('pause() freezes the budget and resume() restores it', () => {
    const timer = new MercyTimer();
    timer.start();

    vi.advanceTimersByTime(10_000);
    const beforePause = timer.elapsedMs;
    expect(beforePause).toBeGreaterThan(9000);

    timer.pause();
    expect(timer.running).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(timer.elapsedMs).toBe(beforePause);
    expect(capture.ticks).toHaveLength(0);

    timer.resume();
    expect(timer.running).toBe(true);
    vi.advanceTimersByTime(11_000);
    expect(capture.ticks).toHaveLength(1);

    timer.stop();
  });

  it('levelFor maps active time to the right rung', () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(MERCY.thresholdsMs[1])).toBe(1);
    expect(levelFor(MERCY.thresholdsMs[2])).toBe(2);
    expect(levelFor(MERCY.thresholdsMs[3])).toBe(3);
  });
});

describe('DetectionLoop — the same rule', () => {
  const noop = (): number => 0;
  const onError = (): void => {
    /* not exercised here */
  };

  it('resume() before start() does NOT begin a loop', () => {
    const loop = new DetectionLoop(noop, onError);
    loop.resume();
    expect(loop.running).toBe(false);
  });

  it('a pause/resume pair before start() does NOT begin a loop', () => {
    const loop = new DetectionLoop(noop, onError);
    loop.pause();
    loop.resume();
    expect(loop.running).toBe(false);
  });

  it('resume() after stop() does NOT restart it', () => {
    const loop = new DetectionLoop(noop, onError);
    loop.start();
    expect(loop.running).toBe(true);

    // `stop()` is the teardown. Nothing may bring the loop back afterwards —
    // an rAF running against closed MediaPipe tasks throws inside WASM.
    loop.stop();
    loop.resume();
    expect(loop.running).toBe(false);
  });

  it('pause() then resume() restores a loop that WAS running', () => {
    const loop = new DetectionLoop(noop, onError);
    loop.start();
    loop.pause();
    expect(loop.running).toBe(false);

    loop.resume();
    expect(loop.running).toBe(true);
    loop.stop();
  });
});
