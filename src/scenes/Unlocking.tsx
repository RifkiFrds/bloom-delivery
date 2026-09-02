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
import { CapturedMoment } from '@/components/CapturedMoment';
import { UnlockBurst } from '@/components/UnlockBurst';
import { UnlockStamp } from '@/components/UnlockStamp';
import { UNLOCK } from '@/content/copy';
import { alert } from '@/lib/live';
import { duration, easing } from '@/motion/tokens';
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
      {/* Their faces at the instant the heart landed. See the component for
          why this is a frozen frame and not a live camera. */}
      <CapturedMoment />
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

      {/*
        Rays, shockwave, petal burst and the tulip horizon. Behind the stamp and
        in front of the darken, so the stamp lands ON the burst rather than
        beside it. See the component for why this is Canvas 2D and not a
        library.
      */}
      <UnlockBurst motionSafe={motionSafe} />

      <UnlockStamp motionSafe={motionSafe} />

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
