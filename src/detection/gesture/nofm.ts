/**
 * N-of-M boolean stabilisation — Doc 03 §4.5.
 *
 * `gesturePresent := accepted true in >= 5 of the last 7 ticks` (~0.47 s at
 * 15 Hz). This is what absorbs single-frame dropouts from motion blur and
 * momentary occlusion.
 *
 * ── APPLIED TO THE FINAL BOOLEAN, NEVER TO INDIVIDUAL CONDITIONS ─────────
 * Smoothing each condition separately would let a hand satisfy C2 in one frame
 * and C5 in another and appear to satisfy both — a false positive constructed
 * out of thin air.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Fixed-size, preallocated; zero allocation per tick (Doc 03 §11.4).
 */

export class RingBuffer {
  private readonly buffer: boolean[];
  private index = 0;

  constructor(
    private readonly window: number,
    private readonly required: number,
  ) {
    if (window <= 0) throw new RangeError('window must be positive');
    if (required > window) throw new RangeError('required cannot exceed window');
    this.buffer = new Array<boolean>(window).fill(false);
  }

  push(value: boolean): boolean {
    this.buffer[this.index] = value;
    this.index = (this.index + 1) % this.window;
    return this.satisfied;
  }

  /** True when at least `required` of the retained samples are true. */
  get satisfied(): boolean {
    let count = 0;
    for (let i = 0; i < this.window; i += 1) {
      if (this.buffer[i] === true) count += 1;
    }
    return count >= this.required;
  }

  get trueCount(): number {
    let count = 0;
    for (let i = 0; i < this.window; i += 1) {
      if (this.buffer[i] === true) count += 1;
    }
    return count;
  }

  /** Chronological view, oldest → newest. HUD only; allocates. */
  snapshot(): readonly boolean[] {
    const out: boolean[] = [];
    for (let i = 0; i < this.window; i += 1) {
      const slot = this.buffer[(this.index + i) % this.window];
      out.push(slot === true);
    }
    return out;
  }

  reset(): void {
    this.buffer.fill(false);
    this.index = 0;
  }
}
