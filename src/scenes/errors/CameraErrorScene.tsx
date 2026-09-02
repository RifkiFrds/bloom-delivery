'use client';

/**
 * `CAMERA_ERROR` — five failures, five copies. Doc 04 §B.17, Doc 02 §2.7.
 *
 * The copy is selected by `context.lastCameraErrorKind`, and the PRIMARY action
 * is selected with it: retry is offered only where retry genuinely works. For
 * `NotFoundError` and `OverconstrainedError` there is no camera to come back
 * to, so the primary action goes straight to the delivery.
 *
 * Every variant carries the escape to the letter. There is no dead end.
 */

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SceneShell } from '@/components/SceneShell';
import { CAMERA_ERRORS, ESCAPE, MODELS_FAILED_COPY } from '@/content/copy';
import { bus } from '@/events/bus';
import { selectContext, selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function CameraErrorScene(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const context = useMachineStore(selectContext);

  // A null kind means the machine arrived here from MODELS_FAILED, which has
  // its own copy rather than a getUserMedia name.
  const copy =
    context.lastCameraErrorKind === null
      ? MODELS_FAILED_COPY
      : CAMERA_ERRORS[context.lastCameraErrorKind];

  const skip = (): void => {
    bus.emit({ type: 'SKIP_TO_LETTER' });
  };

  return (
    <SceneShell heading={copy.title} announcement={`${copy.title}. ${copy.body}`}>
      <div className="mt-6 flex flex-1 flex-col gap-6">
        <Card tone="soft" motionSafe={motionSafe} role="alert">
          <p aria-hidden="true" className="text-3xl">
            🌷
          </p>
          <p className="mt-3 text-[clamp(1.0625rem,4vw,1.25rem)] leading-[1.55]">
            {copy.body}
          </p>
        </Card>

        <div className="mt-auto flex flex-col gap-3">
          {copy.primary === 'retry' ? (
            <>
              <Button
                size="lg"
                block
                autoFocus
                motionSafe={motionSafe}
                onClick={() => {
                  bus.emit({ type: 'RETRY_CAMERA' });
                }}
              >
                Try again
              </Button>
              <Button
                variant="secondary"
                size="md"
                block
                motionSafe={motionSafe}
                onClick={skip}
              >
                {ESCAPE.liteEntry}
              </Button>
            </>
          ) : (
            <Button size="lg" block autoFocus motionSafe={motionSafe} onClick={skip}>
              {ESCAPE.liteEntry}
            </Button>
          )}
        </div>
      </div>
    </SceneShell>
  );
}
