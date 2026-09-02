'use client';

/**
 * ★ THE HAND OVERLAY ★ — landmarks, the heart guide, and the success beat.
 *
 * ── IT NEVER RE-RENDERS, AND IT NEVER TOUCHES DETECTION ──────────────────
 * One canvas, one `requestAnimationFrame`, driven entirely by `detectionRef`.
 * React commits once on mount. No threshold, no evaluator and no config value
 * is read for anything other than DISPLAY — this component cannot change
 * whether a gesture is accepted, only how it looks while it is being made.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── WHY A CANVAS AND NOT SVG ELEMENTS ────────────────────────────────────
 * 42 landmarks plus 40 connections plus a heart plus sparkles is ~100 nodes
 * mutating at 60 Hz. As DOM that is 100 style recalculations per frame on a
 * phone that is simultaneously running two neural networks. As canvas it is one
 * paint. The Phase A budget leaves ≥ 40 ms of every 66 ms frame, and this is
 * how it stays that way.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── COLOUR IS ASSIGNED BY SCREEN POSITION, NOT BY HANDEDNESS ─────────────
 * Doc 03 §2.5: MediaPipe's handedness classifier is IGNORED ENTIRELY, because
 * it is unreliable when the two hands belong to different people. So the pink
 * and mint are chosen from where each hand APPEARS, which is cosmetic, stable,
 * and self-correcting.
 *
 * The preview is mirrored, so the hand that appears on the SCREEN LEFT is the
 * one with the LARGER raw x. That inversion is the whole subtlety here.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Both fills come from the existing palette — `--color-pink` and
 * `--color-green`. Doc 04 §A.1: never introduce a new hue.
 */

import { useEffect, useRef } from 'react';

import { cameraRuntime } from '@/detection/camera/runtime';
import type { Hand } from '@/detection/types';
import { approach, useDetectionFrame } from './useDetectionFrame';

/** MediaPipe's canonical hand skeleton (Doc 03 §2.3 indices). */
const CONNECTIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4], // thumb
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8], // index
  [9, 10],
  [10, 11],
  [11, 12], // middle
  [13, 14],
  [14, 15],
  [15, 16], // ring
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20], // pinky
  [5, 9],
  [9, 13],
  [13, 17], // palm
];

const LANDMARKS = 21;
const SLOTS = 2;

const INK = '#111111';
const PINK = '#FF8FAB';
const MINT = '#B7E4C7';
const CREAM = '#FFF8E8';
const YELLOW = '#FFE599';

/** Heart outline, sampled once into normalised space. */
const HEART_SAMPLES = 160;
const HEART_X = new Float32Array(HEART_SAMPLES + 1);
const HEART_Y = new Float32Array(HEART_SAMPLES + 1);

