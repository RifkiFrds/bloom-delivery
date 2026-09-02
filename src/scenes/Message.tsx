'use client';

/**
 * Scene 11 — `MESSAGE`. Doc 04 §B.13, Doc 02 §2.18.
 *
 * Name the recipient. ~4 s.
 *
 * ── THE NAME IS A TEXT NODE. ALWAYS. ─────────────────────────────────────
 * `recipientName` was sanitized in `BOOT` by a five-line Unicode-aware regex,
 * capped at 24 characters. It is rendered here as JSX text — never `innerHTML`,
 * never `dangerouslySetInnerHTML`. React escapes it, and there is no code path
 * in this file that could bypass that.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The type NEVER truncates. Long names shrink and wrap onto their own line;
 * an ellipsis in the middle of someone's name is the worst possible outcome for
 * a screen whose entire job is to say their name properly (Doc 04 §B.13).
 *
 * Reduced motion: OPACITY ONLY. No overshoot.
 */

import { motion } from 'motion/react';

import { MuteToggle } from '@/components/MuteToggle';
import { MESSAGE } from '@/content/copy';
import { resolveSpring } from '@/motion/tokens';
import { selectContext, selectMotionSafe, useMachineStore } from '@/store/machineStore';
import { Stage } from './Stage';

export function Message(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const { recipientName, peekedAlone, hasUnlocked } = useMachineStore(selectContext);

  // A returning pair who peeked alone the first time get one extra line, so the
  // real unlock is acknowledged as different from the preview (Doc 04 §B.7).
  const returning = peekedAlone && hasUnlocked;

  const long = recipientName.length > 10;

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      <MuteToggle />
      <Stage beat="bloom" dim={0.55} />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-5">
        <motion.h2
          initial={motionSafe ? { scale: 1.15, opacity: 0 } : { opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={resolveSpring('pop', motionSafe)}
          className="text-center font-display leading-[1.1]"
          style={{ fontSize: 'clamp(2rem, 11vw, 3.5rem)' }}
        >
          {MESSAGE.prefix}
          {long ? <br /> : ' '}
          {recipientName} <span aria-hidden="true">{MESSAGE.suffix}</span>
        </motion.h2>
      </div>

      {returning && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: motionSafe ? 1.4 : 0.4 }}
          className="absolute inset-x-0 bottom-[18vh] z-10 text-center text-[clamp(1.0625rem,4vw,1.25rem)]"
        >
          {MESSAGE.returning}
        </motion.p>
      )}
    </div>
  );
}
