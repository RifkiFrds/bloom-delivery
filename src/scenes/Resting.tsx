'use client';

/**
 * Scene 13 — `RESTING`. Doc 04 §B.15, Doc 02 §2.21.
 *
 * An ending, a memory, and a second viewing. v1 had none of these.
 *
 * ── THE LETTER STAYS ON SCREEN ───────────────────────────────────────────
 * `LETTER_OPEN` advances here on a settle timer. If arriving here REMOVED the
 * letter, that timer would close a letter someone is still reading — which is
 * the worst possible failure in the one screen the whole project exists for.
 *
 * So `RESTING` renders the SAME `LetterPaper` component and adds the three
 * actions beneath it. The machine advances and persists the unlock flag; the
 * reader loses nothing. "Read again" replays the reveal from the top.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── THE CAMERA IS NEVER RE-REQUESTED ─────────────────────────────────────
 * "Replay the moment" re-enters `UNLOCKING` with `skipCameraStage = true`, and
 * every teardown step becomes a no-op. There is no path from here back to
 * `getUserMedia` (Doc 02 §2.21).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Idle cost is a HARD budget: `frameloop="demand"`, under 5% GPU. This state is
 * indefinite, and a phone left on it must not get warm.
 */

import { useEffect, useState } from 'react';

import { MuteToggle } from '@/components/MuteToggle';
import { Button } from '@/components/ui/Button';
import { MESSAGE, RESTING } from '@/content/copy';
import { letterParagraphs } from '@/content/letter';
import { cameraRuntime } from '@/detection/camera/runtime';
import { bus } from '@/events/bus';
import { announce } from '@/lib/live';
import { composePhoto, downloadPhoto } from '@/lib/photo';
import { selectContext, selectMotionSafe, useMachineStore } from '@/store/machineStore';
import { LetterPaper } from './Letter';
import { Stage } from './Stage';

export function Resting(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const { recipientName, unlockedByPeek } = useMachineStore(selectContext);
  const [savedFrame] = useState(() => cameraRuntime.frame());

  useEffect(() => {
    announce(RESTING.announcement);
  }, []);

  // Peek-alone hold: the box fell and the tulips bloomed, but the letter is
  // still for when they are together. A warm hold, never a refusal.
  //
  // Keyed on THIS run, not on the persisted history. The previous condition —
  // `peekedAlone && !hasUnlocked` — was true for any returning visitor who had
  // ever peeked, because `hasUnlocked` is a per-session latch that a reload
  // resets. They came back to their own finished letter and were shown the hold
  // instead, with a "Try again with them" button that reloaded straight into
  // the same screen.
  const holding = unlockedByPeek;

  const savePhoto = (): void => {
    if (savedFrame === null) return;
    const composite = composePhoto({ frame: savedFrame, recipientName });
    if (composite === null) return;
    downloadPhoto(composite, `bloom-delivery-${recipientName.replace(/\s+/g, '-')}.png`);
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      <MuteToggle />
      <Stage beat="bloom" dim={0.45} />

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center gap-5 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h2
          id="letter-heading"
          className="font-display text-[clamp(1.125rem,4.5vw,1.5rem)]"
        >
          {MESSAGE.prefix} {recipientName}{' '}
          <span aria-hidden="true">{MESSAGE.suffix}</span>
        </h2>

        {holding ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <p className="rounded-[28px] border-3 border-ink bg-white px-6 py-5 text-[clamp(1.0625rem,4vw,1.25rem)] leading-[1.55] shadow-[6px_6px_0_#111111]">
              {RESTING.peekHold}
            </p>
            <Button
              size="lg"
              autoFocus
              motionSafe={motionSafe}
              onClick={() => {
                window.location.reload();
              }}
            >
              {RESTING.peekRetry}
            </Button>
          </div>
        ) : (
          <>
            <LetterPaper paragraphs={letterParagraphs()} motionSafe={motionSafe} />

            <div className="flex w-full max-w-[440px] flex-col gap-3">
              <Button
                variant="secondary"
                size="lg"
                block
                motionSafe={motionSafe}
                onClick={() => {
                  bus.emit({ type: 'READ_AGAIN_TAPPED' });
                }}
              >
                {RESTING.readAgain}
              </Button>

              <Button
                variant="secondary"
                size="lg"
                block
                motionSafe={motionSafe}
                onClick={() => {
                  bus.emit({ type: 'REPLAY_TAPPED' });
                }}
              >
                {RESTING.replay}
              </Button>

              {/* Offered only when there is a frame. Lite runs have none, and a
                  button that produces a broken file is worse than no button. */}
              {savedFrame !== null && (
                <Button
                  variant="secondary"
                  size="lg"
                  block
                  motionSafe={motionSafe}
                  onClick={() => {
                    bus.emit({ type: 'SAVE_PHOTO_TAPPED' });
                    savePhoto();
                  }}
                >
                  {RESTING.savePhoto}
                </Button>
              )}
            </div>

            <p className="pb-2 text-[0.875rem]">{RESTING.colophon}</p>
          </>
        )}
      </div>
    </div>
  );
}
