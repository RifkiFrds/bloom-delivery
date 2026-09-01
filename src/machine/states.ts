/**
 * The state set — Doc 02 §2.
 *
 * NOTE ON THE COUNT: PRD v2's heading says "States (21)" but its table lists
 * 22. The table is authoritative; this is a typo in the heading, not a design
 * question. All 22 are implemented.
 *
 * `machine/` may not import react, zustand, three, motion or howler. Enforced
 * by ESLint (Doc 01 §2.1 rule B1).
 */

export const STATES = [
  // Entry / routing
  'BOOT',
  'BLOCKED_ENVIRONMENT',
  'LANDING',
  'PREFLIGHT',

  // Camera acquisition
  'REQUESTING_CAMERA',
  'CAMERA_DENIED',
  'CAMERA_ERROR',
  'LOADING_DETECTION',

  // The gate — Phase A
  'SEEKING_FACES',
  'SOLO_PROMPT',
  'TOGETHER_CONFIRMED',
  'SEEKING_GESTURE',
  'GESTURE_HOLDING',
  'CAMERA_INTERRUPTED',

  // The gift — Phase B
  'UNLOCKING',
  'DELIVERY',
  'BLOOM',
  'MESSAGE',
  'LETTER_CLOSED',
  'LETTER_OPEN',
  'RESTING',

  // Failure
  'FATAL_ERROR',
] as const;

export type State = (typeof STATES)[number];

/**
 * Runtime phase — Doc 01 §2.1.
 *
 * Camera + MediaPipe (A) and WebGL (B) NEVER coexist. `UNLOCKING` is the
 * teardown boundary and belongs to neither.
 */
export type RuntimePhase = 'none' | 'A' | 'boundary' | 'B';

const PHASE_A: ReadonlySet<State> = new Set<State>([
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
]);

const PHASE_B: ReadonlySet<State> = new Set<State>([
  'DELIVERY',
  'BLOOM',
  'MESSAGE',
  'LETTER_CLOSED',
  'LETTER_OPEN',
  'RESTING',
]);

export function runtimePhase(state: State): RuntimePhase {
  if (state === 'UNLOCKING') return 'boundary';
  if (PHASE_A.has(state)) return 'A';
  if (PHASE_B.has(state)) return 'B';
  return 'none';
}

/** States where the camera stream is expected to be live. */
export function expectsCamera(state: State): boolean {
  return PHASE_A.has(state) && state !== 'CAMERA_DENIED' && state !== 'CAMERA_ERROR';
}

export function isState(value: string): value is State {
  return (STATES as readonly string[]).includes(value);
}
