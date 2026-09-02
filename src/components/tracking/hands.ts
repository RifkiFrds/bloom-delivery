/**
 * Hand rendering — curved, glowing, alive.
 *
 * ── WHAT MAKES IT NOT LOOK LIKE A DEBUG VIEW ─────────────────────────────
 *  · CURVED connections. Each finger is one quadratic spline through its
 *    joints, not four straight segments. A hand has no straight lines in it,
 *    and a polyline is the single strongest "this is a wireframe" signal.
 *  · A black casing under a pastel core, matching every border in the product.
 *  · Fingertips larger than joints, so the parts that form the heart lead.
 *  · A breathing pulse while tracking, so a still hand is not a still image.
 *  · Opacity from derived confidence — a hand too far away draws faint, which
 *    tells the user to bring it closer.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The glow is a wider, low-alpha pass rather than `shadowBlur`: a blur forces a
 * full-canvas readback on mobile Safari, and this draws every frame while two
 * neural networks are running.
 */

export const HAND_POINTS = 21;
export const HAND_SLOTS = 2;

const INK = '#111111';
/** Matches each person's mask variant — pink on the screen left, mint right. */
const SLOT_COLOUR = ['#FF8FAB', '#B7E4C7'] as const;

/** One spline per finger, plus the palm arch. Indices are Doc 03 §2.3. */
const CHAINS: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4], // thumb
  [0, 5, 6, 7, 8], // index
  [9, 10, 11, 12], // middle
  [13, 14, 15, 16], // ring
  [0, 17, 18, 19, 20], // pinky
  [5, 9, 13, 17], // palm arch
];

const TIPS = [4, 8, 12, 16, 20] as const;

export function drawHands(
  ctx: CanvasRenderingContext2D,
  position: Float32Array,
  alpha: Float32Array,
  confidence: Float32Array,
  toX: (x: number) => number,
  toY: (y: number) => number,
  unit: number,
  glow: number,
  nowMs: number,
  motionSafe: boolean,
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let slot = 0; slot < HAND_SLOTS; slot += 1) {
    const visible = alpha[slot] ?? 0;
    if (visible < 0.02) continue;

    const colour = SLOT_COLOUR[slot] ?? SLOT_COLOUR[0];
    const trust = confidence[slot] ?? 1;
    const base = slot * HAND_POINTS * 2;

    // ≤ 4% amplitude, period ≥ 1.6 s — an idle that reads as alive without
    // competing with intentional motion (Doc 04 §C.4 rule 7), and far below the
    // photosensitivity ceiling of §C.6.
    const breath = motionSafe ? 1 + Math.sin(nowMs / 900 + slot) * 0.035 : 1;
    const opacity = visible * (0.45 + trust * 0.55);

    const core = Math.max(3, unit * 0.013) * breath;
    const casing = core + 4.5;

    // ── Glow ─────────────────────────────────────────────────────────────
    ctx.globalAlpha = opacity * (0.16 + glow * 0.3);
    ctx.strokeStyle = colour;
    ctx.lineWidth = core * 3.2;
    strokeChains(ctx, position, base, toX, toY);

    // ── Casing ───────────────────────────────────────────────────────────
    ctx.globalAlpha = opacity * 0.92;
    ctx.strokeStyle = INK;
    ctx.lineWidth = casing;
    strokeChains(ctx, position, base, toX, toY);

    // ── Core ─────────────────────────────────────────────────────────────
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = colour;
    ctx.lineWidth = core;
    strokeChains(ctx, position, base, toX, toY);

    // ── Joints ───────────────────────────────────────────────────────────
    for (let i = 0; i < HAND_POINTS; i += 1) {
      const x = toX(position[base + i * 2] ?? 0);
      const y = toY(position[base + i * 2 + 1] ?? 0);
      const tip = (TIPS as readonly number[]).includes(i);
      const radius = (tip ? 0.028 : 0.016) * unit * breath;

      if (tip) {
        ctx.globalAlpha = opacity * (0.2 + glow * 0.35);
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.lineWidth = Math.max(2, unit * 0.0075);
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
}

/**
 * Draws every chain as a quadratic spline through the joints.
 *
 * The curve passes through the MIDPOINT of each pair and uses the joint itself
 * as the control point — the standard smoothing that turns a point list into a
 * continuous line without needing tangents.
 */
function strokeChains(
  ctx: CanvasRenderingContext2D,
  position: Float32Array,
  base: number,
  toX: (x: number) => number,
  toY: (y: number) => number,
): void {
  ctx.beginPath();

  for (const chain of CHAINS) {
    const firstIndex = chain[0];
    if (firstIndex === undefined) continue;

    let px = toX(position[base + firstIndex * 2] ?? 0);
    let py = toY(position[base + firstIndex * 2 + 1] ?? 0);
    ctx.moveTo(px, py);

    for (let i = 1; i < chain.length; i += 1) {
      const index = chain[i];
      if (index === undefined) continue;
      const cx = toX(position[base + index * 2] ?? 0);
      const cy = toY(position[base + index * 2 + 1] ?? 0);

      if (i === chain.length - 1) {
        ctx.quadraticCurveTo(px, py, cx, cy);
      } else {
        ctx.quadraticCurveTo(px, py, (px + cx) / 2, (py + cy) / 2);
      }
      px = cx;
      py = cy;
    }
  }

  ctx.stroke();
}
