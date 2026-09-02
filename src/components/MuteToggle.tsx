'use client';

/**
 * The persistent mute toggle — Doc 04 §D.4.
 *
 * ONE toggle, fixed top-right, present from Scene 1 onward. It mutes BOTH buses
 * — there are deliberately no separate music/SFX controls, which would be a
 * settings panel this product should not have.
 *
 * Sits inside `env(safe-area-inset-*)` because a chunky button under the notch
 * or the home indicator is a real and very likely bug (Doc 04 §E.4).
 */

import { bus } from '@/events/bus';
import { MUTE } from '@/content/copy';
import { selectMuted, useMachineStore } from '@/store/machineStore';

export function MuteToggle(): React.ReactElement {
  const muted = useMachineStore(selectMuted);

  return (
    <div className="pointer-events-none fixed right-0 top-0 z-50 p-4 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))]">
      <button
        type="button"
        aria-pressed={muted}
        aria-label={muted ? MUTE.unmute : MUTE.mute}
        onClick={() => {
          bus.emit({ type: 'MUTE_TOGGLED' });
        }}
        className="interactive pointer-events-auto flex h-12 w-12 items-center justify-center rounded-[16px] border-3 border-ink bg-white text-xl shadow-[4px_4px_0_#111111] transition-[transform,box-shadow] duration-[80ms] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_#111111]"
      >
        <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
      </button>
    </div>
  );
}