(function buildHeart(): void {
  for (let i = 0; i <= HEART_SAMPLES; i += 1) {
    // Start at the bottom point and run clockwise, so the progress stroke
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

const SPARKLES = 28;

export interface HandOverlayProps {
  readonly motionSafe: boolean;
}

export function HandOverlay({ motionSafe }: HandOverlayProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Pre-allocated state. Nothing below allocates per frame. ───────────────
  const smoothed = useRef(new Float32Array(SLOTS * LANDMARKS * 2));
  const alpha = useRef(new Float32Array(SLOTS));
  const seeded = useRef(new Uint8Array(SLOTS));

  const sparkX = useRef(new Float32Array(SPARKLES));
  const sparkY = useRef(new Float32Array(SPARKLES));
  const sparkVx = useRef(new Float32Array(SPARKLES));
  const sparkVy = useRef(new Float32Array(SPARKLES));
  const sparkLife = useRef(new Float32Array(SPARKLES));
  const sparkBurst = useRef(false);

  const guideX = useRef(0.5);
  const guideY = useRef(0.42);
  const guideR = useRef(0.16);
  const lastFrameAt = useRef(0);
  const pulse = useRef(0);

  // Keep the backing store matched to the box, at a capped DPR.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const resize = (): void => {
      const parent = canvas.parentElement;
      if (parent === null) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(parent.clientWidth * dpr);
      canvas.height = Math.round(parent.clientHeight * dpr);
      canvas.style.width = `${String(parent.clientWidth)}px`;
      canvas.style.height = `${String(parent.clientHeight)}px`;
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement !== null) observer.observe(canvas.parentElement);
    return () => {
      observer.disconnect();
    };
  }, []);

  useDetectionFrame((snapshot, nowMs) => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    const dtMs =
      lastFrameAt.current === 0 ? 16 : Math.min(nowMs - lastFrameAt.current, 64);
    lastFrameAt.current = nowMs;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const cw = canvas.width / dpr;
    const chh = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, chh);

    // ── The `object-fit: cover` mapping ──────────────────────────────────
    // Landmarks are normalised to the VIDEO frame and square-corrected, so both
    // axes share one scale: pixels per frame-width unit. Getting this wrong is
    // the classic overlay bug — the skeleton drifts from the hand as the
    // container aspect changes.
    const video = cameraRuntime.currentVideo();
    const vw = video?.videoWidth ?? 0;
    const vh = video?.videoHeight ?? 0;
    if (vw === 0 || vh === 0) return;

    const cover = Math.max(cw / vw, chh / vh);
    const unit = vw * cover;
    const offsetX = (cw - vw * cover) / 2;
    const offsetY = (chh - vh * cover) / 2;

    const toX = (x: number): number => offsetX + x * unit;
    const toY = (y: number): number => offsetY + y * unit;

    // ── Slot assignment by screen position ───────────────────────────────
    const hands = snapshot.hands;
    const first = hands[0];
    const second = hands[1];
    // Mirrored preview: the LARGER raw x appears on the screen left.
    let leftHand: Hand | undefined = first;
    let rightHand: Hand | undefined = second;
    if (first !== undefined && second !== undefined) {
      const ax = first[0]?.x ?? 0;
      const bx = second[0]?.x ?? 0;
      if (bx > ax) {
        leftHand = second;
        rightHand = first;
      }
    }

    drawHand(
      ctx,
      leftHand,
      0,
      PINK,
      dtMs,
      smoothed.current,
      alpha.current,
      seeded.current,
      toX,
      toY,
      unit,
    );
    drawHand(
      ctx,
      rightHand,
      1,
      MINT,
      dtMs,
      smoothed.current,
      alpha.current,
      seeded.current,
      toX,
      toY,
      unit,
    );

    // ── The heart guide ──────────────────────────────────────────────────
    // It FOLLOWS the expected gesture position: between the two hands once both
    // are up, so the user aims at a target that has already met them halfway.
    let targetX = 0.5;
    let targetY = 0.42;
    let targetR = 0.16;

    if (leftHand !== undefined && rightHand !== undefined) {
      const a = leftHand[0];
      const b = rightHand[0];
      const at = leftHand[8];
      const bt = rightHand[8];
      if (a !== undefined && b !== undefined && at !== undefined && bt !== undefined) {
        targetX = (a.x + b.x + at.x + bt.x) / 4;
        targetY = (a.y + b.y + at.y + bt.y) / 4;
        targetR = Math.max(0.1, Math.min(0.28, Math.abs(a.x - b.x) * 0.85));
      }
    }

    guideX.current = approach(guideX.current, targetX, dtMs, 140);
    guideY.current = approach(guideY.current, targetY, dtMs, 140);
    guideR.current = approach(guideR.current, targetR, dtMs, 140);

    const holding = snapshot.holdProgress;
    const complete = holding >= 1;
    // Dotted ghost always; the solid stroke traces `progress` of the perimeter.
    const progress = complete ? 1 : Math.max(snapshot.closeness, holding);

    if (motionSafe) {
      pulse.current = complete ? approach(pulse.current, 1, dtMs, 220) : 0;
    }

    drawHeart(
      ctx,
      toX(guideX.current),
      toY(guideY.current),
      guideR.current * unit,
      progress,
      complete,
      motionSafe ? pulse.current : 0,
      nowMs,
      motionSafe,
    );

    // ── Sparkles, on completion only ─────────────────────────────────────
    if (!motionSafe) return;

    if (complete && !sparkBurst.current) {
      sparkBurst.current = true;
      seedSparkles(
        sparkX.current,
        sparkY.current,
        sparkVx.current,
        sparkVy.current,
        sparkLife.current,
        toX(guideX.current),
        toY(guideY.current),
        guideR.current * unit,
      );
    }
    if (!complete && holding <= 0.01) sparkBurst.current = false;

    drawSparkles(
      ctx,
      sparkX.current,
      sparkY.current,
      sparkVx.current,
      sparkVy.current,
      sparkLife.current,
      dtMs,
    );
  });

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

