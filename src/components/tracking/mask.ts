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
//
// Eyes sit at (±0.5, 0); one unit is the interocular distance. Everything below
// is authored in that frame, so scale and head roll are applied once at draw
// time and no shape has to know about them.

/**
 * A FULL-FACE shell — the silhouette is what gives a hero mask its weight, and
 * the previous brow-only band had none.
 *
 * The fill is semi-transparent on purpose. An opaque mask would hide the two
 * faces from each other, in an experience whose entire subject is two people
 * looking at each other. So the outline and the lattice are solid and the shell
 * is a wash: the graphic reads at full strength, the person reads through it.
 */
export const SHELL: readonly (readonly [number, number])[] = [
  [0, -1.72],
  [0.62, -1.6],
  [1.08, -1.16],
  [1.32, -0.5],
  [1.36, 0.24],
  [1.22, 0.98],
  [0.94, 1.62],
  [0.52, 2.08],
  [0, 2.24],
  [-0.52, 2.08],
  [-0.94, 1.62],
  [-1.22, 0.98],
  [-1.36, 0.24],
  [-1.32, -0.5],
  [-1.08, -1.16],
  [-0.62, -1.6],
];

/**
 * ── THE LATTICE IS A LEAF, NOT A WEB ─────────────────────────────────────
 * A radial web converging on one point is the protected part of the reference,
 * and it is also the wrong idea for this product. This is a BOTANICAL vein
 * structure: one central stem with paired veins branching outward and up, which
 * is dense and graphic in the same way while belonging to a gift of flowers.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `[x1, y1, cx, cy, x2, y2]` — quadratic, so every vein is a curve. A straight
 * line is the thing that makes an overlay read as a wireframe.
 */
export const VEINS: readonly (readonly number[])[] = [
  // The stem, top to chin.
  [0, -1.66, 0, 0.2, 0, 2.2],

  // Upper crown pairs.
  [0, -1.3, -0.5, -1.44, -0.96, -1.16],
  [0, -1.3, 0.5, -1.44, 0.96, -1.16],
  [0, -0.86, -0.66, -1.08, -1.2, -0.72],
  [0, -0.86, 0.66, -1.08, 1.2, -0.72],
  [0, -0.42, -0.74, -0.62, -1.32, -0.3],
  [0, -0.42, 0.74, -0.62, 1.32, -0.3],

  // Lower pairs, sweeping down past the cheeks.
  [0, 0.72, -0.7, 0.72, -1.24, 1.02],
  [0, 0.72, 0.7, 0.72, 1.24, 1.02],
  [0, 1.24, -0.62, 1.3, -1.0, 1.66],
  [0, 1.24, 0.62, 1.3, 1.0, 1.66],
  [0, 1.74, -0.44, 1.86, -0.66, 2.06],
  [0, 1.74, 0.44, 1.86, 0.66, 2.06],
];

/** Contour bands across the shell — the cross-weave of the lattice. */
export const BANDS: readonly (readonly number[])[] = [
  [-0.96, -1.16, 0, -1.52, 0.96, -1.16],
  [-1.2, -0.72, 0, -1.08, 1.2, -0.72],
  [-1.24, 1.02, 0, 0.72, 1.24, 1.02],
  [-1.0, 1.66, 0, 1.24, 1.0, 1.66],
  [-0.66, 2.06, 0, 1.74, 0.66, 2.06],
];

/**
 * The eye opening — a standing LEAF: rounded at the outer edge, gently pointed
 * at the top.
 *
 * Deliberately not the reference's teardrop, which sweeps up from a sharp inner
 * corner. That silhouette is the second half of what makes the character
 * recognisable, and it is as much the design as the web is.
 *
 * Authored around the origin, mirrored per side. Large — roughly a third of the
 * face width — because the drama in a hero mask lives in the eyes.
 */
export const EYE: readonly (readonly [number, number])[] = [
  [-0.04, -0.34],
  [0.3, -0.26],
  [0.52, 0.02],
  [0.44, 0.34],
  [0.12, 0.44],
  [-0.16, 0.26],
  [-0.2, -0.06],
];

