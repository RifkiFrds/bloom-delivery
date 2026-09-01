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
  readonly peekedAlone: boolean;

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
