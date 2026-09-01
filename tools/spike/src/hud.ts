/**
 * Debug HUD — the layout specified in Doc 03 §10.2.
 *
 * Every condition is shown with its MEASURED VALUE next to its CURRENT
 * THRESHOLD. That pairing is the entire point: it turns calibration from
 * guessing into reading.
 *
 * Rendered as text into a <pre>, updated on its own rAF — never from the
 * detection loop. This mirrors the production React boundary rule (Doc 01 §B4)
 * so the discipline is established in Phase 0 rather than retrofitted.
 */

import { EXIT_CRITERIA } from './config';
import type { Condition, DetectionSnapshot, VariantResult } from './types';
import type { LoopStats } from './loop';
import type { MeasurementSummary } from './measure';

const tick = (pass: boolean): string => (pass ? '✓' : '✗');

function formatCondition(condition: Condition): string {
  const id = condition.id.padEnd(4);
  const label = condition.label.padEnd(20);
  const mark = tick(condition.pass);

  if (condition.value === null || condition.threshold === null) {
    return `   ${id}${label} ${mark}`;
  }

  const symbol =
    condition.comparison === '<=' ? '<=' : condition.comparison === '>=' ? '>=' : '~';
  return (
    `   ${id}${label} ${mark}  ` +
    `${condition.value.toFixed(4)} ${symbol} ${condition.threshold.toFixed(4)}`
  );
}

function formatVariant(result: VariantResult | null, title: string): string {
  if (result === null) return ` ${title}  —`;
  const head = ` ${title}  ${tick(result.pass)}${
    result.failedAt === null ? '' : `  FAIL@${result.failedAt}`
  }`;
  return [head, ...result.conditions.map(formatCondition)].join('\n');
}

function bar(window: readonly boolean[]): string {
  return window.map((value) => (value ? '●' : '○')).join('');
}

export interface HudInput {
  readonly snapshot: DetectionSnapshot | null;
  readonly stats: LoopStats;
  readonly measurement: MeasurementSummary;
  readonly delegates: { face: string; hands: string };
  readonly notes: readonly string[];
}

export class Hud {
  constructor(private readonly element: HTMLElement) {}

  render(input: HudInput): void {
    this.element.textContent = this.build(input);
  }

  private build(input: HudInput): string {
    const { snapshot, stats, measurement, delegates, notes } = input;

    const perf =
      `perf  inf ${stats.inferenceMs.toFixed(1)}ms  ` +
      `p50 ${stats.inferenceP50.toFixed(1)}  p95 ${stats.inferenceP95.toFixed(1)}  ` +
      `${tick(stats.inferenceP95 <= EXIT_CRITERIA.inferenceMaxMs)}\n` +
      `      ${stats.effectiveHz.toFixed(1)} Hz  interval ${stats.intervalMs}ms  ` +
      `faceDropped ${stats.droppedFaceTicks}\n` +
      `delegate  face ${delegates.face}  hands ${delegates.hands}`;

    if (snapshot === null) {
      return [perf, '', 'waiting for first tick…', '', ...notes].join('\n');
    }

    const hands = snapshot.palmScales
      .map((s, index) => {
        const ok = s >= EXIT_CRITERIA.palmScaleMin;
        return `  hand${index}  S ${s.toFixed(4)}  ${tick(ok)} (>= ${EXIT_CRITERIA.palmScaleMin})`;
      })
      .join('\n');

    const g2 = snapshot.g2
      .map((result, index) => formatVariant(result, `G2[${index}]`))
      .join('\n');

    return [
      perf,
      '─'.repeat(52),
      `luma  Y ${snapshot.lumaY.toFixed(1)}  ${snapshot.tooDark ? 'TOO_DARK' : 'ok'}`,
      `faces ${snapshot.faceCount < 0 ? 'skipped' : snapshot.faceCount}  ` +
        `latched ${tick(snapshot.togetherConfirmed)}  liveness ${tick(snapshot.liveness)}`,
      `mercy ${snapshot.mercyLevel}  coaching ${snapshot.coaching}`,
      '─'.repeat(52),
      snapshot.palmScales.length === 0 ? '  (no hands)' : hands,
      '',
      formatVariant(snapshot.g1, 'G1'),
      g2 === '' ? ' G2  —' : g2,
      formatVariant(snapshot.g3, 'G3'),
      '─'.repeat(52),
      `accepted ${tick(snapshot.accepted)}   ` +
        `gesturePresent ${tick(snapshot.gesturePresent)}`,
      `N-of-M   ${bar(snapshot.nofmWindow)}  (5 of 7)`,
      `closeness ${snapshot.closeness.toFixed(3)}` +
        `${snapshot.coaching === 'ALMOST' ? '  ← ALMOST' : ''}`,
      `hold      ${snapshot.holdMs.toFixed(0)}ms / 900  ` +
        `[${'█'.repeat(Math.round(snapshot.holdProgress * 20)).padEnd(20, '·')}]`,
      '─'.repeat(52),
      measurement.render(),
      notes.length === 0 ? '' : `\n${notes.join('\n')}`,
    ].join('\n');
  }
}
