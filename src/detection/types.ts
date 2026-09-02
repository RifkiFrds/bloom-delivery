/**
 * Detection types — Doc 03 §2.3.
 *
 * These deliberately do NOT import from `@mediapipe/tasks-vision`. The pure
 * geometry modules must operate on plain data so the fixture suite can run them
 * against dumped landmark JSON with no browser and no WASM (Doc 03 §10.3).
 */

/** A landmark in square-corrected space. See `gesture/space.ts`. */
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
  /**
   * BlazeFace's six keypoints, square-corrected:
   * `[rightEye, leftEye, noseTip, mouth, rightEar, leftEar]`.
   *
   * ── THESE WERE ALREADY BEING COMPUTED AND THROWN AWAY ──────────────────
   * Doc 03 §3.1 rejects `FaceLandmarker` (478 points) as "many times the cost
   * for information nothing here uses". That still holds — this is the SAME
   * detector, and these six points arrive in the same result object at no extra
   * inference cost. Reading them changes no threshold and no decision:
   * `faceValid` still tests score and box width alone.
   *
   * Empty when the model returns no keypoints, so every consumer must handle
   * the absence rather than assume six.
   */
  readonly keypoints: readonly Point[];
}

/** Indices into `FaceBox.keypoints`. */
export const FK = {
  RIGHT_EYE: 0,
  LEFT_EYE: 1,
  NOSE: 2,
  MOUTH: 3,
  RIGHT_EAR: 4,
  LEFT_EAR: 5,
} as const;

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

export type GestureVariant = 'G1' | 'G2' | 'G3';

/**
 * One evaluated condition.
 *
 * `value` and `threshold` are carried so the debug HUD can show the measured
 * quantity against the bound it was compared with — without that, thresholds
 * cannot be calibrated against reality (Doc 03 §10.2).
 */
export interface Condition {
  readonly id: string;
  readonly label: string;
  readonly pass: boolean;
  /** Measured quantity. `null` for boolean-only conditions such as C4 and C7. */
  readonly value: number | null;
  /** The bound `value` was compared against. `null` when not applicable. */
  readonly threshold: number | null;
  /** How to read the comparison, for the HUD and for `closeness`. */
  readonly comparison: '<=' | '>=' | 'range' | 'bool';
}

/** The result of evaluating one gesture variant. */
export interface VariantResult {
  readonly variant: GestureVariant;
  readonly pass: boolean;
  readonly conditions: readonly Condition[];
  /** First failing condition id, for coaching and the HUD. `null` when passing. */
  readonly failedAt: string | null;
}

/** Coaching states — Doc 04 §B.9, priority order. First match wins. */
export const COACHING_STATES = [
  'TOO_DARK',
  'NO_FACES',
  'ONE_FACE',
  'NO_HANDS',
  'HANDS_TOO_SMALL',
  'ALMOST',
  'HOLDING',
  'IDLE',
] as const;

export type CoachingState = (typeof COACHING_STATES)[number];

/** Which models the loop runs this tick. Set by the FSM, read by the loop. */
export type DetectionMode = 'idle' | 'face' | 'face+hands';

export type Delegate = 'GPU' | 'CPU';
