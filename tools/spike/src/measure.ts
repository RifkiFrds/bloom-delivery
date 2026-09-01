/**
 * Measurement tooling — Doc 05 §4 (P0.7, P0.8) and Doc 03 §10.3.
 *
 * Produces the two artifacts Phase 0 must deliver:
 *
 *   1. A MEASUREMENT REPORT — `S` distribution, inference percentiles, latch
 *      timings, and true/false-positive tallies, per device and lighting.
 *      "A written measurement report with numbers, not impressions."
 *
 *   2. FIXTURE DUMPS — the last N ticks of landmark arrays plus an expected
 *      outcome, as JSON. Phase 4's unit tests run against these. This is what
 *      turns threshold tuning from a two-people-in-a-room loop into a
 *      ten-second loop, and it is the single highest-leverage piece of tooling
 *      in the project.
 *
 * Nothing here is uploaded. Everything is a local download.
 */

import { EXIT_CRITERIA } from './config';
import type { DetectionSnapshot, Hand, FaceBox } from './types';

export type Lighting = 'daylight' | 'evening';
export type TrialKind = 'accept' | 'reject';

export interface Trial {
  readonly kind: TrialKind;
  readonly label: string;
  readonly lighting: Lighting;
  readonly passed: boolean;
  readonly atMs: number;
}

/** One recorded tick, in the shape Phase 4's fixture tests consume. */
export interface FixtureFrame {
  readonly tick: number;
  readonly timestampMs: number;
  readonly aspect: number;
  readonly hands: readonly Hand[];
  readonly faces: readonly FaceBox[];
}

export interface FixtureExport {
  readonly name: string;
  readonly expectation: string;
  readonly lighting: Lighting;
  readonly device: string;
  readonly recordedAt: string;
  readonly frames: readonly FixtureFrame[];
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(fraction * (sorted.length - 1))),
  );
  return sorted[index] ?? 0;
}

export interface MeasurementSummary {
  render(): string;
}

export class Measurement implements MeasurementSummary {
  private readonly palmScales: number[] = [];
  private readonly inferenceSamples: number[] = [];
  private readonly trials: Trial[] = [];
  private readonly latchTimings: number[] = [];
  private readonly frames: FixtureFrame[] = [];

  private lighting: Lighting = 'daylight';
  private device = 'unknown';
  private startedAt = performance.now();
  private latchStartedAt: number | null = null;

  /** Keeps the fixture ring bounded — 300 ticks ≈ 20 s at 15 Hz. */
  private static readonly FIXTURE_CAPACITY = 300;

  setLighting(lighting: Lighting): void {
    this.lighting = lighting;
  }

  setDevice(device: string): void {
    this.device = device;
  }

  get currentLighting(): Lighting {
    return this.lighting;
  }

  /** Called every tick. Records `S` only when two hands are present. */
  observe(snapshot: DetectionSnapshot, inferenceMs: number): void {
    this.inferenceSamples.push(inferenceMs);
    if (this.inferenceSamples.length > 600) this.inferenceSamples.shift();

    if (snapshot.palmScales.length === 2) {
      for (const s of snapshot.palmScales) {
        if (s > 0) this.palmScales.push(s);
      }
      if (this.palmScales.length > 5000) this.palmScales.splice(0, 1000);
    }

    this.frames.push({
      tick: snapshot.tick,
      timestampMs: snapshot.timestampMs,
      aspect: 0,
      hands: snapshot.hands,
      faces: snapshot.faceBoxes,
    });
    if (this.frames.length > Measurement.FIXTURE_CAPACITY) this.frames.shift();
  }

  /** Call when the face stage begins, to time the latch. */
  beginLatchTiming(nowMs: number): void {
    this.latchStartedAt = nowMs;
  }

  recordLatch(nowMs: number): void {
    if (this.latchStartedAt === null) return;
    this.latchTimings.push(nowMs - this.latchStartedAt);
    this.latchStartedAt = null;
  }

  recordTrial(kind: TrialKind, label: string, passed: boolean): void {
    this.trials.push({
      kind,
      label,
      lighting: this.lighting,
      passed,
      atMs: performance.now() - this.startedAt,
    });
  }

