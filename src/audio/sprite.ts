/**
 * The SFX sprite map — Doc 04 §D.2.
 *
 * SIX SOUNDS IN ONE FILE with a timing map. Sixteen separate requests for 20 KB
 * files is pure overhead, and sprite playback removes per-sound decode latency —
 * which matters because `sfx.pop` fires on a button press and any latency there
 * reads as the button not working.
 *
 * Format: Opus in WebM with an AAC/M4A fallback for older Safari. Howler picks
 * whichever the browser reports it can play.
 *
 * ── THE ASSETS ARE NOT IN THE REPOSITORY ─────────────────────────────────
 * Audio is authored content, not code. Until `public/audio/` is populated the
 * loader fails, `available` stays false, and the entire experience runs SILENT —
 * which is a supported, specified outcome, not a broken one:
 *
 *   "All sound is decorative. No information is conveyed by audio alone. Every
 *    beat must read correctly with sound off." (Doc 04 §D.5)
 *
 * The offsets below are the contract the sprite must be authored against.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type SfxId = 'pop' | 'sting' | 'charge' | 'thud' | 'whoosh' | 'page';

/** `[startMs, durationMs]`, plus `loop` — Howler's sprite format. */
export const SFX_SPRITE: Readonly<
  Record<SfxId, [number, number] | [number, number, boolean]>
> = {
  /** Button press · seal pop · lid burst. Short and bright. */
  pop: [0, 260],
  /** TOGETHER_CONFIRMED confetti. A two-note rising bell. */
  sting: [400, 900],
  /** GESTURE_HOLDING. Looped, rate-mapped 0.9 → 1.6 from holdProgress. */
  charge: [1500, 1200, true],
  /** Box impact · unlock. A deep, soft thud. */
  thud: [2900, 700],
  /** Burst · sky-hole. An airy sweep. */
  whoosh: [3800, 900],
  /** Letter slide and chime. Paper plus a warm bell. */
  page: [4900, 1100],
};

/** Ordered by preference. Howler takes the first the browser can decode. */
export const SFX_SOURCES = ['/audio/sfx-sprite.webm', '/audio/sfx-sprite.m4a'] as const;

export const MUSIC_SOURCES = ['/audio/music.webm', '/audio/music.m4a'] as const;

/** Doc 04 §D.3 — never starts at full volume; users may be in public. */
export const MUSIC_VOLUME = 0.55;
export const SFX_VOLUME = 0.7;

/** Doc 04 §B.10 — `sfx.charge` playback rate across the hold. */
export const CHARGE_RATE_MIN = 0.9;
export const CHARGE_RATE_MAX = 1.6;

/** Muting during `sfx.charge` fades it over 100 ms rather than cutting. */
export const CHARGE_FADE_MS = 100;
