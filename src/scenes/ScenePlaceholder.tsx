'use client';

/**
 * Phase 1 scene placeholder.
 *
 * Renders any state's descriptor as a real, keyboard-operable card so the whole
 * machine can be walked end to end before a single scene is designed. Replaced
 * per state as each phase builds its real component.
 *
 * Styled with the Doc 04 §A tokens — thick black borders, hard offset shadows,
 * #111 text only — so the design system is exercised from Phase 1 rather than
 * bolted on later.
 */

import { bus } from '@/events/bus';
import type { State } from '@/machine';
import { SCENES } from './registry';

interface ScenePlaceholderProps {
  readonly state: State;
}

export function ScenePlaceholder({ state }: ScenePlaceholderProps): React.ReactElement {
  const scene = SCENES[state];

  return (
    <section
      className="mx-auto flex w-full max-w-[480px] flex-col gap-4 px-5 py-8"
      aria-labelledby="scene-title"
    >
      <div className="rounded-[--radius-lg] border-3 border-ink bg-white p-6 shadow-[6px_6px_0_#111111]">
        <p className="font-mono text-xs tracking-wide text-ink/70">
          {state} · phase {scene.buildPhase}
        </p>

        <h1 id="scene-title" className="mt-2 font-display text-3xl leading-tight">
          {scene.title}
        </h1>

        <p className="mt-3 text-[15px] leading-relaxed text-ink/70">{scene.note}</p>

        {scene.actions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {scene.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  bus.emit(action.event);
                }}
                className={[
                  'interactive min-h-[48px] rounded-[--radius-md] border-3 border-ink px-5',
                  'font-display text-[15px] text-ink transition-transform',
                  'active:translate-x-[3px] active:translate-y-[3px]',
                  action.emphasis === 'primary'
                    ? 'bg-pink shadow-[6px_6px_0_#111111] active:shadow-[1px_1px_0_#111111]'
                    : action.emphasis === 'secondary'
                      ? 'bg-yellow shadow-[4px_4px_0_#111111] active:shadow-[1px_1px_0_#111111]'
                      : 'bg-white shadow-[4px_4px_0_#111111] active:shadow-[1px_1px_0_#111111]',
                ].join(' ')}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
