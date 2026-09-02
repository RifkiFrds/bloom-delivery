'use client';

/**
 * The detection debug HUD — Doc 03 §10, Doc 05 P4.12.
 *
 * ── NON-NEGOTIABLE TOOLING ───────────────────────────────────────────────
 * "The gesture cannot be tuned blind." Every condition, its measured value and
 * its current threshold, live. Without this, a failing gesture is an
 * unanswerable question; with it, it is "C5 failed at 0.031 against 0.048".
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Activated by `?debug=1` and excluded from the production bundle by the same
 * `NODE_ENV` gate as the FSM debug panel, so it never ships as dead weight or
 * as an accidental surface.
 *
 * It reads the ref in its own rAF and writes `textContent` — the HUD that
 * exists to prove the ≤ 2 re-renders/second budget must not itself violate it.
 * The React re-render counter shown here is fed by `noteRender`, so a component
 * that starts re-rendering during detection becomes immediately visible.
 */

import { useEffect, useRef, useState } from 'react';

import { noteRender, rendersPerSecond, type DetectionSnapshot } from '@/detection/ref';
import { bus } from '@/events/bus';
import { lastBlockedTransition, useMachineStore } from '@/store/machineStore';
import { activeFlags, isDebugMode } from '@/lib/devFlags';
import type { Condition, VariantResult } from '@/detection/types';
import { useDetectionFrame } from './useDetectionFrame';

export function DebugHUD(): React.ReactElement | null {
  const preRef = useRef<HTMLPreElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isDebugMode());
  }, []);

  useDetectionFrame((snapshot, nowMs) => {
    const node = preRef.current;
    if (node === null) return;
    node.textContent = render(snapshot, nowMs);
  });

  if (process.env.NODE_ENV === 'production' || !enabled) return null;

  return (
    <aside className="pointer-events-none fixed left-2 top-2 z-50 max-w-[min(94vw,420px)]">
      <pre
        ref={preRef}
        className="max-h-[70dvh] overflow-auto rounded-[12px] border-3 border-ink bg-white/95 p-2 font-mono text-[10px] leading-[1.35]"
      />
      <div className="pointer-events-auto mt-1 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => {
            bus.emit({ type: 'MERCY_UNLOCK' });
          }}
          className="rounded-[8px] border-2 border-ink bg-yellow px-2 py-1 font-mono text-[10px]"
        >
          force unlock
        </button>
        {([0, 1, 2, 3] as const).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => {
              bus.emit({ type: 'MERCY_TICK', level });
            }}
            className="rounded-[8px] border-2 border-ink bg-white px-2 py-1 font-mono text-[10px]"
          >
            mercy {level}
          </button>
        ))}
      </div>
    </aside>
  );
}

function num(value: number, digits = 3): string {
  return value.toFixed(digits);
}

/** `C2 thumb junc  ✓   0.021 <= 0.041` — Doc 03 §10.2's layout. */
function line(condition: Condition): string {
  const mark = condition.pass ? '✓' : '✗';
  const label = condition.label.padEnd(14);
  if (condition.value === null || condition.threshold === null) {
    return `   ${condition.id} ${label} ${mark}`;
  }
  const comparison = condition.comparison === 'range' ? '∈' : condition.comparison;
  return `   ${condition.id} ${label} ${mark}  ${num(condition.value)} ${comparison} ${num(
    condition.threshold,
  )}`;
}

function variant(result: VariantResult | null, name: string): string {
  if (result === null) return `${name} —`;
  return `${name} ${result.pass ? '✓' : `✗ ${result.failedAt ?? '?'}`}`;
}

function render(snapshot: DetectionSnapshot, nowMs: number): string {
  noteRender(nowMs);

  const [scaleA = 0, scaleB = 0] = snapshot.palmScales;
  const mean = snapshot.palmScales.length > 0 ? (scaleA + scaleB) / 2 : 0;

  const dots = snapshot.nofmWindow.map((hit) => (hit ? '●' : '○')).join('');
  const hits = snapshot.nofmWindow.filter(Boolean).length;

  return [
    `mode  ${snapshot.mode}  mercy ${String(snapshot.mercyLevel)}  tick ${String(snapshot.tick)}`,
    `flags ${activeFlags().join(' ') || 'none'}   horns ${
      snapshot.hornsLatched ? 'LATCHED' : snapshot.hornsPose ? 'now' : '—'
    }`,
    `perf  ${num(snapshot.inferenceMs, 1)}ms  p50 ${num(snapshot.inferenceP50, 1)}  p95 ${num(
      snapshot.inferenceP95,
      1,
    )}  ${num(snapshot.effectiveHz, 1)}Hz`,
    `      interval ${String(snapshot.intervalMs)}ms  faceDrops ${String(
      snapshot.droppedFaceTicks,
    )}  renders ${String(rendersPerSecond())}/s`,
    `gpu   face ${snapshot.faceDelegate}  hands ${snapshot.handDelegate}`,
    `luma  Y ${num(snapshot.lumaY, 0)}  ${snapshot.tooDark ? 'TOO DARK' : 'ok'}`,
    `faces ${String(snapshot.faceCount)} ${snapshot.togetherConfirmed ? '(latched)' : ''}  liveness ${
      snapshot.liveness ? '✓' : '✗'
    }`,
    '─'.repeat(46),
    `HAND A S ${num(scaleA)}   HAND B S ${num(scaleB)}   S̄ ${num(mean)}`,
    'G1',
    ...(snapshot.g1?.conditions ?? []).map(line),
    [
      variant(snapshot.g2[0] ?? null, 'G2(A)'),
      variant(snapshot.g2[1] ?? null, 'G2(B)'),
      variant(snapshot.g3, 'G3'),
    ].join('  '),
    '─'.repeat(46),
    `closeness ${num(snapshot.closeness, 2)}  coaching ${snapshot.coaching}`,
    `hold ${num(snapshot.holdMs, 0)}ms / 900   accepted ${snapshot.accepted ? '✓' : '✗'}`,
    `N-of-M ${dots}  (${String(hits)} of ${String(snapshot.nofmWindow.length)})`,
    '─'.repeat(46),
    // The two lines that answer "the ring filled but nothing happened".
    `hasUnlocked ${
      useMachineStore.getState().context.hasUnlocked
        ? 'TRUE — canUnlock will refuse'
        : 'false'
    }`,
    `blocked ${lastBlockedTransition() ?? '—'}`,
  ].join('\n');
}
