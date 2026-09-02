/**
 * Hold timer — Doc 03 §7.2.
 *
 *   present: hold = min(hold + dt, 900);  grace = 200
 *   absent : grace > 0 ? grace -= dt : hold = max(hold - dt × 2, 0)
 *
 * THE GRACE AND THE DECAY ARE DELIBERATE UX, NOT LENIENCY. A hard reset to
 * zero on a single dropped frame is punishing and feels broken. Visible decay
 * says "you had it, come back" — which is itself coaching, and the only
 * coaching that operates on a sub-second timescale.
 *
 * Uses MEASURED dt, not a tick count, so the hold is wall-clock accurate at any
 * cadence. A Tier 2 device running at 10 Hz still requires 900 ms of real
 * holding; a tick-count implementation would make the gesture 50% longer on
 * exactly the devices whose users are least patient.
 */

import { HOLD } from '../config';

export interface HoldState {
  readonly holdMs: number;
  readonly progress: number;
  /** True on the tick the hold first reaches the target. Fires once. */
  readonly completed: boolean;
}

export class HoldTimer {
  private holdMs = 0;
  private graceRemaining = 0;
  private hasCompleted = false;

  /** @param dtMs measured elapsed time since the previous tick. */
  update(gesturePresent: boolean, dtMs: number): HoldState {
    // Guard against a stalled tab producing an enormous dt.
    const dt = Math.max(0, Math.min(dtMs, HOLD.maxDtMs));

    if (gesturePresent) {
      this.holdMs = Math.min(this.holdMs + dt, HOLD.targetMs);
      this.graceRemaining = HOLD.graceMs;
    } else if (this.graceRemaining > 0) {
      this.graceRemaining = Math.max(0, this.graceRemaining - dt);
    } else {
      this.holdMs = Math.max(0, this.holdMs - dt * HOLD.decayMultiplier);
    }

    let completed = false;
    if (this.holdMs >= HOLD.targetMs && !this.hasCompleted) {
      this.hasCompleted = true;
      completed = true;
    }
    // Allow a fresh completion only after the hold has fully decayed away.
    if (this.holdMs <= 0) this.hasCompleted = false;

    return {
      holdMs: this.holdMs,
      progress: this.holdMs / HOLD.targetMs,
      completed,
    };
  }

  get current(): number {
    return this.holdMs;
  }

  reset(): void {
    this.holdMs = 0;
    this.graceRemaining = 0;
    this.hasCompleted = false;
  }
}
