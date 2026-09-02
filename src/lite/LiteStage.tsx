'use client';

/**
 * ★ THE LITE STAGE ★ — Doc 04 §B.19, Doc 01 §5.6, Doc 05 P5.6.
 *
 * ── LITE IS A PARALLEL IMPLEMENTATION, NOT A STUB ────────────────────────
 * Every Phase B beat exists twice: in R3F and here. Same structure, same
 * timing, same art direction. The letter is IDENTICAL in both.
 *
 * There is no "lite mode" badge, no watermark and no apology. The user is never
 * told. It trades the third dimension and nothing else.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── WHY CSS + SVG RATHER THAN LOTTIE ─────────────────────────────────────
 * Doc 04 §B.19 budgets ≤ 150 KB for a Lottie sequence. Authoring one requires
 * After Effects and Bodymovin, and produces a JSON blob whose colours cannot
 * follow the design tokens.
 *
 * This implementation is inline SVG driven by Framer Motion: it costs ZERO
 * network bytes against that 150 KB budget, its fills are the CSS custom
 * properties themselves (so a token change reaches it for free), and it honours
 * `motionSafe` through the same root `MotionConfig` as everything else. A Lottie
 * file would have needed a separate reduced-motion export.
 *
 * The tradeoff accepted: no hand-keyed animation curves. The choreography here
 * is the spec's beat table expressed in springs — which is what the R3F twin
 * does too, so the two stay in step.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * REACHED FROM: no WebGL2 · no camera hardware · model failure · permission
 * denial · in-app browser refusal · `DEGRADE_TO_LITE` · a fatal error. Seven
 * routes, and every one of them must arrive at the letter.
 */

import { motion } from 'motion/react';

import { duration, easing, resolveSpring } from '@/motion/tokens';

export type LiteBeat = 'delivery' | 'bloom';

export interface LiteStageProps {
  readonly beat: LiteBeat;
  readonly motionSafe: boolean;
  /** Dim applied over the stage once the message or letter sits on top. */
  readonly dim?: number;
}

/** ≤ 60 tulips in the 3D twin; the 2D twin matches the count and the layout. */
const TULIPS = Array.from({ length: 18 }, (_, index) => {
  const t = index / 17;
  return {
    id: index,
    x: 6 + t * 88,
    scale: 0.7 + ((index * 37) % 11) / 22,
    delayMs: Math.abs(t - 0.5) * 900,
    hue: index % 3,
  };
});

const PETALS = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  x: (index * 41) % 100,
  delay: (index % 8) * 0.28,
  drift: index % 2 === 0 ? 22 : -18,
  size: 8 + (index % 4) * 3,
}));

