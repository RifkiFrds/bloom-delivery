/**
 * Platform detection — Doc 02 §6.1, Doc 04 §B.16.
 *
 * ── WHY UA SNIFFING IS CORRECT HERE ──────────────────────────────────────
 * Feature detection is the right default and is used everywhere else in this
 * codebase. It cannot answer the question this module exists to answer:
 *
 *   "If the user denies the camera, can a second getUserMedia ever prompt
 *    again?"
 *
 * On iOS Safari it cannot — a second call throws NotAllowedError immediately,
 * with no prompt. There is no capability to probe for that; probing it *is*
 * the failure. The only way to know before rendering the recovery screen is to
 * know the platform, and rendering a "Try again" button that silently no-ops
 * is worse than rendering no button at all.
 *
 * `navigator.permissions.query({name:'camera'})` is NEVER used: Safari does not
 * support it, and an architecture that depends on knowing permission state in
 * advance is broken on the platform that matters most here.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type Platform = 'ios' | 'android' | 'desktop';

/**
 * iPadOS reports a desktop Safari UA. `maxTouchPoints > 1` on a Mac-looking UA
 * is the standard discriminator and is what makes the denial screen correct on
 * an iPad.
 */
function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return userAgent.includes('Macintosh') && maxTouchPoints > 1;
}

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const { userAgent } = navigator;
  if (isIos(userAgent, navigator.maxTouchPoints)) return 'ios';
  if (userAgent.includes('Android')) return 'android';
  return 'desktop';
}

/**
 * True where a denied camera permission can be recovered without a reload.
 *
 * iOS: false, always. See the header. The screen shows [ Reload ] instead.
 */
export function canRetryAfterDenial(platform: Platform): boolean {
  return platform !== 'ios';
}

/**
 * Android's `intent://` escape from an in-app WebView — Doc 01 §9.3.
 *
 * Reliably escapes most WebViews. There is no iOS equivalent, and this function
 * returns null there rather than producing a URL that would silently do
 * nothing.
 */
export function buildIntentUrl(href: string, platform: Platform): string | null {
  if (platform !== 'android') return null;
  try {
    const url = new URL(href);
    const withoutScheme = `${url.host}${url.pathname}${url.search}`;
    return `intent://${withoutScheme}#Intent;scheme=${url.protocol.replace(':', '')};action=android.intent.action.VIEW;end`;
  } catch {
    return null;
  }
}

/**
 * Copy to clipboard with the `execCommand` fallback older WebViews still need.
 *
 * Returns whether the copy is believed to have succeeded — the caller shows the
 * "Copied ✓" toast only on true, so the UI never claims something that did not
 * happen.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if ('clipboard' in navigator) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the legacy path */
    }
  }

  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    // Deprecated, and the only thing that works in several in-app WebViews —
    // which is exactly the context this function is called from.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

/** Haptic tap where supported. Silently absent everywhere else (Doc 04 §B.10). */
export function vibrate(pattern: number | readonly number[]): void {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern as number | number[]);
  } catch {
    /* a refused vibration is never worth an error path */
  }
}
