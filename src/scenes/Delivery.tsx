'use client';

/**
 * Scenes 9 and 10 — `DELIVERY` and `BLOOM`. Doc 04 §B.12, Doc 02 §2.16, §2.17.
 *
 * ── ONE COMPONENT, TWO BEATS ─────────────────────────────────────────────
 * `DELIVERY` and `BLOOM` are one continuous shot, not two screens. Splitting
 * them would unmount the stage between them — remounting a WebGL canvas
 * mid-sequence means a black frame and a shader recompile at the exact moment
 * the tulips are supposed to erupt.
 *
 * The FSM still owns the beat boundary; it arrives here as a prop, and both the
 * 3D and Lite implementations respond to it identically.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── NO SKIP BUTTON ───────────────────────────────────────────────────────
 * The sequence IS the gift, it is ~17 s, and a skip affordance during it would
 * be the only element on screen competing with the payoff.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The stage is `aria-hidden` with ONE polite announcement on entry — it carries
 * no information that is not repeated elsewhere (Doc 04 §F.6).
 */

import { useEffect } from 'react';

import { audio } from '@/audio/manager';
import { MuteToggle } from '@/components/MuteToggle';
import { SEQUENCE } from '@/content/copy';
import { announce } from '@/lib/live';
import { Stage } from './Stage';

export function Delivery(): React.ReactElement {
  useEffect(() => {
    announce(SEQUENCE.announcement);
    audio.play('whoosh');
    // The box lands 1.4 s in — the fall duration both stages share.
    const impact = window.setTimeout(() => {
      audio.play('thud');
    }, 1400);
    return () => {
      window.clearTimeout(impact);
    };
  }, []);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      <MuteToggle />
      <Stage beat="delivery" />
    </div>
  );
}

export function Bloom(): React.ReactElement {
  useEffect(() => {
    audio.play('pop');
    audio.play('whoosh');
  }, []);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      <MuteToggle />
      <Stage beat="bloom" />
    </div>
  );
}
