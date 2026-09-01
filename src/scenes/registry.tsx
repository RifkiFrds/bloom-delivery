/**
 * Scene registry — Doc 05 P1.10 ("all states as labelled placeholders wired to
 * the FSM").
 *
 * ── WHY A REGISTRY AND NOT 22 FILES ──────────────────────────────────────
 * Twenty-two near-identical placeholder components would be duplicated logic
 * and, once replaced, dead code — both explicitly prohibited. A descriptor per
 * state gives the same coverage with zero duplication, and each entry grows a
 * `component` field as its real scene is built in later phases. Nothing here is
 * throwaway: the titles, notes and actions are the scene contract.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { ComponentType } from 'react';

import type { MachineEvent, State } from '@/machine';

export interface SceneAction {
  readonly label: string;
  readonly event: MachineEvent;
  readonly emphasis?: 'primary' | 'secondary';
}

export interface SceneDescriptor {
  readonly title: string;
  /** One line on what this state is for, from Doc 02 §2. */
  readonly note: string;
  /** Phase that replaces the placeholder with a real component. */
  readonly buildPhase: number;
  readonly actions: readonly SceneAction[];
  /** Set once the real scene exists; the placeholder is then bypassed. */
  readonly component?: ComponentType;
}

const skip: SceneAction = {
  label: 'Just show me the flowers',
  event: { type: 'SKIP_TO_LETTER' },
  emphasis: 'secondary',
};

