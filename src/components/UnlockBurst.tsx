'use client';

/**
 * ★ THE UNLOCK BURST ★ — the signature beat, in tulips.
 *
 * ── WHY THERE IS NO NEW LIBRARY BEHIND THIS ──────────────────────────────
 * The route entry has 38 KB of gzip headroom, and the one capability an
 * animation library would uniquely add — a full-screen post-processing bloom —
 * is forbidden outright: "NONE. A full-screen pass costs 30–50% of the mobile
 * frame budget and buys almost nothing at this art style" (Doc 01 §5.4).
 *
 * `canvas-confetti`, `gsap` and `lottie-web` would each cost 5–60 KB to
 * duplicate something Framer Motion and Canvas 2D already do here. Spending the
 * entire remaining margin on duplication is not a trade worth making.
 *
 * So the power comes from CHOREOGRAPHY instead, which is where it comes from in
 * the references anyway.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── AND IT CANNOT COME FROM MORE FLASHING ────────────────────────────────
 * Doc 04 §C.6 is a SAFETY rule, not a style note: no full-screen luminance
 * change greater than 10% above 3 Hz, anywhere, in any mode. Every element here
 * fires ONCE and settles. Nothing repeats, nothing strobes, and the rays rotate
 * slowly enough to be motion rather than flicker.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The four layers, in order:
 *   1. SUNBURST RAYS   comic-book impact lines, expanding once from centre
 *   2. SHOCKWAVE       two outlined rings, the same language as the box's dust
 *   3. PETAL BURST     ~40 tulip petals erupting and settling under gravity
 *   4. TULIP HORIZON   tulips growing up from the bottom edge, foreshadowing
 *                      the bloom that follows — this is the signature
 *
 * One canvas, one rAF, everything pre-allocated. The main thread is completely
 * free at this moment: MediaPipe has just been closed by the teardown and the
 * 3D scene has not mounted yet, which is exactly why this beat can afford to be
 * the most detailed drawing in the product.
 */

import { useEffect, useRef } from 'react';

const INK = '#111111';
const PINK = '#FF8FAB';
const PINK_LIGHT = '#FFD6E0';
const PINK_PRESS = '#FF6F92';
const YELLOW = '#FFE599';
const GREEN = '#B7E4C7';

/** Beat boundaries in ms, from Doc 04 §B.11's table. */
const RAYS_AT = 380;
const SHOCK_AT = 420;
const PETALS_AT = 700;
const HORIZON_AT = 880;

/**
 * ── DEPTH IS WHAT MAKES A BURST FEEL LIKE A SPACE ────────────────────────
 * A single plane of particles reads as stickers on glass no matter how many of
 * them there are. Three bands — each with its own size, speed and opacity, drawn
 * back to front around the stamp — read as a room the confetti is falling
 * through.
 *
 * The count rises to 84 because Canvas 2D at this scale is nowhere near the
 * limit, and this beat has the whole main thread: MediaPipe was closed by the
 * teardown a few hundred milliseconds ago and the 3D scene has not mounted.
 * ─────────────────────────────────────────────────────────────────────────
 */
const PETALS = 84;
const RAYS = 18;
const TULIPS = 11;

/** Back, middle, front. `scale` and `speed` multiply; `alpha` sets the haze. */
const DEPTH = [
  { scale: 0.55, speed: 0.62, alpha: 0.5 },
  { scale: 0.85, speed: 0.85, alpha: 0.8 },
  { scale: 1.25, speed: 1.15, alpha: 1 },
] as const;

/** One in four pieces is a curled ribbon rather than a petal. */
function isRibbon(index: number): boolean {
  return index % 4 === 3;
}

export interface UnlockBurstProps {
  readonly motionSafe: boolean;
}

