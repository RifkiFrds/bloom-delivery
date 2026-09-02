/**
 * ★ THE HERO MASK ★ — an original design, drawn from six keypoints.
 *
 * ── ON THE REFERENCE IMAGE ───────────────────────────────────────────────
 * The brief's reference is Spider-Man (Miles Morales and Spider-Gwen). That
 * character design — the radial web, the pointed teardrop eye silhouette, the
 * black rim — is protected, and reproducing it is exactly what the brief itself
 * rules out: "avoid official copyrighted designs, exact replicas".
 *
 * So this takes the BRIEF's list, not the picture: mesh lines, geometric
 * shapes, dynamic facial contours, glowing eye frames. The result is a
 * FACETED, ANGULAR mask — chords and triangles, not a spiral web — with
 * rounded-hexagon eye frames rather than teardrops. It reads as comic-hero
 * without reading as anyone in particular.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── IT COVERS THE UPPER FACE ONLY ────────────────────────────────────────
 * The brief asks that "facial expression remains readable". A full mask cannot
 * do that. This one is a brow-and-eyes piece: the mouth is never covered, so
 * the two people can still see each other smile — which is rather the point of
 * an experience about being together.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── THE LOCAL FRAME ──────────────────────────────────────────────────────
 * Everything is authored in a space where the eyes sit at (±0.5, 0) and one
 * unit is the interocular distance. The draw call then applies scale, head
 * ROLL and translation once. That is what makes the mask track a tilted head
 * for free, with no per-shape maths.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Two fills at different radii instead of `shadowBlur` for the body glow:
 * a blur pass costs a full-canvas readback on mobile Safari, and this is
 * running while two neural networks are.
 */

import { FK, type FaceBox, type Point } from '@/detection/types';

export type MaskVariant = 'red' | 'white';

interface Palette {
  readonly shell: string;
  readonly line: string;
  readonly eye: string;
  readonly eyeCore: string;
}

/**
 * Both variants are built from the existing tokens. Doc 04 §A.1: never
 * introduce a new hue. The eye colour matches that person's HAND colour, so the
 * pairing is legible at a glance — pink person, pink hands, pink eyes.
 */
const PALETTE: Readonly<Record<MaskVariant, Palette>> = {
  red: {
    shell: '#FF8FAB', // --pink
    line: '#111111',
    eye: '#FF6F92', // --pink-press
    eyeCore: '#FFD6E0', // --pink-light
  },
  white: {
    shell: '#FFFFFF', // --white
    line: '#111111',
    eye: '#B7E4C7', // --green
    eyeCore: '#FFF8E8', // --cream
  },
};

/** The mask's own frame, derived from the keypoints. */
export interface MaskFrame {
  readonly centreX: number;
  readonly centreY: number;
  /** Pixels per unit of interocular distance. */
  readonly unit: number;
  readonly rollRad: number;
  readonly valid: boolean;
}

/**
 * Builds the frame. PURE.
 *
 * Falls back to the bounding box when keypoints are absent, so a model build
 * that returns none degrades to a correctly-placed but non-rotating mask rather
 * than to nothing at all.
 */
export function maskFrame(
  face: FaceBox,
  toX: (x: number) => number,
  toY: (y: number) => number,
  unitPx: number,
): MaskFrame {
  const right = face.keypoints[FK.RIGHT_EYE];
  const left = face.keypoints[FK.LEFT_EYE];

  if (right === undefined || left === undefined) {
    return {
      centreX: toX(face.x + face.width / 2),
      centreY: toY(face.y + face.height * 0.42),
      unit: face.width * unitPx * 0.42,
      rollRad: 0,
      valid: face.width > 0,
    };
  }

  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const interocular = Math.hypot(dx, dy);

  return {
    centreX: toX((right.x + left.x) / 2),
    centreY: toY((right.y + left.y) / 2),
    unit: interocular * unitPx,
    rollRad: Math.atan2(dy, dx),
    valid: interocular > 0.0001,
  };
}

// ── The design, authored once in local units ────────────────────────────────

/** Outer shell: an angular brow piece, wider at the temples than at the brow. */
const SHELL: readonly (readonly [number, number])[] = [
  [-1.32, -0.18],
  [-1.18, -0.72],
  [-0.72, -1.06],
  [0, -1.16],
  [0.72, -1.06],
  [1.18, -0.72],
  [1.32, -0.18],
  [1.16, 0.36],
  [0.86, 0.62],
  [0.5, 0.52],
  [0, 0.42],
  [-0.5, 0.52],
  [-0.86, 0.62],
  [-1.16, 0.36],
];

/** Facet chords. Geometric, deliberately NOT radial — a web is the thing to avoid. */
const FACETS: readonly (readonly [number, number, number, number])[] = [
  [-1.18, -0.72, -0.24, -0.5],
  [1.18, -0.72, 0.24, -0.5],
  [-0.72, -1.06, -0.34, -0.28],
  [0.72, -1.06, 0.34, -0.28],
  [0, -1.16, 0, -0.34],
  [-1.32, -0.18, -0.9, 0.1],
  [1.32, -0.18, 0.9, 0.1],
  [-0.24, -0.5, 0.24, -0.5],
];

