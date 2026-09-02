'use client';

/**
 * The coaching HUD — Doc 04 §B.9, §F.1, §F.4.
 *
 * ── IT NEVER RE-RENDERS ──────────────────────────────────────────────────
 * The coaching state changes at up to 15 Hz. This component reads the ref in
 * its own rAF and writes `textContent` directly. React commits once, on mount,
 * and never again for the life of the gesture stage.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The card is an OPAQUE `--cream` surface, always. Text over live video can
 * never guarantee contrast and is prohibited (Doc 04 §F.1) — which is why the
 * HUD sits below the preview rather than on it.
 *
 * `ALMOST` gets the strongest treatment of any state: a `--yellow` fill and a
 * pulse. It is the only feedback that tells the user their gesture is working,
 * and in measured completion rate it is worth more than the other seven states
 * combined.
 */

import { useRef } from 'react';

import { COACHING, MERCY_COPY } from '@/content/copy';
import type { CoachingState } from '@/detection/types';
import { announce } from '@/lib/live';
import { useDetectionFrame } from './useDetectionFrame';

export interface CoachingHUDProps {
  /** Mercy level, so the IDLE line can warm as the ladder escalates. */
  readonly mercyLevel: 0 | 1 | 2 | 3;
  /** Face stage shows a fixed line under some states; gesture stage does not. */
  readonly fallback?: string;
}

export function CoachingHUD({
  mercyLevel,
  fallback,
}: CoachingHUDProps): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const lastState = useRef<CoachingState | null>(null);

  useDetectionFrame((snapshot) => {
    const state = snapshot.coaching;
    if (state === lastState.current) return;
    lastState.current = state;

    const text = copyFor(state, mercyLevel, fallback);
    const node = textRef.current;
    if (node !== null) node.textContent = text;

    const card = cardRef.current;
    if (card !== null) {
      // Class swap rather than a style write: the `ALMOST` treatment is two
      // token changes, and keeping them in CSS keeps the palette in the theme.
      card.dataset.tone = state === 'ALMOST' ? 'almost' : 'normal';
    }

    // Mirrored to the polite region, where `lib/live` applies the mandatory
    // 1.5 s debounce. An unthrottled 15 Hz live region is unusable.
    if (text !== '') announce(text);
  });

  return (
    <div
      ref={cardRef}
      data-tone="normal"
      className={[
        'coach-card rounded-[28px] border-3 border-ink px-5 py-4 text-center',
        'shadow-[4px_4px_0_#111111]',
      ].join(' ')}
    >
      <p ref={textRef} className="font-display text-[17px] leading-[1.4]">
        {copyFor('IDLE', mercyLevel, fallback)}
      </p>
    </div>
  );
}

/**
 * `HOLDING` is deliberately silent — the ring is the message, and swapping text
 * mid-charge competes with it (Doc 04 §B.9, priority 7).
 *
 * `IDLE` warms with the mercy level rather than repeating one instruction the
 * user has already failed to act on.
 */
function copyFor(
  state: CoachingState,
  mercyLevel: 0 | 1 | 2 | 3,
  fallback: string | undefined,
): string {
  if (state === 'HOLDING') return '';
  if (state === 'IDLE') return fallback ?? MERCY_COPY[mercyLevel];
  return COACHING[state];
}
