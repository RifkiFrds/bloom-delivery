/**
 * Landmark overlay — Doc 03 §10.1.
 *
 * ── THE MIRROR RULE ──────────────────────────────────────────────────────
 * The overlay canvas applies the SAME `scaleX(-1)` as the <video>. Inference
 * ran on the raw, unmirrored frame, so the landmarks are in unmirrored space;
 * mirroring the canvas puts them back over the mirrored preview. A mismatch
 * here draws landmarks on the wrong side of the body and is the classic
 * debug-overlay bug.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Colour encodes gate status: green = all conditions pass, amber = scoring but
 * failing, red = a hard condition failed.
 */

import { L, type FaceBox, type Hand, type VariantResult } from './types';
import { palmScale } from './metrics';

/** MediaPipe's canonical 21-edge hand connection set. */
const CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const INK = '#111111';
const PASS = '#7ECBA1';
const NEAR = '#FFD65C';
const FAIL = '#FF6F92';

export interface OverlayInput {
  readonly hands: readonly Hand[];
  readonly faces: readonly FaceBox[];
  readonly g1: VariantResult | null;
  readonly aspect: number;
  readonly mirrored: boolean;
}

export class Overlay {
  private readonly context: CanvasRenderingContext2D | null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d');
  }

  resize(width: number, height: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(input: OverlayInput): void {
    const ctx = this.context;
    if (ctx === null) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    if (input.mirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    // Square-corrected space is in units of frame WIDTH on both axes, so both
    // axes scale by `w`. This is the inverse of the ingest correction.
    const toPx = (x: number, y: number): [number, number] => [x * w, y * w];

    for (const face of input.faces) {
      this.drawFace(ctx, face, toPx, w);
    }

    const status = input.g1?.pass === true ? PASS : input.g1 === null ? FAIL : NEAR;
    for (const hand of input.hands) {
      this.drawHand(ctx, hand, toPx, status);
    }

    if (input.hands.length === 2) {
      const [a, b] = input.hands;
      if (a !== undefined && b !== undefined) this.drawJunctions(ctx, a, b, toPx);
    }

    ctx.restore();
  }

  private drawFace(
    ctx: CanvasRenderingContext2D,
    face: FaceBox,
    toPx: (x: number, y: number) => [number, number],
    frameWidth: number,
  ): void {
    const [x, y] = toPx(face.x, face.y);
    const width = face.width * frameWidth;
    const height = face.height * frameWidth;

    ctx.lineWidth = 3;
    ctx.strokeStyle = face.width >= 0.1 ? PASS : FAIL;
    ctx.strokeRect(x, y, width, height);

    // Un-mirror the label so text is readable over a mirrored preview.
    ctx.save();
    ctx.scale(-1, 1);
    ctx.fillStyle = INK;
    ctx.font = '600 12px ui-monospace, monospace';
    ctx.fillText(
      `${face.score.toFixed(2)} w=${face.width.toFixed(3)}`,
      -(x + width),
      y - 6,
    );
    ctx.restore();
  }

  private drawHand(
    ctx: CanvasRenderingContext2D,
    hand: Hand,
    toPx: (x: number, y: number) => [number, number],
    status: string,
  ): void {
    ctx.lineWidth = 3;
    ctx.strokeStyle = status;
    ctx.lineCap = 'round';

    for (const [from, to] of CONNECTIONS) {
      const a = hand[from];
      const b = hand[to];
      if (a === undefined || b === undefined) continue;
      const [ax, ay] = toPx(a.x, a.y);
      const [bx, by] = toPx(b.x, b.y);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    ctx.fillStyle = INK;
    for (const point of hand) {
      if (point === undefined) continue;
      const [px, py] = toPx(point.x, point.y);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Palm scale S, drawn as a circle so its magnitude is visible at a glance.
    const wrist = hand[L.WRIST];
    if (wrist !== undefined) {
      const s = palmScale(hand);
      const [wx, wy] = toPx(wrist.x, wrist.y);
      const [rx] = toPx(s, 0);
      ctx.strokeStyle = NEAR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(wx, wy, rx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** C2 thumb junction, C3 index junction, C5 aperture — drawn as labelled lines. */
  private drawJunctions(
    ctx: CanvasRenderingContext2D,
    a: Hand,
    b: Hand,
    toPx: (x: number, y: number) => [number, number],
  ): void {
    const pairs: ReadonlyArray<readonly [number, number, string]> = [
      [L.THUMB_TIP, L.THUMB_TIP, 'C2'],
      [L.INDEX_TIP, L.INDEX_TIP, 'C3'],
      [L.WRIST, L.WRIST, 'C5'],
    ];

    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;

    for (const [indexA, indexB] of pairs) {
      const pa = a[indexA];
      const pb = b[indexB];
      if (pa === undefined || pb === undefined) continue;
      const [ax, ay] = toPx(pa.x, pa.y);
      const [bx, by] = toPx(pb.x, pb.y);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}