/** Rounded-hexagon eye frame, authored around the origin. */
const EYE: readonly (readonly [number, number])[] = [
  [-0.3, 0],
  [-0.19, -0.19],
  [0.14, -0.22],
  [0.31, -0.05],
  [0.22, 0.17],
  [-0.1, 0.2],
];

/**
 * Draws one mask.
 *
 * @param reveal 0–1. Drives opacity AND scale, so the mask grows into place
 *   rather than fading on top of the face (Part 4: no popping).
 * @param glow 0–1. Rises with the heart's progress (Part 5).
 * @param pulse 0–1. One pulse on success.
 */
export function drawMask(
  ctx: CanvasRenderingContext2D,
  frame: MaskFrame,
  variant: MaskVariant,
  reveal: number,
  glow: number,
  pulse: number,
): void {
  if (!frame.valid || reveal <= 0.01 || frame.unit <= 0) return;

  const palette = PALETTE[variant];
  const alpha = Math.min(1, reveal);

  ctx.save();
  ctx.translate(frame.centreX, frame.centreY);
  ctx.rotate(frame.rollRad);
  // Settles from 0.86 to 1.0 as it reveals, plus the success pulse.
  ctx.scale(
    frame.unit * (0.86 + reveal * 0.14 + pulse * 0.06),
    frame.unit * (0.86 + reveal * 0.14 + pulse * 0.06),
  );

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ── Shell ──────────────────────────────────────────────────────────────
  // Two passes at different alphas give the body a soft edge without a blur.
  tracePolygon(ctx, SHELL);
  ctx.globalAlpha = alpha * (0.22 + glow * 0.16);
  ctx.fillStyle = palette.shell;
  ctx.fill();

  ctx.globalAlpha = alpha * 0.9;
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 0.055;
  ctx.stroke();

  // ── Facets ─────────────────────────────────────────────────────────────
  ctx.globalAlpha = alpha * (0.45 + glow * 0.35);
  ctx.strokeStyle = palette.shell;
  ctx.lineWidth = 0.032;
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of FACETS) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  // ── Brow chevron ───────────────────────────────────────────────────────
  ctx.globalAlpha = alpha * 0.85;
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(-0.86, -0.42);
  ctx.quadraticCurveTo(0, -0.2, 0.86, -0.42);
  ctx.stroke();

  // ── Eye frames ─────────────────────────────────────────────────────────
  // The fill is deliberately faint: the brief requires the eyes stay VISIBLE,
  // so this frames them rather than covering them.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 0.5, 0.02);
    ctx.scale(side, 1);

    tracePolygon(ctx, EYE);
    ctx.globalAlpha = alpha * (0.2 + glow * 0.25);
    ctx.fillStyle = palette.eye;
    ctx.fill();

    // The glow is a second, larger stroke at low alpha — cheaper than
    // `shadowBlur`, and it survives on a mid-range Android.
    ctx.globalAlpha = alpha * (0.3 + glow * 0.5 + pulse * 0.2);
    ctx.strokeStyle = palette.eye;
    ctx.lineWidth = 0.1 + glow * 0.05;
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = palette.eyeCore;
    ctx.lineWidth = 0.038;
    ctx.stroke();

    ctx.restore();
  }

  // ── Blush ──────────────────────────────────────────────────────────────
  // Doc 04 §A.7: "small blush ovals at 30% --pink". The kawaii half of the art
  // direction, and what keeps this from reading as tactical gear.
  ctx.globalAlpha = alpha * 0.3;
  ctx.fillStyle = '#FF8FAB';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 0.95, 0.46, 0.2, 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function tracePolygon(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
): void {
  ctx.beginPath();
  const first = points[0];
  if (first === undefined) return;
  ctx.moveTo(first[0], first[1]);

  // Quadratic through midpoints: the outline reads as a drawn contour rather
  // than a polygon, which is the difference between "stylised" and "wireframe".
  for (let i = 1; i <= points.length; i += 1) {
    const current = points[i % points.length];
    const next = points[(i + 1) % points.length];
    if (current === undefined || next === undefined) break;
    ctx.quadraticCurveTo(
      current[0],
      current[1],
      (current[0] + next[0]) / 2,
      (current[1] + next[1]) / 2,
    );
  }
  ctx.closePath();
}

/**
 * Variant assignment by SCREEN POSITION.
 *
 * Doc 03 §3.5: the face stage has "no IoU association, no track IDs, no
 * birth/death counters" — it is a count, not an identity system, and adding
 * tracking here to keep a mask on "the same person" would reintroduce several
 * hundred lines of the most bug-prone code in a system like this.
 *
 * Position works instead: the preview is mirrored, so the LARGER raw x appears
 * on the screen left and takes the red variant. It is stable while two people
 * stand side by side, and self-corrects if they swap.
 */
export function variantFor(index: number): MaskVariant {
  return index === 0 ? 'red' : 'white';
}

/** Sorts face indices so index 0 is the screen-left face. */
export function orderByScreenPosition(faces: readonly FaceBox[]): readonly number[] {
  const order = faces.map((_, index) => index);
  order.sort((a, b) => centreOf(faces[b]) - centreOf(faces[a]));
  return order;
}

function centreOf(face: FaceBox | undefined): number {
  if (face === undefined) return 0;
  const nose: Point | undefined = face.keypoints[FK.NOSE];
  return nose?.x ?? face.x + face.width / 2;
}
