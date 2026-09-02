'use client';

/**
 * Scene 12 — `LETTER_CLOSED` and `LETTER_OPEN`. Doc 04 §B.14, Doc 02 §2.19–2.20.
 *
 * ── THE POINT OF THE ENTIRE PROJECT ──────────────────────────────────────
 * The letter is REAL, SELECTABLE, SCREEN-READABLE DOM TEXT. Never an image,
 * never canvas, never a background. It can be copied, translated, zoomed to
 * 200% and read aloud, because a letter that cannot be re-read is not a letter.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The paper is `min(92vw, 440px)` with `max-height: 62dvh`, internal scroll and
 * `overscroll-behavior: contain`, so it is readable at 375 px AND at 200% zoom
 * with no horizontal page scroll — a Phase 7 exit criterion. It SHRINKS, it
 * never truncates.
 *
 * On open, focus moves into the article and the reveal plays. Under reduced
 * motion the three-beat 3D unfold becomes a crossfade and the paragraphs appear
 * together — the content is identical, only the motion is removed.
 */

import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';

import { audio } from '@/audio/manager';
import { MuteToggle } from '@/components/MuteToggle';
import { Button } from '@/components/ui/Button';
import { LETTER, MESSAGE } from '@/content/copy';
import { letterParagraphs, LETTER_SIGNATURE } from '@/content/letter';
import { bus } from '@/events/bus';
import { announce } from '@/lib/live';
import { duration, easing, resolveSpring } from '@/motion/tokens';
import { BEATS_LETTER_SETTLE_MS } from '@/machine/timing';
import { selectContext, selectMotionSafe, useMachineStore } from '@/store/machineStore';
import { Stage } from './Stage';

