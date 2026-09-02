'use client';

/**
 * `CAMERA_INTERRUPTED` — Doc 04 §B.18, Doc 02 §2.14.
 *
 * A phone call, an app switch, a revoked track.
 *
 * ── THE MERCY TIMERS ARE PAUSED HERE ─────────────────────────────────────
 * A phone call must not cost the user their patience budget. The pause happens
 * in the transition's effects; this screen exists only to offer the way back.
 * On recovery the machine returns to EXACTLY the previous state, with the hold
 * progress and the mercy level intact.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `TRACK_ENDED` has already been auto-retried once by the camera runtime before
 * this screen is reached at all (Doc 01 §9.5 principle 3).
 */

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SceneShell } from '@/components/SceneShell';
import { ESCAPE, GESTURE, INTERRUPTED } from '@/content/copy';
import { cameraRuntime } from '@/detection/camera/runtime';
import { bus } from '@/events/bus';
import { selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function CameraInterrupted(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const capped = cameraRuntime.isCapped();

  return (
    <SceneShell
      heading={INTERRUPTED.title}
      headingLevel={2}
      announcement={`${INTERRUPTED.title}. ${INTERRUPTED.body}`}
    >
      <div className="mt-6 flex flex-1 flex-col gap-6">
        <Card motionSafe={motionSafe}>
          <p aria-hidden="true" className="text-3xl">
            ⏸
          </p>
          <p className="mt-3 text-[clamp(1.0625rem,4vw,1.25rem)] leading-[1.55]">
            {capped ? GESTURE.cameraRest : INTERRUPTED.body}
          </p>
        </Card>

        <div className="mt-auto flex flex-col gap-3">
          {/*
            Past the 120 s cap the camera is off for good, so there is no
            Resume to offer. A button that silently does nothing is worse than
            no button — the same rule that governs the iOS denial screen
            (Doc 04 §B.9, §B.16).
          */}
          {!capped && (
            <Button
              size="lg"
              block
              autoFocus
              motionSafe={motionSafe}
              onClick={() => {
                // The stream is gone, so `TRACK_RECOVERED` cannot be emitted
                // here — there is nothing recovered yet. `reacquire()` emits it
                // itself once a new stream actually arrives, and emits nothing
                // if it fails, leaving the escape hatch as the way forward.
                if (cameraRuntime.hasStream()) {
                  bus.emit({ type: 'TRACK_RECOVERED' });
                  return;
                }
                cameraRuntime.reacquire();
              }}
            >
              {INTERRUPTED.cta}
            </Button>
          )}
          <Button
            // Past the cap this is the ONLY way forward, so it becomes the
            // primary action rather than the secondary one.
            variant={capped ? 'gift' : 'secondary'}
            size={capped ? 'lg' : 'md'}
            block
            autoFocus={capped}
            motionSafe={motionSafe}
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
