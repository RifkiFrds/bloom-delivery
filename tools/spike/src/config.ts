/**
 * THE CONSTANT REGISTRY for Phase 0.
 *
 * Every threshold in the detection spec lives here and nowhere else
 * (Doc 05 §14: "Constants live in detection.config — never at the call site").
 *
 * All values are the STARTING values from Doc 03. The structure is fixed; the
 * numbers are what Phase 0 exists to calibrate. When a value changes during
 * calibration, change it here, record the measurement that justified it in the
 * exported report, and carry it into `src/detection/config.ts` at Phase 4.
 */

import type { MercyLevel } from './types';

export const CADENCE = {
  /** Target 15 Hz — Doc 03 §11.1. */
  targetIntervalMs: 66,
  /** Degraded 10 Hz when the last inference exceeded `degradeAboveMs`. */
  degradedIntervalMs: 100,
  /** Above this, drop to 10 Hz. */
  degradeAboveMs: 60,
  /** Above this, drop face detection during the gesture stage entirely. */
  dropFaceAboveMs: 110,
} as const;

export const CAMERA = {
  /** 720p, not 1080p: halves decode cost, MediaPipe downsamples anyway. */
  width: 1280,
  height: 720,
  frameRate: 30,
} as const;

export const FACE = {
  /** Model-level confidence. Mercy ≥ 1 / Tier 2 relaxes to 0.40. */
  minDetectionConfidence: 0.5,
  minDetectionConfidenceRelaxed: 0.4,
  minSuppressionThreshold: 0.3,
  /** App-level filter: rejects small background faces (Doc 03 §3.2). */
  minBoxWidth: 0.1,
  /** The latch: `>= 2` — NOT `== 2` (Doc 03 §3.3). */
  latchMinCount: 2,
  /** N-of-M for the latch: 8 of the last 10 ticks (~0.67 s at 15 Hz). */
  latchWindow: 10,
  latchRequired: 8,
  /** Liveness during the gesture stage: `>= 1` in 5 of the last 10. */
  livenessMinCount: 1,
  livenessWindow: 10,
  livenessRequired: 5,
  /** One face continuously for this long, pre-latch → SOLO_TIMEOUT. */
  soloTimeoutMs: 15_000,
} as const;

export const HANDS = {
  numHands: 2,
  minHandDetectionConfidence: 0.5,
  minHandDetectionConfidenceRelaxed: 0.4,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
} as const;

/**
 * G1 — two-hand heart, formed by one hand from each person. PRIMARY.
 * Doc 03 §6.2. `S̄` is the mean palm scale of the two hands.
 */
export const G1 = {
  /** C1 — hands large enough. THE number that governs the project. */
  minPalmScale: 0.045,
  /** C2 — thumb junction: dist(A4,B4) <= this × S̄ × M */
  thumbJunction: 0.55,
  /** C3 — index junction: dist(A8,B8) <= this × S̄ × M */
  indexJunction: 0.7,
  /** C5 — aperture: dist(A0,B0) >= this × S̄ / M. Rejects clasped/prayer/handshake. */
  aperture: 0.8,
  /** C6 — mirrored posture: angle(palmDir A, palmDir B) within this range. */
  palmAngleMinDeg: 50,
  palmAngleMaxDeg: 170,
} as const;

/** G2 — one-hand Korean finger heart. Accepted from mercy ≥ 1. Doc 03 §6.3. */
export const G2 = {
  minPalmScale: 0.04,
  /** C2 — thumb-index contact: dist(4,8) <= this × S × M */
  thumbIndexContact: 0.35,
} as const;

/** G3 — mirrored finger hearts. Doc 03 §6.4. */
export const G3 = {
  /** Wrist separation, distinguishing two people from one person's two hands. */
  minWristSeparation: 0.6,
} as const;

/** Hysteresis — Doc 03 §7.1. Enter at T, exit only past T × this. */
export const HYSTERESIS = {
  exitMultiplier: 1.3,
} as const;

/** N-of-M boolean stabilisation on the FINAL accepted boolean — Doc 03 §4.5. */
export const NOFM = {
  window: 7,
  required: 5,
} as const;

/** Hold timer — Doc 03 §7.2. */
export const HOLD = {
  targetMs: 900,
  graceMs: 200,
  decayMultiplier: 2,
} as const;

/** Closeness — the "almost there" signal. UI ONLY, never gates. Doc 03 §6.5. */
export const CLOSENESS = {
  emaAlpha: 0.4,
  almostThreshold: 0.65,
} as const;

/** Ambient brightness — Doc 03 §9.1. */
export const LUMA = {
  sampleIntervalMs: 500,
  canvasSize: 32,
  tooDarkBelow: 45,
  /** Consecutive samples below the threshold before TOO_DARK latches. */
  consecutiveSamples: 2,
} as const;

/** Mercy escalation — Doc 03 §6.7. Multiplier `M` relaxes distance thresholds. */
export const MERCY = {
  /** Active elapsed ms in the gesture stage at which each level begins. */
  thresholdsMs: [0, 20_000, 45_000, 90_000] as const,
  multiplier: { 0: 1.0, 1: 1.25, 2: 1.25, 3: 1.25 } as const satisfies Record<
    MercyLevel,
    number
  >,
  /** G2/G3 are only accepted from level 1 onward. */
  acceptsFingerHeartFrom: 1 as const,
} as const;

/** Doc 03 §1.3 / Doc 05 §4.2 — the criteria this spike exists to measure. */
export const EXIT_CRITERIA = {
  palmScaleMin: 0.045,
  truePositiveDaylight: 0.8,
  truePositiveEvening: 0.6,
  falsePositiveMax: 0,
  inferenceMaxMs: 60,
  faceLatchRate: 0.9,
  faceLatchWithinMs: 3000,
} as const;

/** Self-hosted vision assets — Doc 01 §7.3. Never a CDN. */
export const ASSETS = {
  wasmPath: '/vision/wasm',
  faceModel: '/vision/face_detector.task',
  handModel: '/vision/hand_landmarker.task',
} as const;