export function LiteStage({
  beat,
  motionSafe,
  dim = 0,
}: LiteStageProps): React.ReactElement {
  const bloomed = beat === 'bloom';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* The sky-hole: a radial black shape scaling open. */}
      <motion.div
        className="absolute left-1/2 top-0 h-[34vh] w-[34vh] -translate-x-1/2 rounded-full bg-ink"
        initial={motionSafe ? { scaleY: 0, opacity: 0.9 } : { scaleY: 0.4, opacity: 0.6 }}
        animate={{ scaleY: bloomed ? 0.25 : 0.4, opacity: bloomed ? 0.35 : 0.7 }}
        transition={{ duration: motionSafe ? 0.4 : 0.2, ease: easing.back }}
        style={{ transformOrigin: 'top center' }}
      />

      {/* The box. Falls, lands with a squash, then bursts open. */}
      <Box beat={beat} motionSafe={motionSafe} />

      {/* The ground decal. */}
      <div className="absolute bottom-0 left-0 h-[26vh] w-full bg-green/40" />
      <div className="absolute bottom-[26vh] left-0 h-[3px] w-full bg-ink" />

      {/* The tulip field, growing in a radial wave from the box. */}
      <div className="absolute bottom-[18vh] left-0 h-[30vh] w-full">
        {TULIPS.map((tulip) => (
          <motion.div
            key={tulip.id}
            className="absolute bottom-0 origin-bottom"
            style={{ left: `${String(tulip.x)}%` }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={
              bloomed ? { scaleY: tulip.scale, opacity: 1 } : { scaleY: 0, opacity: 0 }
            }
            transition={{
              ...resolveSpring('pop', motionSafe),
              delay: (motionSafe ? tulip.delayMs : tulip.delayMs * 0.4) / 1000,
            }}
          >
            <Tulip hue={tulip.hue} />
          </motion.div>
        ))}
      </div>

      {/* Petal drift. 60 under reduced motion in the 3D twin; 24 here, slow. */}
      {bloomed &&
        PETALS.map((petal) => (
          <motion.span
            key={petal.id}
            className="absolute top-[-6%] block rounded-full border-2 border-ink bg-pink-light"
            style={{
              left: `${String(petal.x)}%`,
              width: petal.size,
              height: petal.size * 0.7,
            }}
            initial={{ y: 0, x: 0, rotate: 0, opacity: 0 }}
            animate={
              motionSafe
                ? { y: '110vh', x: petal.drift, rotate: 220, opacity: [0, 1, 1, 0] }
                : { y: '110vh', opacity: [0, 1, 1, 0] }
            }
            transition={{
              duration: motionSafe ? 7 : 9,
              delay: petal.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}

      {/* Faked bloom: a CSS radial gradient. NEVER a post-processing pass. */}
      {bloomed && (
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 65%, var(--color-yellow) 0%, transparent 55%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.28 }}
          transition={{ duration: duration.beat }}
        />
      )}

      {dim > 0 && <div className="absolute inset-0 bg-ink" style={{ opacity: dim }} />}
    </div>
  );
}

/**
 * Squash-and-stretch on impact: `(1.18, 0.78)` in, over-rebound to
 * `(0.94, 1.09)`, settle. Volume is approximately preserved, which is what makes
 * it read as physical rather than as a scale keyframe (Doc 04 §C.4).
 *
 * Under reduced motion the box FADES IN ALREADY LANDED — content preserved,
 * motion removed, no impact punch.
 */
function Box({
  beat,
  motionSafe,
}: {
  readonly beat: LiteBeat;
  readonly motionSafe: boolean;
}): React.ReactElement {
  const open = beat === 'bloom';

  return (
    <motion.div
      className="absolute left-1/2 w-[min(38vw,150px)] -translate-x-1/2"
      style={{ bottom: '24vh' }}
      initial={
        motionSafe ? { y: '-70vh', rotate: -12, opacity: 1 } : { y: 0, opacity: 0 }
      }
      animate={
        motionSafe
          ? {
              y: 0,
              rotate: 0,
              scaleX: [1, 1.18, 0.94, 1],
              scaleY: [1, 0.78, 1.09, 1],
              opacity: open ? 0.35 : 1,
            }
          : { y: 0, opacity: open ? 0.35 : 1 }
      }
      transition={
        motionSafe
          ? {
              y: { duration: 1.4, ease: [0.55, 0, 1, 1] },
              rotate: { duration: 1.4, ease: 'linear' },
              scaleX: { delay: 1.4, duration: 0.42, times: [0, 0.2, 0.55, 1] },
              scaleY: { delay: 1.4, duration: 0.42, times: [0, 0.2, 0.55, 1] },
              opacity: { duration: duration.slower },
            }
          : { duration: duration.base }
      }
    >
      <svg viewBox="0 0 120 110" className="h-auto w-full" role="presentation">
        <rect
          x="10"
          y="42"
          width="100"
          height="60"
          rx="10"
          fill="var(--color-pink)"
          stroke="#111111"
          strokeWidth="3"
        />
        {/* The lid blows off at the burst. */}
        <motion.g
          animate={
            open && motionSafe
              ? { y: -46, rotate: -22, opacity: 0 }
              : { y: 0, rotate: 0, opacity: open ? 0 : 1 }
          }
          transition={{ duration: 0.5, ease: easing.exit }}
        >
          <rect
            x="4"
            y="28"
            width="112"
            height="22"
            rx="8"
            fill="var(--color-pink-light)"
            stroke="#111111"
            strokeWidth="3"
          />
        </motion.g>
        <rect x="52" y="42" width="16" height="60" fill="var(--color-yellow)" />
        <rect
          x="52"
          y="42"
          width="16"
          height="60"
          fill="none"
          stroke="#111111"
          strokeWidth="3"
        />
        {/* The box gets eyes for a beat before it opens. */}
        {!open && (
          <>
            <circle cx="40" cy="70" r="4" fill="#111111" />
            <circle cx="80" cy="70" r="4" fill="#111111" />
            <ellipse
              cx="30"
              cy="78"
              rx="6"
              ry="4"
              fill="var(--color-pink)"
              opacity="0.3"
            />
            <ellipse
              cx="90"
              cy="78"
              rx="6"
              ry="4"
              fill="var(--color-pink)"
              opacity="0.3"
            />
          </>
        )}
      </svg>
    </motion.div>
  );
}

const HEADS = ['var(--color-pink)', 'var(--color-yellow)', 'var(--color-pink-press)'];

function Tulip({ hue }: { readonly hue: number }): React.ReactElement {
  return (
    <svg viewBox="0 0 40 90" className="h-[22vh] w-auto" role="presentation">
      <path
        d="M20 90 L20 40"
        stroke="#111111"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 66 Q6 60 4 46 Q18 46 20 62 Z"
        fill="var(--color-green)"
        stroke="#111111"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M6 34 Q6 12 20 6 Q34 12 34 34 Q27 42 20 42 Q13 42 6 34 Z"
        fill={HEADS[hue % HEADS.length]}
        stroke="#111111"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M20 6 L20 40"
        stroke="#111111"
        strokeWidth="2.5"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}
