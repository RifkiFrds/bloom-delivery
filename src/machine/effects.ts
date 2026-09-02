/**
 * Effects — declarative descriptors, executed by a runner outside the machine.
 *
 * The reducer returns effects; it never performs them. This is what makes the
 * whole experience deterministically testable by replaying an event log with no
 * camera, no audio and no WebGL (Doc 01 §3, layer 3).
 *
 * Handlers are registered by the layers that own the capability — camera by the
 * detection layer, audio by the audio layer, and so on. In Phase 1 no handlers
 * are registered yet; unhandled effects are recorded in the diagnostic buffer
 * and surfaced in the debug panel, which is how the wiring is verified before
 * the implementations exist.
 */

import type { State } from './states';

export type Effect =
  /** Must run synchronously inside the user gesture (Doc 02 §2.3 X1). */
  | { readonly kind: 'audio.unlock' }
  | { readonly kind: 'audio.play'; readonly track: 'music'; readonly fadeMs: number }
  | { readonly kind: 'audio.setMuted'; readonly muted: boolean }
  | { readonly kind: 'assets.prefetch'; readonly bundle: AssetBundle }
  | { readonly kind: 'camera.acquire' }
  | { readonly kind: 'camera.attach' }
  | { readonly kind: 'camera.armCap' }
  /** Ordered teardown — cancel the loop BEFORE closing tasks (Doc 02 §2.15). */
  | { readonly kind: 'camera.teardown' }
  | { readonly kind: 'detection.start' }
  | { readonly kind: 'detection.stop' }
  | { readonly kind: 'detection.enableHands' }
  | { readonly kind: 'detection.pause' }
  | { readonly kind: 'detection.resume' }
  | { readonly kind: 'mercy.start' }
  | { readonly kind: 'mercy.pause' }
  | { readonly kind: 'mercy.resume' }
  /**
   * Ends the ladder and DISARMS it. `pause` alone is not enough: a paused
   * timer is still armed, so the next `VISIBILITY_VISIBLE` — an any-state row —
   * would resume it into a state with no `MERCY_TICK` row.
   */
  | { readonly kind: 'mercy.stop' }
  | { readonly kind: 'persist.write'; readonly key: PersistKey; readonly value: string }
  | { readonly kind: 'scene.mount3d' }
  | { readonly kind: 'scene.degradeToLite' }
  | { readonly kind: 'photo.capture' }
  | { readonly kind: 'photo.download' }
  | { readonly kind: 'letter.decode' }
  | { readonly kind: 'timer.start'; readonly id: TimerId; readonly ms: number }
  | { readonly kind: 'timer.cancel'; readonly id: TimerId }
  | { readonly kind: 'diagnostic.record'; readonly message: string };

export type AssetBundle =
  'vision-runtime' | 'face-model' | 'hand-model' | 'scene-3d' | 'audio';

export type PersistKey =
  'bloom_unlocked' | 'bloom_muted' | 'bloom_motion' | 'bloom_peeked';

export type TimerId =
  | 'modelTimeout'
  | 'togetherBeat'
  | 'unlockBeat'
  | 'deliveryBeat'
  | 'bloomBeat'
  | 'messageBeat'
  | 'letterSettle';

export type EffectHandler = (effect: Effect) => void;

/**
 * Effect runner.
 *
 * A handler registry rather than a switch, so each layer registers only what it
 * owns and the machine stays free of imports from those layers.
 */
export class EffectRunner {
  private readonly handlers = new Map<Effect['kind'], EffectHandler>();
  private readonly unhandled: string[] = [];

  register(kind: Effect['kind'], handler: EffectHandler): void {
    this.handlers.set(kind, handler);
  }

  run(effects: readonly Effect[], from: State, to: State): void {
    for (const effect of effects) {
      const handler = this.handlers.get(effect.kind);
      if (handler === undefined) {
        const note = `${from} → ${to}: no handler for "${effect.kind}"`;
        this.unhandled.push(note);
        if (this.unhandled.length > 50) this.unhandled.shift();
        continue;
      }
      handler(effect);
    }
  }

  /** Surfaced in the debug panel so unwired effects are visible, not silent. */
  unhandledLog(): readonly string[] {
    return this.unhandled;
  }
}
