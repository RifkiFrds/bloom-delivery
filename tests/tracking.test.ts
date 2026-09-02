/**
 * The tracking overlay's logic — Parts 1, 2 and 4 of the visual upgrade.
 *
 * The DRAWING cannot be unit-tested without a canvas and a pair of eyes, but
 * the two pieces that decide WHERE things go and HOW they move are pure, and
 * they are the two that fail silently: a spring that diverges produces NaN
 * coordinates and an overlay that vanishes with no error, and a mask frame with
 * the wrong units puts the eyes off in a corner.
 */

import { describe, expect, it } from 'vitest';

import {
  integrate,
  integrateScalar,
  snap,
  springConstants,
} from '@/components/tracking/spring';
import {
  BANDS,
  EYE,
  MASK_SCALE,
  maskFrame,
  orderByScreenPosition,
  SHELL,
  variantFor,
  VEINS,
} from '@/components/tracking/mask';
import { spring } from '@/motion/tokens';
import type { FaceBox, Point } from '@/detection/types';

const gentle = springConstants('gentle');

describe('spring integration — Part 1', () => {
  it('uses the motion tokens rather than ad-hoc constants', () => {
    // Doc 04 §C.3: "ad-hoc stiffness/damping values are a review-blocking
    // defect. Every spring in the codebase references one of these four."
    expect(gentle.stiffness).toBe(spring.gentle.stiffness);
    expect(gentle.damping).toBe(spring.gentle.damping);
  });

  it('converges on the target', () => {
    const position = new Float32Array([0]);
    const velocity = new Float32Array([0]);
    const target = new Float32Array([1]);

    for (let i = 0; i < 120; i += 1) {
      integrate(position, velocity, target, 1, gentle, 1 / 60);
    }

    expect(position[0]).toBeCloseTo(1, 3);
    expect(velocity[0]).toBeCloseTo(0, 2);
  });

  /**
   * The whole reason for a spring over an exponential ease: following a ramp,
   * the lag must SETTLE rather than grow. Steady-state lag is
   * `velocity × damping / stiffness` = 0.6 × 26/200 ≈ 0.078 — a fixed offset,
   * not an accumulating one.
   */
  it('carries velocity, so lag settles instead of growing', () => {
    const position = new Float32Array([0]);
    const velocity = new Float32Array([0]);
    const target = new Float32Array([0]);
    const lag: number[] = [];

    for (let i = 0; i < 120; i += 1) {
      const ramp = i * 0.01; // constant 0.6 units/second
      target[0] = ramp;
      integrate(position, velocity, target, 1, gentle, 1 / 60);
      lag.push(Math.abs((position[0] ?? 0) - ramp));
    }

    // Matching the ramp's speed is what "keeping up" means.
    expect(velocity[0]).toBeCloseTo(0.6, 1);

    const early = lag[60] ?? 0;
    const late = lag[119] ?? 0;
    expect(late).toBeCloseTo(early, 3);
    expect(late).toBeLessThan(0.1);
  });

  it('settles without visible overshoot at `gentle`', () => {
    const position = new Float32Array([0]);
    const velocity = new Float32Array([0]);
    const target = new Float32Array([1]);
    let peak = 0;

    for (let i = 0; i < 200; i += 1) {
      integrate(position, velocity, target, 1, gentle, 1 / 60);
      peak = Math.max(peak, position[0] ?? 0);
    }

    expect(peak).toBeLessThan(1.05);
  });

  /**
   * ★ The failure this test exists for ★
   *
   * Semi-implicit Euler diverges once `stiffness × dt²` passes ~1. A single
   * 250 ms frame — a dropped frame, a tab returning from the background —
   * would send every landmark to infinity, and NaN is sticky: the overlay would
   * never come back, with no error anywhere.
   */
  it('stays finite across an enormous frame gap', () => {
    const position = new Float32Array([0]);
    const velocity = new Float32Array([0]);
    const target = new Float32Array([1]);

    integrate(position, velocity, target, 1, springConstants('pop'), 0.25);

    expect(Number.isFinite(position[0] ?? NaN)).toBe(true);
    expect(Math.abs(position[0] ?? 0)).toBeLessThan(4);
  });

  it('a zero or negative step changes nothing', () => {
    const position = new Float32Array([0.3]);
    const velocity = new Float32Array([5]);
    const target = new Float32Array([1]);

    integrate(position, velocity, target, 1, gentle, 0);
    // `toBeCloseTo`, not `toBe`: a Float32Array stores 0.3 as 0.30000001192…
    expect(position[0]).toBeCloseTo(0.3, 6);
  });

  it('snap teleports and kills velocity', () => {
    const position = new Float32Array([0, 0]);
    const velocity = new Float32Array([9, 9]);
    const target = new Float32Array([0.4, 0.7]);

    snap(position, velocity, target, 2);

    expect(Array.from(position)).toEqual([Math.fround(0.4), Math.fround(0.7)]);
    expect(Array.from(velocity)).toEqual([0, 0]);
  });

  it('the scalar spring converges too', () => {
    const velocity = new Float32Array(1);
    let value = 0;
    for (let i = 0; i < 150; i += 1) {
      value = integrateScalar(value, velocity, 0, 1, gentle, 1 / 60);
    }
    expect(value).toBeCloseTo(1, 3);
  });
});

