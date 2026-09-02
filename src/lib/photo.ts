/**
 * "Save our photo" — Doc 04 §B.15, Doc 02 §2.21, Doc 05 U3.
 *
 * ── COMPOSITED ENTIRELY LOCALLY. NOTHING IS UPLOADED. ────────────────────
 * The captured frame lives in an in-memory canvas from the moment of the
 * teardown and reaches disk only when the user taps the button. `connect-src
 * 'self'` makes "nothing is uploaded" structural rather than a promise.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── THE MIRROR BUG THIS FUNCTION EXISTS TO AVOID ─────────────────────────
 * The PREVIEW is mirrored for display, because an un-mirrored selfie view is
 * disorienting. The SAVED PHOTO MUST NOT BE. A mirrored keepsake has backwards
 * text in it and the faces on the wrong sides, and it is embarrassing to ship
 * wrong — which is why it is a Phase 7 exit criterion.
 *
 * `captureFrame` already draws from the raw `<video>`, so the frame arrives
 * un-mirrored. This module must simply not re-introduce the flip.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── IT IS A PHOTO-BOOTH CARD, NOT A FRAMED RECTANGLE ─────────────────────
 * Everything drawn around the photo comes from the same tokens as the app: the
 * cream ground, `#111111` for every line and every word, the zero-blur offset
 * shadow, the 3 px uniform outline. A keepsake that does not look like the
 * thing it came from is just a screenshot with a border.
 *
 * The photo itself is NEVER graded, tinted or filtered. It is their faces at
 * the moment the heart landed, and altering them would be the one decoration
 * that costs something real.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { record } from './diagnostics';

const INK = '#111111';
const CREAM = '#FFF8E8';
const WHITE = '#FFFFFF';
const PINK = '#FF8FAB';
const PINK_LIGHT = '#FFD6E0';
const YELLOW = '#FFE599';
const GREEN = '#B7E4C7';

/** Layout, as fractions of the photo width, so it scales with any capture. */
const MARGIN = 0.07;
const CAPTION_BAND = 0.2;
const CORNER = 0.045;

export interface PhotoOptions {
  readonly frame: HTMLCanvasElement;
  readonly recipientName: string;
}

/**
 * Reads the app's own display face so the caption is set in Fredoka rather than
 * in whatever the canvas defaults to.
 *
 * `next/font` exposes the family through a CSS custom property; the raw family
 * name is not knowable ahead of time because it is hashed at build. Falls back
 * to a rounded system stack, which is the same fallback the CSS declares.
 */
function displayFont(): string {
  const fallback = 'ui-rounded, system-ui, sans-serif';
  if (typeof document === 'undefined') return fallback;
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-display')
      .trim();
    return value.length > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** A small tulip, drawn flat, for the corners of the card. */
function tulip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  head: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, size * 0.11);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -size * 1.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -size * 0.65);
  ctx.quadraticCurveTo(-size * 0.8, -size * 0.85, -size * 0.9, -size * 1.3);
  ctx.quadraticCurveTo(-size * 0.35, -size * 1.1, 0, -size * 0.5);
  ctx.closePath();
  ctx.fillStyle = GREEN;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-size * 0.5, -size * 1.5);
  ctx.quadraticCurveTo(-size * 0.55, -size * 2.35, 0, -size * 2.5);
  ctx.quadraticCurveTo(size * 0.55, -size * 2.35, size * 0.5, -size * 1.5);
  ctx.quadraticCurveTo(size * 0.25, -size * 1.3, 0, -size * 1.32);
  ctx.quadraticCurveTo(-size * 0.25, -size * 1.3, -size * 0.5, -size * 1.5);
  ctx.closePath();
  ctx.fillStyle = head;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A scattered petal, for the negative space around the frame. */
function petal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  fill: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.9, -size * 0.4, size * 0.7, size * 0.7, 0, size);
  ctx.bezierCurveTo(-size * 0.7, size * 0.7, -size * 0.9, -size * 0.4, 0, -size);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * 0.18);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/**
 * Composites the keepsake.
 *
 * Returns null when the frame is unusable, so the caller can hide the action
 * rather than offering a button that produces a broken file.
 */
