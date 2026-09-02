/**
 * ★ THE LETTER ★
 *
 * This is the point of the entire project and the cheapest thing in it.
 * Spend the most care here.
 *
 * Doc 02 §2.20: the letter is real, selectable, screen-readable DOM text.
 * Never an image, never canvas. It lives in ONE OBVIOUS MODULE — this one —
 * because it is the thing the deploying user will most want to change.
 *
 * ── HOW TO REPLACE IT ────────────────────────────────────────────────────
 *  1. Write the letter into `LETTER_PLAIN`. Keep paragraphs short — they fade
 *     in one at a time, and a wall of text defeats the reveal.
 *  2. Set `LETTER_LANG` to the language you actually wrote in. `<html lang>`
 *     reads it, and a screen reader will pronounce Indonesian with an English
 *     voice if it is wrong.
 *  3. To ship it obfuscated, run `obfuscate(LETTER_PLAIN)` from `lib/letter`,
 *     paste the result into `LETTER_PAYLOAD`, and blank `LETTER_PLAIN`.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── THE OBFUSCATION IS NOT SECURITY ──────────────────────────────────────
 * Base64 + XOR is a SPOILER GUARD against casual View Source, and it is
 * documented as such so nobody later mistakes it for protection. The letter
 * ships inside the JS bundle; anyone with the URL can read it. The actual
 * control is URL secrecy (Doc 02 §6.5).
 * ─────────────────────────────────────────────────────────────────────────
 */

import { deobfuscate } from '@/lib/letter';

/** Must match the language of the copy below. */
export const LETTER_LANG = 'en';

/**
 * PLACEHOLDER — replace before sending.
 *
 * Written at a realistic length and shape so the typography, the paragraph
 * stagger, the 375 px layout and the 200%-zoom scroll behaviour are all
 * exercised by something the same size as the real thing.
 */
export const LETTER_PLAIN = `I made you a thing.

It only opens for two people, which felt right — because most of what I want to say is about the fact that there are two of us.

I like who I am when you are in the room. I like that you laugh before the end of the sentence. I like that we can spend an entire evening doing nothing in particular and I would not trade it for anywhere else.

Thank you for the ordinary days. They are my favourite ones.

Here are some flowers that will not wilt.`;

/** Set at ship time. An empty string means "use LETTER_PLAIN". */
export const LETTER_PAYLOAD = '';

export const LETTER_SIGNATURE = '— from me 💗';

let cached: readonly string[] | null = null;

/**
 * The letter, decoded and split into paragraphs.
 *
 * Memoised, so the `letter.decode` effect and the letter scene's own read
 * cannot decode twice — and so `READ_AGAIN_TAPPED`, which has no decode effect
 * of its own in the transition table, still gets the text.
 *
 * Called for the first time on the `LETTER_CLOSED → LETTER_OPEN` transition and
 * not before. That is the point of the obfuscation: the plain text does not
 * exist in memory while the envelope is still sealed.
 */
export function letterParagraphs(): readonly string[] {
  if (cached !== null) return cached;

  // Tested by length rather than by `=== ''`: while the payload is still the
  // empty literal, an equality check narrows to a constant and the compiler
  // flags the branch as dead — which it is not, it is waiting for content.
  const text = LETTER_PAYLOAD.length === 0 ? LETTER_PLAIN : deobfuscate(LETTER_PAYLOAD);
  cached = text
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  return cached;
}