// ── Mask geometry ───────────────────────────────────────────────────────────

/**
 * Mirrors the real caller: `toX`/`toY` already carry the pixels-per-unit scale,
 * and `unitPx` is that same scale, passed separately so the mask can size
 * itself. Using an identity mapping here would test a call shape that never
 * happens.
 */
const SCALE = 1000;
const project = (v: number): number => v * SCALE;

function face(keypoints: readonly Point[], score = 0.9): FaceBox {
  return { x: 0.3, y: 0.2, width: 0.4, height: 0.5, score, keypoints };
}

/** Eyes level, 0.1 apart — a face looking straight at the lens. */
const LEVEL: readonly Point[] = [
  { x: 0.45, y: 0.4 }, // right eye
  { x: 0.55, y: 0.4 }, // left eye
  { x: 0.5, y: 0.46 }, // nose
  { x: 0.5, y: 0.52 }, // mouth
  { x: 0.38, y: 0.42 }, // right ear
  { x: 0.62, y: 0.42 }, // left ear
];

describe('mask frame — Part 2', () => {
  it('centres on the eye midpoint and scales by interocular distance', () => {
    const frame = maskFrame(face(LEVEL), project, project, SCALE);

    expect(frame.valid).toBe(true);
    expect(frame.centreX).toBeCloseTo(500, 3);
    expect(frame.centreY).toBeCloseTo(400, 3);
    expect(frame.unit).toBeCloseTo(100, 3);
    expect(frame.rollRad).toBeCloseTo(0, 5);
  });

  /** A tilted head must tilt the mask, which is the whole reason for the roll. */
  it('follows head roll', () => {
    const tilted: readonly Point[] = [
      { x: 0.45, y: 0.38 },
      { x: 0.55, y: 0.44 },
      ...LEVEL.slice(2),
    ];
    const frame = maskFrame(face(tilted), project, project, SCALE);
    expect(frame.rollRad).toBeCloseTo(Math.atan2(0.06, 0.1), 5);
  });

  /**
   * A model build that returns no keypoints must still place a mask, using the
   * bounding box. Degrading to a non-rotating mask is acceptable; degrading to
   * nothing is not.
   */
  it('falls back to the bounding box when keypoints are absent', () => {
    const frame = maskFrame(face([]), project, project, SCALE);
    expect(frame.valid).toBe(true);
    expect(frame.centreX).toBeCloseTo(0.5 * SCALE, 3);
    expect(frame.rollRad).toBe(0);
  });

  it('is invalid when the box is empty too', () => {
    const empty: FaceBox = { x: 0, y: 0, width: 0, height: 0, score: 0, keypoints: [] };
    expect(maskFrame(empty, project, project, SCALE).valid).toBe(false);
  });
});

describe('variant assignment — Part 2', () => {
  /**
   * Doc 03 §3.5: the face stage has no track IDs and no association — it is a
   * count. Assignment is therefore by SCREEN POSITION, which needs no identity
   * and self-corrects if the two people swap sides.
   *
   * The preview is mirrored, so the LARGER raw x appears on the screen left.
   */
  it('gives the screen-left face the red variant', () => {
    const left = face([{ x: 0.7, y: 0.4 }, ...LEVEL.slice(1)]);
    const right = face([{ x: 0.3, y: 0.4 }, ...LEVEL.slice(1)]);

    // `keypoints[FK.NOSE]` drives the ordering; set it explicitly.
    const a: FaceBox = {
      ...left,
      keypoints: [...LEVEL.slice(0, 2), { x: 0.7, y: 0.46 }],
    };
    const b: FaceBox = {
      ...right,
      keypoints: [...LEVEL.slice(0, 2), { x: 0.3, y: 0.46 }],
    };

    const order = orderByScreenPosition([b, a]);
    expect(order[0]).toBe(1); // `a`, the larger x, is screen-left
    expect(variantFor(0)).toBe('red');
    expect(variantFor(1)).toBe('white');
  });

  it('orders a single face without complaint', () => {
    expect(orderByScreenPosition([face(LEVEL)])).toEqual([0]);
    expect(orderByScreenPosition([])).toEqual([]);
  });
});

