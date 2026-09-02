'use client';

/**
 * Scene 4 — `LOADING_DETECTION`. Doc 04 §B.5, Doc 02 §2.8.
 *
 * ── REAL PROGRESS, NOT A FAKE BAR ────────────────────────────────────────
 * The percentage is the actual byte progress of the face-model download, read
 * from the prefetch accounting. A fake progress bar that hits 90% and waits is
 * the single most common way a loading screen loses trust, and this screen sits
 * directly before the part of the experience that most needs it.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * BLOCKS ON 230 KB, NEVER ON 7.5 MB. The hand model keeps downloading behind
 * this screen, the whole face stage, and the `TOGETHER_CONFIRMED` beat.
 *
 * The 30 s `modelTimeout` is armed by the FSM on entry; this scene only starts
 * the bootstrap and reports what it sees.
 */

import { useEffect, useRef, useState } from 'react';

import { CameraStage } from '@/components/CameraStage';
import { LOADING } from '@/content/copy';
import { detectionRuntime } from '@/detection/runtime';
import { bundleProgress } from '@/lib/assets';
import { announce } from '@/lib/live';

export function LoadingDetection(): React.ReactElement {
  const [percent, setPercent] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    // Guarded because React 19 StrictMode mounts effects twice in development,
    // and instantiating two FaceDetectors would double the WASM heap.
    if (started.current) return;
    started.current = true;
    announce('Starting camera.');
    void detectionRuntime.bootstrap();
  }, []);

  // 4 Hz. A progress readout is the one place a poll is cheaper and clearer
  // than plumbing another signal through the detection ref.
  useEffect(() => {
    const id = window.setInterval(() => {
      setPercent(Math.round(bundleProgress('face-model') * 100));
    }, 250);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  return (
    <CameraStage>
      <div className="w-full rounded-[28px] border-3 border-ink bg-cream/95 p-6 text-center shadow-[6px_6px_0_#111111]">
        <h1 className="font-display text-[clamp(1.375rem,5vw,1.875rem)] leading-[1.2]">
          {LOADING.title}
        </h1>

        <div
          role="progressbar"
          aria-label={LOADING.progressLabel}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-4 h-5 w-full overflow-hidden rounded-full border-3 border-ink bg-white"
        >
          <div
            className="h-full bg-pink transition-[width] duration-300 ease-out"
            style={{ width: `${String(percent)}%` }}
          />
        </div>

        <p className="mt-3 font-mono text-[13px]">{percent}%</p>

        <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="loader-dot h-3 w-3 rounded-full border-2 border-ink bg-yellow"
              style={{ animationDelay: `${String(index * 80)}ms` }}
            />
          ))}
        </div>
      </div>
    </CameraStage>
  );
}
