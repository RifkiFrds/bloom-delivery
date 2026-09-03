/**
 * ★ THE iOS AUDIO UNLOCK RITUAL ★ — Doc 04 §D.1, Doc 02 §2.3 X1.
 *
 * ── WHY THIS IS ITS OWN MODULE AND RUNS IN PHASE 2 ───────────────────────
 * Music begins roughly FORTY-FIVE SECONDS after the Start tap. That tap is the
 * only reliable user gesture in the entire flow — every later moment is either
 * a detection edge (no user activation) or happens after the camera stage has
 * consumed the interaction budget.
 *
 * So the AudioContext is created, resumed, and primed with a one-sample silent
 * buffer INSIDE that click handler, synchronously, and then kept alive for the
 * whole session and never recreated.
 *
 * Getting this wrong produces a silent climax that is very hard to diagnose
 * later, because everything looks correct: the file loaded, `play()` resolved,
 * and no error was thrown. It just made no sound.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Nothing here is awaited. `resume()` returns a promise, which is fired and
 * forgotten deliberately: awaiting it would move the rest of the handler out of
 * the user-activation window.
 */

import { record } from '@/lib/diagnostics';
import { Howler } from 'howler';

/**
 * `window.AudioContext` is typed as always present, and genuinely is not — it is
 * absent in older iOS WebViews, where only the `webkit`-prefixed constructor
 * exists. Widening the window here is what makes the fallback expressible
 * without an `any`.
 */
interface AudioCapableWindow {
  readonly AudioContext?: typeof AudioContext;
  readonly webkitAudioContext?: typeof AudioContext;
}

let context: AudioContext | null = null;
let unlocked = false;

function createContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const candidate: AudioCapableWindow = window;
  const Ctor = candidate.AudioContext ?? candidate.webkitAudioContext;
  if (Ctor === undefined) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * Call SYNCHRONOUSLY inside the Start click handler. Idempotent.
 *
 * Returns false when Web Audio is unavailable, in which case the whole
 * experience runs silent — which is a supported outcome, because all sound in
 * this product is decorative by design (Doc 04 §D.5).
 */
export function unlockAudio(): boolean {
  if (unlocked && context !== null) return true;

  context ??= createContext();
  if (context === null) {
    record('audio: no AudioContext — running silent');
    return false;
  }

  // Fire-and-forget: awaiting would leave the user-activation window.
  void context.resume();

  // Howler owns a separate AudioContext. Resume and prime it in the same
  // gesture, otherwise a music request that finishes loading later can be
  // blocked by the browser's autoplay policy.
  if (Howler.ctx.state === 'suspended') void Howler.ctx.resume();
  try {
    const howlerSource = Howler.ctx.createBufferSource();
    howlerSource.buffer = Howler.ctx.createBuffer(1, 1, 22_050);
    howlerSource.connect(Howler.ctx.destination);
    howlerSource.start(0);
  } catch {
    // Resuming the context is enough on browsers that reject silent priming.
  }

  try {
    const buffer = context.createBuffer(1, 1, 22_050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
  } catch {
    // A failed silent buffer is not fatal; `resume()` alone is often enough.
  }

  unlocked = true;
  record(`audio: context unlocked (state=${context.state})`);
  return true;
}

/** The session-long context. Never recreated — see the header. */
export function audioContext(): AudioContext | null {
  return context;
}

export function isAudioUnlocked(): boolean {
  return unlocked && context !== null;
}

/** iOS suspends the context on backgrounding; every return must resume it. */
export function resumeAudio(): void {
  if (context === null) return;
  if (context.state === 'suspended') void context.resume();
}

export function suspendAudio(): void {
  if (context === null) return;
  if (context.state === 'running') void context.suspend();
}
