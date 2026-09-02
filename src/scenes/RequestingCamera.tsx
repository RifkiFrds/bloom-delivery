'use client';

/**
 * Scene 3 — `REQUESTING_CAMERA`. Doc 04 §B.4, Doc 02 §2.5.
 *
 * ── WHERE THE PROMPT ACTUALLY COMES FROM ─────────────────────────────────
 * `getUserMedia` was already called by the `camera.acquire` effect, dispatched
 * synchronously inside the Pre-flight "I'm ready" tap. That is the only
 * arrangement that satisfies iOS Safari's user-activation requirement — by the
 * time this component mounts, the activation window has closed.
 *
 * The **[ Allow camera ]** button is therefore a SECOND-CHANCE affordance, not
 * the primary trigger: some in-app WebViews swallow the first call silently. It
 * is disabled while a request is in flight so it can never produce a second
 * concurrent prompt.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Spinner-free by design. While the promise is pending the character's eyes
 * widen and hold — an alive state rather than a loading state. The CTA sits in
 * the lower third so the native prompt (top on Android, centre on iOS) never
 * covers the thing that just triggered it.
 */

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { SceneShell } from '@/components/SceneShell';
import { ESCAPE, PERMISSION } from '@/content/copy';
import { cameraRuntime } from '@/detection/camera/runtime';
import { bus } from '@/events/bus';
import { duration, easing } from '@/motion/tokens';
import { selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function RequestingCamera(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const [pending, setPending] = useState(cameraRuntime.isRequesting());

  // One poll at a human rate, not a subscription: this is a two-state boolean
  // that changes at most twice, and it must not become a render source.
  useEffect(() => {
    const id = window.setInterval(() => {
      setPending(cameraRuntime.isRequesting());
    }, 400);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  return (
    <SceneShell heading={PERMISSION.title} announcement={PERMISSION.announcement}>
      <div className="flex flex-1 flex-col items-center gap-6 text-center">
        <CameraCharacter motionSafe={motionSafe} alert={pending} />
        <p className="text-[clamp(1.0625rem,4vw,1.25rem)] leading-[1.55]">
          {PERMISSION.body}
        </p>

        <div className="mt-auto flex w-full flex-col gap-3">
          <Button
            size="xl"
            block
            breathing={!pending}
            motionSafe={motionSafe}
            disabled={pending}
            onClick={() => {
              cameraRuntime.acquire();
              setPending(true);
            }}
          >
            {PERMISSION.cta}
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            block
            onClick={() => {
              bus.emit({ type: 'SKIP_TO_LETTER' });
            }}
          >
            {ESCAPE.toLetter}
          </Button>
        </div>
      </div>
    </SceneShell>
  );
}

function CameraCharacter({
  motionSafe,
  alert,
}: {
  readonly motionSafe: boolean;
  readonly alert: boolean;
}): React.ReactElement {
  return (
    <motion.div
      aria-hidden="true"
      className="w-[min(52vw,200px)]"
      animate={motionSafe ? { rotate: [-4, 4, -4] } : { rotate: 0 }}
      transition={
        motionSafe
          ? { duration: 2.6, repeat: Infinity, ease: easing.sine }
          : { duration: duration.fast }
      }
    >
      <svg viewBox="0 0 120 96" className="h-auto w-full" role="presentation">
        <rect
          x="8"
          y="22"
          width="104"
          height="66"
          rx="14"
          fill="var(--color-pink-light)"
          stroke="#111111"
          strokeWidth="3"
        />
        <path
          d="M38 22 L46 10 H74 L82 22 Z"
          fill="var(--color-pink-light)"
          stroke="#111111"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle
          cx="60"
          cy="55"
          r="22"
          fill="var(--color-cream)"
          stroke="#111111"
          strokeWidth="3"
        />
        {/* Eyes widen while the prompt is pending: alive, not loading. */}
        <circle cx="52" cy="52" r={alert ? 6 : 4} fill="#111111" />
        <circle cx="68" cy="52" r={alert ? 6 : 4} fill="#111111" />
        <path
          d="M52 66 Q60 72 68 66"
          fill="none"
          stroke="#111111"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx="98"
          cy="34"
          r="5"
          fill="var(--color-yellow)"
          stroke="#111111"
          strokeWidth="3"
        />
      </svg>
    </motion.div>
  );
}
