/**
 * Motion tokens — Doc 04 §C.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 * Ad-hoc stiffness/damping values are a REVIEW-BLOCKING DEFECT. Every spring
 * in the codebase references one of the four tokens below.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `spring.bouncy` is PRD v2's named reference value (stiffness 300, damping 12).
 * The other three are derived from it.
 *
 * Under reduced motion every duration is multiplied by 0.6 and every spring is
 * replaced by `easing.out` — content is never removed, only motion.
 */

export const duration = {
  instant: 0.08,
  fast: 0.12,
  quick: 0.18,
  base: 0.24,
  slow: 0.32,
  slower: 0.48,
  scene: 0.72,
  beat: 1.2,
} as const;

export type DurationToken = keyof typeof duration;

/** Doc 04 §C.5 — reduced motion scales all durations by 0.6. */
export const REDUCED_MOTION_SCALE = 0.6;

export const easing = {
  standard: [0.2, 0, 0, 1],
  entrance: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
  back: [0.34, 1.56, 0.64, 1],
  sine: [0.37, 0, 0.63, 1],
  /** The reduced-motion substitute for every spring. */
  out: [0, 0, 0.2, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EasingToken = keyof typeof easing;

export interface SpringToken {
  readonly type: 'spring';
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

export const spring = {
  /** PRD v2's reference. Clear, cartoony bounce. */
  bouncy: { type: 'spring', stiffness: 300, damping: 12, mass: 1 },
  /** Snappy with a visible pop. Badges, stamps, tulip growth, message reveal. */
  pop: { type: 'spring', stiffness: 420, damping: 20, mass: 0.8 },
  /** Soft settle, minimal overshoot. Cards, HUD swaps, ring decay, letter flap. */
  gentle: { type: 'spring', stiffness: 200, damping: 26, mass: 1 },
  /** Fast, near-critical. Toggles, small state changes. */
  snappy: { type: 'spring', stiffness: 500, damping: 34, mass: 0.9 },
} as const satisfies Record<string, SpringToken>;

export type SpringName = keyof typeof spring;

export interface Transition {
  readonly type?: 'spring';
  readonly stiffness?: number;
  readonly damping?: number;
  readonly mass?: number;
  readonly duration?: number;
  readonly ease?: readonly [number, number, number, number];
}

/**
 * Resolve a spring for the current motion preference.
 *
 * Reduced motion replaces the spring entirely rather than softening it —
 * an overshoot is an overshoot at any stiffness.
 */
export function resolveSpring(name: SpringName, motionSafe: boolean): Transition {
  if (motionSafe) return spring[name];
  return { duration: duration.base * REDUCED_MOTION_SCALE, ease: easing.out };
}

export function resolveDuration(token: DurationToken, motionSafe: boolean): number {
  return motionSafe ? duration[token] : duration[token] * REDUCED_MOTION_SCALE;
}
