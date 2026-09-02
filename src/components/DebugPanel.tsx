'use client';

/**
 * Debug panel — Doc 05 P1.9.
 *
 * Shows the current state, the machine context, the last 10 events, the store
 * write counter, unhandled effects, and a jump control for every state.
 *
 * The WRITE COUNTER is not decoration: it is the live proof of the ~8-writes-
 * per-session budget (Doc 01 §6.3). If it climbs during idle, something is
 * writing the store from a loop and that is a defect.
 *
 * Enabled by `?debug=1`. Excluded from production by a build-time flag so it
 * never ships as dead weight or as an accidental surface.
 */

import { useEffect, useState } from 'react';

import { bus } from '@/events/bus';
import { detectionRuntime } from '@/detection/runtime';
import { STATES, type State } from '@/machine';
import { log } from '@/lib/diagnostics';
import { isEphemeral } from '@/lib/persistence';
import {
  effectRunner,
  selectContext,
  selectState,
  selectWrites,
  useMachineStore,
} from '@/store/machineStore';

export function DebugPanel(): React.ReactElement | null {
  const state = useMachineStore(selectState);
  const context = useMachineStore(selectContext);
  const writes = useMachineStore(selectWrites);
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);

  // The diagnostic and effect logs are plain arrays outside React, so poll
  // them at a human rate rather than making them reactive state.
  useEffect(() => {
    const id = window.setInterval(() => {
      force((n) => n + 1);
    }, 500);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <aside className="fixed bottom-3 right-3 z-50 max-w-[min(92vw,420px)] font-mono text-[11px]">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="min-h-[48px] rounded-[12px] border-3 border-ink bg-yellow px-4 shadow-[4px_4px_0_#111111]"
      >
        debug · {state} · w{String(writes)}
      </button>

      {open && (
        <div className="mt-2 max-h-[70dvh] overflow-auto rounded-[12px] border-3 border-ink bg-white p-3 shadow-[6px_6px_0_#111111]">
          <Section title="context">
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(context, null, 1)}
            </pre>
            {isEphemeral() && (
              <p className="mt-1 text-ink/70">storage unavailable — in-memory shim</p>
            )}
          </Section>

          <Section title="last 10 events">
            {bus.recent().length === 0 ? (
              <p className="text-ink/70">none</p>
            ) : (
              <ol className="space-y-0.5">
                {bus.recent().map((event, index) => (
                  <li key={`${event.type}-${String(index)}`}>{event.type}</li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="transitions">
            <ol className="space-y-0.5">
              {log()
                .slice(0, 8)
                .map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
            </ol>
          </Section>

          <Section title="unhandled effects">
            {effectRunner.unhandledLog().length === 0 ? (
              <p className="text-ink/70">none</p>
            ) : (
              <ol className="space-y-0.5">
                {effectRunner
                  .unhandledLog()
                  .slice(-6)
                  .map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
              </ol>
            )}
          </Section>

          <Section title="jump to state">
            <div className="flex flex-wrap gap-1">
              {STATES.map((target) => (
                <JumpButton key={target} target={target} active={target === state} />
              ))}
            </div>
          </Section>
        </div>
      )}
    </aside>
  );
}

function Section({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>): React.ReactElement {
  return (
    <section className="mb-3">
      <h2 className="mb-1 border-b-2 border-ink pb-0.5 font-mono text-[11px] uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Jumping bypasses the transition table on purpose — it is a development
 * affordance for reaching a state without walking the whole flow, and it is
 * the only place in the app permitted to set state outside the reducer.
 *
 * ── AND THAT BYPASS HAS A COST WORTH KNOWING ────────────────────────────
 * Skipping the reducer skips its EFFECTS. Jumping straight to
 * `SEEKING_GESTURE` therefore never ran `detection.enableHands`, so the gesture
 * stage arrived with the hand model switched off — which looks exactly like
 * broken hand tracking rather than like a missing side effect.
 *
 * So the jump now syncs the detection mode it lands in. It is still not a real
 * transition, and `?solo=1` remains the honest way to walk the flow alone.
 * ─────────────────────────────────────────────────────────────────────────
 */
function syncDetectionFor(target: State): void {
  if (target === 'SEEKING_GESTURE' || target === 'GESTURE_HOLDING') {
    detectionRuntime.enableHands();
  }
}

/** States from which the experience has not yet been unlocked. */
const PRE_UNLOCK: ReadonlySet<State> = new Set<State>([
  'BOOT',
  'LANDING',
  'PREFLIGHT',
  'REQUESTING_CAMERA',
  'LOADING_DETECTION',
  'SEEKING_FACES',
  'SOLO_PROMPT',
  'TOGETHER_CONFIRMED',
  'SEEKING_GESTURE',
  'GESTURE_HOLDING',
]);

/**
 * Jumping BACKWARD releases the session latches.
 *
 * ── THE TRAP THIS CLOSES ─────────────────────────────────────────────────
 * `hasUnlocked` is write-once for the whole session, which is exactly right in
 * production — it is what makes the sequence run once, and it is what kills
 * every double-fire race.
 *
 * But pressing "force unlock" and then jumping back to `SEEKING_GESTURE` leaves
 * it latched, so every later `HOLD_COMPLETE` is guarded away in silence. The
 * gesture keeps working, the ring keeps filling and the status pill still
 * reaches "Sempurna" — all three read `holdProgress`, which knows nothing about
 * the machine — and the flowers never come.
 *
 * It looks exactly like broken detection. It is a latch doing its job.
 * ─────────────────────────────────────────────────────────────────────────
 */
function releaseLatchesFor(target: State): void {
  if (!PRE_UNLOCK.has(target)) return;
  useMachineStore.setState((store) => ({
    context: { ...store.context, hasUnlocked: false, unlockedByPeek: false },
  }));
}

function JumpButton({
  target,
  active,
}: Readonly<{ target: State; active: boolean }>): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => {
        useMachineStore.setState({ state: target });
        releaseLatchesFor(target);
        syncDetectionFor(target);
      }}
      className={[
        'rounded-[8px] border-2 border-ink px-1.5 py-0.5',
        active ? 'bg-pink' : 'bg-white',
      ].join(' ')}
    >
      {target}
    </button>
  );
}
