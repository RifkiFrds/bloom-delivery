'use client';

/**
 * Scene 6 — `TOGETHER_CONFIRMED`. Doc 04 §B.8, Doc 02 §2.11.
 *
 * ── TWO PURPOSES, NEITHER DISCLOSED ──────────────────────────────────────
 * A 1.2 s reward beat — and the load buffer that guarantees the hand model is
 * ready. It extends to 5 s while the 7.5 MB download finishes, with the copy
 * swapping to "Warming up the magic ✨" and the confetti settling into an idle
 * sparkle. The user reads a celebration; the system is finishing a download.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Past 5 s with no hand model, `canSeekGesture` can never be satisfied, so the
 * escape hatch is surfaced rather than leaving the user on a beat that will not
 * end. The face stage already succeeded — they are never sent backwards
 * (Doc 01 §7.5).
 */

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { audio } from '@/audio/manager';
import { Button } from '@/components/ui/Button';
import { CameraStage } from '@/components/CameraStage';
import { ESCAPE, TOGETHER } from '@/content/copy';
import { BEATS_TOGETHER_MAX_MS } from '@/machine/timing';
import { bus } from '@/events/bus';
import { resolveSpring } from '@/motion/tokens';
import { selectContext, selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function TogetherConfirmed(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const { handModelReady } = useMachineStore(selectContext);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    audio.play('sting');
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setStalled(true);
    }, BEATS_TOGETHER_MAX_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  const waiting = !handModelReady;

  return (
    <CameraStage>
      <div className="flex w-full flex-col items-center gap-5 text-center">
        {motionSafe && !waiting && <Confetti />}

        <motion.h2
          initial={motionSafe ? { scale: 0 } : { opacity: 0 }}
          // Single target, not keyframes — a spring cannot run a keyframe array
          // and would leave the headline at `scale: 0`. `spring.pop` overshoots
          // to ~1.15 by itself.
          animate={motionSafe ? { scale: 1 } : { opacity: 1 }}
          transition={resolveSpring('pop', motionSafe)}
          className="rounded-[28px] border-3 border-ink bg-white px-6 py-4 font-display text-[clamp(1.75rem,7vw,2.5rem)] leading-[1.15] shadow-[6px_6px_0_#111111]"
        >
          {waiting ? TOGETHER.waiting : TOGETHER.title}
        </motion.h2>

        {stalled && waiting && (
          <div className="w-full">
            <Button
              variant="gift"
              size="lg"
              block
              motionSafe={motionSafe}
              onClick={() => {
                bus.emit({ type: 'MERCY_UNLOCK' });
              }}
            >
              <span aria-hidden="true">🎁</span> {ESCAPE.liteEntry}
            </Button>
          </div>
        )}
      </div>
    </CameraStage>
  );
}

/**
 * ~24 chunky outlined shapes, gravity-free, fading over 700 ms.
 *
 * Removed entirely under reduced motion — the headline carries the beat on its
 * own, and confetti is decoration rather than content (Doc 04 §C.5).
 */
function Confetti(): React.ReactElement {
  const pieces = Array.from({ length: 24 }, (_, index) => index);
  const palette = ['var(--color-pink)', 'var(--color-yellow)', 'var(--color-green)'];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {pieces.map((index) => {
        const angle = (index / pieces.length) * Math.PI * 2;
        const distance = 90 + (index % 5) * 22;
        return (
          <motion.span
            key={index}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              opacity: 0,
              rotate: index % 2 === 0 ? 180 : -180,
            }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 top-1/2 block h-3 w-3 rounded-[3px] border-2 border-ink"
            style={{ backgroundColor: palette[index % palette.length] }}
          />
        );
      })}
    </div>
  );
}
