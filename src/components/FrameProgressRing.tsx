'use client';

/**
 * The frame progress ring — Doc 04 §B.9, §B.10.
 *
 * ── IT TRACES THE CAMERA FRAME'S OWN BORDER ──────────────────────────────
 * Not a separate circle beside the preview. Making the frame itself the
 * charging object is what turns "a progress indicator is filling" into "the
 * thing we are looking through is powering up".
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── IT MUST NOT BE A SPRING ──────────────────────────────────────────────
 * Driven directly from `ref.holdProgress`, read in this component's own rAF and
 * eased with a ~60 ms exponential approach. A Framer Motion spring lags real
 * state and can still be filling AFTER the unlock has fired, which reads as the
 * ring being decorative rather than truthful.
 *
 * A 60 ms approach smooths the 15 Hz staircase without ever overshooting or
 * finishing late.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `aria-valuenow` is throttled to 10% increments. Per-tick updates would flood
 * a screen reader with 15 announcements per second (Doc 04 §B.10).
 */

import { useRef } from 'react';

import { audio } from '@/audio/manager';
import { GESTURE } from '@/content/copy';
import { HOLD } from '@/detection/config';
import { vibrate } from '@/lib/platform';
import { approach, useDetectionFrame } from './useDetectionFrame';

/** Perimeter of the rounded rect in the SVG's own units. Computed once. */
const RING_W = 100;
const RING_H = 133;
const RING_R = 8;
const PERIMETER =
  2 * (RING_W - 2 * RING_R) + 2 * (RING_H - 2 * RING_R) + 2 * Math.PI * RING_R;

export interface FrameProgressRingProps {
  readonly motionSafe: boolean;
}

export function FrameProgressRing({
  motionSafe,
}: FrameProgressRingProps): React.ReactElement {
  const strokeRef = useRef<SVGRectElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const eased = useRef(0);
  const lastFrameAt = useRef(0);
  const lastAnnounced = useRef(-1);
  const hapticsFired = useRef<boolean[]>(HOLD.hapticAt.map(() => false));

  useDetectionFrame((snapshot, nowMs) => {
    const dtMs = lastFrameAt.current === 0 ? 16 : nowMs - lastFrameAt.current;
    lastFrameAt.current = nowMs;

    const target = Math.max(0, Math.min(1, snapshot.holdProgress));
    // Reduced motion fills as a plain stroke with no easing — the value still
    // conveys state, which is why the ring is RETAINED rather than removed.
    eased.current = motionSafe ? approach(eased.current, target, dtMs) : target;

    const node = strokeRef.current;
    if (node !== null) {
      node.style.strokeDashoffset = String(PERIMETER * (1 - eased.current));
      node.style.opacity = eased.current > 0.005 ? '1' : '0';
    }

    // Haptic taps at 33% and 66%, once each per charge (Doc 04 §B.10).
    if (motionSafe) {
      HOLD.hapticAt.forEach((mark, index) => {
        if (target >= mark && hapticsFired.current[index] !== true) {
          hapticsFired.current[index] = true;
          vibrate(12);
        }
      });
      if (target <= 0.01) hapticsFired.current = HOLD.hapticAt.map(() => false);
    }

    // The charge tone follows the same value as the ring, so sound and image
    // can never disagree about how far along the hold is (Doc 04 §B.10).
    if (target > 0.01) {
      audio.startCharge();
      audio.setChargeProgress(target);
    } else {
      audio.stopCharge();
    }

    const decile = Math.round(target * 10) * 10;
    if (decile !== lastAnnounced.current) {
      lastAnnounced.current = decile;
      liveRef.current?.setAttribute('aria-valuenow', String(decile));
    }
  });

  return (
    <>
      <svg
        viewBox={`0 0 ${String(RING_W)} ${String(RING_H)}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <rect
          ref={strokeRef}
          x="1.5"
          y="1.5"
          width={RING_W - 3}
          height={RING_H - 3}
          rx={RING_R}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{
            strokeDasharray: PERIMETER,
            strokeDashoffset: PERIMETER,
            opacity: 0,
            // Rotate the dash origin to the top of the frame.
            transform: 'rotate(0deg)',
            transformOrigin: 'center',
          }}
        />
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-pink)" />
            <stop offset="100%" stopColor="var(--color-yellow)" />
          </linearGradient>
        </defs>
      </svg>

      <div
        ref={liveRef}
        role="progressbar"
        aria-label={GESTURE.ringLabel}
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={100}
        className="sr-only"
      />
    </>
  );
}
