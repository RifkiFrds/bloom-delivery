'use client';

/**
 * Scene 8 — `UNLOCKING`. Doc 04 §B.11, Doc 02 §2.15.
 *
 * The teardown boundary, disguised as the transaction beat. ~2.2 s.
 * NON-INTERRUPTIBLE — there is no skip, and interruptibility here would undercut
 * both the payoff and the teardown.
 *
 * ── THE TEARDOWN ALREADY HAPPENED ────────────────────────────────────────
 * By the time this component mounts, the `camera.teardown` effect has run: the
 * frame was captured, the rAF cancelled, every track stopped, both MediaPipe
 * tasks closed, and the assertion recorded. THE CAMERA INDICATOR LIGHT IS
 * ALREADY OUT.
 *
 * That ordering is deliberate. The teardown is an effect of the TRANSITION, not
 * of the mount, so it cannot be delayed by a slow first paint or skipped by a
 * render that throws.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── PHOTOSENSITIVITY IS SPECIFIED, NOT INTERPRETED ───────────────────────
 * ONE 400 ms radial bloom. Not a strobe. The shake is capped at 350 ms and 8 px.
 * No full-screen luminance change greater than 10% at a rate above 3 Hz. Both
 * the shake and the bloom are removed ENTIRELY under reduced motion, replaced by
 * an instant crossfade (Doc 04 §C.6).
 * ─────────────────────────────────────────────────────────────────────────
 */

import { motion } from 'motion/react';
import { useEffect } from 'react';

import { audio } from '@/audio/manager';
import { UNLOCK } from '@/content/copy';
import { alert } from '@/lib/live';
import { duration, easing, resolveSpring } from '@/motion/tokens';
import { selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function Unlocking(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);

  useEffect(() => {
    alert(UNLOCK.announcement);
    audio.stopCharge();
    // t = 300 ms in the unlock beat table (Doc 04 §B.11).
    const id = window.setTimeout(() => {
      audio.play('thud');
    }, 300);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden">
      {/* The 35% darken. Instant under reduced motion. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        transition={{ duration: motionSafe ? 0.3 : 0 }}
      />

      {/* ONE radial bloom, 400 ms. Removed entirely under reduced motion. */}
      {motionSafe && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, var(--color-yellow) 0%, transparent 60%)',
          }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.55, 0], scale: [0.4, 1.6, 1.8] }}
          transition={{ duration: 0.4, delay: 0.4, ease: easing.entrance }}
        />
      )}

      {/* The stamp. Scale 0 → 1.25 → 1, rotate −8° → 2°. */}
      <motion.div
        // One shake, ≤ 350 ms, ≤ 8 px, stepped. Never under reduced motion.
        animate={motionSafe ? { x: [0, -8, 6, -4, 2, 0] } : { x: 0 }}
        transition={{ duration: 0.35, delay: 0.15, ease: 'linear' }}
        className="relative"
      >
        <motion.h2
          initial={motionSafe ? { scale: 0, rotate: -8 } : { opacity: 0, rotate: 0 }}
          // A single target, not a keyframe array: Framer Motion cannot run
          // keyframes on a spring, and the pair silently leaves the element at
          // its initial value — which here meant `scale: 0`, an invisible
          // stamp. `spring.pop` produces the 1.25 overshoot on its own, which
          // is what the beat table is describing anyway (Doc 04 §B.11).
          animate={motionSafe ? { scale: 1, rotate: 2 } : { opacity: 1, scale: 1 }}
          transition={{
            ...resolveSpring('pop', motionSafe),
            delay: motionSafe ? 0.7 : 0,
          }}
          className="rounded-[28px] border-3 border-ink bg-yellow px-7 py-5 text-center font-display text-[clamp(1.5rem,7vw,2.5rem)] leading-[1.1] shadow-[8px_8px_0_#111111]"
        >
          {UNLOCK.stamp}
        </motion.h2>
      </motion.div>

      {/* The Phase B stage mounts behind this layer and cross-dissolves in. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cream"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: motionSafe ? duration.scene : duration.base,
          delay: motionSafe ? 1.6 : 0.4,
        }}
      />
    </div>
  );
}
