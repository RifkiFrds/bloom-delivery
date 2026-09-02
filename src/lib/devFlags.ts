/**
 * Development flags — URL switches that only exist in a development build.
 *
 * ── WHY THESE CANNOT REACH PRODUCTION ────────────────────────────────────
 * Every flag here relaxes something the product depends on. `solo` in
 * particular lowers the togetherness gate to ONE face, which would quietly
 * remove the entire premise: the gift is supposed to need two people.
 *
 * So the check is `process.env.NODE_ENV`, the same gate the debug panel and the
 * detection HUD use. In a production bundle every function below returns false
 * and the bundler drops the bodies.
 *
 * There is deliberately no persisted equivalent and no in-app toggle. A flag
 * that survives a reload is a flag someone forgets is on.
 * ─────────────────────────────────────────────────────────────────────────
 */

const isDev = process.env.NODE_ENV !== 'production';

function flag(name: string): boolean {
  if (!isDev || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(name) === '1';
}

/**
 * `?solo=1` — the whole experience, alone.
 *
 * Lowers the face latch from `>= 2` to `>= 1`, so `SEEKING_FACES` closes on one
 * person and the run continues into the gesture stage normally. NOTHING else
 * changes: the same 8-of-10 N-of-M window, the same validity filter, the real
 * `detection.enableHands` effect, the real hold timer, the real mercy ladder.
 *
 * This is the honest way to test alone. Jumping states from the debug panel
 * skips the reducer, so the effects that arm detection never run and the
 * gesture stage arrives with the hand model disabled — which looks exactly like
 * broken hand tracking.
 *
 * The heart itself needs no accommodation: handedness is ignored entirely
 * (Doc 03 §2.5), so one person's two hands satisfy G1 the same as two people's
 * one hand each.
 */
export function isSoloMode(): boolean {
  return flag('solo');
}

/**
 * `?reset=1` — start from the very beginning.
 *
 * Clears the four persisted flags before `BOOT` reads them, so the run begins
 * at `LANDING` instead of being routed straight to `RESTING` by a previous
 * completion. Without it, the landing page is unreachable the moment you have
 * finished the experience once — which is exactly when you most want to test
 * it again.
 */
export function isResetMode(): boolean {
  return flag('reset');
}

/** `?debug=1` — the detection HUD. Read here so every flag has one home. */
export function isDebugMode(): boolean {
  return flag('debug');
}

/** Shown in the debug HUD, so an enabled flag is never a silent surprise. */
export function activeFlags(): readonly string[] {
  const active: string[] = [];
  if (isSoloMode()) active.push('solo');
  if (isResetMode()) active.push('reset');
  if (isDebugMode()) active.push('debug');
  return active;
}
