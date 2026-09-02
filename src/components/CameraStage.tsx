'use client';

/**
 * The shared camera stage — Doc 04 §B.5. Used by Scenes 4 through 7.
 *
 * ── THE MIRROR RULE, IN ONE PLACE ────────────────────────────────────────
 * The preview is ALWAYS mirrored (`scaleX(-1)`), because an un-mirrored selfie
 * view is disorienting and people cannot aim their hands in it.
 *
 * INFERENCE RUNS ON THE RAW, UNMIRRORED FRAME — MediaPipe reads the `<video>`
 * element, not the composited pixels — and the overlay canvas applies the SAME
 * mirror as the video. A mismatch between those two transforms is the classic
 * debug bug in this kind of work, so both live here and nowhere else
 * (Doc 03 §2.2).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The preview LETTERBOXES with `--cream` rather than cropping. A face partly
 * hidden behind a notch is a detection failure the user cannot diagnose
 * (Doc 04 §E.4).
 *
 * The `<video>` is `aria-hidden` with a sibling text description: a live feed
 * of the user has no meaningful static alternative, and every state derived
 * from it is announced as text instead (Doc 04 §F.6).
 */

import { useEffect, useRef } from 'react';

import { cameraRuntime } from '@/detection/camera/runtime';
import { SEEKING_FACES } from '@/content/copy';

export interface CameraStageProps {
  /** Drawn over the preview, inside the mirrored space. */
  readonly overlay?: React.ReactNode;
  /** The progress ring, drawn on the frame border. Not mirrored. */
  readonly ring?: React.ReactNode;
  /**
   * Chrome pinned inside the frame but OUTSIDE the mirror — status pills and
   * anything carrying text. Mirrored text is unreadable, so it cannot live in
   * `overlay`.
   */
  readonly chrome?: React.ReactNode;
  /** Coaching HUD, below the preview. Always an opaque card, never over video. */
  readonly hud?: React.ReactNode;
  /** Escape hatch and other bottom-anchored chrome. */
  readonly footer?: React.ReactNode;
  /** Overlaid content that is NOT mirrored — loaders, prompts, dim layers. */
  readonly children?: React.ReactNode;
  /** 0–1 dim applied over the preview (SOLO_PROMPT dims to 0.4). */
  readonly dim?: number;
}

export function CameraStage({
  overlay,
  ring,
  chrome,
  hud,
  footer,
  children,
  dim = 0,
}: CameraStageProps): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    cameraRuntime.bindVideo(videoRef.current);
    return () => {
      // Do NOT stop the stream here: unmounting the stage happens on every
      // scene swap, and the teardown belongs exclusively to UNLOCKING.
      cameraRuntime.bindVideo(null);
    };
  }, []);

  return (
    // ── THE CAMERA IS THE HERO ───────────────────────────────────────────
    // The preview claims every pixel between the mute toggle and the coaching
    // card: `flex-1` with `min-h-0` rather than a fixed `aspect-[3/4]`, which
    // previously left most of a tall phone empty below the frame.
    //
    // Gutters drop from 20 px to 12 px and the column cap rises 560 → 660 px,
    // about 18% more visual width, which is where the hands actually are.
    <div className="flex min-h-[100dvh] w-full flex-col items-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-[660px] flex-1 flex-col gap-3">
        <div className="relative mt-14 min-h-[46dvh] w-full flex-1 overflow-hidden rounded-[40px] border-3 border-ink bg-cream shadow-[8px_8px_0_#111111]">
          <video
            ref={videoRef}
            aria-hidden="true"
            playsInline
            muted
            autoPlay
            className="h-full w-full scale-x-[-1] object-cover"
          />

          {/* Same mirror as the video. One transform, applied twice, on purpose. */}
          {overlay !== undefined && (
            <div className="pointer-events-none absolute inset-0 scale-x-[-1]">
              {overlay}
            </div>
          )}

          {dim > 0 && (
            <div
              className="pointer-events-none absolute inset-0 bg-ink"
              style={{ opacity: dim }}
            />
          )}

          {ring}
          {chrome}

          {children !== undefined && (
            <div className="absolute inset-0 flex items-center justify-center p-5">
              {children}
            </div>
          )}
        </div>

        {/* The text alternative for the preview. */}
        <p className="sr-only">{SEEKING_FACES.videoDescription}</p>

        {hud}

        <div className="mt-auto flex flex-col gap-2 pt-2">{footer}</div>
      </div>
    </div>
  );
}
