'use client';

/**
 * Scene 5 — `SEEKING_FACES`. Doc 04 §B.6, Doc 02 §2.9.
 *
 * Prove togetherness. Once.
 *
 * ── THE GATE ─────────────────────────────────────────────────────────────
 * `count(faceValid) >= 2` — NOT `== 2` — in ≥ 8 of the last 10 ticks. A poster,
 * a TV, a mirror or a passer-by adding a third face must not CLOSE the gate.
 * Requiring exactly two would turn a benign environmental accident into an
 * unexplainable failure in a room the user cannot easily change.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── THE ESCAPE HATCH EXISTS FROM HERE, NOT FROM THE GESTURE STAGE ────────
 * It is rendered into the DOM and keyboard-focusable from the moment the camera
 * is live, though it belongs to the gesture stage. Keyboard and screen-reader
 * users must never be trapped behind a gesture they cannot perform, and "from
 * t=0" means from the first camera-bearing state (Doc 02 §2.9 E5).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * This component renders ONCE. Every live value reaches the DOM through the
 * detection rAF.
 */

import { CameraStage } from '@/components/CameraStage';
import { CoachingHUD } from '@/components/CoachingHUD';
import { EscapeHatch } from '@/components/EscapeHatch';
import { PersonChips } from '@/components/FramingGuide';
import { TrackingOverlay } from '@/components/TrackingOverlay';
import { selectMotionSafe, useMachineStore } from '@/store/machineStore';
import { SEEKING_FACES } from '@/content/copy';

export function SeekingFaces(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);

  return (
    <CameraStage
      // ── NO FRAMING RETICLES ────────────────────────────────────────────
      // Doc 04 §B.6 specifies two reticles as framing guidance. They were
      // removed: with masks tracking the faces and a ring tracking the hands,
      // two static rounded rectangles are the only thing on screen that does
      // NOT respond to the user, and they read as leftover debug chrome.
      //
      // The job they did — "stand where the camera can see you" — is now done
      // better by the masks themselves, which only appear when a face is
      // actually found. The person chips below still report the count.
      // ───────────────────────────────────────────────────────────────────
      overlay={<TrackingOverlay motionSafe={motionSafe} />}
      hud={
        <div className="flex flex-col gap-3">
          <PersonChips />
          <CoachingHUD mercyLevel={0} fallback="Stand together 💕" />
        </div>
      }
      footer={<EscapeHatch mercyLevel={0} />}
    >
      <h1 className="sr-only">{SEEKING_FACES.title}</h1>
    </CameraStage>
  );
}