export function composePhoto(options: PhotoOptions): HTMLCanvasElement | null {
  const { frame, recipientName } = options;
  if (frame.width === 0 || frame.height === 0) return null;

  try {
    const w = frame.width;
    const margin = Math.round(w * MARGIN);
    const band = Math.round(w * CAPTION_BAND);
    const stroke = Math.max(3, Math.round(w * 0.007));
    const radius = Math.round(w * CORNER);

    const canvas = document.createElement('canvas');
    canvas.width = w + margin * 2;
    canvas.height = frame.height + margin * 2 + band;

    const ctx = canvas.getContext('2d');
    if (ctx === null) return null;

    // ── Ground ───────────────────────────────────────────────────────────
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // The one gradient the design system allows, matching the app background.
    const glow = ctx.createRadialGradient(
      canvas.width / 2,
      0,
      0,
      canvas.width / 2,
      canvas.height * 0.7,
      canvas.width * 0.8,
    );
    glow.addColorStop(0, PINK_LIGHT);
    glow.addColorStop(1, CREAM);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    // ── Confetti behind the frame ────────────────────────────────────────
    const scatter = [
      [0.1, 0.12, PINK],
      [0.9, 0.09, YELLOW],
      [0.06, 0.62, YELLOW],
      [0.95, 0.55, PINK_LIGHT],
      [0.16, 0.93, PINK_LIGHT],
      [0.84, 0.95, PINK],
    ] as const;
    for (const [fx, fy, fill] of scatter) {
      petal(ctx, canvas.width * fx, canvas.height * fy, w * 0.022, fx * 7 + fy * 3, fill);
    }

    // ── The photo: hard offset shadow, then the frame, then the image ────
    const px = margin;
    const py = margin;
    const offset = Math.round(w * 0.016);

    ctx.fillStyle = INK;
    roundedRect(ctx, px + offset, py + offset, w, frame.height, radius);
    ctx.fill();

    ctx.fillStyle = WHITE;
    roundedRect(ctx, px, py, w, frame.height, radius);
    ctx.fill();

    // Clip to the rounded corners, then draw the capture. NOT mirrored.
    ctx.save();
    roundedRect(ctx, px, py, w, frame.height, radius);
    ctx.clip();
    ctx.drawImage(frame, px, py, w, frame.height);
    ctx.restore();

    ctx.strokeStyle = INK;
    ctx.lineWidth = stroke;
    roundedRect(ctx, px, py, w, frame.height, radius);
    ctx.stroke();

    // ── Caption ──────────────────────────────────────────────────────────
    const family = displayFont();
    const captionY = frame.height + margin * 2 + band * 0.34;
    const fontSize = Math.round(band * 0.34);

    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${String(fontSize)}px ${family}`;
    ctx.fillText(
      `For ${recipientName} 🌷`,
      canvas.width / 2,
      captionY,
      canvas.width - margin * 4,
    );

    // The date, small — a keepsake that does not say when is half a keepsake.
    ctx.font = `500 ${String(Math.round(fontSize * 0.42))}px ${family}`;
    ctx.globalAlpha = 0.62;
    ctx.fillText(
      new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      canvas.width / 2,
      captionY + fontSize * 0.85,
    );
    ctx.globalAlpha = 1;

    // ── Tulips flanking the caption ──────────────────────────────────────
    const tulipSize = band * 0.15;
    tulip(ctx, margin * 1.1, canvas.height - margin * 0.5, tulipSize, -0.12, PINK);
    tulip(
      ctx,
      canvas.width - margin * 1.1,
      canvas.height - margin * 0.5,
      tulipSize,
      0.14,
      YELLOW,
    );

    return canvas;
  } catch (error) {
    record(
      `photo: compose failed — ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Triggers the download. Object URLs are revoked on the next tick — leaving
 * them alive pins the whole bitmap in memory for the rest of the session.
 */
export function downloadPhoto(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (blob === null) {
      record('photo: toBlob returned null');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }, 'image/png');
}
