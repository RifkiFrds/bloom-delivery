'use client';

/**
 * The realtime status pill — Doc 04 §A.6, §F.1.
 *
 * ── AN OPAQUE CARD, NEVER TEXT ON VIDEO ──────────────────────────────────
 * Doc 04 §F.1: "Coaching copy over the camera preview always sits inside an
 * opaque `--cream` card. Text over live video can never guarantee contrast and
 * must never be attempted." So this floats OVER the preview but is itself
 * opaque, bordered and shadowed — a chunky sticker, not an overlay caption.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── IT IS `aria-hidden`, AND THAT IS DELIBERATE ──────────────────────────
 * `CoachingHUD` already mirrors the coaching state into the polite live region
 * with the mandatory 1.5 s debounce. Two components announcing overlapping
 * descriptions of the same thing would talk over each other and make the app
 * unusable with a screen reader. This pill is the VISUAL channel; the HUD keeps
 * the accessibility contract.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Updates at 60 Hz by writing `textContent` and one data attribute. React
 * commits once, on mount.
 */

import { useRef } from 'react';

import { STATUS } from '@/content/copy';
import { CLOSENESS } from '@/detection/config';
import { useDetectionFrame } from './useDetectionFrame';

type StatusKey = 'searching' | 'oneHand' | 'twoHands' | 'almost' | 'complete';

const EMOJI: Readonly<Record<StatusKey, string>> = {
  searching: '👀',
  oneHand: '🫱',
  twoHands: '🫱🫲',
  almost: '💗',
  complete: '❤️',
};

export function DetectionStatusCard(): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const last = useRef<StatusKey | null>(null);

  useDetectionFrame((snapshot) => {
    const key = statusFor(snapshot.handCount, snapshot.closeness, snapshot.holdProgress);
    if (key === last.current) return;
    last.current = key;

    if (textRef.current !== null) textRef.current.textContent = STATUS[key];
    if (iconRef.current !== null) iconRef.current.textContent = EMOJI[key];
    if (cardRef.current !== null) cardRef.current.dataset.state = key;
  });

  return (
    <div
      ref={cardRef}
      aria-hidden="true"
      data-state="searching"
      className="status-pill pointer-events-none absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[20px] border-3 border-ink px-4 py-2 shadow-[4px_4px_0_#111111]"
    >
      <span ref={iconRef} className="text-[17px] leading-none">
        {EMOJI.searching}
      </span>
      <span ref={textRef} className="font-display text-[15px] leading-none">
        {STATUS.searching}
      </span>
    </div>
  );
}

/**
 * PURE, and reading only values the detection ref already publishes for the UI.
 *
 * `closeness` is explicitly a UI-only scalar (Doc 03 §6.5) — it must never gate
 * a transition, and it does not here. This is the display it exists for.
 */
export function statusFor(
  handCount: number,
  closeness: number,
  holdProgress: number,
): StatusKey {
  if (holdProgress >= 1) return 'complete';
  if (closeness >= CLOSENESS.almostThreshold) return 'almost';
  if (handCount >= 2) return 'twoHands';
  if (handCount === 1) return 'oneHand';
  return 'searching';
}
