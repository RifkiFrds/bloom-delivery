/**
 * THE FROZEN TRANSITION TABLE — transcribed from Doc 02 §5.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 * Any (state, event) pair NOT in this table is ILLEGAL. In development the
 * reducer throws; in production it records to the diagnostic buffer and returns
 * state unchanged. This is how PRD v1's "sequence must execute once, no
 * retriggering" is actually enforced.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Rows are evaluated in declaration order, so guarded rows must precede their
 * unguarded fallback for the same (from, event) pair.
 *
 * No row here was invented. If a transition is needed that is not in Doc 02 §5,
 * the document changes first.
 */

import type { MachineContext } from './context';
import type { Effect } from './effects';
import type { MachineEvent, EventType } from './events';
import type { GuardName } from './guards';
import type { State } from './states';

/** `self` stays put; `previous` returns to `context.interruptedFrom`. */
export type Target = State | 'self' | 'previous';

export interface TransitionInput {
  readonly context: MachineContext;
  readonly event: MachineEvent;
  readonly from: State;
}

export interface Transition {
  readonly from: readonly State[];
  readonly event: EventType;
  readonly guard?: GuardName;
  readonly to: Target;
  /** Context patch applied when this row is taken. */
  readonly assign?: (input: TransitionInput) => Partial<MachineContext>;
  readonly effects?: (input: TransitionInput) => readonly Effect[];
}

const PHASE_A_CAMERA_STATES: readonly State[] = [
  'LOADING_DETECTION',
  'SEEKING_FACES',
  'SOLO_PROMPT',
  'TOGETHER_CONFIRMED',
  'SEEKING_GESTURE',
  'GESTURE_HOLDING',
];

/** Every state — for the root-level cross-cutting rows. */
const ANY: readonly State[] = [
  'BOOT',
  'BLOCKED_ENVIRONMENT',
  'LANDING',
  'PREFLIGHT',
  'REQUESTING_CAMERA',
  'CAMERA_DENIED',
  'CAMERA_ERROR',
  'LOADING_DETECTION',
  'SEEKING_FACES',
  'SOLO_PROMPT',
  'TOGETHER_CONFIRMED',
  'SEEKING_GESTURE',
  'GESTURE_HOLDING',
  'CAMERA_INTERRUPTED',
  'UNLOCKING',
  'DELIVERY',
  'BLOOM',
  'MESSAGE',
  'LETTER_CLOSED',
  'LETTER_OPEN',
  'RESTING',
  'FATAL_ERROR',
];

const bootAssign = ({ event }: TransitionInput): Partial<MachineContext> => {
  if (event.type !== 'BOOT_OK') return {};
  return {
    renderTier: event.payload.tier,
    motionSafe: event.payload.motionSafe,
    recipientName: event.payload.recipientName,
    peekedAlone: event.payload.peekedAlone,
    muted: event.payload.muted,
  };
};

