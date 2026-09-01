/**
 * Capability probe — Doc 02 §2.1, runs inside BOOT, exits in < 100 ms.
 *
 * Decides Full / Lite / Blocked / Returning BEFORE any UI commits.
 *
 * ── ONE THING THIS DELIBERATELY DOES NOT DO ──────────────────────────────
 * It never calls `navigator.permissions.query({name:'camera'})`. Safari does
 * not support it, and an architecture that depends on knowing permission state
 * in advance is broken on the platform that matters most here (Doc 02 §6.1).
 * The pre-flight screen exists partly because this is our only pre-prompt
 * intervention.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { BlockedReason, BootOkPayload, RenderTier } from '@/machine';
import { readFlag, readMotionPreference } from './persistence';
import { readRecipientFromLocation } from './sanitize';

/** In-app browser UA substrings — Doc 01 §9.3. */
const IN_APP_BROWSERS: readonly string[] = [
  'Instagram',
  'FBAN',
  'FBAV',
  'FB_IAB',
  'FBIOS',
  'Line/',
  'MicroMessenger',
  'Twitter',
  'TikTok',
  'Snapchat',
  'KAKAOTALK',
];

export interface CapabilityReport {
  readonly secureContext: boolean;
  readonly hasGetUserMedia: boolean;
  readonly hasWebGL2: boolean;
  readonly inAppBrowser: string | null;
  readonly tier: RenderTier;
  readonly blocked: BlockedReason | null;
}

function detectInAppBrowser(userAgent: string): string | null {
  for (const token of IN_APP_BROWSERS) {
    if (userAgent.includes(token)) return token;
  }
  return null;
}

function detectWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (context === null) return false;
    // Release immediately — probing must not hold a context.
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function probeCapabilities(): CapabilityReport {
  if (typeof window === 'undefined') {
    return {
      secureContext: false,
      hasGetUserMedia: false,
      hasWebGL2: false,
      inAppBrowser: null,
      tier: 'lite',
      blocked: null,
    };
  }

  const secureContext = window.isSecureContext;
  // `mediaDevices` is typed non-nullish but is genuinely absent in insecure
  // contexts and inside several in-app WebViews — the exact case this probe
  // exists to catch. The `in` check is a real runtime guard.
  const hasGetUserMedia =
    'mediaDevices' in navigator &&
    typeof navigator.mediaDevices.getUserMedia === 'function';
  const hasWebGL2 = detectWebGL2();
  const inAppBrowser = detectInAppBrowser(navigator.userAgent);

  let blocked: BlockedReason | null = null;
  if (inAppBrowser !== null) blocked = 'inapp';
  else if (!secureContext) blocked = 'insecure';
  else if (!hasGetUserMedia) blocked = 'nomedia';

  return {
    secureContext,
    hasGetUserMedia,
    hasWebGL2,
    inAppBrowser,
    tier: hasWebGL2 ? 'full' : 'lite',
    blocked,
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Builds the BOOT_OK payload.
 *
 * All impure reads (storage, matchMedia, location) happen HERE, once, so that
 * every guard downstream stays pure (Doc 02 §4).
 */
export function buildBootPayload(report: CapabilityReport): BootOkPayload {
  const override = readMotionPreference();
  const motionSafe =
    override === 'reduced' ? false : override === 'full' ? true : !prefersReducedMotion();

  return {
    tier: report.tier,
    motionSafe,
    recipientName: readRecipientFromLocation(
      typeof window === 'undefined' ? '' : window.location.search,
    ),
    priorUnlock: readFlag('bloom_unlocked'),
    peekedAlone: readFlag('bloom_peeked'),
    muted: readFlag('bloom_muted'),
  };
}
