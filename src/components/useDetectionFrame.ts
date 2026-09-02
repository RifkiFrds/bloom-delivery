'use client';

/**
 * ★ THE READ SIDE OF THE REF ★ — Doc 01 §6.3, Doc 05 P3.5.
 *
 * The detection loop writes `detectionRef` at 15 Hz. This hook reads it inside
 * its OWN `requestAnimationFrame` and hands the values to a callback that
 * writes them straight into DOM properties.
 *
 * ── WHY A CALLBACK AND NOT STATE ─────────────────────────────────────────
 * Returning the snapshot as React state would make every consumer re-render at
 * 15 Hz, which is the exact defect the ref exists to prevent — it would just
 * move the violation one layer up. So the callback receives the snapshot and is
 * expected to mutate refs, styles and attributes directly. No component using
 * this hook re-renders as a result of detection.
 *
 * The ≤ 2 re-renders/second budget is therefore a property of the architecture,
 * not of reviewer discipline.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The rAF is cancelled on unmount, and it never runs while the tab is hidden —
 * that is free, and it is why rAF is used rather than an interval.
 */

import { useEffect, useRef } from 'react';

import { detectionRef, type DetectionSnapshot } from '@/detection/ref';

export type FrameReader = (snapshot: DetectionSnapshot, nowMs: number) => void;

export function useDetectionFrame(read: FrameReader): void {
  // Held in a ref so a changed callback identity does not restart the loop —
  // restarting an rAF on every parent render would defeat the point.
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    let handle = 0;

    const pump = (nowMs: number): void => {
      handle = requestAnimationFrame(pump);
      readRef.current(detectionRef, nowMs);
    };

    handle = requestAnimationFrame(pump);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, []);
}

/**
 * Frame-rate-independent lerp toward a target.
 *
 * Used by the progress ring: a ~60 ms approach smooths the 15 Hz staircase
 * without lagging behind real progress. It must NOT be a spring — a spring can
 * still be filling after the unlock has already fired, which reads as the ring
 * being decorative rather than truthful (Doc 04 §B.10).
 */
export function approach(
  current: number,
  target: number,
  dtMs: number,
  timeConstantMs = 60,
): number {
  if (timeConstantMs <= 0) return target;
  const alpha = 1 - Math.exp(-dtMs / timeConstantMs);
  return current + (target - current) * alpha;
}