export const TRANSITIONS: readonly Transition[] = [
  // ── BOOT ───────────────────────────────────────────────────────────────
  {
    from: ['BOOT'],
    event: 'BOOT_OK',
    guard: 'hasPriorUnlock',
    to: 'RESTING',
    assign: bootAssign,
  },
  {
    from: ['BOOT'],
    event: 'BOOT_OK',
    to: 'LANDING',
    assign: bootAssign,
    effects: () => [{ kind: 'assets.prefetch', bundle: 'vision-runtime' }],
  },
  {
    from: ['BOOT'],
    event: 'ENV_BLOCKED',
    to: 'BLOCKED_ENVIRONMENT',
    assign: ({ event }) =>
      event.type === 'ENV_BLOCKED' ? { blockedReason: event.reason } : {},
  },

  // ── BLOCKED_ENVIRONMENT ────────────────────────────────────────────────
  {
    from: ['BLOCKED_ENVIRONMENT'],
    event: 'SKIP_TO_LETTER',
    guard: 'canUnlock',
    to: 'UNLOCKING',
    assign: () => ({ renderTier: 'lite' }),
  },

  // ── LANDING ────────────────────────────────────────────────────────────
  {
    from: ['LANDING'],
    event: 'START_TAPPED',
    to: 'PREFLIGHT',
    // audio.unlock MUST run synchronously inside the click handler.
    effects: () => [
      { kind: 'audio.unlock' },
      { kind: 'assets.prefetch', bundle: 'vision-runtime' },
      { kind: 'assets.prefetch', bundle: 'face-model' },
    ],
  },

  // ── PREFLIGHT ──────────────────────────────────────────────────────────
  {
    from: ['PREFLIGHT'],
    event: 'PREFLIGHT_CONTINUE',
    to: 'REQUESTING_CAMERA',
    // The 7.5 MB hand model starts here, hidden behind the permission prompt
    // and the entire face stage.
    effects: () => [
      { kind: 'assets.prefetch', bundle: 'hand-model' },
      { kind: 'camera.acquire' },
    ],
  },

  // ── REQUESTING_CAMERA ──────────────────────────────────────────────────
  {
    from: ['REQUESTING_CAMERA'],
    event: 'PERMISSION_GRANTED',
    to: 'LOADING_DETECTION',
    effects: () => [
      { kind: 'camera.attach' },
      { kind: 'camera.armCap' },
      { kind: 'timer.start', id: 'modelTimeout', ms: 30_000 },
    ],
  },
  { from: ['REQUESTING_CAMERA'], event: 'PERMISSION_DENIED', to: 'CAMERA_DENIED' },
  {
    from: ['REQUESTING_CAMERA'],
    event: 'CAMERA_FAILED',
    guard: 'isTerminalCameraError',
    to: 'CAMERA_ERROR',
    assign: ({ event }) =>
      event.type === 'CAMERA_FAILED' ? { lastCameraErrorKind: event.kind } : {},
  },
  {
    from: ['REQUESTING_CAMERA'],
    event: 'CAMERA_FAILED',
    to: 'CAMERA_ERROR',
    assign: ({ event }) =>
      event.type === 'CAMERA_FAILED' ? { lastCameraErrorKind: event.kind } : {},
  },

  // ── CAMERA_DENIED / CAMERA_ERROR ───────────────────────────────────────
  { from: ['CAMERA_DENIED'], event: 'RETRY_CAMERA', to: 'REQUESTING_CAMERA' },
  {
    from: ['CAMERA_ERROR'],
    event: 'RETRY_CAMERA',
    guard: 'isRecoverableCameraError',
    to: 'REQUESTING_CAMERA',
  },
  {
    from: ['CAMERA_DENIED', 'CAMERA_ERROR'],
    event: 'SKIP_TO_LETTER',
    guard: 'canUnlock',
    to: 'UNLOCKING',
    assign: () => ({ renderTier: 'lite' }),
  },

  // ── LOADING_DETECTION ──────────────────────────────────────────────────
  {
    from: ['LOADING_DETECTION'],
    event: 'MODELS_READY',
    to: 'SEEKING_FACES',
    effects: () => [
      { kind: 'timer.cancel', id: 'modelTimeout' },
      { kind: 'detection.start' },
      { kind: 'assets.prefetch', bundle: 'scene-3d' },
    ],
  },
  { from: ['LOADING_DETECTION'], event: 'MODELS_FAILED', to: 'CAMERA_ERROR' },

  // ── SEEKING_FACES ──────────────────────────────────────────────────────
  {
    from: ['SEEKING_FACES', 'SOLO_PROMPT'],
    event: 'FACES_ACQUIRED',
    to: 'TOGETHER_CONFIRMED',
    // The togetherness latch. Permanent for the session.
    assign: () => ({ togetherConfirmed: true }),
    effects: () => [
      { kind: 'assets.prefetch', bundle: 'audio' },
      { kind: 'timer.start', id: 'togetherBeat', ms: 1200 },
    ],
  },
  { from: ['SEEKING_FACES'], event: 'SOLO_TIMEOUT', to: 'SOLO_PROMPT' },

  // ── SOLO_PROMPT ────────────────────────────────────────────────────────
  { from: ['SOLO_PROMPT'], event: 'WAIT_FOR_PARTNER', to: 'SEEKING_FACES' },
  {
    from: ['SOLO_PROMPT'],
    event: 'PEEK_ALONE',
    guard: 'canUnlock',
    to: 'UNLOCKING',
    assign: () => ({ peekedAlone: true }),
    effects: () => [{ kind: 'persist.write', key: 'bloom_peeked', value: '1' }],
  },

  // ── TOGETHER_CONFIRMED ─────────────────────────────────────────────────
  {
    from: ['TOGETHER_CONFIRMED'],
    event: 'HAND_MODEL_READY',
    to: 'self',
    assign: () => ({ handModelReady: true }),
  },
  {
    from: ['TOGETHER_CONFIRMED'],
    event: 'SEQUENCE_STEP_DONE',
    guard: 'canSeekGesture',
    to: 'SEEKING_GESTURE',
    assign: () => ({ mercyLevel: 0 }),
    effects: () => [{ kind: 'detection.enableHands' }, { kind: 'mercy.start' }],
  },

  // ── SEEKING_GESTURE / GESTURE_HOLDING ──────────────────────────────────
  { from: ['SEEKING_GESTURE'], event: 'GESTURE_ENTER', to: 'GESTURE_HOLDING' },
  { from: ['GESTURE_HOLDING'], event: 'GESTURE_EXIT', to: 'SEEKING_GESTURE' },
  {
    from: ['GESTURE_HOLDING'],
    event: 'HOLD_COMPLETE',
    guard: 'canUnlock',
    to: 'UNLOCKING',
  },
  {
    from: ['SEEKING_GESTURE'],
    event: 'MERCY_TICK',
    guard: 'mercyReached',
    to: 'self',
    assign: ({ event }) =>
      event.type === 'MERCY_TICK' ? { mercyLevel: event.level } : {},
  },
  {
    from: ['SEEKING_GESTURE', 'GESTURE_HOLDING'],
    event: 'MERCY_UNLOCK',
    guard: 'canUnlock',
    to: 'UNLOCKING',
  },

  // ── CAMERA_INTERRUPTED ─────────────────────────────────────────────────
  {
    from: PHASE_A_CAMERA_STATES,
    event: 'TRACK_MUTED',
    to: 'CAMERA_INTERRUPTED',
    assign: ({ from }) => ({ interruptedFrom: from }),
    effects: () => [{ kind: 'detection.pause' }, { kind: 'mercy.pause' }],
  },
  {
    from: PHASE_A_CAMERA_STATES,
    event: 'TRACK_ENDED',
    to: 'CAMERA_INTERRUPTED',
    assign: ({ from }) => ({ interruptedFrom: from }),
    effects: () => [{ kind: 'detection.pause' }, { kind: 'mercy.pause' }],
  },
  {
    from: ['CAMERA_INTERRUPTED'],
    event: 'TRACK_RECOVERED',
    to: 'previous',
    effects: () => [{ kind: 'detection.resume' }, { kind: 'mercy.resume' }],
  },
  {
    from: ['CAMERA_INTERRUPTED'],
    event: 'MERCY_UNLOCK',
    guard: 'canUnlock',
    to: 'UNLOCKING',
  },
  {
    from: ['CAMERA_INTERRUPTED'],
    event: 'SKIP_TO_LETTER',
    guard: 'canUnlock',
    to: 'UNLOCKING',
    assign: () => ({ renderTier: 'lite' }),
  },

  // ── UNLOCKING — the teardown boundary ──────────────────────────────────
  {
    from: ['UNLOCKING'],
    event: 'SEQUENCE_STEP_DONE',
    to: 'DELIVERY',
    effects: () => [
      { kind: 'scene.mount3d' },
      { kind: 'audio.play', track: 'music', fadeMs: 800 },
      { kind: 'timer.start', id: 'deliveryBeat', ms: 9000 },
    ],
  },

  // ── Phase B beats ──────────────────────────────────────────────────────
  {
    from: ['DELIVERY'],
    event: 'SEQUENCE_STEP_DONE',
    to: 'BLOOM',
    effects: () => [{ kind: 'timer.start', id: 'bloomBeat', ms: 8000 }],
  },
  {
    from: ['BLOOM'],
    event: 'SEQUENCE_STEP_DONE',
    guard: 'peekedAlone',
    to: 'RESTING',
  },
  {
    from: ['BLOOM'],
    event: 'SEQUENCE_STEP_DONE',
    to: 'MESSAGE',
    effects: () => [{ kind: 'timer.start', id: 'messageBeat', ms: 4000 }],
  },
  { from: ['MESSAGE'], event: 'SEQUENCE_STEP_DONE', to: 'LETTER_CLOSED' },
  {
    from: ['LETTER_CLOSED'],
    event: 'LETTER_OPEN_TAPPED',
    to: 'LETTER_OPEN',
    effects: () => [{ kind: 'letter.decode' }],
  },
  {
    from: ['LETTER_OPEN'],
    event: 'SEQUENCE_STEP_DONE',
    to: 'RESTING',
    effects: () => [{ kind: 'persist.write', key: 'bloom_unlocked', value: '1' }],
  },

  // ── RESTING ────────────────────────────────────────────────────────────
  {
    from: ['RESTING'],
    event: 'REPLAY_TAPPED',
    to: 'UNLOCKING',
    assign: () => ({ skipCameraStage: true }),
  },
  { from: ['RESTING'], event: 'READ_AGAIN_TAPPED', to: 'LETTER_OPEN' },
  {
    from: ['RESTING'],
    event: 'SAVE_PHOTO_TAPPED',
    to: 'self',
    effects: () => [{ kind: 'photo.download' }],
  },

  // ── Cross-cutting, root level ──────────────────────────────────────────
  {
    from: ANY,
    event: 'CONTEXT_LOST',
    guard: 'restoreFailed',
    to: 'self',
    assign: () => ({ renderTier: 'lite' }),
    effects: () => [{ kind: 'scene.degradeToLite' }],
  },
  {
    from: ANY,
    event: 'DEGRADE_TO_LITE',
    to: 'self',
    assign: () => ({ renderTier: 'lite' }),
    effects: () => [{ kind: 'scene.degradeToLite' }],
  },
  {
    from: ANY,
    event: 'FATAL',
    to: 'FATAL_ERROR',
    assign: ({ event }) =>
      event.type === 'FATAL' ? { lastError: event.diagnostic } : {},
  },
  {
    from: ['FATAL_ERROR'],
    event: 'SKIP_TO_LETTER',
    to: 'LETTER_OPEN',
    assign: () => ({ renderTier: 'lite' }),
    effects: () => [{ kind: 'letter.decode' }],
  },
  {
    from: ANY,
    event: 'VISIBILITY_HIDDEN',
    to: 'self',
    assign: () => ({ paused: true }),
    effects: () => [{ kind: 'detection.pause' }, { kind: 'mercy.pause' }],
  },
  {
    from: ANY,
    event: 'VISIBILITY_VISIBLE',
    to: 'self',
    assign: () => ({ paused: false }),
    effects: () => [{ kind: 'detection.resume' }, { kind: 'mercy.resume' }],
  },
  {
    from: ANY,
    event: 'MUTE_TOGGLED',
    to: 'self',
    assign: ({ context }) => ({ muted: !context.muted }),
    effects: ({ context }) => [
      { kind: 'audio.setMuted', muted: !context.muted },
      { kind: 'persist.write', key: 'bloom_muted', value: context.muted ? '0' : '1' },
    ],
  },
];

/** Index for O(1) lookup: `${state}::${eventType}` → candidate rows in order. */
const INDEX: ReadonlyMap<string, readonly Transition[]> = (() => {
  const map = new Map<string, Transition[]>();
  for (const transition of TRANSITIONS) {
    for (const state of transition.from) {
      const key = `${state}::${transition.event}`;
      const bucket = map.get(key);
      if (bucket === undefined) map.set(key, [transition]);
      else bucket.push(transition);
    }
  }
  return map;
})();

export function candidatesFor(state: State, event: EventType): readonly Transition[] {
  return INDEX.get(`${state}::${event}`) ?? [];
}