describe('the mask is an original design, not the reference', () => {
  /**
   * The reference images supplied were the Marvel Spider-Man mask. Two things
   * make that design recognisable and protected: a RADIAL WEB converging on a
   * single point, and the swept TEARDROP eye with a sharp inner corner.
   *
   * These assertions pin the geometry away from both. They are unusual tests —
   * they encode a design constraint rather than a behaviour — but this is the
   * one property of the file that a future "make it look more like the
   * reference" edit would quietly destroy.
   */
  it('the lattice has no single convergence point', () => {
    // Every vein and band is a quadratic with distinct endpoints; a web would
    // show many segments sharing one coordinate. Count endpoint collisions.
    const endpoints = new Map<string, number>();
    for (const curve of [...VEINS, ...BANDS]) {
      for (const [x, y] of [
        [curve[0], curve[1]],
        [curve[4], curve[5]],
      ]) {
        const key = `${String(x)},${String(y)}`;
        endpoints.set(key, (endpoints.get(key) ?? 0) + 1);
      }
    }

    const busiest = Math.max(...endpoints.values());
    // A radial web would have every spoke meeting at the centre. The stem of a
    // leaf structure has branches leaving it at DIFFERENT heights.
    expect(busiest).toBeLessThanOrEqual(2);
  });

  it('the eye opening is not a swept teardrop', () => {
    // A teardrop has one vertex far sharper than the rest. A leaf shape spreads
    // its curvature. Compare the tightest interior angle against the mean.
    const angles: number[] = [];
    for (let i = 0; i < EYE.length; i += 1) {
      const previous = EYE[(i - 1 + EYE.length) % EYE.length];
      const current = EYE[i];
      const next = EYE[(i + 1) % EYE.length];
      if (previous === undefined || current === undefined || next === undefined) continue;

      const a = Math.atan2(previous[1] - current[1], previous[0] - current[0]);
      const b = Math.atan2(next[1] - current[1], next[0] - current[0]);
      let angle = Math.abs(a - b);
      if (angle > Math.PI) angle = Math.PI * 2 - angle;
      angles.push(angle);
    }

    const tightest = Math.min(...angles);
    // Nothing below ~50°: no sharp point anywhere on the outline.
    expect(tightest).toBeGreaterThan(0.85);
  });

  it('the shell is a full face, which is where the silhouette comes from', () => {
    const ys = SHELL.map(([, y]) => y);
    expect(Math.min(...ys)).toBeLessThan(-1.5); // above the brow
    expect(Math.max(...ys)).toBeGreaterThan(2); // past the chin
  });
});

describe('mask proportions match a real face', () => {
  /**
   * Everything is measured in pupil-to-pupil distances, so these ratios are
   * anthropometry, not taste — and they are what the reported "topengnya
   * kebesaran" turned out to be. The authored polygon was uniformly ~1.3× too
   * large, which `MASK_SCALE` corrects.
   *
   * A face is roughly 13.5 cm across the cheekbones with pupils 6.4 cm apart,
   * so half the face width is about 1.05 of a unit.
   */
  const effective = (value: number): number => value * MASK_SCALE;

  it('is no wider than a face', () => {
    const halfWidth = effective(Math.max(...SHELL.map(([x]) => Math.abs(x))));
    expect(halfWidth).toBeGreaterThan(0.95);
    expect(halfWidth).toBeLessThan(1.15);
  });

  it('reaches the crown and the chin, and no further', () => {
    const top = effective(Math.min(...SHELL.map(([, y]) => y)));
    const bottom = effective(Math.max(...SHELL.map(([, y]) => y)));

    expect(top).toBeGreaterThan(-1.45); // not floating above the head
    expect(top).toBeLessThan(-1.15);
    expect(bottom).toBeGreaterThan(1.6); // covers the chin
    expect(bottom).toBeLessThan(1.95); // does not hang off it
  });

  /**
   * ★ The bug inside the bug ★ — the eye HOLES sat 0.62 apart while the eyes
   * they frame are 0.5 apart by definition. They were framing empty cheek.
   */
  it('the eye openings sit on the eyes', () => {
    const EYE_OFFSET = 0.62; // the authored translate in `drawProcedural`
    expect(effective(EYE_OFFSET)).toBeCloseTo(0.5, 1);
  });

  it('the eye opening is wide enough to see through, not wider than an eye socket', () => {
    const width = effective(
      Math.max(...EYE.map(([x]) => x)) - Math.min(...EYE.map(([x]) => x)),
    );
    expect(width).toBeGreaterThan(0.4);
    expect(width).toBeLessThan(0.75);
  });
});