export function LetterClosed(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const { recipientName } = useMachineStore(selectContext);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      <MuteToggle />
      <Stage beat="bloom" dim={0.35} />

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h2 className="font-display text-[clamp(1.125rem,4.5vw,1.5rem)]">
          {MESSAGE.prefix} {recipientName}{' '}
          <span aria-hidden="true">{MESSAGE.suffix}</span>
        </h2>

        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <Envelope motionSafe={motionSafe} />
          <Button
            size="xl"
            autoFocus
            breathing
            motionSafe={motionSafe}
            onClick={() => {
              bus.emit({ type: 'LETTER_OPEN_TAPPED' });
            }}
          >
            {LETTER.openCta}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Envelope({ motionSafe }: { readonly motionSafe: boolean }): React.ReactElement {
  return (
    <motion.div
      role="img"
      aria-label={LETTER.closedLabel}
      className="w-[min(70vw,280px)]"
      initial={motionSafe ? { y: -40, scale: 0.8, opacity: 0 } : { opacity: 0 }}
      animate={
        motionSafe
          ? { y: [0, -4, 0], scale: 1, opacity: 1 }
          : { y: 0, scale: 1, opacity: 1 }
      }
      transition={
        motionSafe
          ? {
              scale: resolveSpring('bouncy', true),
              opacity: { duration: duration.base },
              y: { duration: 2.8, repeat: Infinity, ease: easing.sine },
            }
          : { duration: duration.base * 0.6 }
      }
    >
      <svg viewBox="0 0 200 130" className="h-auto w-full" role="presentation">
        <rect
          x="4"
          y="20"
          width="192"
          height="106"
          rx="12"
          fill="var(--color-white)"
          stroke="#111111"
          strokeWidth="3"
        />
        <path
          d="M4 32 L100 88 L196 32"
          fill="var(--color-cream)"
          stroke="#111111"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle
          cx="100"
          cy="74"
          r="17"
          fill="var(--color-pink)"
          stroke="#111111"
          strokeWidth="3"
        />
        <path
          d="M100 82 C 92 76, 88 72, 88 68 C 88 65, 90 63, 93 63 C 96 63, 98 65, 100 68 C 102 65, 104 63, 107 63 C 110 63, 112 65, 112 68 C 112 72, 108 76, 100 82 Z"
          fill="var(--color-white)"
          stroke="#111111"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}

export function LetterOpen(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const { recipientName } = useMachineStore(selectContext);
  const articleRef = useRef<HTMLElement>(null);
  const paragraphs = letterParagraphs();

  // Focus moves INTO the letter, and the article is announced once. The text
  // itself is real DOM, so a screen reader reads it from here without any
  // additional announcement (Doc 04 §B.14).
  useEffect(() => {
    articleRef.current?.focus();
    announce(`A letter for ${recipientName}.`);
    // The wax seal pops off at t=0; the paper slides out from t=300 ms.
    audio.play('pop');
    const paper = window.setTimeout(() => {
      audio.play('page');
    }, 300);
    return () => {
      window.clearTimeout(paper);
    };
  }, [recipientName]);

  // The settle beat. The letter is NOT removed when it fires — `RESTING` keeps
  // it on screen and adds the actions beneath, so a slow reader is never
  // interrupted (Doc 02 §2.20 timers, §2.21).
  useEffect(() => {
    const id = window.setTimeout(() => {
      bus.emit({ type: 'SEQUENCE_STEP_DONE' });
    }, BEATS_LETTER_SETTLE_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      <MuteToggle />
      <Stage beat="bloom" dim={0.45} />

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h2
          id="letter-heading"
          className="font-display text-[clamp(1.125rem,4.5vw,1.5rem)]"
        >
          {MESSAGE.prefix} {recipientName}{' '}
          <span aria-hidden="true">{MESSAGE.suffix}</span>
        </h2>

        <div className="flex flex-1 items-center justify-center py-6">
          <LetterPaper ref={articleRef} paragraphs={paragraphs} motionSafe={motionSafe} />
        </div>
      </div>
    </div>
  );
}

interface LetterPaperProps {
  readonly paragraphs: readonly string[];
  readonly motionSafe: boolean;
  readonly ref?: React.Ref<HTMLElement>;
}

/**
 * The paper. Exported so `RESTING` renders the SAME component — the letter does
 * not change appearance when the machine moves on, which is what lets the
 * settle timer fire without anything being taken away from the reader.
 */
export function LetterPaper({
  paragraphs,
  motionSafe,
  ref,
}: LetterPaperProps): React.ReactElement {
  return (
    <motion.article
      ref={ref}
      tabIndex={-1}
      role="article"
      aria-labelledby="letter-heading"
      initial={motionSafe ? { scaleY: 0.55, opacity: 0 } : { opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={
        motionSafe
          ? { ...resolveSpring('gentle', true), delay: 0.3 }
          : { duration: duration.base * 0.6 }
      }
      style={{ transformOrigin: 'top center' }}
      className={[
        'letter-paper w-[min(92vw,440px)] max-h-[62dvh] overflow-y-auto',
        'rounded-[28px] border-3 border-ink bg-white px-7 py-7 shadow-[8px_8px_0_#111111]',
        'outline-none',
      ].join(' ')}
    >
      {paragraphs.map((paragraph, index) => (
        <motion.p
          key={paragraph.slice(0, 24)}
          initial={motionSafe ? { y: 10, opacity: 0 } : { opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: duration.slow,
            // 120 ms stagger under full motion; all together under reduced.
            delay: motionSafe ? 0.6 + index * 0.12 : 0.1,
          }}
          className="mb-4 text-[1.0625rem] leading-[1.7] last:mb-0"
        >
          {paragraph}
        </motion.p>
      ))}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: duration.slow,
          delay: motionSafe ? 0.6 + paragraphs.length * 0.12 : 0.1,
        }}
        className="mt-6 text-right font-display text-[1.0625rem]"
      >
        {LETTER_SIGNATURE}
      </motion.p>
    </motion.article>
  );
}
