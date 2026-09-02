/**
 * The mercy ladder — Doc 01 §9.4, Doc 02 §6.2, Doc 03 §6.7.
 *
 * ── THE MECHANISM THAT GUARANTEES DELIVERY ───────────────────────────────
 *   0–20 s   G1 only, M = 1.00, confidence 0.50, hatch focusable but hidden
 *   20–45 s  G1 ∨ G2 ∨ G3, M = 1.25, confidence 0.40, warmer coaching
 *   45–90 s  same, hatch VISIBLE, styled as a gift
 *   90 s+    same, hatch is the PRIMARY CTA
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── ACTIVE TIME, NOT WALL CLOCK ──────────────────────────────────────────
 * The ladder pauses on `VISIBILITY_HIDDEN` and `CAMERA_INTERRUPTED`. A phone
 * call must not cost the user their patience budget — backgrounding for sixty
 * seconds costs zero mercy.
 *
 * The elapsed time is therefore accumulated from measured deltas rather than
 * read from a start timestamp. A `Date.now() - startedAt` implementation cannot
 * express a pause and is the exact bug this design forecloses.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * IT NEVER FIRES ITSELF. The ladder escalates help; the escape hatch is always
 * a tap. An auto-unlock reads as a bug and steals the moment of agency that
 * makes the unlock feel earned.
 */

import { bus } from '@/events/bus';
import type { MercyLevel } from '@/machine';
import { MERCY } from './config';

const TICK_MS = 250;

export class MercyTimer {
  private activeMs = 0;
  private level: MercyLevel = 0;
  private handle: number | null = null;
  private lastTickAt = 0;
  /**
   * ARMED between `start()` and `stop()` — the gesture stage, and only that.
   *
   * ── WHY THIS IS SEPARATE FROM `handle` ──────────────────────────────────
   * `mercy.pause` and `mercy.resume` are dispatched by the ANY-STATE
   * `VISIBILITY_HIDDEN` / `VISIBILITY_VISIBLE` rows, so they arrive in every
   * state, including ones where the ladder was never started.
   *
   * With `resume()` keyed on `handle === null` alone, tabbing away and back
   * during `SEEKING_FACES` STARTED the ladder from zero, and twenty seconds
   * later it emitted `MERCY_TICK` into a state with no row for it.
   *
   * A lifecycle signal must never START a subsystem that was not already
   * running. It may only restore one.
   * ─────────────────────────────────────────────────────────────────────────
   */
  private armed = false;

  /** Called on entering `SEEKING_GESTURE`. Restarts the ladder from zero. */
  start(): void {
    this.stop();
    this.armed = true;
    this.activeMs = 0;
    this.level = 0;
    this.run();
  }

  /** Freezes the accumulator. The budget is preserved exactly. */
  pause(): void {
    if (this.handle === null) return;
    window.clearInterval(this.handle);
    this.handle = null;
  }

  resume(): void {
    // Not armed = the gesture stage has not begun, or is already over.
    if (!this.armed || this.handle !== null) return;
    this.run();
  }

  stop(): void {
    this.pause();
    this.armed = false;
    this.activeMs = 0;
    this.level = 0;
  }

  /** Starts the interval with a fresh delta baseline, so a pause costs zero. */
  private run(): void {
    this.lastTickAt = performance.now();
    this.handle = window.setInterval(() => {
      this.tick();
    }, TICK_MS);
  }

  private tick(): void {
    const now = performance.now();
    const dt = now - this.lastTickAt;
    this.lastTickAt = now;
    // A tab that was throttled rather than hidden can deliver a large delta;
    // cap it so a background throttle cannot skip a rung.
    this.activeMs += Math.min(dt, TICK_MS * 4);

    const reached = levelFor(this.activeMs);
    if (reached > this.level) {
      this.level = reached;
      bus.emit({ type: 'MERCY_TICK', level: reached });
    }
  }

  get elapsedMs(): number {
    return this.activeMs;
  }

  get currentLevel(): MercyLevel {
    return this.level;
  }

  get running(): boolean {
    return this.handle !== null;
  }
}

/** PURE. The ladder itself, so it can be unit-tested without a clock. */
export function levelFor(activeMs: number): MercyLevel {
  const [, one, two, three] = MERCY.thresholdsMs;
  if (activeMs >= three) return 3;
  if (activeMs >= two) return 2;
  if (activeMs >= one) return 1;
  return 0;
}

/**
 * The permissiveness property the whole ladder rests on is asserted
 * BEHAVIOURALLY in `tests/gesture.test.ts` (Doc 05 P4.9): a borderline hand
 * that level 0 rejects must be accepted at level 1.
 *
 * A constant-comparison helper was written here first and deleted — with the
 * multipliers declared `as const`, TypeScript proves it tautologically true,
 * which means it can never catch the regression it exists to catch. The test
 * has to run the real evaluator.
 */

export const mercyTimer = new MercyTimer();
