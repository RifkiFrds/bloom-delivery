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
    reduce(
      'TOGETHER_CONFIRMED',
      ctx({ togetherConfirmed: true }),
      {
        type: 'SEQUENCE_STEP_DONE',
      },
      { onIllegal: (m) => messages.push(m) },
    );

    expect(messages[0]).toMatch(/every guard rejected/);
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
