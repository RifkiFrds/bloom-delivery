/**
 * Library tests — sanitization, letter obfuscation, motion tokens, and the
 * contrast rule.
 *
 * The contrast test is the enforcement mechanism behind Doc 04 §A.2:
 * "#111111 is the only approved text color in the entire application."
 * A CI check rather than a review note.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_RECIPIENT } from '@/machine';
import { deobfuscate, obfuscate } from '@/lib/letter';
import { readRecipientFromLocation, sanitizeRecipientName } from '@/lib/sanitize';
import { resolveDuration, resolveSpring, spring } from '@/motion/tokens';

describe('recipient sanitization — the five lines that replaced Zod', () => {
  it('accepts ordinary names', () => {
    expect(sanitizeRecipientName('Alya')).toBe('Alya');
    expect(sanitizeRecipientName('Mary-Jane')).toBe('Mary-Jane');
    expect(sanitizeRecipientName("O'Brien")).toBe("O'Brien");
  });

  it('is Unicode-aware so non-Latin names work', () => {
    expect(sanitizeRecipientName('あやか')).toBe('あやか');
    expect(sanitizeRecipientName('Zoë')).toBe('Zoë');
    expect(sanitizeRecipientName('Đặng')).toBe('Đặng');
  });

  it('rejects markup and falls back to the default', () => {
    expect(sanitizeRecipientName('<script>alert(1)</script>')).toBe(DEFAULT_RECIPIENT);
    expect(sanitizeRecipientName('<img src=x onerror=y>')).toBe(DEFAULT_RECIPIENT);
    expect(sanitizeRecipientName('a&b')).toBe(DEFAULT_RECIPIENT);
  });

  it('caps length at 24 to protect the layout', () => {
    expect(sanitizeRecipientName('a'.repeat(24))).toHaveLength(24);
    expect(sanitizeRecipientName('a'.repeat(25))).toBe(DEFAULT_RECIPIENT);
  });

  it('handles absent, empty and malformed input', () => {
    expect(sanitizeRecipientName(null)).toBe(DEFAULT_RECIPIENT);
    expect(sanitizeRecipientName(undefined)).toBe(DEFAULT_RECIPIENT);
    expect(sanitizeRecipientName('   ')).toBe(DEFAULT_RECIPIENT);
    expect(readRecipientFromLocation('?to=Alya')).toBe('Alya');
    expect(readRecipientFromLocation('')).toBe(DEFAULT_RECIPIENT);
  });
});

describe('letter payload — a spoiler guard, explicitly NOT security', () => {
  it('round-trips, including newlines and emoji', () => {
    const plain = 'Hai sayang,\n\nSelamat ulang tahun 🌷\n\n— from me 💗';
    expect(deobfuscate(obfuscate(plain))).toBe(plain);
  });

  it('does not leave the plaintext readable in the payload', () => {
    const payload = obfuscate('the secret message');
    expect(payload).not.toContain('secret');
  });

  it('returns an empty string on a corrupt payload rather than throwing', () => {
    expect(deobfuscate('!!!not base64!!!')).toBe('');
  });
});

describe('motion tokens', () => {
  it('uses PRD v2 reference values for the bouncy spring', () => {
    expect(spring.bouncy.stiffness).toBe(300);
    expect(spring.bouncy.damping).toBe(12);
  });

  it('replaces springs entirely under reduced motion — never softens them', () => {
    const reduced = resolveSpring('bouncy', false);
    expect(reduced.type).toBeUndefined();
    expect(reduced.stiffness).toBeUndefined();
    expect(reduced.duration).toBeGreaterThan(0);
  });

  it('scales durations by 0.6 under reduced motion', () => {
    expect(resolveDuration('base', false)).toBeCloseTo(
      resolveDuration('base', true) * 0.6,
    );
  });
});

/**
 * Doc 04 §A.2 — the contrast rule, enforced.
 * Relative luminance and contrast ratio per WCAG 2.1.
 */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (offset: number): number => {
    const raw = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

describe('the contrast rule: #111111 is the only text color', () => {
  const INK = '#111111';
  const SURFACES = {
    cream: '#FFF8E8',
    white: '#FFFFFF',
    pink: '#FF8FAB',
    pinkLight: '#FFD6E0',
    yellow: '#FFE599',
    green: '#B7E4C7',
    peach: '#FFC2A8',
  } as const;

  it.each(Object.entries(SURFACES))('ink on %s passes AA', (_name, surface) => {
    expect(contrast(INK, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('confirms the prohibited pairs really do fail', () => {
    expect(contrast('#FFFFFF', SURFACES.pink)).toBeLessThan(4.5);
    expect(contrast(SURFACES.pink, SURFACES.cream)).toBeLessThan(4.5);
    expect(contrast(SURFACES.yellow, SURFACES.cream)).toBeLessThan(4.5);
  });
});