/**
 * One hand: outlined connections, then outlined dots.
 *
 * The landmarks arrive at 15 Hz and are drawn at 60 Hz, so each point eases
 * toward its target with a ~70 ms approach. Without it the skeleton visibly
 * steps, which reads as the tracking being broken rather than deliberate.
 */
function drawHand(
  ctx: CanvasRenderingContext2D,
  hand: Hand | undefined,
  slot: number,
  colour: string,
  dtMs: number,
  smoothed: Float32Array,
  alpha: Float32Array,
  seeded: Uint8Array,
  toX: (x: number) => number,
  toY: (y: number) => number,
  unit: number,
): void {
  const base = slot * LANDMARKS * 2;
  const present = hand !== undefined && hand.length >= LANDMARKS;

  alpha[slot] = approach(alpha[slot] ?? 0, present ? 1 : 0, dtMs, present ? 90 : 160);
  const a = alpha[slot] ?? 0;

  // `present` is an inferred type predicate, so `hand` is non-nullable here.
  if (present) {
    for (let i = 0; i < LANDMARKS; i += 1) {
      const point = hand[i];
      if (point === undefined) continue;
      const ix = base + i * 2;
      // A hand that has just appeared snaps to place rather than flying in
      // from wherever the previous one left the slot.
      if (seeded[slot] === 0) {
        smoothed[ix] = point.x;
        smoothed[ix + 1] = point.y;
      } else {
        smoothed[ix] = approach(smoothed[ix] ?? point.x, point.x, dtMs, 70);
        smoothed[ix + 1] = approach(smoothed[ix + 1] ?? point.y, point.y, dtMs, 70);
      }
    }
    seeded[slot] = 1;
  } else if (a < 0.02) {
    seeded[slot] = 0;
  }

  if (a < 0.02) return;

  ctx.globalAlpha = a;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Chunky black casing under a pastel core — the neo-brutalist line, applied
  // to a skeleton (Doc 04 §A.7: uniform 3 px outline, no weight variation).
  const core = Math.max(3, unit * 0.014);
  const casing = core + 4;

  for (const [from, to] of CONNECTIONS) {
    const fx = toX(smoothed[base + from * 2] ?? 0);
    const fy = toY(smoothed[base + from * 2 + 1] ?? 0);
    const tx = toX(smoothed[base + to * 2] ?? 0);
    const ty = toY(smoothed[base + to * 2 + 1] ?? 0);

    ctx.strokeStyle = INK;
    ctx.lineWidth = casing;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.strokeStyle = colour;
    ctx.lineWidth = core;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  // Fingertips read larger, so the parts that form the heart are the parts the
  // eye follows.
  const TIPS = new Set([4, 8, 12, 16, 20]);
  for (let i = 0; i < LANDMARKS; i += 1) {
    const x = toX(smoothed[base + i * 2] ?? 0);
    const y = toY(smoothed[base + i * 2 + 1] ?? 0);
    const r = (TIPS.has(i) ? 0.026 : 0.017) * unit;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.lineWidth = Math.max(2, unit * 0.008);
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

/**
 * The guide: a dotted ghost outline always, plus a solid stroke tracing
 * `progress` of the perimeter — so 25 / 50 / 75 / 100% is literally visible as
 * how much of the heart has been drawn.
 *
 * The glow is `shadowBlur` on a canvas stroke, not a CSS `box-shadow`. Doc 04
 * §A.3's zero-blur rule governs UI ELEVATION — cards and buttons — not the
 * illustration layer, where a soft light around a completed heart is the whole
 * point of the beat.
 */
function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  progress: number,
  complete: boolean,
  pulse: number,
  nowMs: number,
  motionSafe: boolean,
): void {
  // ≤ 4% amplitude, period ≥ 1.6 s — an idle that never competes with intent
  // (Doc 04 §C.4 rule 7), and well under the photosensitivity ceiling.
  const breath = motionSafe ? 1 + Math.sin(nowMs / 620) * 0.03 * pulse : 1;
  const r = radius * breath;

  ctx.save();

  // Ghost outline.
  ctx.setLineDash([Math.max(4, r * 0.09), Math.max(6, r * 0.11)]);
  ctx.lineWidth = Math.max(2.5, r * 0.035);
  ctx.strokeStyle = complete ? PINK : CREAM;
  ctx.globalAlpha = complete ? 0.35 : 0.85;
  strokeHeart(ctx, cx, cy, r, 1);
  ctx.globalAlpha = 1;

  // Progress stroke.
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
    ctx.setLineDash([]);
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

function seedSparkles(
  x: Float32Array,
  y: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  life: Float32Array,
  cx: number,
  cy: number,
  r: number,
): void {
  for (let i = 0; i < SPARKLES; i += 1) {
    // Deterministic from the index — the same burst on every device, and a bug
    // that reproduces.
    const angle = i * 2.399963;
    const speed = 0.06 + ((i * 37) % 11) / 90;
    x[i] = cx + Math.cos(angle) * r * 0.6;
    y[i] = cy + Math.sin(angle) * r * 0.6;
    vx[i] = Math.cos(angle) * speed * r;
    vy[i] = Math.sin(angle) * speed * r - r * 0.02;
    life[i] = 1;
  }
}

function drawSparkles(
  ctx: CanvasRenderingContext2D,
  x: Float32Array,
  y: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  life: Float32Array,
  dtMs: number,
): void {
  const dt = dtMs / 1000;
  for (let i = 0; i < SPARKLES; i += 1) {
    const remaining = life[i] ?? 0;
    if (remaining <= 0) continue;

    life[i] = Math.max(0, remaining - dt * 0.75);
    x[i] = (x[i] ?? 0) + (vx[i] ?? 0) * dt;
    y[i] = (y[i] ?? 0) + (vy[i] ?? 0) * dt;
    vy[i] = (vy[i] ?? 0) + 60 * dt;

    const size = 3 + remaining * 5;
    ctx.globalAlpha = remaining;
    ctx.fillStyle = i % 2 === 0 ? YELLOW : PINK;
    ctx.beginPath();
    // A four-point star, drawn as a rotated square pinched at the waist —
    // cheaper than a path per sparkle and reads correctly at this size.
    ctx.moveTo(x[i] ?? 0, (y[i] ?? 0) - size);
    ctx.quadraticCurveTo(x[i] ?? 0, y[i] ?? 0, (x[i] ?? 0) + size, y[i] ?? 0);
    ctx.quadraticCurveTo(x[i] ?? 0, y[i] ?? 0, x[i] ?? 0, (y[i] ?? 0) + size);
    ctx.quadraticCurveTo(x[i] ?? 0, y[i] ?? 0, (x[i] ?? 0) - size, y[i] ?? 0);
    ctx.quadraticCurveTo(x[i] ?? 0, y[i] ?? 0, x[i] ?? 0, (y[i] ?? 0) - size);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
