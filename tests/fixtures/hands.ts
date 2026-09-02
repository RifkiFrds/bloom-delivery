/**
 * Synthetic landmark fixtures — Doc 03 §10.3, Doc 05 P4.2.
 *
 * ── WHAT THESE ARE, AND WHAT THEY ARE NOT ────────────────────────────────
 * Doc 03 §10.3 specifies FIFTEEN RECORDED CLIPS with dumped landmark arrays,
 * captured with two people in a room, in daylight and in evening light. Those
 * clips are the calibration data and they cannot be synthesised — the whole
 * point of recording them is that real hands are noisier and stranger than
 * anything one would invent.
 *
 * No clips are committed to this repository. So this file supplies the
 * COMPLEMENTARY half of the suite: hand-constructed landmark sets that pin the
 * GEOMETRY — every condition's sign, every rejection pose's discriminating
 * condition, the mercy monotonicity property, hysteresis, and the hold timer.
 *
 * These catch a regression in the maths. They do NOT establish the true- and
 * false-positive rates, which are measured against the recorded clips and are
 * an explicit outstanding verification debt (see the Phase 4 exit criteria).
 *
 * When the clips are recorded, `dump-landmarks` output drops in alongside this
 * file and the same assertions run against it unchanged — the evaluator takes
 * plain data, which is exactly why it takes plain data.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * COORDINATE SPACE: every fixture is already square-corrected (Doc 03 §2.1),
 * in frame-width units, y growing DOWNWARD. Values are chosen so a typical
 * palm scale S = dist(0, 9) lands near 0.06 — comfortably above the 0.045 gate,
 * matching what Phase 0 measured at arm's length.
 */

import type { Hand, Point } from '@/detection/types';

/** Builds a 21-landmark hand from a compact description. */
interface HandSpec {
  /** Wrist position. */
  readonly wrist: Point;
  /** Direction the palm points, in degrees. 0 = +x, 90 = +y (downward). */
  readonly palmAngleDeg: number;
  /** Palm scale S = dist(wrist, middleMCP). */
  readonly scale: number;
  /** Fraction of `scale` at which middle/ring/pinky tips sit from the wrist. */
  readonly curlFactor: number;
  /** Thumb tip, absolute. */
  readonly thumbTip: Point;
  /** Index tip, absolute. */
  readonly indexTip: Point;
  /** Fraction of `scale` at which the index PIP sits from the wrist. */
  readonly indexPipFactor?: number;
  /**
   * Overrides the pinky tip radius independently of `curlFactor`.
   *
   * The 🤟 sign needs the pinky EXTENDED while the middle and ring are folded,
   * and `curlFactor` moves all three together — so without this the pose cannot
   * be expressed at all.
   */
  readonly pinkyFactor?: number;
}

function polar(origin: Point, angleDeg: number, distance: number): Point {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: origin.x + Math.cos(radians) * distance,
    y: origin.y + Math.sin(radians) * distance,
  };
}

/**
 * Assembles the 21 landmarks the evaluators actually read.
 *
 * Only the indices the conditions touch are meaningful; the rest are filled
 * along the palm axis so the array is well-formed. This is honest about what
 * the fixture is: a geometry probe, not a simulated hand.
 */
