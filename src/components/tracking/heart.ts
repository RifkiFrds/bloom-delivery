/**
 * The heart guide — the target, and the progress meter.
 *
 * ── DOTTED GHOST PLUS A TRACING STROKE ───────────────────────────────────
 * The dotted outline is always there, so the user always knows where the shape
 * goes. A solid stroke then traces `progress` of the perimeter, which makes
 * 25 / 50 / 75 / 100% literally visible as how much of the heart has been
 * drawn — no number, no bar, no separate widget.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `shadowBlur` is used HERE and nowhere else in the overlay. One blurred stroke
 * on one shape is affordable; a blur per landmark is not.
 *
 * Doc 04 §A.3's zero-blur rule governs UI ELEVATION — cards and buttons. This
 * is the illustration layer, where a soft light around a completed heart is the
 * entire point of the beat.
 */

const INK = '#111111';
const PINK = '#FF8FAB';
const CREAM = '#FFF8E8';
const YELLOW = '#FFE599';

/** The guide's radius is expressed in hand-separation units; this scales it. */
export const HEART_UNIT = 1;

const HEART_SAMPLES = 160;
const HEART_X = new Float32Array(HEART_SAMPLES + 1);
const HEART_Y = new Float32Array(HEART_SAMPLES + 1);

(function buildHeart(): void {
  for (let i = 0; i <= HEART_SAMPLES; i += 1) {
    // Starts at the bottom point and runs clockwise, so the progress stroke
    // fills the way a person draws a heart.
    const t = Math.PI + (i / HEART_SAMPLES) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t)
    );
    HEART_X[i] = x / 17;
    HEART_Y[i] = y / 17;
  }
})();

export interface HeartGuideOptions {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly progress: number;
  readonly complete: boolean;
  readonly pulse: number;
  readonly nowMs: number;
  readonly motionSafe: boolean;
}

export function drawHeartGuide(
  ctx: CanvasRenderingContext2D,
  options: HeartGuideOptions,
): void {
  const { x: cx, y: cy, progress, complete, pulse, nowMs, motionSafe } = options;

  // ≤ 4% amplitude, period ≥ 1.6 s (Doc 04 §C.4 rule 7).
  const breath = motionSafe ? 1 + Math.sin(nowMs / 620) * 0.03 * pulse : 1;
  const r = options.radius * breath;
  if (r <= 0) return;

  ctx.save();

  ctx.setLineDash([Math.max(4, r * 0.09), Math.max(6, r * 0.11)]);
  ctx.lineWidth = Math.max(2.5, r * 0.035);
  ctx.strokeStyle = complete ? PINK : CREAM;
  ctx.globalAlpha = complete ? 0.35 : 0.85;
  strokeHeart(ctx, cx, cy, r, 1);
  ctx.globalAlpha = 1;

  ctx.setLineDash([]);
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped > 0.01) {
    ctx.lineWidth = Math.max(3, r * 0.055);
    ctx.strokeStyle = complete ? PINK : YELLOW;
    if (motionSafe) {
      ctx.shadowColor = complete ? PINK : 'rgba(255,229,153,0.9)';
      ctx.shadowBlur = complete ? 26 + pulse * 12 : 10 + clamped * 10;
    }
    strokeHeart(ctx, cx, cy, r, clamped);
    ctx.shadowBlur = 0;
  }

  // On completion the heart gains its black outline and reads as a finished
  // object rather than a target.
  if (complete) {
    ctx.lineWidth = Math.max(2, r * 0.028);
    ctx.strokeStyle = INK;
    strokeHeart(ctx, cx, cy, r, 1);
  }

  ctx.restore();
}

function strokeHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fraction: number,
): void {
  const last = Math.max(1, Math.floor(HEART_SAMPLES * fraction));
  ctx.beginPath();
  for (let i = 0; i <= last; i += 1) {
    const x = cx + (HEART_X[i] ?? 0) * r;
    const y = cy + (HEART_Y[i] ?? 0) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
