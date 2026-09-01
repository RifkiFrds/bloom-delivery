/**
 * The detection loop — Doc 03 §11.1, Doc 01 §4.1 stage 2.
 *
 *   ONE requestAnimationFrame loop with a time accumulator.
 *   Target 15 Hz (66 ms). Degrades to 10 Hz (100 ms) when the last inference
 *   exceeded 60 ms. Above 110 ms, face detection is dropped from the gesture
 *   stage entirely — the latch already holds.
 *
 * Not `setInterval`: it drifts, and it does not pause with the tab, which on
 * mobile means a backgrounded page keeps a neural network warm and the camera
 * hot. rAF + accumulator gives a stable cadence AND free lifecycle correctness.
 *
 * ONE `performance.now()` timestamp per tick, shared by both detectors.
 * MediaPipe's VIDEO running mode throws if a timestamp is not greater than the
 * previous one it saw.
 *
 * THE REACT BOUNDARY RULE, honoured from day one: this loop publishes to a
 * single mutable snapshot. The HUD reads it on its own rAF. Nothing here ever
 * calls into a UI framework.
 */

import { CADENCE } from './config';

export interface TickContext {
  /** Shared, monotonically increasing. Pass to BOTH detectors. */
  readonly timestampMs: number;
  /** Measured elapsed time since the previous executed tick. */
  readonly dtMs: number;
  readonly tick: number;
  /** False when inference is over budget and face detection is being skipped. */
  readonly runFaceInference: boolean;
}

export interface LoopStats {
  readonly inferenceMs: number;
  readonly inferenceP50: number;
  readonly inferenceP95: number;
  readonly effectiveHz: number;
  readonly intervalMs: number;
  readonly droppedFaceTicks: number;
}

/** Rolling window for p50/p95 without sorting the whole history each tick. */
class Percentiles {
  private readonly samples: number[] = [];
  constructor(private readonly capacity: number) {}

  push(value: number): void {
    this.samples.push(value);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  at(fraction: number): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.round(fraction * (sorted.length - 1))),
    );
    return sorted[index] ?? 0;
  }
}

export class DetectionLoop {
  private rafId: number | null = null;
  private lastRunAt = 0;
  private lastTickAt = 0;
  private tickCount = 0;
  private intervalMs: number = CADENCE.targetIntervalMs;
  private lastInferenceMs = 0;
  private droppedFaceTicks = 0;
  private readonly percentiles = new Percentiles(120);
  private readonly hzWindow: number[] = [];
  private timestampCursor = 0;

  /**
   * @param onTick executes the inference and returns the measured inference
   *   duration in ms. Throwing is caught and reported via `onError`.
   */
  constructor(
    private readonly onTick: (context: TickContext) => number,
    private readonly onError: (error: unknown) => void,
  ) {}

  start(): void {
    if (this.rafId !== null) return;
    this.lastRunAt = 0;
    this.lastTickAt = performance.now();
    this.pump();
  }

  /** Idempotent. MUST be called before closing any MediaPipe task. */
  stop(): void {
    if (this.rafId === null) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  get running(): boolean {
    return this.rafId !== null;
  }

  private pump = (): void => {
    this.rafId = requestAnimationFrame(this.pump);

    const now = performance.now();
    if (now - this.lastRunAt < this.intervalMs) return;

    const dtMs = this.lastRunAt === 0 ? this.intervalMs : now - this.lastRunAt;
    this.lastRunAt = now;
    this.tickCount += 1;

    // Strictly increasing timestamps: MediaPipe throws otherwise, and two
    // detectors sharing one clock must never see the same value twice.
    this.timestampCursor = Math.max(this.timestampCursor + 1, Math.round(now));

    const runFaceInference = this.lastInferenceMs <= CADENCE.dropFaceAboveMs;
    if (!runFaceInference) this.droppedFaceTicks += 1;

    try {
      this.lastInferenceMs = this.onTick({
        timestampMs: this.timestampCursor,
        dtMs,
        tick: this.tickCount,
        runFaceInference,
      });
    } catch (error) {
      this.onError(error);
      return;
    }

    this.percentiles.push(this.lastInferenceMs);

    // Adaptive cadence, one-way within a session (Doc 03 §11.1).
    this.intervalMs =
      this.lastInferenceMs > CADENCE.degradeAboveMs
        ? CADENCE.degradedIntervalMs
        : this.intervalMs;

    const gap = now - this.lastTickAt;
    this.lastTickAt = now;
    if (gap > 0) {
      this.hzWindow.push(1000 / gap);
      if (this.hzWindow.length > 30) this.hzWindow.shift();
    }
  };

  stats(): LoopStats {
    const hz =
      this.hzWindow.length === 0
        ? 0
        : this.hzWindow.reduce((sum, value) => sum + value, 0) / this.hzWindow.length;

    return {
      inferenceMs: this.lastInferenceMs,
      inferenceP50: this.percentiles.at(0.5),
      inferenceP95: this.percentiles.at(0.95),
      effectiveHz: hz,
      intervalMs: this.intervalMs,
      droppedFaceTicks: this.droppedFaceTicks,
    };
  }
}
