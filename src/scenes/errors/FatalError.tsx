'use client';

/**
 * `FATAL_ERROR` — the last line of the no-dead-end invariant. Doc 04 §B.18,
 * Doc 02 §2.22.
 *
 * Reached when a `FATAL` event is emitted programmatically. A render error
 * caught by the boundary renders the boundary's own twin of this screen,
 * because at that point the tree below it cannot be trusted to mount.
 *
 * ── WHY COPYABLE AND NOT SENT ────────────────────────────────────────────
 * PRD v2 rejected an opt-in error beacon. Any network egress, however small,
 * would put an asterisk on "your camera never leaves this phone" — and that
 * asterisk costs more than the telemetry is worth. If it breaks, she
 * screenshots it. CSP `connect-src 'self'` enforces this structurally.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SceneShell } from '@/components/SceneShell';
import { FATAL } from '@/content/copy';
import { bus } from '@/events/bus';
import { buildDiagnosticString } from '@/lib/diagnostics';
import { copyToClipboard } from '@/lib/platform';
import { selectContext, selectMotionSafe, useMachineStore } from '@/store/machineStore';

export function FatalError(): React.ReactElement {
  const motionSafe = useMachineStore(selectMotionSafe);
  const context = useMachineStore(selectContext);

  const diagnostic =
    context.lastError ?? buildDiagnosticString('FATAL_ERROR', new Error('unknown'));

  return (
    <SceneShell heading={FATAL.title} announcement={`${FATAL.title} ${FATAL.body}`}>
      <div className="mt-6 flex flex-1 flex-col gap-4">
        <Card tone="soft" motionSafe={motionSafe} role="alert">
          <p className="text-[clamp(1.0625rem,4vw,1.25rem)] leading-[1.55]">
            {FATAL.body}
          </p>
          <div className="mt-6">
            <Button
              size="xl"
              block
              autoFocus
              motionSafe={motionSafe}
              onClick={() => {
                bus.emit({ type: 'SKIP_TO_LETTER' });
              }}
            >
              {FATAL.cta}
            </Button>
          </div>
        </Card>

        <details className="rounded-[20px] border-3 border-ink bg-white p-4 shadow-[4px_4px_0_#111111]">
          <summary className="cursor-pointer font-display text-[15px]">
            {FATAL.diagnosticLabel}
          </summary>
          <pre className="mt-3 max-h-64 select-text overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.4]">
            {diagnostic}
          </pre>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              motionSafe={motionSafe}
              onClick={() => {
                void copyToClipboard(diagnostic);
              }}
            >
              {FATAL.copy}
            </Button>
          </div>
        </details>
      </div>
    </SceneShell>
  );
}
