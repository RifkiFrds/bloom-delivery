/**
 * `closeness` — the "almost there" signal. Doc 03 §6.5.
 *
 *     closeness = clamp01( mean over C2..C7 of ( 1 - measured / threshold ) )
 *
 * then smoothed with EMA α = 0.4.
 *
 * ── THE RULE THAT MATTERS ────────────────────────────────────────────────
 * `closeness` MUST NEVER GATE A TRANSITION. It exists to give the USER a
 * continuous signal; the MACHINE uses booleans. A smoothed scalar crossing a
 * threshold reintroduces exactly the lag the N-of-M buffer exists to avoid.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * In measured completion rate this is worth more than the other seven coaching
 * states combined: it is the only feedback that tells the user their gesture is
 * WORKING, which converts random flailing into deliberate adjustment.
 */

import { CLOSENESS } from '../config';
import { clamp01 } from './metrics';
import type { Condition } from '../types';

/**
 * Per-condition satisfaction in [0,1].
 *
 * Upper bounds (`<=`) approach 1 as the measurement shrinks below the limit.
 * Lower bounds (`>=`) approach 1 as it grows past the limit. Boolean and range
 * conditions contribute a flat 1 or 0 — they have no meaningful "how close".
 */
function satisfaction(condition: Condition): number {
  const { value, threshold, comparison, pass } = condition;

  if (comparison === 'bool' || comparison === 'range') return pass ? 1 : 0;
  if (value === null || threshold === null || threshold === 0) return pass ? 1 : 0;

  if (comparison === '<=') return clamp01(1 - value / threshold);
  return clamp01(1 - threshold / Math.max(value, Number.EPSILON));
}

/** Raw closeness over the non-C1 conditions (C1 is a size gate, not a shape cue). */
export function rawCloseness(conditions: readonly Condition[]): number {
  const scored = conditions.filter((condition) => condition.id !== 'C1');
  if (scored.length === 0) return 0;
  let total = 0;
  for (const condition of scored) total += satisfaction(condition);
  return clamp01(total / scored.length);
}

/** Exponential moving average, α = 0.4. Stateful by design; UI only. */
export class ClosenessFilter {
  private value = 0;
  private seeded = false;

  update(raw: number): number {
    if (!this.seeded) {
      this.value = raw;
      this.seeded = true;
      return this.value;
    }
    this.value = CLOSENESS.emaAlpha * raw + (1 - CLOSENESS.emaAlpha) * this.value;
    return this.value;
  }

  get current(): number {
    return this.value;
  }

  /** True once the user is close enough that the HUD should say so. */
  get isAlmost(): boolean {
    return this.value >= CLOSENESS.almostThreshold;
  }

  reset(): void {
    this.value = 0;
    this.seeded = false;
  }
}
