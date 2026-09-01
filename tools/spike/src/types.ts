/**
 * Shared types for the Phase 0 spike.
 *
 * These deliberately do NOT import from @mediapipe/tasks-vision: the pure
 * geometry modules must operate on plain data so they can be unit-tested
 * against dumped landmark JSON without a browser (Doc 03 §10.3).
 */

/** A landmark in square-corrected space. See `space.ts`. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Exactly 21 MediaPipe hand landmarks, square-corrected. */
export type Hand = readonly Point[];

/** A face bounding box in normalized (frame-width) units. */
export interface FaceBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly score: number;
}

/** MediaPipe canonical hand landmark indices (Doc 03 §2.3). */
export const L = {
  WRIST: 0,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
} as const;

/** The three fingers whose curl is tested by G1 C7 and G2 C4. */
export const CURL_FINGERS = ['middle', 'ring', 'pinky'] as const;
export type CurlFinger = (typeof CURL_FINGERS)[number];

/** Mercy level, per Doc 03 §6.7. */
export type MercyLevel = 0 | 1 | 2 | 3;

/**
 * One evaluated condition. `value` and `threshold` are surfaced in the HUD so
 * thresholds can be calibrated against measured reality (Doc 03 §10.2).
 */
export interface Condition {
  readonly id: string;
  readonly label: string;
  readonly pass: boolean;
  /** Measured quantity. `null` for boolean-only conditions such as C4 and C7. */
  readonly value: number | null;
  /** The bound `value` was compared against. `null` when not applicable. */
  readonly threshold: number | null;
  /** How to read the comparison, for the HUD. */
  readonly comparison: '<=' | '>=' | 'range' | 'bool';
}

/** The result of evaluating one gesture variant. */
export interface VariantResult {
  readonly variant: 'G1' | 'G2' | 'G3';
  readonly pass: boolean;
  readonly conditions: readonly Condition[];
  /** First failing condition id, for coaching and the HUD. `null` when passing. */
  readonly failedAt: string | null;
}

/** Coaching states, Doc 04 §B.9, priority order — first match wins. */
export type CoachingState =
  | 'TOO_DARK'
  | 'NO_FACES'
  | 'ONE_FACE'
  | 'NO_HANDS'
  | 'HANDS_TOO_SMALL'
  | 'ALMOST'
  | 'HOLDING'
  | 'IDLE';

/** Everything the loop publishes per tick. The HUD reads this on its own rAF. */
export interface DetectionSnapshot {
  readonly tick: number;
  readonly timestampMs: number;

  readonly faceCount: number;
  readonly faceBoxes: readonly FaceBox[];
  readonly togetherConfirmed: boolean;
  readonly liveness: boolean;

  readonly hands: readonly Hand[];
  readonly palmScales: readonly number[];

  readonly g1: VariantResult | null;
  readonly g2: readonly VariantResult[];
  readonly g3: VariantResult | null;

  readonly accepted: boolean;
  readonly gesturePresent: boolean;
  readonly closeness: number;
  readonly holdMs: number;
  readonly holdProgress: number;
  readonly nofmWindow: readonly boolean[];

  readonly coaching: CoachingState;
  readonly mercyLevel: MercyLevel;
  readonly lumaY: number;
  readonly tooDark: boolean;

  readonly inferenceMs: number;
  readonly effectiveHz: number;
  readonly intervalMs: number;
}