export function UnlockBurst({ motionSafe }: UnlockBurstProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pre-allocated petal state. The frame loop allocates nothing.
  const px = useRef(new Float32Array(PETALS));
  const py = useRef(new Float32Array(PETALS));
  const pvx = useRef(new Float32Array(PETALS));
  const pvy = useRef(new Float32Array(PETALS));
  const pspin = useRef(new Float32Array(PETALS));
  const pangle = useRef(new Float32Array(PETALS));
  const pscale = useRef(new Float32Array(PETALS));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    let handle = 0;
    const startedAt = performance.now();
    let lastAt = startedAt;
    let seeded = false;

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = `${String(window.innerWidth)}px`;
      canvas.style.height = `${String(window.innerHeight)}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (now: number): void => {
      handle = requestAnimationFrame(frame);

      const elapsed = now - startedAt;
      const dt = Math.min((now - lastAt) / 1000, 0.05);
      lastAt = now;

      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      // One unit ≈ the short edge, so the beat reads the same on a phone and a
      // laptop instead of being a different composition on each.
      const unit = Math.min(w, h);

      if (!motionSafe) {
        // Content preserved, motion removed (Doc 04 §C.5): the settled end
        // state, drawn once, with no burst and no expansion.
        drawRays(ctx, cx, cy, unit * 0.62, 0.1, 0.14);
        drawHorizon(ctx, w, h, unit, 1);
        return;
      }

      if (!seeded && elapsed >= PETALS_AT) {
        seeded = true;
        seedPetals(
          px.current,
          py.current,
          pvx.current,
          pvy.current,
          pspin.current,
          pangle.current,
          pscale.current,
          cx,
          cy,
          unit,
        );
      }

      // ── 1. Sunburst rays ────────────────────────────────────────────────
      if (elapsed >= RAYS_AT) {
        const t = clamp01((elapsed - RAYS_AT) / 620);
        const eased = 1 - Math.pow(1 - t, 3);
        drawRays(
          ctx,
          cx,
          cy,
          unit * (0.18 + eased * 0.78),
          (1 - t) * 0.5,
          elapsed / 9000,
        );
      }

      // ── 2. Shockwave ────────────────────────────────────────────────────
      if (elapsed >= SHOCK_AT) {
        drawShock(ctx, cx, cy, unit, (elapsed - SHOCK_AT) / 760);
        drawShock(ctx, cx, cy, unit, (elapsed - SHOCK_AT - 140) / 760);
      }

      // ── 3. Petal burst ──────────────────────────────────────────────────
      if (seeded) {
        stepPetals(
          ctx,
          px.current,
          py.current,
          pvx.current,
          pvy.current,
          pspin.current,
          pangle.current,
          pscale.current,
          dt,
          unit,
          h,
        );
      }

      // ── 4. The tulip horizon — the signature ────────────────────────────
      if (elapsed >= HORIZON_AT) {
        drawHorizon(ctx, w, h, unit, clamp01((elapsed - HORIZON_AT) / 900));
      }
    };

    handle = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(handle);
      window.removeEventListener('resize', resize);
    };
  }, [motionSafe]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Comic-book impact lines: alternating wedges radiating from centre.
 *
 * They rotate at roughly one revolution per minute — motion, not flicker, and
 * far below the 3 Hz ceiling that governs anything full-screen.
 */
function drawRays(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  alpha: number,
  rotation: number,
): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;

  const step = (Math.PI * 2) / RAYS;
  for (let i = 0; i < RAYS; i += 1) {
    const from = i * step;
    ctx.fillStyle = i % 2 === 0 ? YELLOW : PINK_LIGHT;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, from, from + step * 0.46);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/** One outlined ring expanding and fading — the box's dust ring, scaled up. */
function drawShock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  unit: number,
  t: number,
): void {
  if (t <= 0 || t >= 1) return;
  const eased = 1 - Math.pow(1 - t, 2.4);
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.85;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, unit * 0.012 * (1 - t));
  ctx.beginPath();
  ctx.arc(cx, cy, unit * 0.08 + eased * unit * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = (1 - t) * 0.45;
  ctx.strokeStyle = PINK;
  ctx.lineWidth = Math.max(1.5, unit * 0.02 * (1 - t));
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Deterministic from the index — the same burst on every device, every time. */
function seedPetals(
  x: Float32Array,
  y: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  spin: Float32Array,
  angle: Float32Array,
  scale: Float32Array,
  cx: number,
  cy: number,
  unit: number,
): void {
  for (let i = 0; i < PETALS; i += 1) {
    const band = DEPTH[i % DEPTH.length] ?? DEPTH[2];
    const a = i * 2.399963;
    const speed = (0.55 + ((i * 37) % 13) / 26) * unit * band.speed;

    // Launched from a small disc rather than a single point, so the burst has a
    // source with size instead of a mathematical origin.
    x[i] = cx + Math.cos(a) * unit * 0.04;
    y[i] = cy + Math.sin(a) * unit * 0.04;
    vx[i] = Math.cos(a) * speed;
    vy[i] = Math.sin(a) * speed - unit * 0.35 * band.speed;
    spin[i] = (((i * 53) % 17) / 17 - 0.5) * 7;
    angle[i] = a;
    scale[i] = (0.7 + ((i * 29) % 11) / 16) * band.scale;
  }
}

function stepPetals(
  ctx: CanvasRenderingContext2D,
  x: Float32Array,
  y: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  spin: Float32Array,
  angle: Float32Array,
  scale: Float32Array,
  dt: number,
  unit: number,
  height: number,
): void {
  const drag = 0.965;

  // Back to front, so the near layer overlaps the far one and the depth reads.
  for (let band = 0; band < DEPTH.length; band += 1) {
    const depth = DEPTH[band] ?? DEPTH[2];
    const gravity = unit * 1.15 * depth.speed;
    ctx.globalAlpha = depth.alpha;

    for (let i = band; i < PETALS; i += DEPTH.length) {
      vy[i] = (vy[i] ?? 0) + gravity * dt;
      vx[i] = (vx[i] ?? 0) * drag;
      x[i] = (x[i] ?? 0) + (vx[i] ?? 0) * dt;
      y[i] = (y[i] ?? 0) + (vy[i] ?? 0) * dt;
      angle[i] = (angle[i] ?? 0) + (spin[i] ?? 0) * dt;

      const py = y[i] ?? 0;
      if (py > height + unit * 0.1) continue;

      // A slow lateral drift, so nothing falls on a straight line — the single
      // cheapest thing that separates confetti from a particle system.
      const drift = Math.sin((py / unit) * 3.1 + i) * unit * 0.012;
      const size = (scale[i] ?? 1) * unit * 0.035;

      if (isRibbon(i)) {
        drawRibbon(ctx, (x[i] ?? 0) + drift, py, angle[i] ?? 0, size, i);
      } else {
        drawPetal(ctx, (x[i] ?? 0) + drift, py, angle[i] ?? 0, size, i);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** One tulip petal: a leaf-shaped blade with the uniform ink outline. */
function drawPetal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number,
  size: number,
  index: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.9, -size * 0.4, size * 0.7, size * 0.7, 0, size);
  ctx.bezierCurveTo(-size * 0.7, size * 0.7, -size * 0.9, -size * 0.4, 0, -size);
  ctx.closePath();

  ctx.fillStyle = index % 3 === 0 ? YELLOW : index % 3 === 1 ? PINK : PINK_LIGHT;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * 0.16);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/**
 * A curled ribbon streamer.
 *
 * Drawn as a wave whose amplitude tracks its own rotation, so it appears to
 * twist through the frame rather than tumble flat. Silhouette variety is what
 * keeps eighty pieces from reading as eighty copies.
 */
function drawRibbon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number,
  size: number,
  index: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * 0.5);

  const length = size * 3.4;
  const curl = Math.cos(rotation) * size * 0.9;

  ctx.beginPath();
  ctx.moveTo(-length / 2, 0);
  ctx.quadraticCurveTo(-length / 6, curl, 0, 0);
  ctx.quadraticCurveTo(length / 6, -curl, length / 2, 0);

  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(3, size * 0.72);
  ctx.stroke();

  ctx.strokeStyle = index % 2 === 0 ? GREEN : PINK_PRESS;
  ctx.lineWidth = Math.max(1.5, size * 0.44);
  ctx.stroke();
  ctx.restore();
}

/**
 * Tulips growing up from the bottom edge.
 *
 * This is the signature, and it is also a PROMISE: the field that fills the
 * screen thirty seconds later starts here, at the edge, while the stamp is
 * still on screen. The unlock stops being a transition and becomes the first
 * frame of the bloom.
 */
function drawHorizon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  unit: number,
  progress: number,
): void {
  for (let i = 0; i < TULIPS; i += 1) {
    const t = i / (TULIPS - 1);
    // Grows outward from the centre, so it reads as spreading rather than as a
    // row switching on.
    const delay = Math.abs(t - 0.5) * 1.4;
    const grown = clamp01((progress - delay * 0.4) / 0.6);
    if (grown <= 0.01) continue;

    const x = width * (0.04 + t * 0.92);
    const size = unit * (0.1 + ((i * 31) % 7) / 90) * grown;

    ctx.save();
    ctx.translate(x, height + unit * 0.02);
    ctx.rotate(((i % 5) - 2) * 0.045);

    // Stem
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2.5, size * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -size * 1.5);
    ctx.stroke();

    // Leaf
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.7);
    ctx.quadraticCurveTo(-size * 0.75, -size * 0.9, -size * 0.85, -size * 1.35);
    ctx.quadraticCurveTo(-size * 0.35, -size * 1.15, 0, -size * 0.55);
    ctx.closePath();
    ctx.fillStyle = GREEN;
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.stroke();

    // Head — the tulip cup
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, -size * 1.5);
    ctx.quadraticCurveTo(-size * 0.55, -size * 2.35, 0, -size * 2.5);
    ctx.quadraticCurveTo(size * 0.55, -size * 2.35, size * 0.5, -size * 1.5);
    ctx.quadraticCurveTo(size * 0.25, -size * 1.3, 0, -size * 1.32);
    ctx.quadraticCurveTo(-size * 0.25, -size * 1.3, -size * 0.5, -size * 1.5);
    ctx.closePath();
    ctx.fillStyle = i % 3 === 0 ? YELLOW : i % 3 === 1 ? PINK : PINK_PRESS;
    ctx.fill();
    ctx.lineWidth = Math.max(2.5, size * 0.1);
    ctx.stroke();

    ctx.restore();
  }
}
