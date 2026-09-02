'use client';

/**
 * Scenes 7a and 7b — `SEEKING_GESTURE` and `GESTURE_HOLDING`.
 * Doc 04 §B.9, §B.10, Doc 02 §2.12, §2.13.
 *
 * ── ONE COMPONENT FOR TWO STATES, DELIBERATELY ───────────────────────────
 * `GESTURE_HOLDING` is not a different screen. It is the SAME screen with the
 * ring filling. Splitting it into two components would unmount and remount the
 * camera stage on every `GESTURE_ENTER` / `GESTURE_EXIT` edge — which at the
 * boundary is several times per second, and would tear down the `<video>`
 * element the detection loop is reading from.
 *
 * The ring reads `holdProgress` from the ref, so it is already correct in both
 * states without the FSM telling it anything.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── THE GATE IS NEVER A WALL ─────────────────────────────────────────────
 * Detection keeps running at every mercy level. If the heart lands at t = 100 s
 * it still wins, and the sequence is identical. The ladder adds alternatives and
 * warms the coaching; it never withdraws the intended moment.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { useEffect } from 'react';

import { CameraStage } from '@/components/CameraStage';
import { CoachingHUD } from '@/components/CoachingHUD';
import { DetectionStatusCard } from '@/components/DetectionStatusCard';
import { EscapeHatch } from '@/components/EscapeHatch';
import { FrameProgressRing } from '@/components/FrameProgressRing';
import { GestureDiagram } from '@/components/GestureDiagram';
import { TrackingOverlay } from '@/components/TrackingOverlay';
import { MERCY_COPY } from '@/content/copy';
import { detectionRuntime } from '@/detection/runtime';
import { selectContext, selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function SeekingGesture(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const { mercyLevel } = useMachineStore(selectContext);

  // The FSM owns the mercy level; the detection runtime needs it for the
  // multiplier and the confidence relaxation. Three writes per session at most.
  useEffect(() => {
    detectionRuntime.setMercyLevel(mercyLevel);
  }, [mercyLevel]);

  // Tripod Mode: a propped phone frees both hands, so the finger heart becomes
  // the natural pose and G2 is accepted at every level (Doc 04 §E.3).
  useEffect(() => {
    const evaluate = (): void => {
      const landscape = window.innerWidth > window.innerHeight;
      const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
      detectionRuntime.setTripodMode(landscape && phone);
    };
    evaluate();
    window.addEventListener('resize', evaluate);
    window.visualViewport?.addEventListener('resize', evaluate);
    return () => {
      window.removeEventListener('resize', evaluate);
      window.visualViewport?.removeEventListener('resize', evaluate);
    };
  }, []);

  return (
    <CameraStage
      ring={<FrameProgressRing motionSafe={motionSafe} />}
      overlay={
        // Mirrored with the video: the landmarks must sit on the hands, and the
        // diagram's left hand must be on the user's left as they see themselves.
        <>
          <TrackingOverlay motionSafe={motionSafe} />
          <div className="flex h-full w-full items-end justify-center pb-4 opacity-80">
            <GestureDiagram motionSafe={motionSafe} />
          </div>
        </>
      }
      // Outside the mirror — the pill carries text.
      chrome={<DetectionStatusCard />}
      hud={<CoachingHUD mercyLevel={mercyLevel} />}
      footer={<EscapeHatch mercyLevel={mercyLevel} />}
    >
      <h1 className="sr-only">{MERCY_COPY[mercyLevel]}</h1>
    </CameraStage>
  );
}
