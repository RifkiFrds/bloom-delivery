'use client';

/**
 * Scene 2 — `PREFLIGHT`. Doc 04 §B.3, Doc 02 §2.4, §6.4.
 *
 * ── THIS SCREEN IS NOT DECORATION ────────────────────────────────────────
 * It does three jobs at once:
 *   1. Delivers the privacy promise BEFORE the prompt. Because Safari does not
 *      expose permission state, this is the ONLY pre-prompt intervention
 *      available, and it materially raises the grant rate.
 *   2. Sets the two-person expectation before the camera is live.
 *   3. Buys ~6 s of download time, and its Continue starts the 7.5 MB hand
 *      model behind the permission prompt.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The motion toggle lives HERE rather than in a settings menu: people who never
 * set the OS preference can still opt in, and this is the last screen before
 * the motion-heavy portion begins.
 */

import { motion } from 'motion/react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SceneShell } from '@/components/SceneShell';
import { PREFLIGHT } from '@/content/copy';
import { bus } from '@/events/bus';
import { write } from '@/lib/persistence';
import { duration, resolveSpring } from '@/motion/tokens';
import { selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function Preflight(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);

  return (
    <SceneShell
      heading={PREFLIGHT.title}
      announcement="Camera stays on your phone. Nothing is recorded, uploaded, or saved."
    >
      <div className="mt-6 flex flex-1 flex-col gap-6">
        <Card motionSafe={motionSafe}>
          <motion.p
            aria-hidden="true"
            className="text-3xl"
            initial={motionSafe ? { rotate: -12 } : false}
            animate={{ rotate: 0 }}
            transition={resolveSpring('bouncy', motionSafe)}
          >
            🌷
          </motion.p>
          <h2 className="mt-3 font-display text-[clamp(1.375rem,5vw,1.875rem)] leading-[1.2]">
            {PREFLIGHT.promiseHeading}
          </h2>
          <p className="mt-3 text-[clamp(1.0625rem,4vw,1.25rem)] leading-[1.55]">
            {PREFLIGHT.promiseBody}
          </p>
        </Card>

        <motion.div
          initial={motionSafe ? { opacity: 0, y: 12 } : { opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.base, delay: motionSafe ? 0.1 : 0 }}
        >
          <p>{PREFLIGHT.expectation}</p>
          <p>{PREFLIGHT.duration}</p>
        </motion.div>

        <div className="mt-auto flex flex-col gap-5">
          <MotionToggle motionSafe={motionSafe} />
          <Button
            size="lg"
            block
            breathing
            motionSafe={motionSafe}
            onClick={() => {
              bus.emit({ type: 'PREFLIGHT_CONTINUE' });
            }}
          >
            {PREFLIGHT.cta}
          </Button>
        </div>
      </div>
    </SceneShell>
  );
}

/**
 * A real radio group with a visible label — not a switch. The two options are
 * named states, and a screen-reader user must hear which one is active.
 *
 * The selection is written straight to `bloom_motion` and applied by patching
 * the machine context, because `motionSafe` is read by the root `MotionConfig`
 * and must take effect on this screen, not on the next one.
 */
function MotionToggle({
  motionSafe,
}: {
  readonly motionSafe: boolean;
}): React.ReactElement {
  const set = (next: boolean): void => {
    write('bloom_motion', next ? 'full' : 'reduced');
    useMachineStore.setState((store) => ({
      context: { ...store.context, motionSafe: next },
    }));
  };

  return (
    <fieldset className="rounded-[20px] border-3 border-ink bg-white p-4 shadow-[4px_4px_0_#111111]">
      <legend className="px-2 font-display text-[15px]">{PREFLIGHT.motionLabel}</legend>
      <div className="flex gap-2" role="radiogroup" aria-label={PREFLIGHT.motionLabel}>
        {(
          [
            [PREFLIGHT.motionFull, true],
            [PREFLIGHT.motionReduced, false],
          ] as const
        ).map(([label, value]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={motionSafe === value}
            onClick={() => {
              set(value);
            }}
            className={[
              'interactive min-h-[48px] flex-1 rounded-[16px] border-3 border-ink px-4',
              'font-display text-[15px] transition-[transform,box-shadow] duration-[80ms]',
              'active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_#111111]',
              motionSafe === value
                ? 'bg-pink shadow-[4px_4px_0_#111111]'
                : 'bg-white shadow-[2px_2px_0_#111111]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
