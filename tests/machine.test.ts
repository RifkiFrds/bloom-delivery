/**
 * Machine tests — Doc 05 §5 exit criteria.
 *
 * The load-bearing one is `canUnlock idempotency`:
 *
 *   "canUnlock proven idempotent by test (10 concurrent HOLD_COMPLETE events
 *    → one transition)"
 *
 * Everything else here protects the transition table from drift.
 */

import { describe, expect, it } from 'vitest';

import {
  EVENT_TYPES,
  STATES,
  TRANSITIONS,
  candidatesFor,
  initialContext,
  reduce,
  type MachineContext,
  type MachineEvent,
  type State,
} from '@/machine';

const ctx = (patch: Partial<MachineContext> = {}): MachineContext => ({
  ...initialContext,
  ...patch,
});

describe('canUnlock — the idempotency latch', () => {
  it('collapses 10 concurrent HOLD_COMPLETE events into exactly one transition', () => {
    let state: State = 'GESTURE_HOLDING';
    let context = ctx({ togetherConfirmed: true, handModelReady: true });
    let handledCount = 0;

    for (let i = 0; i < 10; i += 1) {
      const result = reduce(state, context, { type: 'HOLD_COMPLETE' });
      if (result.handled) handledCount += 1;
      state = result.state;
      context = result.context;
    }

    expect(handledCount).toBe(1);
    expect(state).toBe('UNLOCKING');
    expect(context.hasUnlocked).toBe(true);
  });

  it('sets hasUnlocked synchronously, before effects are returned', () => {
    const result = reduce(
      'GESTURE_HOLDING',
      ctx({ togetherConfirmed: true, handModelReady: true }),
      { type: 'HOLD_COMPLETE' },
    );
    // The context handed back with the effects already carries the latch.
    expect(result.context.hasUnlocked).toBe(true);
  });

  it('rejects HOLD_COMPLETE and MERCY_UNLOCK arriving in the same tick', () => {
    const first = reduce(
      'GESTURE_HOLDING',
      ctx({ togetherConfirmed: true, handModelReady: true }),
      { type: 'HOLD_COMPLETE' },
    );
    expect(first.handled).toBe(true);

    // The mercy tap lands after the detection edge, on the already-latched ctx.
    const second = reduce(first.state, first.context, { type: 'MERCY_UNLOCK' });
    expect(second.handled).toBe(false);
    expect(second.state).toBe('UNLOCKING');
  });

  it.each([
    ['SOLO_PROMPT', { type: 'PEEK_ALONE' }],
    ['CAMERA_DENIED', { type: 'SKIP_TO_LETTER' }],
    ['CAMERA_ERROR', { type: 'SKIP_TO_LETTER' }],
    ['BLOCKED_ENVIRONMENT', { type: 'SKIP_TO_LETTER' }],
  ] as readonly (readonly [State, MachineEvent])[])(
    'guards the unlock road from %s too',
    (from, event) => {
      const once = reduce(from, ctx(), event);
      expect(once.handled).toBe(true);
      expect(once.state).toBe('UNLOCKING');

      const twice = reduce(from, once.context, event);
      expect(twice.handled).toBe(false);
    },
  );
});

describe('illegal transitions', () => {
  it('throws in strict mode', () => {
    expect(() =>
      reduce('LANDING', ctx(), { type: 'HOLD_COMPLETE' }, { strict: true }),
    ).toThrow(/Illegal transition/);
  });

  it('records and returns unchanged in non-strict mode', () => {
    const messages: string[] = [];
    const result = reduce(
      'LANDING',
      ctx(),
      { type: 'HOLD_COMPLETE' },
      {
        strict: false,
        onIllegal: (message) => messages.push(message),
      },
    );

    expect(result.handled).toBe(false);
    expect(result.state).toBe('LANDING');
    expect(messages).toHaveLength(1);
  });

  it('reports guard rejection distinctly from a missing row', () => {
    const messages: string[] = [];
    // The row exists, but canSeekGesture fails without the hand model.
    const result = reduce(
      'TOGETHER_CONFIRMED',
      ctx({ togetherConfirmed: true }),
      {
        type: 'SEQUENCE_STEP_DONE',
      },
      { onIllegal: (m) => messages.push(m) },
    );

    expect(result.outcome).toBe('guarded');
    expect(messages[0]).toMatch(/Guard rejected/);
  });

  /**
   * A guard doing its job is not a programming error. If it threw, `canUnlock`
   * swallowing a second HOLD_COMPLETE — the entire point of the latch — would
   * crash the app in development.
   */
  it('does NOT throw in strict mode when a guard rejects', () => {
    expect(() =>
      reduce(
        'GESTURE_HOLDING',
        ctx({ hasUnlocked: true }),
        { type: 'HOLD_COMPLETE' },
        { strict: true },
      ),
    ).not.toThrow();
  });

  it('DOES throw in strict mode when no row exists', () => {
    expect(() =>
      reduce('LANDING', ctx(), { type: 'HOLD_COMPLETE' }, { strict: true }),
    ).toThrow(/no row/);
  });
});

