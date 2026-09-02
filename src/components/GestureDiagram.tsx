'use client';

/**
 * The gesture diagram — Doc 04 §B.9.
 *
 * Two hands, one from each side, meeting to form a heart. A ~1.4 s loop.
 *
 * ── RETAINED UNDER REDUCED MOTION ────────────────────────────────────────
 * This is one of exactly three animations that survive `motionSafe = false`
 * (with the progress ring and all audio). It is INSTRUCTIONAL CONTENT, not
 * decoration — removing it makes the core interaction unlearnable, and Doc 04
 * §C.5's rule is that content is never removed, only motion.
 *
 * Under reduced motion the loop is replaced by the FINAL frame — the completed
 * heart — which is the instruction, held still.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Authored as inline SVG rather than a Lottie file: it is ~1 KB, it inherits
 * the token palette, and it is on screen at the moment the main thread is
 * busiest with inference.
 */

import { motion } from 'motion/react';

import { GESTURE } from '@/content/copy';

export interface GestureDiagramProps {
  readonly motionSafe: boolean;
}

export function GestureDiagram({ motionSafe }: GestureDiagramProps): React.ReactElement {
  const loop = motionSafe
    ? { x: [-14, 0, 0, -14], opacity: [0.85, 1, 1, 0.85] }
    : { x: 0, opacity: 1 };

  const transition = motionSafe
    ? {
        duration: 1.4,
        repeat: Infinity,
        times: [0, 0.35, 0.75, 1],
        ease: 'easeInOut' as const,
      }
    : { duration: 0 };

  return (
    <div className="pointer-events-none flex items-center justify-center">
      <svg
        viewBox="0 0 140 90"
        className="h-auto w-[min(46vw,180px)]"
        role="img"
        aria-label={GESTURE.diagramAlt}
      >
        {/* The heart the two half-shapes complete. */}
        <path
          d="M70 74 C 44 56, 30 44, 30 32 C 30 22, 38 16, 47 16 C 55 16, 62 21, 70 31 C 78 21, 85 16, 93 16 C 102 16, 110 22, 110 32 C 110 44, 96 56, 70 74 Z"
          fill="var(--color-pink-light)"
          stroke="#111111"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Left hand, entering from the left. */}
        <motion.g animate={loop} transition={transition}>
          <path
            d="M22 78 L38 60 Q46 52 52 56 Q58 60 50 68 L40 78 Z"
            fill="var(--color-yellow)"
            stroke="#111111"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </motion.g>

        {/* Right hand, mirrored, out of phase by the same amount. */}
        <motion.g
          animate={
            motionSafe
              ? { x: [14, 0, 0, 14], opacity: [0.85, 1, 1, 0.85] }
              : { x: 0, opacity: 1 }
          }
          transition={transition}
        >
          <path
            d="M118 78 L102 60 Q94 52 88 56 Q82 60 90 68 L100 78 Z"
            fill="var(--color-yellow)"
            stroke="#111111"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </motion.g>
      </svg>
    </div>
  );
}