export function makeHand(spec: HandSpec): Hand {
  const { wrist, palmAngleDeg: angle, scale, curlFactor } = spec;
  const points: Point[] = new Array<Point>(21);

  points[0] = wrist;
  points[9] = polar(wrist, angle, scale); // MIDDLE_MCP defines S and palmDir

  // MCPs fan around the palm axis at roughly the same radius.
  points[5] = polar(wrist, angle - 18, scale * 0.98); // INDEX_MCP
  points[13] = polar(wrist, angle + 16, scale * 0.94); // RING_MCP
  points[17] = polar(wrist, angle + 32, scale * 0.86); // PINKY_MCP
  points[2] = polar(wrist, angle - 40, scale * 0.5); // THUMB_MCP
  points[3] = polar(wrist, angle - 42, scale * 0.75); // THUMB_IP

  // PIPs sit beyond their MCPs, along the same rays.
  points[10] = polar(wrist, angle, scale * 1.5); // MIDDLE_PIP
  points[14] = polar(wrist, angle + 16, scale * 1.42); // RING_PIP
  points[18] = polar(wrist, angle + 32, scale * 1.3); // PINKY_PIP
  points[6] = polar(wrist, angle - 18, scale * (spec.indexPipFactor ?? 1.5)); // INDEX_PIP
  points[7] = polar(wrist, angle - 18, scale * 1.8); // INDEX_DIP

  // TIPs at `curlFactor × scale` from the wrist. Below the PIP radius means
  // curled; beyond it means extended. That single number drives C7 / C4.
  points[12] = polar(wrist, angle, scale * curlFactor); // MIDDLE_TIP
  points[16] = polar(wrist, angle + 16, scale * curlFactor * 0.95); // RING_TIP
  points[20] = polar(wrist, angle + 32, scale * (spec.pinkyFactor ?? curlFactor * 0.87)); // PINKY_TIP

  points[4] = spec.thumbTip;
  points[8] = spec.indexTip;

  // Remaining indices are never read by any condition; fill them so the array
  // has no holes rather than leaving `undefined` for the evaluator to guard.
  for (let i = 0; i < 21; i += 1) {
    points[i] ??= polar(wrist, angle, scale);
  }

  return points;
}

const S = 0.06;

/**
 * G1 accept — the canonical two-hand heart. One hand from each person, thumbs
 * meeting BELOW the index tips (the point of the heart at the bottom), wrists
 * apart, palms turned toward each other, other fingers curled.
 */
export function heartPair(): { handA: Hand; handB: Hand } {
  const handA = makeHand({
    wrist: { x: 0.36, y: 0.62 },
    palmAngleDeg: -55, // pointing up and to the right
    scale: S,
    curlFactor: 1.2,
    thumbTip: { x: 0.5, y: 0.53 },
    indexTip: { x: 0.487, y: 0.44 },
  });

  const handB = makeHand({
    wrist: { x: 0.64, y: 0.62 },
    palmAngleDeg: -125, // mirrored: up and to the left
    scale: S,
    curlFactor: 1.2,
    thumbTip: { x: 0.512, y: 0.53 },
    indexTip: { x: 0.525, y: 0.44 },
  });

  return { handA, handB };
}

/** C5 reject — clasped hands. Fingertips meet, but the WRISTS come together. */
export function claspedPair(): { handA: Hand; handB: Hand } {
  const { handA } = heartPair();
  const handB = makeHand({
    wrist: { x: 0.39, y: 0.61 }, // aperture collapses
    palmAngleDeg: -125,
    scale: S,
    curlFactor: 1.2,
    thumbTip: { x: 0.512, y: 0.53 },
    indexTip: { x: 0.525, y: 0.44 },
  });
  return { handA, handB };
}

/** C6 reject — high five. Palms PARALLEL and fingers extended: fails twice. */
export function highFivePair(): { handA: Hand; handB: Hand } {
  const handA = makeHand({
    wrist: { x: 0.36, y: 0.62 },
    palmAngleDeg: -90,
    scale: S,
    curlFactor: 2.4, // extended
    thumbTip: { x: 0.5, y: 0.53 },
    indexTip: { x: 0.487, y: 0.44 },
  });
  const handB = makeHand({
    wrist: { x: 0.64, y: 0.62 },
    palmAngleDeg: -90, // same direction → angle 0°, outside [50,170]
    scale: S,
    curlFactor: 2.4,
    thumbTip: { x: 0.512, y: 0.53 },
    indexTip: { x: 0.525, y: 0.44 },
  });
  return { handA, handB };
}

/** C7 reject — open palms, fingers splayed. Curl fails on both hands. */
export function openPalmPair(): { handA: Hand; handB: Hand } {
  return {
    handA: makeHand({
      wrist: { x: 0.36, y: 0.62 },
      palmAngleDeg: -55,
      scale: S,
      curlFactor: 2.6,
      thumbTip: { x: 0.5, y: 0.53 },
      indexTip: { x: 0.487, y: 0.44 },
    }),
    handB: makeHand({
      wrist: { x: 0.64, y: 0.62 },
      palmAngleDeg: -125,
      scale: S,
      curlFactor: 2.6,
      thumbTip: { x: 0.512, y: 0.53 },
      indexTip: { x: 0.525, y: 0.44 },
    }),
  };
}

