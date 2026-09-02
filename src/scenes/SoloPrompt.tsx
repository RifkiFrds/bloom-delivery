'use client';

/**
 * `SOLO_PROMPT` — Doc 04 §B.7, Doc 02 §2.10.
 *
 * ── THE MOST LIKELY FIRST OPEN ───────────────────────────────────────────
 * She opens the link on a bus, alone. This screen turns that from a broken
 * website into anticipation. It is worth far more than its size suggests.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── TONE RULE ────────────────────────────────────────────────────────────
 * An invitation, never a refusal. No lock icons, no "denied", no greyed-out
 * imagery, no red.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A PARTNER ARRIVING ALWAYS WINS: detection keeps running underneath, and
 * `FACES_ACQUIRED` fires from beneath this screen straight to
 * `TOGETHER_CONFIRMED` with no tap needed.
 *
 * "Peek alone" is a real, respected choice — the box falls and the tulips
 * bloom — but the message and the letter stay sealed behind a warm hold on
 * `RESTING`. It is not a punishment; it is the difference between a preview and
 * the thing itself.
 */

import { Button } from '@/components/ui/Button';
import { CameraStage } from '@/components/CameraStage';
import { SOLO } from '@/content/copy';
import { detectionRuntime } from '@/detection/runtime';
import { bus } from '@/events/bus';
import { selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function SoloPrompt(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);

  return (
    <CameraStage dim={0.4}>
      <div className="w-full rounded-[28px] border-3 border-ink bg-white p-6 text-center shadow-[8px_8px_0_#111111]">
        <p aria-hidden="true" className="text-3xl">
          🌷
        </p>
        <h2 className="mt-2 font-display text-[clamp(1.375rem,5vw,1.875rem)] leading-[1.2]">
          {SOLO.title}
        </h2>
        <p className="mt-2 text-[clamp(1.0625rem,4vw,1.25rem)] leading-[1.55]">
          {SOLO.body}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            size="lg"
            block
            autoFocus
            motionSafe={motionSafe}
            onClick={() => {
              // The solo accumulator restarts; the latch buffers do not, so a
              // partner arriving is still caught by the same 8-of-10 window.
              detectionRuntime.resetSolo();
              bus.emit({ type: 'WAIT_FOR_PARTNER' });
            }}
          >
            {SOLO.wait}
          </Button>
          <Button
            variant="secondary"
            size="md"
            block
            motionSafe={motionSafe}
            onClick={() => {
              bus.emit({ type: 'PEEK_ALONE' });
            }}
          >
            {SOLO.peek}
          </Button>
        </div>
      </div>
    </CameraStage>
  );
}
