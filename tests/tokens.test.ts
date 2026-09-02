/**
 * The contrast gate — Doc 04 §A.2, §F.1.
 *
 * ── `#111111` IS THE ONLY APPROVED TEXT COLOR ────────────────────────────
 * Every brand colour is a SURFACE or a FILL, never a foreground. White-on-pink
 * is explicitly prohibited despite being the instinctive kawaii choice.
 *
 * This is not a compromise with the art direction: neo-brutalism is BUILT ON
 * black text and thick black borders over saturated fills. The accessible
 * choice and the stylistically correct choice are the same choice.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Doc 04 §F.1 requires "a CI check on the token pair table [that] fails the
 * build on violation". This is that check. It reads the ACTUAL token values out
 * of `styles/tokens.css`, so editing a hex there and forgetting the consequence
 * fails here rather than in production.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TOKENS_CSS = readFileSync(
  fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)),
  'utf8',
);

/** Reads a `--color-*` custom property straight out of the token file. */
function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(TOKENS_CSS);
  if (match?.[1] === undefined) throw new Error(`token --color-${name} not found`);
  return match[1].toLowerCase();
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const INK = () => token('ink');

describe('the only approved text color', () => {
  it('is #111111', () => {
    expect(INK()).toBe('#111111');
  });
});

describe('#111111 passes AA on every surface it is used on', () => {
  it.each([
    ['cream', 4.5],
    ['white', 4.5],
    ['pink', 4.5],
    ['pink-light', 4.5],
    ['yellow', 4.5],
    ['green', 4.5],
    ['peach', 4.5],
  ])('ink on --color-%s', (surface, minimum) => {
    expect(contrast(INK(), token(surface))).toBeGreaterThanOrEqual(minimum);
  });
});

/**
 * The prohibited pairs. These are asserted to FAIL, so if someone "fixes" a
 * brand colour into something that would pass, this test tells them the palette
 * changed rather than silently permitting brand-on-brand text.
 */
describe('prohibited pairs — asserted to fail, on purpose', () => {
  it.each([
    ['pink', 'cream'],
    ['yellow', 'cream'],
    ['white', 'pink'],
    ['green', 'white'],
  ])('--color-%s on --color-%s is never used for text', (foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeLessThan(4.5);
  });
});

describe('the neo-brutalist shadow rule', () => {
  /**
   * Zero blur radius, zero spread, pure black, offset down-right. One blurred
   * shadow anywhere breaks the entire visual language, so the token file is
   * checked rather than trusted (Doc 04 §A.3).
   */
  it('every shadow token is a hard offset with no blur', () => {
    const shadows = [...TOKENS_CSS.matchAll(/--shadow-[\w-]+:\s*([^;]+);/g)].map(
      (match) => match[1]?.trim() ?? '',
    );

    expect(shadows.length).toBeGreaterThan(0);
    for (const shadow of shadows) {
      // `<x> <y> 0 #111111` — exactly three lengths, the third being zero.
      expect(shadow).toMatch(/^-?\d+px\s+-?\d+px\s+0\s+#111111$/);
    }
  });

  it('declares no dark theme anywhere', () => {
    expect(TOKENS_CSS).not.toContain('prefers-color-scheme: dark');
    expect(TOKENS_CSS).toContain('color-scheme: light');
  });
});
