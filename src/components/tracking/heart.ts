/**
 * The heart — TRACED FROM THE HANDS THEMSELVES.
 *
 * ── WHAT CHANGED, AND WHY ────────────────────────────────────────────────
 * This used to be an idealised dotted heart floating near the hands. It read as
 * a sticker: it did not touch anything, so it did not look like it had anything
 * to do with what the user was doing.
 *
 * Now every anchor is a real landmark:
 *
 *   the point of the heart   = midpoint of the two THUMB TIPS
 *   the dip at the top       = midpoint of the two INDEX TIPS
 *   the outer swell of each  = that hand's own WRIST
 *
 * So the line is literally drawn through the hands. As they move, it deforms
 * with them; as they come together, it closes. There is nothing to "match" —
 * the shape IS their hands, and its shape is the feedback.
 *
 * It is drawn ONLY when both hands are visible. No hands, no line — the screen
 * stays clean instead of carrying a target nobody is aiming at yet.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Green, as specified: `--color-green`. It brightens toward `--color-pink` as
 * the gesture is accepted, so the colour itself carries the progress.
 */

import { L, type Hand, type Point } from '@/detection/types';

const INK = '#111111';
const GREEN = '#B7E4C7';
const PINK = '#FF8FAB';

export interface HandHeartOptions {
  readonly handA: Hand;
  readonly handB: Hand;
  readonly toX: (x: number) => number;
  readonly toY: (y: number) => number;
  /** 0–1. Drives thickness, opacity and the green → pink shift. */
  readonly progress: number;
  readonly complete: boolean;
  readonly pulse: number;
  readonly motionSafe: boolean;
}

/** Scratch, so the hot path allocates nothing. */
const bottom = { x: 0, y: 0 };
const top = { x: 0, y: 0 };
const controlA = { x: 0, y: 0 };
const controlB = { x: 0, y: 0 };

export function drawHandHeart(
  ctx: CanvasRenderingContext2D,
  options: HandHeartOptions,
): void {
  const { handA, handB, toX, toY, progress, complete, pulse, motionSafe } = options;

  const thumbA = handA[L.THUMB_TIP];
  const thumbB = handB[L.THUMB_TIP];
  const indexA = handA[L.INDEX_TIP];
  const indexB = handB[L.INDEX_TIP];
  const wristA = handA[L.WRIST];
  const wristB = handB[L.WRIST];

  if (
    thumbA === undefined ||
    thumbB === undefined ||
    indexA === undefined ||
    indexB === undefined ||
    wristA === undefined ||
    wristB === undefined
  ) {
    return;
  }

  bottom.x = (thumbA.x + thumbB.x) / 2;
  bottom.y = (thumbA.y + thumbB.y) / 2;
  top.x = (indexA.x + indexB.x) / 2;
  top.y = (indexA.y + indexB.y) / 2;

  const span = Math.hypot(top.x - bottom.x, top.y - bottom.y);
  if (span < 0.001) return;

  const clamped = Math.max(0, Math.min(1, progress));
  const scale = motionSafe ? 1 + pulse * 0.04 : 1;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const width = Math.max(3, span * 90 * (0.35 + clamped * 0.45)) * scale;

  // Casing first, so the line reads on a bright wall as well as a dark room.
  ctx.globalAlpha = 0.55 + clamped * 0.35;
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 5;
  traceHeart(ctx, wristA, wristB, span, toX, toY);

  // The line itself: green while they are getting there, pink once it lands.
  ctx.globalAlpha = 0.75 + clamped * 0.25;
  ctx.strokeStyle = complete ? PINK : GREEN;
  ctx.lineWidth = width;
  traceHeart(ctx, wristA, wristB, span, toX, toY);

  // A wider, fainter pass under it, so the line glows as it completes without
  // a `shadowBlur` — which forces a full-canvas readback on mobile Safari.
  if (clamped > 0.1) {
    ctx.globalAlpha = (clamped - 0.1) * 0.4;
    ctx.strokeStyle = complete ? PINK : GREEN;
    ctx.lineWidth = width * 3;
    traceHeart(ctx, wristA, wristB, span, toX, toY);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Two cubic lobes, bottom to top, one per hand.
 *
 * Each control pair pushes PAST the wrist and then above the index tips, which
 * is what turns "a line between two hands" into a heart. The wrists sit below
 * and outside the thumb junction in this pose, so the outward control comes for
 * free from the anatomy.
 */
function traceHeart(
  ctx: CanvasRenderingContext2D,
  wristA: Point,
  wristB: Point,
  span: number,
  toX: (x: number) => number,
  toY: (y: number) => number,
): void {
  ctx.beginPath();
  ctx.moveTo(toX(bottom.x), toY(bottom.y));
  lobe(ctx, wristA, span, toX, toY);
  ctx.moveTo(toX(bottom.x), toY(bottom.y));
  lobe(ctx, wristB, span, toX, toY);
  ctx.stroke();
}

function lobe(
  ctx: CanvasRenderingContext2D,
  wrist: Point,
  span: number,
  toX: (x: number) => number,
  toY: (y: number) => number,
): void {
  // Out past the wrist…
  controlA.x = bottom.x + (wrist.x - bottom.x) * 1.25;
  controlA.y = bottom.y + (wrist.y - bottom.y) * 0.75;
  // …then up over the top, which forms the swell of the lobe.
  controlB.x = controlA.x;
  controlB.y = top.y - span * 0.85;

  ctx.bezierCurveTo(
    toX(controlA.x),
    toY(controlA.y),
    toX(controlB.x),
    toY(controlB.y),
    toX(top.x),
    toY(top.y),
  );
}

/**
 * The 🤟 tracking ring — a targeting circle that follows the hand until the
 * pose lands and the mask is unlocked.
 *
 * Deliberately reads as a computer-vision reticle rather than as decoration:
 * this is the one moment the product WANTS to look like it is scanning, because
 * that is what makes the mask feel earned rather than applied.
 */
export function drawHornsRing(
  ctx: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  radius: number,
  matched: boolean,
  nowMs: number,
  motionSafe: boolean,
): void {
  if (radius <= 0) return;

  ctx.save();
  ctx.translate(centreX, centreY);
  if (motionSafe) ctx.rotate((nowMs / 2600) % (Math.PI * 2));

  ctx.lineCap = 'round';
  const colour = matched ? PINK : GREEN;

  // The sweep: four arcs with gaps, so the rotation is legible.
  ctx.globalAlpha = matched ? 0.95 : 0.7;
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(2.5, radius * 0.06);
  for (let i = 0; i < 4; i += 1) {
    const from = (i * Math.PI) / 2 + 0.24;
    ctx.beginPath();
    ctx.arc(0, 0, radius, from, from + Math.PI / 2 - 0.48);
    ctx.stroke();
  }

  // Corner ticks — the bracket that says "locked on".
  if (matched) {
    ctx.lineWidth = Math.max(3, radius * 0.08);
    for (let i = 0; i < 4; i += 1) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const inner = radius * 0.82;
      const outer = radius * 1.12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