  private rate(kind: TrialKind, lighting?: Lighting): { n: number; rate: number } {
    const scoped = this.trials.filter(
      (trial) => trial.kind === kind && (lighting === undefined || trial.lighting === lighting),
    );
    if (scoped.length === 0) return { n: 0, rate: 0 };
    const passed = scoped.filter((trial) => trial.passed).length;
    return { n: scoped.length, rate: passed / scoped.length };
  }

  render(): string {
    const s = this.palmScales;
    const day = this.rate('accept', 'daylight');
    const evening = this.rate('accept', 'evening');
    const reject = this.rate('reject');
    const latchOk = this.latchTimings.filter(
      (value) => value <= EXIT_CRITERIA.faceLatchWithinMs,
    ).length;

    const sLine =
      s.length === 0
        ? '  S   no two-hand samples yet'
        : `  S   n=${s.length}  min ${percentile(s, 0).toFixed(4)}  ` +
          `p5 ${percentile(s, 0.05).toFixed(4)}  med ${percentile(s, 0.5).toFixed(4)}  ` +
          `p95 ${percentile(s, 0.95).toFixed(4)}`;

    const gate =
      s.length === 0
        ? '  GATE  pending'
        : percentile(s, 0.05) >= EXIT_CRITERIA.palmScaleMin
          ? '  GATE  S p5 >= 0.045  →  BUILD G1 AS PRIMARY'
          : '  GATE  S p5 <  0.045  →  PROMOTE G2 TO PRIMARY (Doc 03 §5.4)';

    return [
      'MEASUREMENT  (device: ' + this.device + ', lighting: ' + this.lighting + ')',
      sLine,
      gate,
      `  TP  daylight ${(day.rate * 100).toFixed(0)}% (n=${day.n}, need ≥80)  ` +
        `evening ${(evening.rate * 100).toFixed(0)}% (n=${evening.n}, need ≥60)`,
      `  FP  ${reject.n - Math.round(reject.rate * reject.n)}/${reject.n} rejected correctly ` +
        `(need 0 false accepts)`,
      `  latch  ${latchOk}/${this.latchTimings.length} within 3 s`,
    ].join('\n');
  }

  /** The Phase 0 report artifact. */
  buildReport(): Record<string, unknown> {
    const s = this.palmScales;
    return {
      generatedAt: new Date().toISOString(),
      device: this.device,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      palmScale: {
        samples: s.length,
        min: percentile(s, 0),
        p5: percentile(s, 0.05),
        median: percentile(s, 0.5),
        p95: percentile(s, 0.95),
        max: percentile(s, 1),
        gateThreshold: EXIT_CRITERIA.palmScaleMin,
        gatePassed: s.length > 0 && percentile(s, 0.05) >= EXIT_CRITERIA.palmScaleMin,
      },
      inference: {
        samples: this.inferenceSamples.length,
        p50: percentile(this.inferenceSamples, 0.5),
        p95: percentile(this.inferenceSamples, 0.95),
        budgetMs: EXIT_CRITERIA.inferenceMaxMs,
        budgetPassed:
          percentile(this.inferenceSamples, 0.95) <= EXIT_CRITERIA.inferenceMaxMs,
      },
      latch: {
        timingsMs: this.latchTimings,
        withinTargetRate:
          this.latchTimings.length === 0
            ? 0
            : this.latchTimings.filter((v) => v <= EXIT_CRITERIA.faceLatchWithinMs).length /
              this.latchTimings.length,
      },
      trials: this.trials,
      rates: {
        daylight: this.rate('accept', 'daylight'),
        evening: this.rate('accept', 'evening'),
        rejects: this.rate('reject'),
      },
    };
  }

  buildFixture(name: string, expectation: string): FixtureExport {
    return {
      name,
      expectation,
      lighting: this.lighting,
      device: this.device,
      recordedAt: new Date().toISOString(),
      frames: [...this.frames],
    };
  }
}

/** Triggers a local download. Nothing leaves the device. */
export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
