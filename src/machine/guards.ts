/**
 * Guards — Doc 02 §4.
 *
 * PURITY RULE: guards are pure, synchronous, and read only MachineContext, the
 * event payload, and the current state. A guard that touches localStorage,
 * performs I/O, reads a clock, or reads the detection ref is a defect.
 *
 * Two consequences of that rule, both deliberate:
 *
 *   `hasPriorUnlock` — reads `BOOT_OK.payload.priorUnlock`, not localStorage.
 *     The capability probe does the impure read once and puts the answer in the
 *     event.
 *
 *   `mercyReached` — compares `event.level` against `ctx.mercyLevel`, not a
 *     clock. Active-time accounting lives in the mercy timer service, which
 *     pauses on VISIBILITY_HIDDEN and CAMERA_INTERRUPTED and emits MERCY_TICK
 *     with the level it computed.
 */

import type { MachineContext } from './context';
import type { MachineEvent } from './events';
import type { State } from './states';

export const GUARD_NAMES = [
  'canUnlock',
  'canSeekGesture',
  'canRenderFull',
  'isReplay',
  'mercyReached',
  'isTerminalCameraError',
  'isRecoverableCameraError',
  'hasPriorUnlock',
  'peekedAlone',
  'restoreFailed',
] as const;

export type GuardName = (typeof GUARD_NAMES)[number];

export interface GuardInput {
  readonly state: State;
  readonly context: MachineContext;
  readonly event: MachineEvent;
}

/**
 * States from which an unlock may legitimately be initiated.
 *
 * The failure states are included deliberately: `SKIP_TO_LETTER` routes through
 * `UNLOCKING` so the Lite path shares one teardown-and-transition
 * implementation with the camera path. There is one road to the gift.
 */
const UNLOCKABLE_FROM: ReadonlySet<State> = new Set<State>([
  'SEEKING_GESTURE',
  'GESTURE_HOLDING',
  'SOLO_PROMPT',
  'CAMERA_INTERRUPTED',
  'CAMERA_DENIED',
  'CAMERA_ERROR',
  'BLOCKED_ENVIRONMENT',
  'RESTING',
]);

const TERMINAL_CAMERA_ERRORS: ReadonlySet<string> = new Set([
  'NotFoundError',
  'SecurityError',
  'OverconstrainedError',
  'Unsupported',
]);

/**
 * THE SINGLE MOST IMPORTANT GUARD IN THE APP.
 *
 * Kills every double-fire race: HOLD_COMPLETE and MERCY_UNLOCK arriving in the
 * same tick, a double-tap on the escape hatch, a detection edge racing a user
 * tap. The reducer sets `hasUnlocked = true` in the SAME synchronous call that
 * evaluates this guard, before any effect is dispatched.
 */
function canUnlock({ state, context }: GuardInput): boolean {
  return !context.hasUnlocked && UNLOCKABLE_FROM.has(state);
}

/** Never enter the gesture stage without the model. */
function canSeekGesture({ context }: GuardInput): boolean {
  return context.togetherConfirmed && context.handModelReady;
}

function canRenderFull({ event }: GuardInput): boolean {
  return event.type === 'BOOT_OK' && event.payload.tier === 'full';
}

function isReplay({ context }: GuardInput): boolean {
  return context.hasUnlocked && context.skipCameraStage;
}

function mercyReached({ context, event }: GuardInput): boolean {
  return event.type === 'MERCY_TICK' && event.level > context.mercyLevel;
}

/** Terminal errors go to Lite, not into a retry loop. */
function isTerminalCameraError({ event }: GuardInput): boolean {
  return event.type === 'CAMERA_FAILED' && TERMINAL_CAMERA_ERRORS.has(event.kind);
}

function isRecoverableCameraError(input: GuardInput): boolean {
  return input.event.type === 'CAMERA_FAILED' && !isTerminalCameraError(input);
}

function hasPriorUnlock({ event }: GuardInput): boolean {
  return event.type === 'BOOT_OK' && event.payload.priorUnlock;
}

function peekedAlone({ context }: GuardInput): boolean {
  return context.peekedAlone;
}

function restoreFailed({ event }: GuardInput): boolean {
  return event.type === 'CONTEXT_LOST' && !event.restored;
}

export const GUARDS: Readonly<Record<GuardName, (input: GuardInput) => boolean>> = {
  canUnlock,
  canSeekGesture,
  canRenderFull,
  isReplay,
  mercyReached,
  isTerminalCameraError,
  isRecoverableCameraError,
  hasPriorUnlock,
  peekedAlone,
  restoreFailed,
};

export function evaluateGuard(name: GuardName, input: GuardInput): boolean {
  return GUARDS[name](input);
}
