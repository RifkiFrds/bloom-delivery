/**
 * MachineContext — Doc 01 §6.2, PRD v2 §State Machine Specification.
 *
 * Three latches are WRITE-ONCE and never cleared during a session:
 *   togetherConfirmed · hasUnlocked · peekedAlone
 *
 * `hasUnlocked` is THE idempotency latch. It is set synchronously inside the
 * reducer, before any effect runs — see `guards.canUnlock` and `reducer.ts`.
 */

import type { State } from './states';

export type RenderTier = 'full' | 'lite';
export type MercyLevel = 0 | 1 | 2 | 3;

export type CameraErrorKind =
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'OverconstrainedError'
  | 'SecurityError'
  | 'AbortError'
  | 'Unsupported'
  | 'Unknown';

export interface MachineContext {
  // Latches — write-once
  readonly togetherConfirmed: boolean;
  readonly hasUnlocked: boolean;
  /**
   * HISTORICAL, and persisted to `bloom_peeked`: they have peeked at some point.
   * Drives the extra "There you are. Now the real one." line on `MESSAGE`.
   */
  readonly peekedAlone: boolean;
  /**
   * THIS SESSION'S unlock came from `PEEK_ALONE` — never restored, never
   * persisted.
   *
   * ── WHY THIS IS SEPARATE FROM `peekedAlone` ─────────────────────────────
   * Doc 02 §5 guards `BLOOM → RESTING` on `peekedAlone`, and Doc 02 §2.10
   * promises that "when they later return and unlock properly, the full
   * sequence plays". Those two cannot both be true of one persisted flag: once
   * `bloom_peeked` is written, the guard fires on EVERY later run, so a person
   * who peeked once could never reach the letter again — the gesture would
   * work, the flowers would bloom, and the sequence would divert to the
   * "for when you're together" hold forever.
   *
   * The behavioural promise in §2.10 is the more specific statement, so the
   * guard reads this instead: was the unlock we are currently playing a peek?
   * ─────────────────────────────────────────────────────────────────────────
   */
  readonly unlockedByPeek: boolean;

  // Config
  readonly recipientName: string;
  readonly motionSafe: boolean;
  readonly renderTier: RenderTier;
  readonly muted: boolean;

  // Runtime
  readonly handModelReady: boolean;
  readonly gestureStageEnteredAt: number | null;
  readonly mercyLevel: MercyLevel;
  readonly lastError: string | null;
  readonly lastCameraErrorKind: CameraErrorKind | null;
  readonly skipCameraStage: boolean;
  readonly blockedReason: 'inapp' | 'insecure' | 'nomedia' | null;
  /** Where `CAMERA_INTERRUPTED` returns on `TRACK_RECOVERED`. */
  readonly interruptedFrom: State | null;
  readonly paused: boolean;
}

/** The default recipient name when `?to=` is absent or fails validation. */
export const DEFAULT_RECIPIENT = 'Someone Special';

export const initialContext: MachineContext = {
  togetherConfirmed: false,
  hasUnlocked: false,
  peekedAlone: false,
  unlockedByPeek: false,

  recipientName: DEFAULT_RECIPIENT,
  motionSafe: true,
  renderTier: 'full',
  muted: false,

  handModelReady: false,
  gestureStageEnteredAt: null,
  mercyLevel: 0,
  lastError: null,
  lastCameraErrorKind: null,
  skipCameraStage: false,
  blockedReason: null,
  interruptedFrom: null,
  paused: false,
};
