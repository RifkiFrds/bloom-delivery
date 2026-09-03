/**
 * The audio manager — Doc 04 §D, Doc 05 Phase 8.
 *
 * Howler with `html5: false` (Web Audio), which is required for playback-rate
 * manipulation on `sfx.charge` and for low-latency sprite playback.
 *
 * ── THE 45-SECOND PROBLEM ────────────────────────────────────────────────
 * The `AudioContext` was unlocked on the Scene-1 Start tap — the only reliable
 * user gesture in the flow — and music does not begin until `UNLOCKING` exits,
 * roughly forty-five seconds later. The context is kept ALIVE for the whole
 * session and never recreated. See `audio/unlock.ts`.
 *
 * Howler maintains its own context; `unlockAudio()` runs first so that the
 * browser has already granted playback by the time Howler initialises, and
 * `Howler.ctx.resume()` on every return from the background keeps it that way.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── FAILURE IS SILENCE, NOT AN ERROR ─────────────────────────────────────
 * If the assets 404, decode fails, or Web Audio is unavailable, `available`
 * stays false and every method becomes a no-op. Nothing is surfaced to the
 * user. All sound in this product is decorative by design, so a silent run is a
 * complete run (Doc 04 §D.5).
 *
 * The iOS physical ringer switch also mutes Web Audio and CANNOT be worked
 * around. Scene 1's "Sound on for the full effect 🔊" line is what converts
 * that from a bug into an understood condition.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { Howl, Howler } from 'howler';

import { record } from '@/lib/diagnostics';
import { resumeAudio, suspendAudio } from './unlock';
import {
  CHARGE_FADE_MS,
  CHARGE_RATE_MAX,
  CHARGE_RATE_MIN,
  MUSIC_SOURCES,
  MUSIC_VOLUME,
  SFX_SOURCES,
  SFX_SPRITE,
  SFX_VOLUME,
  type SfxId,
} from './sprite';

class AudioManager {
  private sfx: Howl | null = null;
  private music: Howl | null = null;
  private chargeId: number | null = null;
  private muted = false;
  private sfxReady = false;
  private musicReady = false;
  private loadStarted = false;
  private musicRequested = false;

  /**
   * Begins loading. Called from the `assets.prefetch` effect for the `audio`
   * bundle, which fires at `TOGETHER_CONFIRMED` — roughly twenty seconds before
   * the first sound is needed.
   */
  load(): void {
    if (this.loadStarted) return;
    this.loadStarted = true;

    this.sfx = new Howl({
      src: [...SFX_SOURCES],
      sprite: { ...SFX_SPRITE },
      html5: false,
      preload: true,
      volume: SFX_VOLUME,
      onload: () => {
        this.sfxReady = true;
        record('audio: sfx sprite ready');
      },
      onloaderror: () => {
        record('audio: sfx sprite unavailable — running silent');
      },
    });

    this.music = new Howl({
      src: [...MUSIC_SOURCES],
      html5: false,
      preload: true,
      loop: true,
      volume: 0,
      onload: () => {
        this.musicReady = true;
        record('audio: music ready');
        if (this.musicRequested) this.playMusic(800);
      },
      onloaderror: () => {
        record('audio: music unavailable — running silent');
      },
    });
  }

  /** True when at least one bus can actually make a sound. */
  get available(): boolean {
    return this.sfxReady || this.musicReady;
  }

  play(id: SfxId): void {
    if (!this.sfxReady || this.muted || this.sfx === null) return;
    this.sfx.play(id);
  }

  /** The rising charge tone. Looped, started once per hold. */
  startCharge(): void {
    if (!this.sfxReady || this.muted || this.sfx === null) return;
    if (this.chargeId !== null) return;
    this.chargeId = this.sfx.play('charge');
  }

  /** Maps `holdProgress` onto the playback rate. Called from the ring's rAF. */
  setChargeProgress(progress: number): void {
    if (this.chargeId === null || this.sfx === null) return;
    const clamped = Math.max(0, Math.min(1, progress));
    this.sfx.rate(
      CHARGE_RATE_MIN + (CHARGE_RATE_MAX - CHARGE_RATE_MIN) * clamped,
      this.chargeId,
    );
  }

  /** Fades out over 100 ms rather than cutting — a hard stop reads as a glitch. */
  stopCharge(): void {
    const id = this.chargeId;
    if (id === null || this.sfx === null) return;
    this.chargeId = null;
    this.sfx.fade(SFX_VOLUME, 0, CHARGE_FADE_MS, id);
    window.setTimeout(() => {
      this.sfx?.stop(id);
      this.sfx?.volume(SFX_VOLUME, id);
    }, CHARGE_FADE_MS);
  }

  /** Doc 04 §D.3 — an 800 ms fade-in. Never starts at full volume. */
  playMusic(fadeMs: number): void {
    this.musicRequested = true;
    if (!this.musicReady || this.music === null) return;
    if (!this.music.playing()) this.music.play();
    this.music.fade(0, this.muted ? 0 : MUSIC_VOLUME, fadeMs);
  }

  /** One toggle, both buses. There are deliberately no separate controls. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
    if (muted) this.stopCharge();
  }

  /** iOS suspends the context on backgrounding; every return must resume it. */
  onHidden(): void {
    Howler.volume(0);
    suspendAudio();
  }

  onVisible(): void {
    resumeAudio();
    // Howler keeps its own context alongside the one `unlock.ts` primed.
    if (Howler.ctx.state === 'suspended') void Howler.ctx.resume();
    Howler.volume(this.muted ? 0 : 1);
  }

  /** Released at teardown so no decoded buffer survives into Phase B. */
  dispose(): void {
    this.stopCharge();
    this.sfx?.unload();
    this.music?.unload();
    this.sfx = null;
    this.music = null;
    this.sfxReady = false;
    this.musicReady = false;
  }
}

export const audio = new AudioManager();
