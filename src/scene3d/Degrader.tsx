'use client';

/**
 * The degradation ladder — Doc 01 §8.6, Doc 04 §B.12, Doc 05 P6.8.
 *
 * ── ONE-WAY. IT NEVER CLIMBS BACK. ───────────────────────────────────────
 *   median < 45 fps  →  dpr 1.0
 *   median < 34 fps  →  petals 300 → 150, OUTLINE PASS OFF
 *   median < 26 fps  →  tulips 60 → 24, petals → 60, freeze ambient drift
 *   median < 20 fps for 3 s  →  DEGRADE_TO_LITE
 *
 * Oscillation is worse than a slightly conservative setting: a scene that
 * flickers between two quality levels reads as broken, whereas one that settles
 * a rung low reads as normal. So the ladder only ever descends.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Driven by a rolling MEDIAN over a 2 s window, not a mean — one 400 ms stall
 * during the box impact must not drop a rung on an otherwise healthy device.
 *
 * The frame samples live in a pre-allocated ring buffer, and the median is
 * computed at most twice per second rather than every frame.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useRef } from 'react';

import { bus } from '@/events/bus';
import { record } from '@/lib/diagnostics';

export type QualityRung = 0 | 1 | 2 | 3;

export interface Quality {
  readonly dpr: number;
  readonly tulips: number;
  readonly petals: number;
  readonly outlines: boolean;
  readonly frozen: boolean;
}

export const QUALITY: Readonly<Record<QualityRung, Quality>> = {
  0: { dpr: 1.5, tulips: 60, petals: 300, outlines: true, frozen: false },
  1: { dpr: 1.0, tulips: 60, petals: 300, outlines: true, frozen: false },
  2: { dpr: 1.0, tulips: 60, petals: 150, outlines: false, frozen: false },
  3: { dpr: 1.0, tulips: 24, petals: 60, outlines: false, frozen: true },
};

const WINDOW_MS = 2000;
const SAMPLE_CAPACITY = 180;
const EVALUATE_EVERY_MS = 500;
/** How long the median must stay under 20 fps before cutting to Lite. */
const LITE_DWELL_MS = 3000;

export interface DegraderProps {
  readonly onRung: (rung: QualityRung) => void;
}

export function Degrader({ onRung }: DegraderProps): null {
  const { setDpr } = useThree((state) => ({ setDpr: state.setDpr }));

  const samples = useRef(new Float32Array(SAMPLE_CAPACITY));
  const stamps = useRef(new Float64Array(SAMPLE_CAPACITY));
  const cursor = useRef(0);
  const filled = useRef(0);
  const lastEvaluatedAt = useRef(0);
  const rung = useRef<QualityRung>(0);
  const belowLiteSince = useRef<number | null>(null);

  const descend = useCallback(
    (next: QualityRung): void => {
      if (next <= rung.current) return;
      rung.current = next;
      const quality = QUALITY[next];
      setDpr(quality.dpr);
      record(
        `degrader: rung ${String(next)} — dpr ${String(quality.dpr)}, tulips ${String(
          quality.tulips,
        )}, petals ${String(quality.petals)}, outlines ${String(quality.outlines)}`,
      );
      onRung(next);
    },
    [onRung, setDpr],
  );

  useFrame((_, delta) => {
    const now = performance.now();
    const fps = delta > 0 ? 1 / delta : 0;

    samples.current[cursor.current] = fps;
    stamps.current[cursor.current] = now;
    cursor.current = (cursor.current + 1) % SAMPLE_CAPACITY;
    if (filled.current < SAMPLE_CAPACITY) filled.current += 1;

    if (now - lastEvaluatedAt.current < EVALUATE_EVERY_MS) return;
    lastEvaluatedAt.current = now;

    const median = medianWithin(samples.current, stamps.current, filled.current, now);
    if (median === null) return;

    if (median < 20) {
      belowLiteSince.current ??= now;
      if (now - belowLiteSince.current >= LITE_DWELL_MS) {
        record(`degrader: median ${median.toFixed(1)} fps for 3 s — cutting to Lite`);
        bus.emit({ type: 'DEGRADE_TO_LITE' });
        belowLiteSince.current = null;
        return;
      }
    } else {
      belowLiteSince.current = null;
    }

    if (median < 26) descend(3);
    else if (median < 34) descend(2);
    else if (median < 45) descend(1);
  });

  return null;
}

/**
 * Median of the samples inside the trailing window.
 *
 * Copies into a fixed scratch array rather than allocating — this runs twice a
 * second during the most GPU-bound part of the experience.
 */
const scratch = new Float32Array(SAMPLE_CAPACITY);

function medianWithin(
  values: Float32Array,
  times: Float64Array,
  filled: number,
  now: number,
): number | null {
  let count = 0;
  for (let i = 0; i < filled; i += 1) {
    const stamp = times[i] ?? 0;
    if (now - stamp > WINDOW_MS) continue;
    scratch[count] = values[i] ?? 0;
    count += 1;
  }
  if (count < 10) return null;

  const view = scratch.subarray(0, count);
  view.sort();
  const middle = count >> 1;
  return count % 2 === 0
    ? ((view[middle - 1] ?? 0) + (view[middle] ?? 0)) / 2
    : (view[middle] ?? 0);
}
