/**
 * The detection loop — Doc 03 §11.1, Doc 01 §4.1 stage 2.
 *
 * ONE `requestAnimationFrame` loop with a time accumulator. Target 15 Hz
 * (66 ms), degrading to 10 Hz (100 ms) once an inference exceeds 60 ms. Above
 * 110 ms, face detection is dropped from the gesture stage entirely — the latch
 * already holds, so liveness is a courtesy rather than a gate.
 *
 * ── WHY NOT setInterval ──────────────────────────────────────────────────
 * It drifts, and it does not pause with the tab — which on mobile means a
 * backgrounded page keeps a neural network warm and the camera hot. rAF plus an
 * accumulator gives a stable cadence AND free lifecycle correctness.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ONE `performance.now()`-derived timestamp per tick, shared by both detectors.
 * MediaPipe's VIDEO running mode throws if a timestamp is not strictly greater
 * than the previous one it saw, and two detectors sharing one clock must never
 * be handed the same value twice.
 *
 * THE REACT BOUNDARY RULE: nothing here ever calls into a UI framework. The
 * loop writes `detectionRef` and that is the entire contract.
 */

import { CADENCE } from '../config';

export interface TickContext {
  /** Shared, strictly increasing. Pass to BOTH detectors. */
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

/**
 * Rolling percentiles over a fixed window.
 *
 * Allocates only inside `at()`, which the debug HUD calls at its own rate — the
 * hot path (`push`) is allocation-free, per the zero-allocation budget
 * (Doc 03 §11.4).
 */
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
  private paused = false;
  /** True between `start()` and `stop()`. Gates `pause`/`resume` — see below. */
  private armed = false;

  /**
   * @param onTick performs the inference and returns its measured duration in
   *   ms. Throwing is caught and reported through `onError`; the loop stops.
   */
  constructor(
    private readonly onTick: (context: TickContext) => number,
    private readonly onError: (error: unknown) => void,
  ) {}

  /** Tier 2 devices start degraded rather than discovering it (Doc 03 §11.5). */
  startDegraded(): void {
    this.intervalMs = CADENCE.tier2IntervalMs;
  }

  start(): void {
    if (this.rafId !== null) return;
    this.armed = true;
    this.paused = false;
    this.lastRunAt = 0;
    this.lastTickAt = performance.now();
    this.pump();
  }

  /**
   * Idempotent. MUST be called before closing any MediaPipe task — an in-flight
   * `detectForVideo` resolving against a closed task throws inside WASM
   * (Doc 02 §2.15 E2).
   */
  stop(): void {
    this.armed = false;
    if (this.rafId === null) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  /**
   * Pause without tearing down. The rAF is cancelled, so a backgrounded tab
   * costs nothing; `resume()` restarts from a clean accumulator so the first
   * tick back does not deliver a multi-second `dt`.
   *
   * `armed` survives a pause and is cleared by `stop()`, so a pause/resume pair
   * arriving before the loop ever ran — which the ANY-state visibility rows
   * make routine — cannot start it. A lifecycle signal restores a subsystem; it
   * never starts one.
   */
  pause(): void {
    if (!this.armed) return;
    this.paused = true;
    cancelAnimationFrame(this.rafId ?? 0);
    this.rafId = null;
  }

  resume(): void {
    if (!this.armed || !this.paused || this.rafId !== null) return;
    this.paused = false;
    this.lastRunAt = 0;
    this.lastTickAt = performance.now();
    this.pump();
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

    // Strictly increasing, and shared by both detectors.
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
      this.stop();
      this.onError(error);
      return;
    }

    this.percentiles.push(this.lastInferenceMs);

    // Adaptive cadence, ONE-WAY within a session. Oscillating between 15 and
    // 10 Hz is worse than sitting at the conservative rate (Doc 01 §8.6).
    if (this.lastInferenceMs > CADENCE.degradeAboveMs) {
      this.intervalMs = CADENCE.degradedIntervalMs;
    }

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
