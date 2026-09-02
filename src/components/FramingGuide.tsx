'use client';

/**
 * Framing guide and person chips — Doc 04 §B.6.
 *
 * ── RETICLES ARE TARGETS, NOT TRACKERS ───────────────────────────────────
 * They sit at fixed positions and DO NOT follow faces. A reticle fills when a
 * valid face overlaps it.
 *
 * This is far more legible than boxes chasing heads, and it doubles as framing
 * guidance — which is the actual job here, because the gate needs both people
 * looking at the lens. Tracking boxes would tell the user where their face is,
 * which they already know, instead of where it needs to be.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Both the reticles and the chips are driven from the detection rAF by direct
 * attribute writes. Neither re-renders.
 */

import { useRef } from 'react';

import { SEEKING_FACES } from '@/content/copy';
import type { FaceBox } from '@/detection/types';
import { useDetectionFrame } from './useDetectionFrame';

/** Reticle centres as a fraction of frame width. 30/70 below 380 px. */
const RETICLE_X = [0.32, 0.68] as const;
const RETICLE_X_NARROW = [0.3, 0.7] as const;
const RETICLE_Y = 0.42;
const RETICLE_W = 0.3;
const RETICLE_H = 0.34;

export function FramingGuide(): React.ReactElement {
  const leftRef = useRef<SVGRectElement>(null);
  const rightRef = useRef<SVGRectElement>(null);

  useDetectionFrame((snapshot) => {
    const narrow = window.innerWidth < 380;
    const xs = narrow ? RETICLE_X_NARROW : RETICLE_X;

    for (const [index, ref] of [leftRef, rightRef].entries()) {
      const node = ref.current;
      if (node === null) continue;
      const centre = xs[index] ?? 0.5;
      const matched = snapshot.faceBoxes.some((box) => overlapsReticle(box, centre));
      node.dataset.matched = matched ? 'yes' : 'no';
    }
  });

  const narrow = typeof window !== 'undefined' && window.innerWidth < 380;
  const xs = narrow ? RETICLE_X_NARROW : RETICLE_X;

  return (
    <svg
      viewBox="0 0 100 133"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      {xs.map((x, index) => (
        <rect
          key={x}
          ref={index === 0 ? leftRef : rightRef}
          data-matched="no"
          className="reticle"
          x={(x - RETICLE_W / 2) * 100}
          y={(RETICLE_Y - RETICLE_H / 2) * 133}
          width={RETICLE_W * 100}
          height={RETICLE_H * 133}
          rx="12"
          fill="none"
          // 3 px, matching every other border in the system. The previous 1.2 px
          // hairline read as a wireframe rather than as a chunky target
          // (Doc 04 §A.7: uniform 3 px outline, no weight variation).
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/**
 * Overlap in square-corrected space. The reticle's own coordinates are in
 * frame-width units for x and frame-width-scaled units for y, which is the
 * same space `correctFaceBox` produces — so no second conversion happens here
 * (Doc 03 §2.1).
 */
function overlapsReticle(box: FaceBox, centreX: number): boolean {
  const boxCentreX = box.x + box.width / 2;
  return Math.abs(boxCentreX - centreX) < RETICLE_W;
}

/**
 * Two chunky chips that fill as faces register. Announced as "1 of 2 people
 * detected" through the polite region, debounced like every other announcement.
 */
export function PersonChips(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(-1);

  useDetectionFrame((snapshot) => {
    const count = Math.max(0, Math.min(2, snapshot.faceCount));
    if (count === lastCount.current) return;
    lastCount.current = count;

    const container = containerRef.current;
    if (container === null) return;
    container.dataset.count = String(count);
    container.setAttribute('aria-label', SEEKING_FACES.chipsLabel(count));
  });

  return (
    <div
      ref={containerRef}
      data-count="0"
      aria-label={SEEKING_FACES.chipsLabel(0)}
      role="img"
      className="person-chips flex justify-center gap-3"
    >
      <span className="chip" data-index="0" aria-hidden="true">
        🙂
      </span>
      <span className="chip" data-index="1" aria-hidden="true">
        🙂
      </span>
    </div>
  );
}
