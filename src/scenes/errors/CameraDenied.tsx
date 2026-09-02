'use client';

/**
 * `CAMERA_DENIED` — Doc 04 §B.16, Doc 02 §2.6, §6.1.
 *
 * ── THERE IS NO GENERIC VERSION OF THIS SCREEN ───────────────────────────
 * On iOS Safari a second `getUserMedia` throws `NotAllowedError` immediately,
 * with no prompt. Retry is impossible in-page. A "Try again" button there is a
 * silent no-op, which is worse than no button: the user taps it, nothing
 * happens, and they conclude the gift is broken.
 *
 * So iOS gets **[ Reload ]** and the AA → Website Settings → Camera → Allow
 * steps. Android and desktop get a genuine **[ Try again ]** alongside their own
 * illustrated recovery path.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `--peach` fill, never red. The palette contains no saturated red, and this is
 * not the user's fault.
 */

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SceneShell } from '@/components/SceneShell';
import { DENIED, ESCAPE } from '@/content/copy';
import { bus } from '@/events/bus';
import { canRetryAfterDenial, detectPlatform } from '@/lib/platform';
import { selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function CameraDenied(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const platform = detectPlatform();
  const canRetry = canRetryAfterDenial(platform);

  const steps =
    platform === 'ios'
      ? DENIED.iosSteps
      : platform === 'android'
        ? DENIED.androidSteps
        : DENIED.desktopSteps;

  return (
    <SceneShell heading={DENIED.title} announcement={`${DENIED.title}. ${DENIED.body}`}>
      <div className="mt-6 flex flex-1 flex-col gap-6">
        <Card tone="soft" motionSafe={motionSafe} role="alert">
          <p aria-hidden="true" className="text-3xl">
            😊
          </p>
          <p className="mt-3 text-[clamp(1.0625rem,4vw,1.25rem)] leading-[1.55]">
            {DENIED.body}
          </p>

          <ol className="mt-5 flex flex-col gap-2 rounded-[20px] border-3 border-ink bg-white p-4">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border-2 border-ink bg-yellow font-display text-[13px]"
                >
                  {index + 1}
                </span>
                <span className="text-[15px] leading-[1.45]">{step}</span>
              </li>
            ))}
          </ol>
        </Card>

        <div className="mt-auto flex flex-col gap-3">
          {canRetry ? (
            <Button
              size="lg"
              block
              autoFocus
              motionSafe={motionSafe}
              onClick={() => {
                bus.emit({ type: 'RETRY_CAMERA' });
              }}
            >
              {DENIED.retry}
            </Button>
          ) : (
            <Button
              size="lg"
              block
              autoFocus
              motionSafe={motionSafe}
              onClick={() => {
                window.location.reload();
              }}
            >
              {DENIED.reload}
            </Button>
          )}

          <Button
            variant="secondary"
            size="md"
            block
            motionSafe={motionSafe}
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
