/**
 * FSM timings — the durations of the machine's own named timers (Doc 02 §2,
 * the "T" rows).
 *
 * ── WHY THESE LIVE IN `machine/` AND NOT IN `detection/config` ───────────
 * They are properties of the STATE MACHINE, not of the detection pipeline: the
 * length of the `UNLOCKING` beat is unrelated to a palm-scale threshold, and
 * `machine/` cannot import from `detection/` without a cycle — `detection/config`
 * already imports `MercyLevel` from here.
 *
 * They are not motion tokens either. `motion/tokens` governs how an element
 * ANIMATES; these govern how long the machine SITS in a state. A beat is a
 * narrative duration that survives its animation being removed under reduced
 * motion.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Doc 05 §14: constants live in a registry, never at a call site. Before this
 * module, `transitions.ts` carried seven bare numeric literals.
 */

/** `modelTimeout` — Doc 02 §2.8. Face model only; never the 7.5 MB one. */
export const MODEL_TIMEOUT_MS = 30_000;

/** `togetherBeat` — the reward beat AND the hand-model load buffer. */
export const BEATS_TOGETHER_MS = 1200;

/** How far `TOGETHER_CONFIRMED` may extend while `!handModelReady`. */
export const BEATS_TOGETHER_MAX_MS = 5000;

/** `unlockBeat` — the teardown beat. Non-interruptible. */
export const BEATS_UNLOCK_MS = 2200;

/** `deliveryBeat` — the box falls, lands and bursts. */
export const BEATS_DELIVERY_MS = 9000;

/** `bloomBeat` — the tulip field and the music peak. */
export const BEATS_BLOOM_MS = 8000;

/** `messageBeat` — "For {name} 🌷". */
export const BEATS_MESSAGE_MS = 4000;

/** `letterSettle` — after the reveal completes and the reader has had a beat. */
export const BEATS_LETTER_SETTLE_MS = 2600;

/** The music fade-in at `UNLOCKING` exit. Never starts at full volume. */
export const MUSIC_FADE_MS = 800;
