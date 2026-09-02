'use client';

/**
 * The single client boundary — Doc 01 §5.2 rule B7.
 *
 * `use client` appears exactly once in the application, here. Everything
 * camera- or WebGL-dependent hangs below it and is loaded with `ssr: false`.
 *
 * Responsibilities in Phase 1:
 *   - run the capability probe and emit BOOT_OK / ENV_BLOCKED
 *   - bind the visibility listener (pauses detection, audio and mercy timers)
 *   - host the error boundary, the live regions and the debug panel
 *   - render the current state's scene
 */

import { useEffect } from 'react';
import { MotionConfig } from 'motion/react';

import { registerEffectHandlers } from './effects';
import { DebugHUD } from '@/components/DebugHUD';
import { DebugPanel } from '@/components/DebugPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { bus } from '@/events/bus';
import { buildBootPayload, probeCapabilities } from '@/lib/capability';
import { activeFlags, isResetMode, isSoloMode } from '@/lib/devFlags';
import { clearPersisted } from '@/lib/persistence';
import { detectionRuntime } from '@/detection/runtime';
import { record } from '@/lib/diagnostics';
import { ScenePlaceholder } from '@/scenes/ScenePlaceholder';
import { SCENES } from '@/scenes/registry';
import { selectMotionSafe, selectState, useMachineStore } from '@/store/machineStore';

export default function ExperienceRoot(): React.ReactElement {
  // Registered before the first event can be emitted. Idempotent, so the
  // double render StrictMode performs in development is harmless.
  registerEffectHandlers();

  const state = useMachineStore(selectState);
  const motionSafe = useMachineStore(selectMotionSafe);

  // ── BOOT: capability routing, once, before any UI commits ─────────────────
  useEffect(() => {
    if (useMachineStore.getState().state !== 'BOOT') return;

    // Before the probe, not after: `buildBootPayload` reads these flags, and
    // `hasPriorUnlock` routes straight past the landing on the strength of one.
    if (isResetMode()) {
      clearPersisted();
      record('dev: persisted flags cleared (?reset=1)');
    }

    const report = probeCapabilities();
    record(
      `probe: secure=${String(report.secureContext)} ` +
        `gum=${String(report.hasGetUserMedia)} ` +
        `webgl2=${String(report.hasWebGL2)} inApp=${report.inAppBrowser ?? 'no'}`,
    );

    if (report.blocked !== null) {
      bus.emit(
        report.inAppBrowser === null
          ? { type: 'ENV_BLOCKED', reason: report.blocked }
          : { type: 'ENV_BLOCKED', reason: report.blocked, app: report.inAppBrowser },
      );
      return;
    }

    bus.emit({ type: 'BOOT_OK', payload: buildBootPayload(report) });
  }, []);

  // ── Development flags ─────────────────────────────────────────────────────
  // Applied before detection starts, and inert in a production build.
  useEffect(() => {
    if (isSoloMode()) detectionRuntime.enableSoloMode();
    const flags = activeFlags();
    if (flags.length > 0) record(`dev flags: ${flags.join(', ')}`);
  }, []);

  // ── Visibility: pause the loop, audio and the mercy timers ────────────────
  useEffect(() => {
    const onChange = (): void => {
      bus.emit({
        type: document.hidden ? 'VISIBILITY_HIDDEN' : 'VISIBILITY_VISIBLE',
      });
    };
    document.addEventListener('visibilitychange', onChange);
    return () => {
      document.removeEventListener('visibilitychange', onChange);
    };
  }, []);

  const scene = SCENES[state];
  const Scene = scene.component;

  return (
    <MotionConfig reducedMotion={motionSafe ? 'never' : 'always'}>
      <ErrorBoundary currentState={state}>
        <main className="min-h-dvh">
          {Scene === undefined ? <ScenePlaceholder state={state} /> : <Scene />}
        </main>

        {/* Doc 04 §F.4 — exactly two live regions, always present. */}
        <div id="sr-status" role="status" aria-live="polite" className="sr-only" />
        <div id="sr-alert" role="alert" aria-live="assertive" className="sr-only" />

        <DebugHUD />
        <DebugPanel />
      </ErrorBoundary>
    </MotionConfig>
  );
}
