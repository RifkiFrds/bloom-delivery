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
 */

import { record } from './diagnostics';

const FRAME_PADDING = 0.045;
const CAPTION_BAND = 0.16;

export interface PhotoOptions {
  readonly frame: HTMLCanvasElement;
  readonly recipientName: string;
}

/**
 * Composites the keepsake: the captured frame, the neo-brutalist border, and
 * "For {name} 🌷" on a cream band.
 *
 * Returns null when the frame is unusable, so the caller can hide the action
 * rather than offering a button that produces a broken file.
 */
export function composePhoto(options: PhotoOptions): HTMLCanvasElement | null {
  const { frame, recipientName } = options;
  if (frame.width === 0 || frame.height === 0) return null;

  try {
    const pad = Math.round(frame.width * FRAME_PADDING);
    const band = Math.round(frame.width * CAPTION_BAND);

    const canvas = document.createElement('canvas');
    canvas.width = frame.width + pad * 2;
    canvas.height = frame.height + pad * 2 + band;

    const context = canvas.getContext('2d');
    if (context === null) return null;

    // Cream ground.
    context.fillStyle = '#FFF8E8';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // The frame itself. NOT mirrored — see the header.
    context.drawImage(frame, pad, pad, frame.width, frame.height);

    // The 3 px border, scaled to the output resolution so it reads the same as
    // it does on screen.
    const stroke = Math.max(3, Math.round(frame.width * 0.006));
    context.strokeStyle = '#111111';
    context.lineWidth = stroke;
    context.strokeRect(
      pad - stroke / 2,
      pad - stroke / 2,
      frame.width + stroke,
      frame.height + stroke,
    );

    // The caption. `#111111` on cream, the only text colour in the product.
    const fontSize = Math.round(band * 0.42);
    context.fillStyle = '#111111';
    context.font = `600 ${String(fontSize)}px ui-rounded, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(
      `For ${recipientName} 🌷`,
      canvas.width / 2,
      frame.height + pad * 2 + band / 2,
      canvas.width - pad * 2,
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