/** C4 reject — the heart upside down. Thumbs ABOVE the index tips. */
export function invertedPair(): { handA: Hand; handB: Hand } {
  const handA = makeHand({
    wrist: { x: 0.36, y: 0.38 },
    palmAngleDeg: 55,
    scale: S,
    curlFactor: 1.2,
    thumbTip: { x: 0.5, y: 0.47 },
    indexTip: { x: 0.487, y: 0.56 },
  });
  const handB = makeHand({
    wrist: { x: 0.64, y: 0.38 },
    palmAngleDeg: 125,
    scale: S,
    curlFactor: 1.2,
    thumbTip: { x: 0.512, y: 0.47 },
    indexTip: { x: 0.525, y: 0.56 },
  });
  return { handA, handB };
}

/** C1 reject — hands too far from the camera. Below the 0.045 size gate. */
export function tooFarPair(): { handA: Hand; handB: Hand } {
  const tiny = 0.03;
  const handA = makeHand({
    wrist: { x: 0.44, y: 0.55 },
    palmAngleDeg: -55,
    scale: tiny,
    curlFactor: 1.2,
    thumbTip: { x: 0.497, y: 0.525 },
    indexTip: { x: 0.494, y: 0.49 },
  });
  const handB = makeHand({
    wrist: { x: 0.56, y: 0.55 },
    palmAngleDeg: -125,
    scale: tiny,
    curlFactor: 1.2,
    thumbTip: { x: 0.503, y: 0.525 },
    indexTip: { x: 0.506, y: 0.49 },
  });
  return { handA, handB };
}

/**
 * G2 accept — one-hand finger heart. Thumb tip touching a bent index tip, the
 * other three fingers curled.
 */
export function fingerHeart(): Hand {
  const wrist = { x: 0.5, y: 0.62 };
  return makeHand({
    wrist,
    palmAngleDeg: -90,
    scale: S,
    curlFactor: 1.2,
    // Contact: well under 0.35 × S.
    thumbTip: { x: 0.508, y: 0.552 },
    indexTip: { x: 0.5145, y: 0.5535 },
    indexPipFactor: 1.5,
  });
}

/**
 * G3 accept — mirrored finger hearts, one per person, wrists far apart.
 * `minWristSeparation` is 0.6 in frame-width units, so they sit near the edges.
 */
export function mirroredFingerHearts(): { handA: Hand; handB: Hand } {
  const build = (wristX: number): Hand =>
    makeHand({
      wrist: { x: wristX, y: 0.62 },
      palmAngleDeg: -90,
      scale: S,
      curlFactor: 1.2,
      thumbTip: { x: wristX + 0.008, y: 0.552 },
      indexTip: { x: wristX + 0.0145, y: 0.5535 },
    });
  return { handA: build(0.12), handB: build(0.78) };
}

/**
 * A G1 heart just OUTSIDE the level-0 thumb-junction bound and inside the
 * level-1 one. This is the fixture that makes the mercy monotonicity property
 * testable behaviourally rather than tautologically.
 */
export function borderlineHeartPair(): { handA: Hand; handB: Hand } {
  // Level 0 thumb limit = 0.85 × S̄ = 0.051. Level 1 = ×1.25 = 0.0638.
  // Place the thumbs 0.057 apart: rejected at 0, accepted at 1.
  const gap = 0.057;
  const handA = makeHand({
    wrist: { x: 0.36, y: 0.62 },
    palmAngleDeg: -55,
    scale: S,
    curlFactor: 1.2,
    thumbTip: { x: 0.5 - gap / 2, y: 0.53 },
    indexTip: { x: 0.487, y: 0.44 },
  });
  const handB = makeHand({
    wrist: { x: 0.64, y: 0.62 },
    palmAngleDeg: -125,
    scale: S,
    curlFactor: 1.2,
    thumbTip: { x: 0.5 + gap / 2, y: 0.53 },
    indexTip: { x: 0.525, y: 0.44 },
  });
  return { handA, handB };
}
