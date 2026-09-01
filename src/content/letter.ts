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
 * `<html lang>` must match the letter's actual language (Doc 04 §B.14).
 * If the copy is Indonesian, set LETTER_LANG to 'id'.
 *
 * To obfuscate for shipping (Doc 02 §6.5 — a spoiler guard, NOT security):
 *
 *   import { obfuscate } from '@/lib/letter';
 *   console.log(obfuscate(LETTER_PLAIN));
 *
 * then paste the result into LETTER_PAYLOAD and blank LETTER_PLAIN.
 * Phase 7 wires the decode; until then the plain text is used directly.
 */

export const LETTER_LANG = 'en';

/** Placeholder. Replace before Phase 7. */
export const LETTER_PLAIN = `Placeholder letter.

This text is replaced before Phase 7. It exists so the letter scene has
something real to lay out and so the typography can be checked at 375 px
and at 200% zoom.

Keep the paragraphs short. They fade in one at a time.`;

/** Set at Phase 7. Empty means "use LETTER_PLAIN". */
export const LETTER_PAYLOAD = '';

export const LETTER_SIGNATURE = '— from me 💗';
