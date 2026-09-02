/**
 * The success sparkles — Part 5's "subtle sparkle burst".
 *
 * A fixed pool, seeded deterministically from the index. No `Math.random()`:
 * the same burst happens on every device, so a report of "it looked wrong"
 * reproduces instead of being a story about one run.
 *
 * Removed entirely under reduced motion by the caller. Doc 04 §C.5: content is
 * never removed, only motion — and a sparkle carries no content.
 */

const INK = '#111111';
const PINK = '#FF8FAB';
const YELLOW = '#FFE599';

export const SPARKLE_COUNT = 28;

export function seedSparkles(
  x: Float32Array,
  y: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  life: Float32Array,
  cx: number,
  cy: number,
  r: number,
): void {
  for (let i = 0; i < SPARKLE_COUNT; i += 1) {
    const angle = i * 2.399963;
    const speed = 0.06 + ((i * 37) % 11) / 90;
    x[i] = cx + Math.cos(angle) * r * 0.6;
    y[i] = cy + Math.sin(angle) * r * 0.6;
    vx[i] = Math.cos(angle) * speed * r;
    vy[i] = Math.sin(angle) * speed * r - r * 0.02;
    life[i] = 1;
  }
}

export function drawSparkles(
  ctx: CanvasRenderingContext2D,
  x: Float32Array,
  y: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  life: Float32Array,
  dtSec: number,
): void {
  for (let i = 0; i < SPARKLE_COUNT; i += 1) {
    const remaining = life[i] ?? 0;
    if (remaining <= 0) continue;

    life[i] = Math.max(0, remaining - dtSec * 0.75);
    x[i] = (x[i] ?? 0) + (vx[i] ?? 0) * dtSec;
    y[i] = (y[i] ?? 0) + (vy[i] ?? 0) * dtSec;
    vy[i] = (vy[i] ?? 0) + 60 * dtSec;

    const px = x[i] ?? 0;
    const py = y[i] ?? 0;
    const size = 3 + remaining * 5;

    ctx.globalAlpha = remaining;
    ctx.fillStyle = i % 2 === 0 ? YELLOW : PINK;
    // A four-point star drawn as one pinched path — cheaper than a star polygon
    // and it reads correctly at this size.
    ctx.beginPath();
    ctx.moveTo(px, py - size);
    ctx.quadraticCurveTo(px, py, px + size, py);
    ctx.quadraticCurveTo(px, py, px, py + size);
    ctx.quadraticCurveTo(px, py, px - size, py);
    ctx.quadraticCurveTo(px, py, px, py - size);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
