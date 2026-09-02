/**
 * The reducer — pure and total. Doc 02 §5, Doc 01 §3 layer 3.
 *
 * `(state, context, event) => { state, context, effects }`
 *
 * Two rules give the machine its correctness:
 *
 *  1. ANY (state, event) PAIR NOT IN THE TABLE IS ILLEGAL.
 *     Dev: throw. Prod: record and return unchanged. Never a silent drop.
 *
 *  2. `canUnlock` SETS `hasUnlocked = true` IN THIS SAME SYNCHRONOUS CALL,
 *     before any effect is dispatched. That is what kills the double-fire race
 *     when HOLD_COMPLETE and MERCY_UNLOCK arrive in the same tick.
 */

import type { MachineContext } from './context';
import type { Effect } from './effects';
import { entryEffects } from './entry';
import type { MachineEvent } from './events';
import { evaluateGuard } from './guards';
import type { State } from './states';
import { candidatesFor, type Transition } from './transitions';

export interface ReduceResult {
  readonly state: State;
  readonly context: MachineContext;
  readonly effects: readonly Effect[];
  /** False when no row was taken. See `outcome` for why. */
  readonly handled: boolean;
  /**
   * `taken`    a row matched and was applied.
   * `guarded`  rows exist for this pair but every guard rejected. LEGAL — a
   *            no-op, e.g. a second `HOLD_COMPLETE` after `hasUnlocked`, or
   *            `SEQUENCE_STEP_DONE` in `TOGETHER_CONFIRMED` before the hand
   *            model is ready.
   * `illegal`  no row exists for this pair at all. Doc 02 §5: dev throws,
   *            production records and returns unchanged.
   */
  readonly outcome: 'taken' | 'guarded' | 'illegal';
}

export interface ReduceOptions {
  /** Throw on an ILLEGAL pair. True in development, false in production. */
  readonly strict?: boolean;
  /** Receives a description of every illegal pair and every guard rejection. */
  readonly onIllegal?: (message: string) => void;
}

function resolveTarget(
  transition: Transition,
  from: State,
  context: MachineContext,
): State {
  if (transition.to === 'self') return from;
  if (transition.to === 'previous') return context.interruptedFrom ?? from;
  return transition.to;
}

export function reduce(
  state: State,
  context: MachineContext,
  event: MachineEvent,
  options: ReduceOptions = {},
): ReduceResult {
  const candidates = candidatesFor(state, event.type);

  for (const transition of candidates) {
    const input = { state, context, event, from: state };

    if (transition.guard !== undefined && !evaluateGuard(transition.guard, input)) {
      continue;
    }

    const next = resolveTarget(transition, state, context);
    const patch = transition.assign?.({ context, event, from: state }) ?? {};

    // ── The idempotency latch ────────────────────────────────────────────
    // Set here, synchronously, before effects are returned to the caller.
    const unlockPatch: Partial<MachineContext> =
      transition.guard === 'canUnlock' ? { hasUnlocked: true } : {};

    const nextContext: MachineContext = { ...context, ...patch, ...unlockPatch };
    const transitionEffects =
      transition.effects?.({ context: nextContext, event, from: state }) ?? [];

    // Entry effects belong to the STATE, so every path into it performs them.
    // `to: 'self'` is not a re-entry and must not re-run them.
    const effects =
      next === state ? transitionEffects : [...transitionEffects, ...entryEffects(next)];

    return {
      state: next,
      context: nextContext,
      effects,
      handled: true,
      outcome: 'taken',
    };
  }

  // ── Guard-rejected is LEGAL. Illegal is a missing row. ───────────────────
  // Conflating the two would make `canUnlock` doing its job — swallowing a
  // second HOLD_COMPLETE in the same tick — throw in development, which is the
  // opposite of what the idempotency latch exists to achieve.
  if (candidates.length > 0) {
    const message = `Guard rejected (${state}, ${event.type}) — no transition`;
    options.onIllegal?.(message);
    return { state, context, effects: [], handled: false, outcome: 'guarded' };
  }

  const message = `Illegal transition: no row for (${state}, ${event.type})`;
  options.onIllegal?.(message);
  if (options.strict === true) throw new Error(message);

  return { state, context, effects: [], handled: false, outcome: 'illegal' };
}
