'use client';

/**
 * `BLOCKED_ENVIRONMENT` — the highest-severity mobile screen. Doc 04 §B.1,
 * Doc 01 §9.3, Doc 02 §2.2.
 *
 * ── THE GIFT CAN FAIL BEFORE THE CAMERA PROMPT EVER APPEARS ──────────────
 * This link arrives over WhatsApp, Instagram DM or LINE. Those open in embedded
 * WebViews where `getUserMedia` is unreliable or simply absent. This screen is
 * shown BEFORE any permission request.
 *
 * Android gets an `intent://` URL, which reliably escapes most WebViews.
 *
 * On iOS there is NO PROGRAMMATIC ESCAPE. So there is no "Open in Safari"
 * button on iOS — there is a copy-link button and a labelled illustration of
 * the ••• menu. **Do not ship a button that pretends to work**: a button that
 * silently does nothing is worse than no button, because the user concludes the
 * gift is broken rather than that they need to switch browsers.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SceneShell } from '@/components/SceneShell';
import { BLOCKED, ESCAPE } from '@/content/copy';
import { bus } from '@/events/bus';
import { announce } from '@/lib/live';
import { buildIntentUrl, copyToClipboard, detectPlatform } from '@/lib/platform';
import { selectContext, selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function BlockedEnvironment(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const { blockedReason } = useMachineStore(selectContext);
  const [copied, setCopied] = useState(false);
  const platform = detectPlatform();

  const href = typeof window === 'undefined' ? '' : window.location.href;
  const intentUrl = buildIntentUrl(href, platform);

  const title =
    blockedReason === 'insecure'
      ? BLOCKED.insecureTitle
      : blockedReason === 'nomedia'
        ? BLOCKED.nomediaTitle
        : BLOCKED.title;

  const body =
    blockedReason === 'insecure'
      ? BLOCKED.insecureBody
      : blockedReason === 'nomedia'
        ? BLOCKED.nomediaBody
        : BLOCKED.body;

  const copyLink = (): void => {
    void copyToClipboard(href).then((ok) => {
      setCopied(ok);
      if (ok) announce(BLOCKED.copied);
    });
  };

  return (
    <SceneShell heading={title} announcement={`${title}. ${body}`}>
      <div className="mt-6 flex flex-1 flex-col gap-6">
        <Card tone="modal" motionSafe={motionSafe}>
          <p aria-hidden="true" className="text-3xl">
            🌐
          </p>
          <p className="mt-3 text-[clamp(1.0625rem,4vw,1.25rem)] leading-[1.55]">
            {body}
          </p>

          {blockedReason === 'insecure' && (
            <p className="mt-4 break-all rounded-[12px] border-2 border-ink bg-cream p-3 font-mono text-[12px]">
              {href.replace(/^http:/, 'https:')}
            </p>
          )}

          {blockedReason === 'inapp' && (
            <div className="mt-5 flex flex-col gap-3">
              {intentUrl !== null && (
                <a
                  href={intentUrl}
                  className="interactive inline-flex min-h-[64px] items-center justify-center rounded-[20px] border-3 border-ink bg-pink px-8 font-display text-[17px] text-ink shadow-[6px_6px_0_#111111] transition-[transform,box-shadow] duration-[80ms] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_#111111]"
                >
                  {BLOCKED.openAndroid}
                </a>
              )}

              <Button
                variant="secondary"
                size="md"
                block
                motionSafe={motionSafe}
                onClick={copyLink}
              >
                {copied ? BLOCKED.copied : BLOCKED.copyLink}
              </Button>

              {platform === 'ios' && <IosMenuHint />}
            </div>
          )}
        </Card>

        <div className="mt-auto">
          <Button
            variant="tertiary"
            size="sm"
            block
            onClick={() => {
              bus.emit({ type: 'SKIP_TO_LETTER' });
            }}
          >
            {ESCAPE.toLetter}
          </Button>
        </div>
      </div>
    </SceneShell>
  );
}

/**
 * The illustrated menu position. Honest by construction: it shows where to tap
 * rather than offering a button that cannot work.
 */
function IosMenuHint(): React.ReactElement {
  return (
    <div className="rounded-[20px] border-3 border-ink bg-cream p-4">
      <p className="text-[15px] leading-[1.45]">{BLOCKED.iosSteps}</p>
      <svg
        viewBox="0 0 200 64"
        className="mt-3 h-auto w-full"
        role="img"
        aria-label="An illustration of the browser toolbar with the three-dot menu at the top right."
      >
        <rect
          x="2"
          y="8"
          width="196"
          height="48"
          rx="12"
          fill="var(--color-white)"
          stroke="#111111"
          strokeWidth="3"
        />
        <rect
          x="16"
          y="24"
          width="120"
          height="16"
          rx="8"
          fill="var(--color-pink-light)"
        />
        <circle cx="160" cy="32" r="3.5" fill="#111111" />
        <circle cx="172" cy="32" r="3.5" fill="#111111" />
        <circle cx="184" cy="32" r="3.5" fill="#111111" />
        <circle
          cx="172"
          cy="32"
          r="20"
          fill="none"
          stroke="var(--color-pink)"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}
