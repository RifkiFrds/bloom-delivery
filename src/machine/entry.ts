/**
 * State ENTRY effects — Doc 02 §5, the `UNLOCKING | (entry)` row.
 *
 * ── WHY THIS EXISTS SEPARATELY FROM THE TRANSITION TABLE ─────────────────
 * Doc 02 models entry actions ("E" rows) as a property of the STATE, not of the
 * arrow into it. `UNLOCKING` is reached by SIX distinct paths — `HOLD_COMPLETE`,
 * `MERCY_UNLOCK` from two states, `PEEK_ALONE`, `SKIP_TO_LETTER` from three
 * failure states, and `REPLAY_TAPPED` — and every one of them must perform the
 * same teardown in the same order.
 *
 * Attaching the teardown to each arrow would be six copies of the single most
 * safety-critical effect list in the application, and the seventh path added
 * later would be the one that forgot it. Attaching it to the state makes
 * omission impossible.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Entry effects run AFTER the transition's own effects and only when the state
 * actually changes — a `to: 'self'` row does not re-enter.
 */

import type { Effect } from './effects';
import type { State } from './states';
import { BEATS_UNLOCK_MS } from './timing';

const ENTRY: Partial<Record<State, readonly Effect[]>> = {
  /**
   * THE TEARDOWN BOUNDARY. The order inside `camera/teardown.ts` is fixed:
   * capture the frame → cancel the rAF → stop every track → close both tasks →
   * assert. Cancelling before closing is not a preference; an in-flight
   * `detectForVideo` resolving against a closed task throws inside WASM.
   *
   * On replay (`skipCameraStage`) every step is a no-op, so the same list runs
   * unchanged and the camera is never re-requested.
   */
  UNLOCKING: [
    { kind: 'camera.teardown' },
    // Declared here rather than left to the teardown handler, which
    // short-circuits on replay. The ladder must end on every path.
    { kind: 'mercy.stop' },
    { kind: 'timer.start', id: 'unlockBeat', ms: BEATS_UNLOCK_MS },
  ],

  /**
   * A fatal error is terminal, and everything still running must stop with it.
   *
   * Without this, a `FATAL` raised from the gesture stage left the mercy ladder
   * armed and ticking; the next rung then emitted `MERCY_TICK` into
   * `FATAL_ERROR`, crashing the screen whose entire job is to be the last thing
   * that still works.
   */
  FATAL_ERROR: [{ kind: 'detection.stop' }, { kind: 'mercy.stop' }],
};

export function entryEffects(state: State): readonly Effect[] {
  return ENTRY[state] ?? [];
}
