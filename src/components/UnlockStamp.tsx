'use client';

/**
 * The stamp — "DELIVERY UNLOCKED", landing one letter at a time.
 *
 * ── WHY PER-LETTER AND NOT ONE SCALE-IN ──────────────────────────────────
 * A card that scales in is a card arriving. Letters that land one after another
 * with their own overshoot are an EVENT — it is the whole difference between a
 * toast notification and a Nintendo item-get, which is the reference the art
 * direction names.
 *
 * Doc 04 §C.4 rule 5: "stagger everything countable, 40–120 ms between
 * siblings. Never simultaneous." Sixteen characters at 34 ms is 540 ms of
 * arrival — long enough to read as choreography, short enough to stay inside
 * the 2.2 s beat.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── THE ACCESSIBILITY COST, PAID ─────────────────────────────────────────
 * Splitting text into per-character spans makes some screen readers announce it
 * letter by letter, or not at all. So the split version is `aria-hidden` and a
 * single readable copy sits beside it. The unlock is also announced through the
 * assertive live region by the scene, so the words arrive intact either way.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Under reduced motion the whole thing is one opacity fade at scale 1: no
 * stagger, no overshoot, no shine. Content preserved, motion removed.
 */

import { motion } from 'motion/react';

import { UNLOCK } from '@/content/copy';
import { duration, easing, resolveSpring } from '@/motion/tokens';

const STAGGER_S = 0.034;
/** After the shake and the bloom have had the stage (Doc 04 §B.11). */
const LEAD_IN_S = 0.7;

export interface UnlockStampProps {
  readonly motionSafe: boolean;
}

export function UnlockStamp({ motionSafe }: UnlockStampProps): React.ReactElement {
  // `Array.from`, not a spread or `split('')`: it iterates CODE POINTS, so a
  // translated stamp with an emoji or a non-Latin script does not come apart
  // into broken surrogate halves. `Intl.Segmenter` would also handle grapheme
  // clusters, but it is absent on the iOS 15.0–16.3 devices this supports as
  // Tier 2, and a stamp is not worth a capability branch.
  const characters = Array.from(UNLOCK.stamp);

  return (
    <motion.div
      // One shake for the whole card — ≤ 350 ms, ≤ 8 px, stepped, and removed
      // entirely under reduced motion (Doc 04 §C.6).
      animate={motionSafe ? { x: [0, -8, 6, -4, 2, 0] } : { x: 0 }}
      transition={{ duration: 0.35, delay: 0.15, ease: 'linear' }}
      className="relative"
    >
      <motion.h2
        initial={motionSafe ? { scale: 0.94, rotate: -8 } : { opacity: 0 }}
        animate={motionSafe ? { scale: 1, rotate: 2 } : { opacity: 1 }}
        transition={{
          ...resolveSpring('pop', motionSafe),
          delay: motionSafe ? LEAD_IN_S : 0,
        }}
        className={[
          'relative overflow-hidden rounded-[28px] border-3 border-ink bg-yellow',
          'px-7 py-5 text-center font-display leading-[1.1] shadow-[8px_8px_0_#111111]',
          'text-[clamp(1.5rem,7vw,2.5rem)]',
        ].join(' ')}
      >
        {/* The readable copy. */}
        <span className="sr-only">{UNLOCK.stamp}</span>

        <span aria-hidden="true" className="inline-block whitespace-nowrap">
          {characters.map((character, index) => (
            <motion.span
              key={`${character}-${String(index)}`}
              initial={
                motionSafe
                  ? { y: '-70%', scale: 1.6, opacity: 0, rotate: -12 }
                  : { opacity: 1 }
              }
              animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
              transition={{
                ...resolveSpring('bouncy', motionSafe),
                delay: motionSafe ? LEAD_IN_S + 0.12 + index * STAGGER_S : 0,
              }}
              className="inline-block"
            >
              {/* A space collapses in an inline-block, so it needs a body. */}
              {character === ' ' ? ' ' : character}
            </motion.span>
          ))}
        </span>

        {/* The shine. ONE pass, after the last letter lands.

            `transform` only — Doc 01 §5.3 forbids animating `filter` or
            `box-shadow` over the canvas, because both force a full-screen
            recomposite on mobile Safari. A translated gradient does not. */}
        {motionSafe && (
          <motion.span
            aria-hidden="true"
            initial={{ x: '-140%' }}
            animate={{ x: '140%' }}
            transition={{
              duration: duration.slower,
              delay: LEAD_IN_S + 0.12 + characters.length * STAGGER_S + 0.1,
              ease: easing.standard,
            }}
            className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/45"
          />
        )}
      </motion.h2>
    </motion.div>
  );
}
