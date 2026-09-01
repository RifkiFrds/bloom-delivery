/**
 * Letter payload — Doc 02 §6.5.
 *
 * ── THIS IS NOT SECURITY. ────────────────────────────────────────────────
 * The letter ships inside the JS bundle. Anyone with the URL can read it via
 * View Source. Base64 + XOR is a SPOILER GUARD against casual inspection, and
 * it is documented as such so nobody later mistakes it for protection.
 *
 * The actual control is URL secrecy: deploy at an unguessable path, the root
 * returns a neutral placeholder, and the Open Graph tags carry a teaser only.
 * Real secrecy would require a backend, which this project has correctly
 * decided not to build.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Decoded ONLY on the LETTER_CLOSED → LETTER_OPEN transition.
 */

const XOR_KEY = 'bloom';

function xor(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    const keyCode = XOR_KEY.charCodeAt(i % XOR_KEY.length);
    out += String.fromCharCode(code ^ keyCode);
  }
  return out;
}

function toBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');
}

function fromBase64(input: string): string {
  const binary =
    typeof atob === 'function'
      ? atob(input)
      : Buffer.from(input, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Build-time helper: produce the obfuscated payload for `content/letter.ts`. */
export function obfuscate(plain: string): string {
  return toBase64(xor(plain));
}

/** Runtime: called once, on the LETTER_OPEN transition. */
export function deobfuscate(payload: string): string {
  try {
    return xor(fromBase64(payload));
  } catch {
    return '';
  }
}
