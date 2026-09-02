/**
 * Zustand host for the machine — Doc 01 §2.2, §6.3.
 *
 * ── THE WRITE BUDGET ─────────────────────────────────────────────────────
 * This store is written ONLY on discrete FSM transitions — roughly EIGHT
 * writes across an entire session. The detection loop never touches it; it
 * writes a mutable ref at 15 Hz which the HUD reads on its own rAF.
 *
 * A per-frame `setState` here would produce 30–60 React commits per second
 * during the single most performance-sensitive phase, on the weakest devices,
 * while two neural networks are running. That is a defect, not a style
 * preference (Doc 01 §B4).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Selectors must be ATOMIC (`s => s.state`), never object literals, or React
 * will re-render on every write regardless of relevance.
 */

import { create } from 'zustand';

import {
  EffectRunner,
  initialContext,
  reduce,
  type MachineContext,
  type MachineEvent,
  type State,
} from '@/machine';
import { bus } from '@/events/bus';
import { record } from '@/lib/diagnostics';

export const effectRunner = new EffectRunner();

/**
 * The last `(state, event)` a guard refused, for the debug HUD.
 *
 * ── WHY THIS IS WORTH SURFACING ──────────────────────────────────────────
 * A guard doing its job is silent by design, and `canUnlock` is the loudest
 * example: once `hasUnlocked` latches, every later `HOLD_COMPLETE` is dropped.
 * That is correct — it is the whole point of the latch — but from the outside
 * it looks like the gesture stopped working, because the ring still fills and
 * the status pill still reads "Sempurna". Both read `holdProgress`, which knows
 * nothing about the machine.
 *
 * Recording it makes "why did nothing happen?" answerable in one glance instead
 * of a debugging session.
 * ─────────────────────────────────────────────────────────────────────────
 */
let lastBlocked: string | null = null;

export function lastBlockedTransition(): string | null {
  return lastBlocked;
}

const isDev = process.env.NODE_ENV !== 'production';

interface MachineStore {
  readonly state: State;
  readonly context: MachineContext;
  /** Monotonic counter — proves the ~8-writes-per-session budget. */
  readonly writes: number;
  send: (event: MachineEvent) => void;
}

export const useMachineStore = create<MachineStore>((set, get) => ({
  state: 'BOOT',
  context: initialContext,
  writes: 0,

  send: (event) => {
    const { state, context } = get();

    const result = reduce(state, context, event, {
      strict: isDev,
      onIllegal: (message) => {
        lastBlocked = message;
        record(message);
      },
    });

    if (!result.handled) return;

    set({
      state: result.state,
      context: result.context,
      writes: get().writes + 1,
    });

    record(`${state} --${event.type}--> ${result.state}`);
    effectRunner.run(result.effects, state, result.state);
  },
}));

/** Wire the bus to the store exactly once, at module load. */
bus.subscribe((event) => {
  useMachineStore.getState().send(event);
});

// ── Atomic selectors ────────────────────────────────────────────────────────
export const selectState = (store: MachineStore): State => store.state;
export const selectContext = (store: MachineStore): MachineContext => store.context;
export const selectWrites = (store: MachineStore): number => store.writes;
export const selectMuted = (store: MachineStore): boolean => store.context.muted;
export const selectMotionSafe = (store: MachineStore): boolean =>
  store.context.motionSafe;
export const selectRenderTier = (store: MachineStore): MachineContext['renderTier'] =>
  store.context.renderTier;