describe('transition table integrity', () => {
  it('references only known states and events', () => {
    for (const transition of TRANSITIONS) {
      for (const from of transition.from) {
        expect(STATES).toContain(from);
      }
      expect(EVENT_TYPES).toContain(transition.event);
      if (transition.to !== 'self' && transition.to !== 'previous') {
        expect(STATES).toContain(transition.to);
      }
    }
  });

  it('places guarded rows before their unguarded fallback', () => {
    const seen = new Map<string, boolean>();
    for (const transition of TRANSITIONS) {
      for (const from of transition.from) {
        const key = `${from}::${transition.event}`;
        const hadUnguarded = seen.get(key);
        if (hadUnguarded === true) {
          throw new Error(`unreachable row after an unguarded fallback: ${key}`);
        }
        if (transition.guard === undefined) seen.set(key, true);
      }
    }
  });

  it('reaches every state from BOOT', () => {
    const reached = new Set<State>(['BOOT']);
    const queue: State[] = ['BOOT'];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;
      for (const eventType of EVENT_TYPES) {
        for (const transition of candidatesFor(current, eventType)) {
          const target =
            transition.to === 'self'
              ? current
              : transition.to === 'previous'
                ? current
                : transition.to;
          if (!reached.has(target)) {
            reached.add(target);
            queue.push(target);
          }
        }
      }
    }

    const unreachable = STATES.filter((state) => !reached.has(state));
    expect(unreachable).toEqual([]);
  });
});

describe('the togetherness latch', () => {
  it('is permanent for the session once set', () => {
    const acquired = reduce('SEEKING_FACES', ctx(), { type: 'FACES_ACQUIRED' });
    expect(acquired.context.togetherConfirmed).toBe(true);

    // Nothing downstream clears it.
    const interrupted = reduce(acquired.state, acquired.context, { type: 'TRACK_ENDED' });
    expect(interrupted.context.togetherConfirmed).toBe(true);
  });

  it('blocks the gesture stage until the hand model is ready', () => {
    const withoutModel = reduce(
      'TOGETHER_CONFIRMED',
      ctx({ togetherConfirmed: true, handModelReady: false }),
      { type: 'SEQUENCE_STEP_DONE' },
    );
    expect(withoutModel.handled).toBe(false);

    const ready = reduce(
      'TOGETHER_CONFIRMED',
      ctx({ togetherConfirmed: true, handModelReady: true }),
      { type: 'SEQUENCE_STEP_DONE' },
    );
    expect(ready.state).toBe('SEEKING_GESTURE');
  });
});

describe('camera interruption', () => {
  it('returns to exactly the state it left', () => {
    const interrupted = reduce(
      'SEEKING_GESTURE',
      ctx({ togetherConfirmed: true, handModelReady: true }),
      { type: 'TRACK_MUTED' },
    );
    expect(interrupted.state).toBe('CAMERA_INTERRUPTED');
    expect(interrupted.context.interruptedFrom).toBe('SEEKING_GESTURE');

    const recovered = reduce(interrupted.state, interrupted.context, {
      type: 'TRACK_RECOVERED',
    });
    expect(recovered.state).toBe('SEEKING_GESTURE');
  });
});

describe('mercy escalation', () => {
  it('only advances the level, never regresses', () => {
    const first = reduce('SEEKING_GESTURE', ctx({ mercyLevel: 0 }), {
      type: 'MERCY_TICK',
      level: 2,
    });
    expect(first.context.mercyLevel).toBe(2);

    const backwards = reduce(first.state, first.context, {
      type: 'MERCY_TICK',
      level: 1,
    });
    expect(backwards.handled).toBe(false);
    expect(backwards.context.mercyLevel).toBe(2);
  });
});

describe('replay', () => {
  it('never re-enters a camera state', () => {
    const replay = reduce('RESTING', ctx({ hasUnlocked: true }), {
      type: 'REPLAY_TAPPED',
    });
    expect(replay.state).toBe('UNLOCKING');
    expect(replay.context.skipCameraStage).toBe(true);
  });
});

/**
 * ★ REGRESSION: events that arrive in a state the table did not anticipate ★
 *
 * A runtime crash — `Illegal transition: no row for (SEEKING_FACES,
 * HAND_MODEL_READY)` — came from the §5 table listing `HAND_MODEL_READY` only
 * under `TOGETHER_CONFIRMED`. The 7.5 MB model is prefetched at
 * `PREFLIGHT_CONTINUE`, so on a fast connection it lands long before the
 * two-face latch closes.
 *
 * These tests pin every ASYNCHRONOUS fact against every state it can plausibly
 * arrive in. Each one failed before the fix.
 */