export const SCENES: Readonly<Record<State, SceneDescriptor>> = {
  BOOT: {
    title: 'Boot',
    note: 'Capability routing. No UI. Exits in < 100 ms.',
    buildPhase: 2,
    actions: [],
  },
  BLOCKED_ENVIRONMENT: {
    title: 'Open in your real browser',
    note: 'In-app browser, insecure context, or no mediaDevices. Terminal-with-escape.',
    buildPhase: 2,
    actions: [skip],
  },
  LANDING: {
    title: 'Bloom Delivery',
    note: 'Hook + audio unlock. The Start tap is the only reliable user gesture in the flow.',
    buildPhase: 2,
    actions: [{ label: 'Start', event: { type: 'START_TAPPED' }, emphasis: 'primary' }],
  },
  PREFLIGHT: {
    title: 'Before we start',
    note: 'Privacy promise before the prompt. Buys ~6 s of hand-model download.',
    buildPhase: 2,
    actions: [
      { label: "I'm ready", event: { type: 'PREFLIGHT_CONTINUE' }, emphasis: 'primary' },
    ],
  },
  REQUESTING_CAMERA: {
    title: 'Ready when you are',
    note: 'getUserMedia in flight. Spinner-free.',
    buildPhase: 2,
    actions: [
      { label: 'granted', event: { type: 'PERMISSION_GRANTED' }, emphasis: 'primary' },
      { label: 'denied', event: { type: 'PERMISSION_DENIED' } },
      { label: 'NotFoundError', event: { type: 'CAMERA_FAILED', kind: 'NotFoundError' } },
      {
        label: 'NotReadableError',
        event: { type: 'CAMERA_FAILED', kind: 'NotReadableError' },
      },
    ],
  },
  CAMERA_DENIED: {
    title: "We can't see yet",
    note: 'Platform-specific recovery. iOS gets Reload, NOT a retry button.',
    buildPhase: 2,
    actions: [
      { label: 'Try again', event: { type: 'RETRY_CAMERA' }, emphasis: 'primary' },
      skip,
    ],
  },
  CAMERA_ERROR: {
    title: 'Camera trouble',
    note: 'Five non-denial failures, five copies. Retry only where retry works.',
    buildPhase: 2,
    actions: [{ label: 'Try again', event: { type: 'RETRY_CAMERA' } }, skip],
  },
  LOADING_DETECTION: {
    title: 'Warming up the magic',
    note: 'Blocks on the 230 KB face model only. The 7.5 MB hand model loads behind it.',
    buildPhase: 3,
    actions: [
      { label: 'models ready', event: { type: 'MODELS_READY' }, emphasis: 'primary' },
      { label: 'models failed', event: { type: 'MODELS_FAILED' } },
    ],
  },
  SEEKING_FACES: {
    title: 'Stand together',
    note: 'count(faceValid) >= 2 — NOT == 2 — in 8 of the last 10 ticks, then latch.',
    buildPhase: 3,
    actions: [
      { label: 'faces acquired', event: { type: 'FACES_ACQUIRED' }, emphasis: 'primary' },
      { label: 'solo timeout', event: { type: 'SOLO_TIMEOUT' } },
      { label: 'track muted', event: { type: 'TRACK_MUTED' } },
    ],
  },
  SOLO_PROMPT: {
    title: "Someone's missing",
    note: 'The most likely first open. An invitation, never a refusal.',
    buildPhase: 3,
    actions: [
      {
        label: "I'll go get them",
        event: { type: 'WAIT_FOR_PARTNER' },
        emphasis: 'primary',
      },
      { label: 'Peek alone', event: { type: 'PEEK_ALONE' }, emphasis: 'secondary' },
      { label: 'partner arrived', event: { type: 'FACES_ACQUIRED' } },
    ],
  },
  TOGETHER_CONFIRMED: {
    title: 'There you are!',
    note: '1.2 s reward beat — and the buffer that guarantees the hand model is ready.',
    buildPhase: 3,
    actions: [
      { label: 'hand model ready', event: { type: 'HAND_MODEL_READY' } },
      { label: 'beat done', event: { type: 'SEQUENCE_STEP_DONE' }, emphasis: 'primary' },
    ],
  },
  SEEKING_GESTURE: {
    title: 'Make a heart — one hand each',
    note: 'The gate, plus the 20/45/90 s mercy ladder. The hatch is focusable from t=0.',
    buildPhase: 4,
    actions: [
      {
        label: 'gesture enter',
        event: { type: 'GESTURE_ENTER', variant: 'G1' },
        emphasis: 'primary',
      },
      { label: 'mercy 1', event: { type: 'MERCY_TICK', level: 1 } },
      { label: 'mercy 2', event: { type: 'MERCY_TICK', level: 2 } },
      { label: 'mercy 3', event: { type: 'MERCY_TICK', level: 3 } },
      { label: 'Let them out', event: { type: 'MERCY_UNLOCK' }, emphasis: 'secondary' },
    ],
  },
  GESTURE_HOLDING: {
    title: 'Hold it…',
    note: '900 ms, 200 ms grace, ×2 decay. Decay says "you had it, come back".',
    buildPhase: 4,
    actions: [
      { label: 'hold complete', event: { type: 'HOLD_COMPLETE' }, emphasis: 'primary' },
      { label: 'gesture exit', event: { type: 'GESTURE_EXIT' } },
    ],
  },
  CAMERA_INTERRUPTED: {
    title: 'Camera paused',
    note: 'Mercy timers PAUSED. A phone call must not cost the user their patience budget.',
    buildPhase: 2,
    actions: [
      { label: 'Resume', event: { type: 'TRACK_RECOVERED' }, emphasis: 'primary' },
      skip,
    ],
  },
  UNLOCKING: {
    title: 'DELIVERY UNLOCKED',
    note: 'THE TEARDOWN BOUNDARY. Cancel loop → stop tracks → close tasks → assert.',
    buildPhase: 5,
    actions: [
      { label: 'beat done', event: { type: 'SEQUENCE_STEP_DONE' }, emphasis: 'primary' },
    ],
  },
  DELIVERY: {
    title: 'Delivery',
    note: 'Box falls, lands with a punch, bursts. ~9 s.',
    buildPhase: 6,
    actions: [
      { label: 'beat done', event: { type: 'SEQUENCE_STEP_DONE' }, emphasis: 'primary' },
    ],
  },
  BLOOM: {
    title: 'Bloom',
    note: 'Tulip field, petal drift, music peak. ~8 s.',
    buildPhase: 6,
    actions: [
      { label: 'beat done', event: { type: 'SEQUENCE_STEP_DONE' }, emphasis: 'primary' },
    ],
  },
  MESSAGE: {
    title: 'For {name} 🌷',
    note: 'Scale overshoot 1.15 → 1.0. Name rendered as a text node, never innerHTML.',
    buildPhase: 7,
    actions: [
      { label: 'beat done', event: { type: 'SEQUENCE_STEP_DONE' }, emphasis: 'primary' },
    ],
  },
  LETTER_CLOSED: {
    title: 'Open Letter',
    note: 'One last beat of anticipation. The payload is NOT decoded yet.',
    buildPhase: 7,
    actions: [
      {
        label: 'Open Letter',
        event: { type: 'LETTER_OPEN_TAPPED' },
        emphasis: 'primary',
      },
    ],
  },
  LETTER_OPEN: {
    title: 'The letter',
    note: 'Real, selectable, screen-readable DOM text. Never an image, never canvas.',
    buildPhase: 7,
    actions: [
      { label: 'settled', event: { type: 'SEQUENCE_STEP_DONE' }, emphasis: 'primary' },
    ],
  },
  RESTING: {
    title: 'Resting',
    note: 'frameloop="demand", < 5% GPU. The camera is never re-requested.',
    buildPhase: 7,
    actions: [
      { label: 'Read again', event: { type: 'READ_AGAIN_TAPPED' }, emphasis: 'primary' },
      { label: 'Replay the moment', event: { type: 'REPLAY_TAPPED' } },
      { label: 'Save our photo', event: { type: 'SAVE_PHOTO_TAPPED' } },
    ],
  },
  FATAL_ERROR: {
    title: 'Something wobbled',
    note: 'Copyable local diagnostic. Nothing is ever sent.',
    buildPhase: 1,
    actions: [
      {
        label: 'Take me to the letter',
        event: { type: 'SKIP_TO_LETTER' },
        emphasis: 'primary',
      },
    ],
  },
};
