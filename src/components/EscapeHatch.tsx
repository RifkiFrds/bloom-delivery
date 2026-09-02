'use client';

/**
 * ★ THE ESCAPE HATCH ★ — Doc 01 §9.4, Doc 02 §6.2, Doc 04 §B.9, §F.3.
 *
 * ── IN THE DOM AND KEYBOARD-FOCUSABLE FROM t=0 ───────────────────────────
 * Visually revealed at 45 s, but present and reachable by Tab from the moment
 * the camera stage mounts. This is the provision that satisfies WCAG 2.5.4
 * (motion actuation) and, more importantly, it means keyboard and screen-reader
 * users are never trapped behind a gesture they cannot perform.
 *
 * "Visually hidden" here means `opacity: 0` + `pointer-events: none` — NOT
 * `display: none` and NOT `visibility: hidden`, both of which remove it from
 * the tab order and defeat the entire point.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── IT IS NEVER STYLED AS A FAILURE ──────────────────────────────────────
 * No "skip", no "give up", no lock icon, no greyed treatment. It is a gift
 * being handed over early: `--yellow`, a wrapped-present icon, growing in
 * prominence as the ladder escalates.
 *
 * AND IT NEVER FIRES ITSELF. An auto-unlock reads as a bug and steals the
 * moment of agency that makes the unlock feel earned. It is always a tap.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { Button } from '@/components/ui/Button';
import { HATCH_LABEL } from '@/content/copy';
import { MERCY } from '@/detection/config';
import { bus } from '@/events/bus';
import type { MercyLevel } from '@/machine';
import { selectMotionSafe, useMachineStore } from '@/store/machineStore';

export interface EscapeHatchProps {
  readonly mercyLevel: MercyLevel;
}

export function EscapeHatch({ mercyLevel }: EscapeHatchProps): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);

  const visible = mercyLevel >= MERCY.hatchVisibleFrom;
  const primary = mercyLevel >= MERCY.hatchPrimaryFrom;

  return (
    <div
      // Focusable at every level; only its paint changes.
      className={[
        'transition-opacity duration-500 ease-out',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      ].join(' ')}
    >
      <Button
        variant="gift"
        size={primary ? 'xl' : 'lg'}
        block
        breathing={primary}
        motionSafe={motionSafe}
        onClick={() => {
          bus.emit({ type: 'MERCY_UNLOCK' });
        }}
      >
        <span aria-hidden="true">🎁</span> {HATCH_LABEL[mercyLevel]}
      </Button>
    </div>
  );
}