describe('asynchronous facts must be legal wherever they land', () => {
  const CAMERA_STAGES: readonly State[] = [
    'REQUESTING_CAMERA',
    'LOADING_DETECTION',
    'SEEKING_FACES',
    'SOLO_PROMPT',
    'TOGETHER_CONFIRMED',
    'SEEKING_GESTURE',
    'GESTURE_HOLDING',
    'CAMERA_INTERRUPTED',
  ];

  it.each(CAMERA_STAGES)('HAND_MODEL_READY is legal in %s', (state) => {
    const result = reduce(state, ctx(), { type: 'HAND_MODEL_READY' }, { strict: true });
    expect(result.outcome).toBe('taken');
    expect(result.state).toBe(state);
    // The whole point: the latch is recorded wherever the event lands. Dropping
    // it would leave `canSeekGesture` false forever.
    expect(result.context.handModelReady).toBe(true);
  });

  /**
   * The mercy timer keeps running while the user is mid-hold, so crossing 20 s,
   * 45 s or 90 s during a hold is ordinary. Doc 02 §2.13 lists MERCY_TICK among
   * the events GESTURE_HOLDING handles; the §5 row omitted the state.
   */
  it.each(['SEEKING_GESTURE', 'GESTURE_HOLDING'] as const)(
    'MERCY_TICK is legal in %s',
    (state) => {
      const result = reduce(
        state,
        ctx({ mercyLevel: 0 }),
        { type: 'MERCY_TICK', level: 2 },
        { strict: true },
      );
      expect(result.outcome).toBe('taken');
      expect(result.state).toBe(state);
      expect(result.context.mercyLevel).toBe(2);
    },
  );

  it('MERCY_TICK for a level already reached is a guarded no-op, not a crash', () => {
    const result = reduce(
      'GESTURE_HOLDING',
      ctx({ mercyLevel: 3 }),
      { type: 'MERCY_TICK', level: 1 },
      { strict: true },
    );
    expect(result.outcome).toBe('guarded');
  });

  /**
   * `TRACK_ENDED` now precedes the automatic re-acquisition, so the recovery
   * resolves while the machine is already in CAMERA_INTERRUPTED — the only
   * state where TRACK_RECOVERED is legal.
   */
  it('TRACK_RECOVERED is legal in CAMERA_INTERRUPTED', () => {
    const result = reduce(
      'CAMERA_INTERRUPTED',
      ctx({ interruptedFrom: 'SEEKING_FACES' }),
      { type: 'TRACK_RECOVERED' },
      { strict: true },
    );
    expect(result.outcome).toBe('taken');
    expect(result.state).toBe('SEEKING_FACES');
  });

  /**
   * The camera runtime must never emit these outside the one state that accepts
   * them. Asserted as ILLEGAL on purpose: if a future change starts emitting
   * `PERMISSION_GRANTED` from a recovery again, this fails rather than the app.
   */
  it.each(['SEEKING_FACES', 'CAMERA_INTERRUPTED', 'LOADING_DETECTION'] as const)(
    'PERMISSION_GRANTED remains illegal in %s',
    (state) => {
      expect(() =>
        reduce(state, ctx(), { type: 'PERMISSION_GRANTED' }, { strict: true }),
      ).toThrow(/no row/);
    },
  );

  it('TRACK_ENDED is legal in every camera-bearing state', () => {
    for (const state of CAMERA_STAGES) {
      if (state === 'REQUESTING_CAMERA' || state === 'CAMERA_INTERRUPTED') continue;
      const result = reduce(state, ctx(), { type: 'TRACK_ENDED' }, { strict: true });
      expect(result.state, state).toBe('CAMERA_INTERRUPTED');
      expect(result.context.interruptedFrom, state).toBe(state);
    }
  });
});

describe('terminal states end every running subsystem', () => {
  /**
   * A `FATAL` raised from the gesture stage used to leave the mercy ladder
   * armed. The next rung then emitted `MERCY_TICK` into `FATAL_ERROR` and
   * crashed the screen whose entire job is to be the last thing that works.
   */
  it('FATAL_ERROR stops detection and the mercy ladder', () => {
    const result = reduce(
      'GESTURE_HOLDING',
      ctx(),
      { type: 'FATAL', diagnostic: 'boom' },
      { strict: true },
    );

    expect(result.state).toBe('FATAL_ERROR');
    const kinds = result.effects.map((effect) => effect.kind);
    expect(kinds).toContain('mercy.stop');
    expect(kinds).toContain('detection.stop');
  });

  it('UNLOCKING stops the ladder on every entry path, including replay', () => {
    for (const [state, event] of [
      ['GESTURE_HOLDING', { type: 'HOLD_COMPLETE' }],
      ['SEEKING_GESTURE', { type: 'MERCY_UNLOCK' }],
      ['SOLO_PROMPT', { type: 'PEEK_ALONE' }],
      ['CAMERA_DENIED', { type: 'SKIP_TO_LETTER' }],
      ['RESTING', { type: 'REPLAY_TAPPED' }],
    ] as const satisfies readonly (readonly [State, MachineEvent])[]) {
      const seed = state === 'RESTING' ? ctx({ hasUnlocked: true }) : ctx();
      const result = reduce(state, seed, event, { strict: true });
      expect(result.state, state).toBe('UNLOCKING');
      expect(
        result.effects.map((effect) => effect.kind),
        state,
      ).toContain('mercy.stop');
    }
  });
});
