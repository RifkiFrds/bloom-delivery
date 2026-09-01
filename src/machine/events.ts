/**
 * The event union — Doc 02 §3.
 *
 * The ONLY way into the machine is `bus.emit(event)`. Detection emits discrete
 * edges; components dispatch user intent; neither writes state directly.
 *
 * WHAT IS DELIBERATELY NOT AN EVENT (Doc 02 §3.2): holdProgress, closeness,
 * coachingState, faceCount, handCount, luma, fps and every debug metric. Those
 * are written to the detection ref at 15 Hz. Routing any of them through the
 * FSM would multiply store writes ~100× and break the ≤2 re-renders/second
 * budget.
 */

import type { CameraErrorKind } from './context';
import type { MercyLevel, RenderTier } from './context';

export interface BootOkPayload {
  readonly tier: RenderTier;
  readonly motionSafe: boolean;
  readonly recipientName: string;
  readonly priorUnlock: boolean;
  readonly peekedAlone: boolean;
  readonly muted: boolean;
}

export type BlockedReason = 'inapp' | 'insecure' | 'nomedia';

export type MachineEvent =
  // System
  | { readonly type: 'BOOT_OK'; readonly payload: BootOkPayload }
  | {
      readonly type: 'ENV_BLOCKED';
      readonly reason: BlockedReason;
      readonly app?: string;
    }
  | { readonly type: 'FATAL'; readonly diagnostic: string }

  // User
  | { readonly type: 'START_TAPPED' }
  | { readonly type: 'PREFLIGHT_CONTINUE' }
  | { readonly type: 'RETRY_CAMERA' }
  | { readonly type: 'PEEK_ALONE' }
  | { readonly type: 'WAIT_FOR_PARTNER' }
  | { readonly type: 'MERCY_UNLOCK' }
  | { readonly type: 'SKIP_TO_LETTER' }
  | { readonly type: 'LETTER_OPEN_TAPPED' }
  | { readonly type: 'REPLAY_TAPPED' }
  | { readonly type: 'READ_AGAIN_TAPPED' }
  | { readonly type: 'SAVE_PHOTO_TAPPED' }
  | { readonly type: 'MUTE_TOGGLED' }

  // Camera
  | { readonly type: 'PERMISSION_GRANTED' }
  | { readonly type: 'PERMISSION_DENIED' }
  | { readonly type: 'CAMERA_FAILED'; readonly kind: CameraErrorKind }
  | { readonly type: 'TRACK_MUTED' }
  | { readonly type: 'TRACK_ENDED' }
  | { readonly type: 'TRACK_RECOVERED' }

  // Loading
  | { readonly type: 'MODELS_READY' }
  | { readonly type: 'MODELS_FAILED' }
  | { readonly type: 'HAND_MODEL_READY' }

  // Detection — discrete edges only
  | { readonly type: 'FACES_ACQUIRED' }
  | { readonly type: 'SOLO_TIMEOUT' }
  | { readonly type: 'GESTURE_ENTER'; readonly variant: 'G1' | 'G2' | 'G3' }
  | { readonly type: 'GESTURE_EXIT' }
  | { readonly type: 'HOLD_COMPLETE' }

  // Sequence
  | { readonly type: 'SEQUENCE_STEP_DONE' }

  // Runtime
  | { readonly type: 'VISIBILITY_HIDDEN' }
  | { readonly type: 'VISIBILITY_VISIBLE' }
  | { readonly type: 'CONTEXT_LOST'; readonly restored: boolean }
  | { readonly type: 'DEGRADE_TO_LITE' }
  | { readonly type: 'MERCY_TICK'; readonly level: MercyLevel };

export type EventType = MachineEvent['type'];

export const EVENT_TYPES = [
  'BOOT_OK',
  'ENV_BLOCKED',
  'FATAL',
  'START_TAPPED',
  'PREFLIGHT_CONTINUE',
  'RETRY_CAMERA',
  'PEEK_ALONE',
  'WAIT_FOR_PARTNER',
  'MERCY_UNLOCK',
  'SKIP_TO_LETTER',
  'LETTER_OPEN_TAPPED',
  'REPLAY_TAPPED',
  'READ_AGAIN_TAPPED',
  'SAVE_PHOTO_TAPPED',
  'MUTE_TOGGLED',
  'PERMISSION_GRANTED',
  'PERMISSION_DENIED',
  'CAMERA_FAILED',
  'TRACK_MUTED',
  'TRACK_ENDED',
  'TRACK_RECOVERED',
  'MODELS_READY',
  'MODELS_FAILED',
  'HAND_MODEL_READY',
  'FACES_ACQUIRED',
  'SOLO_TIMEOUT',
  'GESTURE_ENTER',
  'GESTURE_EXIT',
  'HOLD_COMPLETE',
  'SEQUENCE_STEP_DONE',
  'VISIBILITY_HIDDEN',
  'VISIBILITY_VISIBLE',
  'CONTEXT_LOST',
  'DEGRADE_TO_LITE',
  'MERCY_TICK',
] as const satisfies readonly EventType[];
