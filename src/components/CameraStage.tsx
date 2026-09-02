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
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The `<video>` is created and owned by the camera runtime, and MOVED into
    // this host. It is not JSX, because every Phase A scene mounts its own
    // `CameraStage` and a JSX element would be replaced on each transition —
    // which is exactly how the preview went blank after `LOADING_DETECTION`.
    //
    // There is no cleanup: the element outlives this component on purpose, and
    // the teardown belongs exclusively to `UNLOCKING`.
    cameraRuntime.mountVideo(hostRef.current);
  }, []);

  return (
    // ── THE CAMERA IS THE HERO ───────────────────────────────────────────
    // The preview claims every pixel between the mute toggle and the coaching
    // card: `flex-1` with `min-h-0` rather than a fixed `aspect-[3/4]`, which
    // previously left most of a tall phone empty below the frame.
    //
    // Gutters drop from 20 px to 12 px, and the column grows with the viewport
    // instead of stopping at a fixed cap.
    //
    // Doc 04 §E.1 caps the desktop camera stage at 720 px in "a decorative
    // bordered frame". That reads as a deliberate frame on a wide monitor and
    // as wasted space on a laptop, where the hands are then small enough that
    // the palm-scale gate starts to matter. `min(96vw, 1120px)` keeps the phone
    // layout byte for byte identical — 96vw is smaller than the cap at every
    // phone width — and lets the desktop stage fill the room it has.
    <div className="flex h-[100dvh] w-full flex-col items-center overflow-hidden px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-[min(96vw,1120px)] min-h-0 flex-1 flex-col gap-2">
        {/*
          `h-[100dvh]` with `min-h-0` on the column, not `min-h-[100dvh]`.
          A min-height lets children push the page TALLER than the viewport, so
          `flex-1` on the preview resolved against content instead of against
          the screen and left the bottom short. A fixed height plus `min-h-0`
          makes the preview take every pixel the HUD and the hatch do not.
        */}
        <div className="relative mt-12 min-h-0 w-full flex-1 overflow-hidden rounded-[40px] border-3 border-ink bg-cream shadow-[8px_8px_0_#111111]">
          {/* The runtime's persistent <video> is appended here. */}
          <div ref={hostRef} className="absolute inset-0" />

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

        <div className="shrink-0">{hud}</div>

        <div className="flex shrink-0 flex-col gap-2">{footer}</div>
      </div>
    </div>
  );
}
