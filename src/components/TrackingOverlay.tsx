'use client';

/**
 * ★ THE TRACKING OVERLAY ★ — masks, hands, the heart guide, and the payoff.
 *
 * ── ONE CANVAS, ONE rAF, ZERO RE-RENDERS ─────────────────────────────────
 * Faces, hands, guide and sparkles share a single canvas and a single frame
 * loop, driven entirely by `detectionRef`. React commits once, on mount.
 *
 * Two canvases would mean two clears and two composites per frame for a scene
 * that is one picture. Two rAF loops would mean the mask and the hands could
 * disagree about what frame it is.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── IT CANNOT AFFECT DETECTION ───────────────────────────────────────────
 * Everything here READS the ref. No threshold, no evaluator, no FSM event. The
 * gesture is decided exactly as it was before this file existed; this only
 * changes how it looks while it is being made.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── THE PERFORMANCE SHAPE ────────────────────────────────────────────────
 * `shadowBlur` is used for the heart and nothing else. It forces a full-canvas
 * readback on mobile Safari, and this runs while two neural networks do. Every
 * other glow is a second pass at a larger radius and lower alpha — two fills
 * instead of a blur.
 *
 * Every buffer is pre-allocated at mount. The frame loop allocates nothing.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from 'react';

import { cameraRuntime } from '@/detection/camera/runtime';
import { G1 } from '@/detection/config';
import type { DetectionSnapshot } from '@/detection/ref';
import type { Hand } from '@/detection/types';
import { drawHands, HAND_POINTS, HAND_SLOTS } from './tracking/hands';
import { drawHeartGuide, HEART_UNIT } from './tracking/heart';
import {
  drawMask,
  loadMaskArt,
  maskFrame,
  orderByScreenPosition,
  variantFor,
} from './tracking/mask';
import { drawSparkles, seedSparkles, SPARKLE_COUNT } from './tracking/sparkles';
import { integrate, integrateScalar, snap, springConstants } from './tracking/spring';
import { useDetectionFrame } from './useDetectionFrame';

const HAND_VALUES = HAND_SLOTS * HAND_POINTS * 2;
const FACE_SLOTS = 2;

export interface TrackingOverlayProps {
  readonly motionSafe: boolean;
  /** Faces get masks only once the stage is about the two of you. */
  readonly masks?: boolean;
}

