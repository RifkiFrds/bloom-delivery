'use client';

/**
 * The moment, kept — a polaroid in the corner through the whole sequence.
 *
 * ── WHY THIS IS A FROZEN FRAME AND NOT A LIVE PREVIEW ────────────────────
 * A live camera here would break the one rule the whole architecture is built
 * on: Phase A (camera + MediaPipe) and Phase B (WebGL) NEVER coexist, and
 * `UNLOCKING` is the teardown boundary (Doc 01 §2.1). Keeping the stream alive
 * past it would cost three things at once:
 *
 *   · the camera indicator light staying ON through the payoff, which is the
 *     visible proof behind "your camera stays on your phone"
 *   · the heap drop after teardown — a Phase 5 exit criterion
 *   · the thermal headroom the split exists to protect, on the exact screen
 *     that is running the most GPU work in the product
 *
 * So this shows `capturedFrame` — the still grabbed at the instant the heart
 * landed, which the teardown already takes for "Save our photo".
 *
 * That is also the better picture. A live feed would show two people watching a
 * box fall. This is their faces at the moment they succeeded, which is the
 * expression worth keeping.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Absent on the Lite path, where there was never a camera to capture from. No
 * placeholder, no empty frame — the corner is simply clear.
 */

import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { cameraRuntime } from '@/detection/camera/runtime';
import { resolveSpring } from '@/motion/tokens';
import { selectContext, selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function CapturedMoment(): React.ReactElement | null {
  const motionSafe = useMachineStore(selectMotionSafe);
  const { recipientName } = useMachineStore(selectContext);
  const hostRef = useRef<HTMLDivElement>(null);
  const [frame] = useState(() => cameraRuntime.frame());

  useEffect(() => {
    const host = hostRef.current;
    if (host === null || frame === null) return;

    // The canvas is reused, not copied into an <img>: `toDataURL` on a 720p
    // frame is a multi-megabyte string built on the main thread, during the
    // busiest two seconds in the product.
    frame.className = 'moment-frame';
    host.appendChild(frame);
    return () => {
      if (frame.parentElement === host) host.removeChild(frame);
    };
  }, [frame]);

  if (frame === null) return null;

  return (
    <motion.figure
      aria-label={`A photo of the two of you, taken the moment the heart landed. For ${recipientName}.`}
      initial={motionSafe ? { scale: 0.4, opacity: 0, rotate: -14 } : { opacity: 0 }}
      animate={{ scale: 1, opacity: 1, rotate: -4 }}
      transition={{
        ...resolveSpring('bouncy', motionSafe),
        // After the stamp has landed, so it reads as a consequence of the
        // unlock rather than as another thing arriving at the same time.
        delay: motionSafe ? 1.1 : 0.3,
      }}
      className={[
        'pointer-events-none fixed z-40',
        'right-[max(1rem,env(safe-area-inset-right))] top-[max(5.5rem,calc(env(safe-area-inset-top)+5rem))]',
        'w-[clamp(104px,24vw,168px)]',
        'rounded-[18px] border-3 border-ink bg-white p-2 pb-6 shadow-[6px_6px_0_#111111]',
      ].join(' ')}
    >
      {/* The polaroid window. */}
      <div
        ref={hostRef}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px] border-2 border-ink bg-cream"
      />

      <figcaption className="absolute inset-x-0 bottom-1 text-center font-display text-[10px] leading-none">
        {recipientName} <span aria-hidden="true">🌷</span>
      </figcaption>

      {/* A piece of tape, because a polaroid taped to the corner reads as kept
          rather than as rendered. */}
      <span
        aria-hidden="true"
        className="absolute -top-3 left-1/2 h-5 w-12 -translate-x-1/2 rotate-[-6deg] rounded-[3px] border-2 border-ink bg-yellow/80"
      />
    </motion.figure>
  );
}
