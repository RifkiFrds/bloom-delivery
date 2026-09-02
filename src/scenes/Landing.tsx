'use client';

/**
 * Scene 1 — `LANDING`. Doc 04 §B.2, Doc 02 §2.3.
 *
 * ── THE CRITICAL INTERACTION ─────────────────────────────────────────────
 * The Start handler emits `START_TAPPED`, which the reducer turns into the
 * `audio.unlock` effect — dispatched synchronously, inside this click handler,
 * before anything else. See `audio/unlock.ts` for why that matters 45 seconds
 * later.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The ringer-switch line is load-bearing copy, not decoration: Web Audio in
 * Safari respects the physical mute switch and this cannot be worked around.
 * Saying so converts a silent run from a bug into an understood condition.
 */

import { motion } from 'motion/react';

import { Button } from '@/components/ui/Button';
import { SceneShell } from '@/components/SceneShell';
import { LANDING } from '@/content/copy';
import { bus } from '@/events/bus';
import { duration, easing, resolveSpring } from '@/motion/tokens';
import { selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function Landing(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);

  return (
    <SceneShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <HeroBox motionSafe={motionSafe} />

        <div>
          <h1 className="font-display text-[clamp(2.25rem,9vw,4rem)] leading-[1.05]">
            {LANDING.title}
          </h1>
          <p className="mt-2 text-[clamp(1.0625rem,4vw,1.25rem)] leading-[1.55]">
            {LANDING.subtitle}
          </p>
        </div>

        <Button
          size="xl"
          block
          breathing
          motionSafe={motionSafe}
          autoFocus
          onClick={() => {
            bus.emit({ type: 'START_TAPPED' });
          }}
        >
          {LANDING.cta} <span aria-hidden="true">✨</span>
        </Button>

        <div className="text-[0.875rem] leading-[1.45]">
          <p>{LANDING.sound}</p>
          <p>{LANDING.twoPeople}</p>
        </div>
      </div>
    </SceneShell>
  );
}

/**
 * The gift box with eyes. Authored as inline SVG rather than an asset: it is
 * ~1 KB, it inherits the token palette, and it costs no network request on the
 * screen whose LCP budget is the tightest in the project (Doc 01 §8.3).
 */
function HeroBox({ motionSafe }: { readonly motionSafe: boolean }): React.ReactElement {
  return (
    <motion.div
      aria-hidden="true"
      initial={motionSafe ? { scale: 0.7, y: 40, opacity: 0 } : { opacity: 0 }}
      animate={
        motionSafe
          ? { scale: 1, y: [0, -10, 0], opacity: 1, rotate: [-3, 3, -3] }
          : { scale: 1, y: 0, opacity: 1 }
      }
      transition={
        motionSafe
          ? {
              scale: { ...resolveSpring('bouncy', true), delay: 0.08 },
              opacity: { duration: duration.base },
              y: { duration: 3.4, repeat: Infinity, ease: easing.sine },
              rotate: { duration: 3.4, repeat: Infinity, ease: easing.sine },
            }
          : { duration: duration.base * 0.6 }
      }
      className="w-[min(62vw,240px)]"
    >
      <svg viewBox="0 0 120 110" className="h-auto w-full" role="presentation">
        {/* body */}
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
        {/* lid */}
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
        {/* ribbon */}
        <rect x="52" y="28" width="16" height="74" fill="var(--color-yellow)" />
        <rect
          x="52"
          y="28"
          width="16"
          height="74"
          fill="none"
          stroke="#111111"
          strokeWidth="3"
        />
        {/* bow */}
        <path
          d="M60 28 C 44 10, 24 14, 34 26 C 40 33, 54 30, 60 28 Z"
          fill="var(--color-yellow)"
          stroke="#111111"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M60 28 C 76 10, 96 14, 86 26 C 80 33, 66 30, 60 28 Z"
          fill="var(--color-yellow)"
          stroke="#111111"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* face */}
        <circle cx="40" cy="70" r="4" fill="#111111" />
        <circle cx="80" cy="70" r="4" fill="#111111" />
        <ellipse cx="30" cy="78" rx="6" ry="4" fill="var(--color-pink)" opacity="0.3" />
        <ellipse cx="90" cy="78" rx="6" ry="4" fill="var(--color-pink)" opacity="0.3" />
        <path
          d="M52 80 Q60 87 68 80"
          fill="none"
          stroke="#111111"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}