export function TrackingOverlay({
  motionSafe,
  masks = true,
}: TrackingOverlayProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Pre-allocated. Nothing in the frame loop allocates. ───────────────────
  const handPos = useRef(new Float32Array(HAND_VALUES));
  const handVel = useRef(new Float32Array(HAND_VALUES));
  const handTarget = useRef(new Float32Array(HAND_VALUES));
  const handAlpha = useRef(new Float32Array(HAND_SLOTS));
  const handConfidence = useRef(new Float32Array(HAND_SLOTS));
  const handSeeded = useRef(new Uint8Array(HAND_SLOTS));

  const maskReveal = useRef(new Float32Array(FACE_SLOTS));
  const maskVel = useRef(new Float32Array(FACE_SLOTS));

  const scalarVel = useRef(new Float32Array(4));
  const glow = useRef(0);
  const guideX = useRef(0.5);
  const guideY = useRef(0.42);
  const guideR = useRef(0.16);
  const pulse = useRef(0);

  const sparkX = useRef(new Float32Array(SPARKLE_COUNT));
  const sparkY = useRef(new Float32Array(SPARKLE_COUNT));
  const sparkVx = useRef(new Float32Array(SPARKLE_COUNT));
  const sparkVy = useRef(new Float32Array(SPARKLE_COUNT));
  const sparkLife = useRef(new Float32Array(SPARKLE_COUNT));
  const burst = useRef(false);

  const lastFrameAt = useRef(0);

  // Optional drop-in artwork. Absent by default, and absent is fine — the
  // procedural mask is the fallback, not an error path. See `tracking/mask.ts`
  // for the contract the files must meet.
  useEffect(() => {
    loadMaskArt('red', '/mask/red.png');
    loadMaskArt('white', '/mask/white.png');
  }, []);

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

    // A returning tab can deliver a multi-second gap; the spring integrator
    // subdivides whatever it gets, but there is no point simulating a minute.
    const dtSec =
      lastFrameAt.current === 0
        ? 1 / 60
        : Math.min((nowMs - lastFrameAt.current) / 1000, 0.064);
    lastFrameAt.current = nowMs;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // ── The `object-fit: cover` mapping ──────────────────────────────────
    // Landmarks are normalised to the VIDEO frame and square-corrected, so both
    // axes share one scale: pixels per frame-width unit. Getting this wrong is
    // the classic overlay bug — the drawing drifts off the face as the
    // container aspect changes.
    const video = cameraRuntime.currentVideo();
    const vw = video?.videoWidth ?? 0;
    const vh = video?.videoHeight ?? 0;
    if (vw === 0 || vh === 0) return;

    const cover = Math.max(cw / vw, ch / vh);
    const unit = vw * cover;
    const offsetX = (cw - vw * cover) / 2;
    const offsetY = (ch - vh * cover) / 2;
    const toX = (x: number): number => offsetX + x * unit;
    const toY = (y: number): number => offsetY + y * unit;

    // ── Shared intensity ─────────────────────────────────────────────────
    // Part 5: everything brightens together as the heart comes together, so the
    // whole picture responds to one number rather than each part having its own
    // idea of progress.
    const holding = snapshot.holdProgress;
    const complete = holding >= 1;
    const intensity = Math.max(snapshot.closeness, holding);
    glow.current = integrateScalar(
      glow.current,
      scalarVel.current,
      0,
      intensity,
      springConstants('gentle'),
      dtSec,
    );

    if (motionSafe) {
      pulse.current = integrateScalar(
        pulse.current,
        scalarVel.current,
        1,
        complete ? 1 : 0,
        springConstants('pop'),
        dtSec,
      );
    }

    // ── Masks ────────────────────────────────────────────────────────────
    if (masks) {
      const order = orderByScreenPosition(snapshot.faceBoxes);
      for (let slot = 0; slot < FACE_SLOTS; slot += 1) {
        const face = snapshot.faceBoxes[order[slot] ?? -1];

        // Part 4: reveal follows the model's own confidence, so the mask grows
        // in as the detector becomes sure and recedes as it loses the face. No
        // popping, because nothing here is a boolean.
        const target = face === undefined ? 0 : Math.min(1, Math.max(0, face.score));
        maskReveal.current[slot] = integrateScalar(
          maskReveal.current[slot] ?? 0,
          maskVel.current,
          slot,
          target,
          springConstants('gentle'),
          dtSec,
        );

        if (face === undefined) continue;
        drawMask(
          ctx,
          maskFrame(face, toX, toY, unit),
          variantFor(slot),
          maskReveal.current[slot] ?? 0,
          glow.current,
          motionSafe ? pulse.current : 0,
        );
      }
    }

    // ── Hands ────────────────────────────────────────────────────────────
    const hands = snapshot.hands;
    const first = hands[0];
    const second = hands[1];
    // Mirrored preview: the LARGER raw x appears on the screen left, and takes
    // the same colour as that side's mask.
    let leftHand: Hand | undefined = first;
    let rightHand: Hand | undefined = second;
    if (
      first !== undefined &&
      second !== undefined &&
      (second[0]?.x ?? 0) > (first[0]?.x ?? 0)
    ) {
      leftHand = second;
      rightHand = first;
    }

    updateHandSlot(
      0,
      leftHand,
      snapshot,
      dtSec,
      handPos.current,
      handVel.current,
      handTarget.current,
      handAlpha.current,
      handConfidence.current,
      handSeeded.current,
      scalarVel.current,
    );
    updateHandSlot(
      1,
      rightHand,
      snapshot,
      dtSec,
      handPos.current,
      handVel.current,
      handTarget.current,
      handAlpha.current,
      handConfidence.current,
      handSeeded.current,
      scalarVel.current,
    );

    drawHands(
      ctx,
      handPos.current,
      handAlpha.current,
      handConfidence.current,
      toX,
      toY,
      unit,
      glow.current,
      nowMs,
      motionSafe,
    );

    // ── The heart guide ──────────────────────────────────────────────────
    // It FOLLOWS the expected gesture position, so the target meets the user
    // halfway rather than making them find it.
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

    const gentle = springConstants('gentle');
    guideX.current = integrateScalar(
      guideX.current,
      scalarVel.current,
      2,
      targetX,
      gentle,
      dtSec,
    );
    guideY.current = integrateScalar(
      guideY.current,
      scalarVel.current,
      3,
      targetY,
      gentle,
      dtSec,
    );
    guideR.current += (targetR - guideR.current) * Math.min(1, dtSec * 6);

    drawHeartGuide(ctx, {
      x: toX(guideX.current),
      y: toY(guideY.current),
      radius: guideR.current * unit * HEART_UNIT,
      progress: complete ? 1 : intensity,
      complete,
      pulse: motionSafe ? pulse.current : 0,
      nowMs,
      motionSafe,
    });

    // ── Sparkles ─────────────────────────────────────────────────────────
    if (!motionSafe) return;

    if (complete && !burst.current) {
      burst.current = true;
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
    if (!complete && holding <= 0.01) burst.current = false;

    drawSparkles(
      ctx,
      sparkX.current,
      sparkY.current,
      sparkVx.current,
      sparkVy.current,
      sparkLife.current,
      dtSec,
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
 * Springs one hand's 21 landmarks toward their latest reading.
 *
 * ── CONFIDENCE IS DERIVED, NOT REPORTED ──────────────────────────────────
 * `HandLandmarkerResult` carries no per-landmark score, so there is nothing to
 * read. Doc 03 §4.3 supplies the honest proxy instead: "hands smaller than this
 * produce landmark estimates too noisy for the distance ratios to mean
 * anything". So reliability tracks palm scale against the C1 gate — a hand at
 * the size threshold draws faint, a hand well inside it draws solid.
 *
 * That is a real signal about the data, not a decoration, and it tells the user
 * something actionable: a faint hand means bring it closer.
 * ─────────────────────────────────────────────────────────────────────────
 */
function updateHandSlot(
  slot: number,
  hand: Hand | undefined,
  snapshot: DetectionSnapshot,
  dtSec: number,
  position: Float32Array,
  velocity: Float32Array,
  target: Float32Array,
  alpha: Float32Array,
  confidence: Float32Array,
  seeded: Uint8Array,
  scalarVel: Float32Array,
): void {
  const base = slot * HAND_POINTS * 2;
  const present = hand !== undefined && hand.length >= HAND_POINTS;

  if (present) {
    for (let i = 0; i < HAND_POINTS; i += 1) {
      const point = hand[i];
      if (point === undefined) continue;
      target[base + i * 2] = point.x;
      target[base + i * 2 + 1] = point.y;
    }

    if (seeded[slot] === 0) {
      snap(
        position.subarray(base, base + HAND_POINTS * 2),
        velocity.subarray(base, base + HAND_POINTS * 2),
        target.subarray(base, base + HAND_POINTS * 2),
        HAND_POINTS * 2,
      );
      seeded[slot] = 1;
    }

    const scale = snapshot.palmScales[slot] ?? G1.minPalmScale;
    confidence[slot] = Math.max(0.35, Math.min(1, scale / (G1.minPalmScale * 1.25)));
  }

  integrate(
    position.subarray(base, base + HAND_POINTS * 2),
    velocity.subarray(base, base + HAND_POINTS * 2),
    target.subarray(base, base + HAND_POINTS * 2),
    HAND_POINTS * 2,
    springConstants('gentle'),
    dtSec,
  );

  const next = integrateScalar(
    alpha[slot] ?? 0,
    scalarVel,
    slot,
    present ? 1 : 0,
    springConstants('snappy'),
    dtSec,
  );
  alpha[slot] = Math.max(0, Math.min(1, next));

  // Once fully faded the slot forgets its pose, so the next hand to arrive
  // snaps into place instead of flying in from the last one's position.
  if (!present && (alpha[slot] ?? 0) < 0.02) seeded[slot] = 0;
}
