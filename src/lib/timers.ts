/**
 * The timer registry — the executor for the `timer.start` / `timer.cancel`
 * effects (Doc 02 §2, "T" rows).
 *
 * Deliberately dumb: it starts, cancels and clears named timeouts and nothing
 * else. Beat POLICY — "extend `TOGETHER_CONFIRMED` while the hand model is
 * still in flight" — lives in the effect-wiring layer, which is allowed to read
 * the machine context. Putting policy here would require this module to reach
 * into the store, which is exactly the coupling the effect-descriptor design
 * exists to prevent.
 *
 * Every timer is named, so a re-entered state cannot leave two copies of its
 * beat running — starting an id cancels the previous one by construction.
 */

import type { TimerId } from '@/machine';

const handles = new Map<TimerId, number>();

export function startTimer(id: TimerId, ms: number, fire: () => void): void {
  cancelTimer(id);
  const handle = window.setTimeout(() => {
    handles.delete(id);
    fire();
  }, ms);
  handles.set(id, handle);
}

export function cancelTimer(id: TimerId): void {
  const handle = handles.get(id);
  if (handle === undefined) return;
  window.clearTimeout(handle);
  handles.delete(id);
}

/** Called at teardown and on `FATAL`, so no beat outlives its scene. */
export function cancelAllTimers(): void {
  for (const handle of handles.values()) window.clearTimeout(handle);
  handles.clear();
}

export function isTimerRunning(id: TimerId): boolean {
  return handles.has(id);
}