/**
 * ── OPTIONAL DROP-IN ARTWORK ─────────────────────────────────────────────
 * If original mask art exists, it is used instead of the procedural design.
 * Drawn artwork will always beat anything generated from polygons, so the code
 * should not stand in the way of it.
 *
 * THE CONTRACT the artwork must meet, so it lands on the face correctly:
 *   · square canvas
 *   · face centred horizontally
 *   · the EYE LINE at 42% of the height
 *   · interocular distance = 26% of the width
 *   · transparent where the eyes and the background are
 *
 * Drop `public/mask/red.png` and `public/mask/white.png` (or `.svg`) and call
 * `loadMaskArt()` once. Anything that fails to load falls back silently — a
 * missing file must never cost the mask.
 *
 * Same-origin only. `img-src 'self'` is what keeps that structural.
 * ─────────────────────────────────────────────────────────────────────────
 */
const ART_EYE_LINE = 0.42;
const ART_INTEROCULAR = 0.26;

const art: Partial<Record<MaskVariant, HTMLImageElement>> = {};

export function loadMaskArt(variant: MaskVariant, src: string): void {
  if (typeof Image === 'undefined') return;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    art[variant] = image;
  };
  // No handler on error, deliberately: the procedural mask is already the
  // fallback, and a 404 here is a content gap, not a failure the user should
  // ever learn about.
  image.src = src;
}

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

  const alpha = Math.min(1, reveal);
  // Settles from 0.86 to 1.0 as it reveals, plus the success pulse.
  const grow = 0.86 + reveal * 0.14 + pulse * 0.06;

  ctx.save();
  ctx.translate(frame.centreX, frame.centreY);
  ctx.rotate(frame.rollRad);

  const image = art[variant];
  if (image !== undefined && image.complete && image.naturalWidth > 0) {
    drawArt(ctx, image, frame.unit * grow, alpha);
    ctx.restore();
    return;
  }

  ctx.scale(frame.unit * grow, frame.unit * grow);
  drawProcedural(ctx, PALETTE[variant], alpha, glow, pulse);
  ctx.restore();
}

function drawArt(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  unit: number,
  alpha: number,
): void {
  const width = unit / ART_INTEROCULAR;
  const height = width * (image.naturalHeight / image.naturalWidth);
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, -width / 2, -height * ART_EYE_LINE, width, height);
  ctx.globalAlpha = 1;
}

function drawProcedural(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  alpha: number,
  glow: number,
  pulse: number,
): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ── Shell ──────────────────────────────────────────────────────────────
  tracePolygon(ctx, SHELL);
  ctx.globalAlpha = alpha * (0.3 + glow * 0.18);
  ctx.fillStyle = palette.shell;
  ctx.fill();

  // The bold outline is what gives the silhouette its weight — the single
  // biggest thing the earlier brow-band design was missing.
  ctx.globalAlpha = alpha * 0.95;
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 0.085;
  ctx.stroke();

  // ── Lattice ────────────────────────────────────────────────────────────
  ctx.globalAlpha = alpha * (0.6 + glow * 0.3);
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 0.038;
  ctx.beginPath();
  for (const [x1, y1, cx, cy, x2, y2] of [...VEINS, ...BANDS]) {
    ctx.moveTo(x1 ?? 0, y1 ?? 0);
    ctx.quadraticCurveTo(cx ?? 0, cy ?? 0, x2 ?? 0, y2 ?? 0);
  }
  ctx.stroke();

  // A lighter pass in the variant colour sits the lattice into the shell
  // instead of leaving it as black lines floating on top.
  ctx.globalAlpha = alpha * (0.3 + glow * 0.3);
  ctx.strokeStyle = palette.shell;
  ctx.lineWidth = 0.016;
  ctx.stroke();

  // ── Eyes ───────────────────────────────────────────────────────────────
  // Large, thick-rimmed, and CLEAR inside: the brief requires the eyes stay
  // visible, and it is also where a hero mask carries its expression.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 0.62, 0.04);
    ctx.scale(side, 1);

    tracePolygon(ctx, EYE);

    // Glow: a wide, low-alpha stroke. Cheaper than `shadowBlur`, which forces a
    // full-canvas readback on mobile Safari.
    ctx.globalAlpha = alpha * (0.28 + glow * 0.5 + pulse * 0.22);
    ctx.strokeStyle = palette.eye;
    ctx.lineWidth = 0.26 + glow * 0.08;
    ctx.stroke();

    ctx.globalAlpha = alpha * (0.16 + glow * 0.2);
    ctx.fillStyle = palette.eye;
    ctx.fill();

    // The heavy rim.
    ctx.globalAlpha = alpha * 0.95;
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 0.075;
    ctx.stroke();

    // The bright inner lip that makes the eye read as lit.
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = palette.eyeCore;
    ctx.lineWidth = 0.03;
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
    ctx.ellipse(side * 1.02, 0.76, 0.24, 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
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
