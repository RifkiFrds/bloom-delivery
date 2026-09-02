/**
 * Gesture geometry suite — Doc 05 P4.2, Doc 03 §10.3.
 *
 * Runs in milliseconds against plain landmark data, with no browser, no WASM
 * and no camera. That is what turns threshold tuning from a two-people-in-a-room
 * loop into a ten-second loop.
 *
 * What each block pins:
 *   · every G1 condition's SIGN and the pose it exists to reject
 *   · the false-positive workhorses C5 and C6, individually
 *   · mercy monotonicity, asserted through the real evaluator
 *   · hysteresis widening only in the active direction
 *   · the hold timer's wall-clock accuracy at 10 Hz and 15 Hz
 *   · N-of-M applied to the final boolean
 *   · the coaching priority order
 */

import { describe, expect, it } from 'vitest';

import { CLOSENESS, G1, MERCY, NOFM, HOLD } from '@/detection/config';
import { statusFor } from '@/components/DetectionStatusCard';
import { deriveCoaching, type CoachingInput } from '@/detection/coaching';
import { evaluateG1 } from '@/detection/gesture/g1';
import { evaluateG2 } from '@/detection/gesture/g2';
import { evaluateG3 } from '@/detection/gesture/g3';
import { rawCloseness } from '@/detection/gesture/closeness';
import { HoldTimer } from '@/detection/gesture/hold';
import { upperBound, lowerBound } from '@/detection/gesture/hysteresis';
import { RingBuffer } from '@/detection/gesture/nofm';
import { selectGesture } from '@/detection/gesture/select';
import { palmScale } from '@/detection/gesture/metrics';
import { aspectFactor, correctHand } from '@/detection/gesture/space';
import { levelFor } from '@/detection/mercy';
import {
  borderlineHeartPair,
  claspedPair,
  fingerHeart,
  heartPair,
  highFivePair,
  invertedPair,
  mirroredFingerHearts,
  openPalmPair,
  tooFarPair,
} from './fixtures/hands';

const level0 = { mercyMultiplier: MERCY.multiplier[0], active: false };
const level1 = { mercyMultiplier: MERCY.multiplier[1], active: false };

describe('square correction — Doc 03 §2.1', () => {
  it('scales y by height/width and leaves x alone', () => {
    const factor = aspectFactor(1280, 720);
    expect(factor).toBeCloseTo(0.5625, 6);

    const corrected = correctHand([{ x: 0.4, y: 0.8 }], factor);
    expect(corrected[0]?.x).toBeCloseTo(0.4, 6);
    expect(corrected[0]?.y).toBeCloseTo(0.45, 6);
  });

  it('is identity on a square frame', () => {
    expect(aspectFactor(720, 720)).toBe(1);
  });

  /**
   * Skipping this step makes every threshold in the spec wrong by the aspect
   * ratio — the single most commonly skipped step in MediaPipe gesture work,
   * and the reason such code "works on the laptop and not on the phone".
   */
  it('changes a vertical distance by 44% on a 16:9 frame', () => {
    const factor = aspectFactor(1280, 720);
    const raw = 0.1;
    expect(raw * factor).toBeCloseTo(0.05625, 6);
  });
});

describe('fixtures are in the calibrated size band', () => {
  it('a heart hand sits comfortably above the 0.045 gate', () => {
    const { handA, handB } = heartPair();
    expect(palmScale(handA)).toBeGreaterThan(G1.minPalmScale);
    expect(palmScale(handB)).toBeGreaterThan(G1.minPalmScale);
  });
});

describe('G1 — the primary gesture', () => {
  it('ACCEPTS the canonical two-hand heart', () => {
    const { handA, handB } = heartPair();
    const result = evaluateG1({ handA, handB, ...level0 });
    expect(result.failedAt).toBeNull();
    expect(result.pass).toBe(true);
  });

  it('evaluates all seven conditions', () => {
    const { handA, handB } = heartPair();
    const result = evaluateG1({ handA, handB, ...level0 });
    expect(result.conditions.map((c) => c.id)).toEqual([
      'C1',
      'C2',
      'C3',
      'C4',
      'C5',
      'C6',
      'C7',
    ]);
  });

  /** C5 and C6 are the false-positive workhorses — Doc 03 §8.1. */
  it('REJECTS clasped hands at C5 (wrist aperture)', () => {
    const { handA, handB } = claspedPair();
    const result = evaluateG1({ handA, handB, ...level0 });
    expect(result.pass).toBe(false);
    expect(result.failedAt).toBe('C5');
  });

  it('REJECTS a high five (parallel palms, extended fingers)', () => {
    const { handA, handB } = highFivePair();
    const result = evaluateG1({ handA, handB, ...level0 });
    expect(result.pass).toBe(false);
    const c6 = result.conditions.find((c) => c.id === 'C6');
    const c7 = result.conditions.find((c) => c.id === 'C7');
    expect(c6?.pass).toBe(false);
    expect(c7?.pass).toBe(false);
  });

  it('REJECTS open palms at C7 (curl)', () => {
    const { handA, handB } = openPalmPair();
    const result = evaluateG1({ handA, handB, ...level0 });
    expect(result.pass).toBe(false);
    expect(result.conditions.find((c) => c.id === 'C7')?.pass).toBe(false);
  });

  it('REJECTS an upside-down heart at C4 (vertical order)', () => {
    const { handA, handB } = invertedPair();
    const result = evaluateG1({ handA, handB, ...level0 });
    expect(result.pass).toBe(false);
    expect(result.conditions.find((c) => c.id === 'C4')?.pass).toBe(false);
  });

  it('REJECTS hands too far from the camera at C1', () => {
    const { handA, handB } = tooFarPair();
    const result = evaluateG1({ handA, handB, ...level0 });
    expect(result.pass).toBe(false);
    expect(result.failedAt).toBe('C1');
  });

  it('does not throw on a malformed hand — it fails C1', () => {
    const { handA } = heartPair();
    const result = evaluateG1({ handA, handB: [], ...level0 });
    expect(result.pass).toBe(false);
    expect(result.failedAt).toBe('C1');
  });
});

describe('G2 and G3 — the finger hearts', () => {
  it('G2 ACCEPTS a one-hand finger heart', () => {
    const result = evaluateG2({ hand: fingerHeart(), ...level1 });
    expect(result.failedAt).toBeNull();
    expect(result.pass).toBe(true);
  });

  it('G2 REJECTS an open palm', () => {
    const { handA } = openPalmPair();
    expect(evaluateG2({ hand: handA, ...level1 }).pass).toBe(false);
  });

  it('G3 ACCEPTS two finger hearts with the wrists far apart', () => {
    const { handA, handB } = mirroredFingerHearts();
    const result = evaluateG3({ handA, handB, ...level1 });
    expect(result.failedAt).toBeNull();
    expect(result.pass).toBe(true);
  });

  /**
   * The wrist-separation requirement is what distinguishes TWO PEOPLE each
   * making a finger heart from ONE PERSON holding both hands together.
   */
  it('G3 REJECTS two finger hearts made by one person (wrists together)', () => {
    const hand = fingerHeart();
    const result = evaluateG3({ handA: hand, handB: hand, ...level1 });
    expect(result.pass).toBe(false);
    expect(result.failedAt).toBe('SEP');
  });
});

describe('acceptance policy over time — Doc 03 §6.7', () => {
  it('G1 is accepted at level 0', () => {
    const { handA, handB } = heartPair();
    const result = selectGesture({
      hands: [handA, handB],
      mercyLevel: 0,
      active: false,
      tripodMode: false,
    });
    expect(result.accepted).toBe(true);
    expect(result.variant).toBe('G1');
  });

  it('a lone finger heart is REJECTED at level 0', () => {
    const result = selectGesture({
      hands: [fingerHeart()],
      mercyLevel: 0,
      active: false,
      tripodMode: false,
    });
    expect(result.accepted).toBe(false);
  });

  it('the same finger heart is ACCEPTED at level 1', () => {
    const result = selectGesture({
      hands: [fingerHeart()],
      mercyLevel: 1,
      active: false,
      tripodMode: false,
    });
    expect(result.accepted).toBe(true);
    expect(result.variant).toBe('G2');
  });

  /** Tripod Mode frees both hands, so G2 lands at every level (Doc 04 §E.3). */
  it('Tripod Mode accepts a finger heart at level 0', () => {
    const result = selectGesture({
      hands: [fingerHeart()],
      mercyLevel: 0,
      active: false,
      tripodMode: true,
    });
    expect(result.accepted).toBe(true);
  });

  /**
   * ★ Doc 05 P4.9 — level 1 must be STRICTLY more permissive than level 0.
   * Asserted through the real evaluator, so it cannot be satisfied by a
   * tautology over constants.
   */
  it('level 1 accepts a borderline heart that level 0 rejects', () => {
    const { handA, handB } = borderlineHeartPair();
    expect(evaluateG1({ handA, handB, ...level0 }).pass).toBe(false);
    expect(evaluateG1({ handA, handB, ...level1 }).pass).toBe(true);
  });

  it('G1 is still evaluated at the highest mercy level', () => {
    const { handA, handB } = heartPair();
    const result = selectGesture({
      hands: [handA, handB],
      mercyLevel: 3,
      active: false,
      tripodMode: false,
    });
    expect(result.variant).toBe('G1');
  });

  it('the ladder maps active time to the right rung', () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(19_999)).toBe(0);
    expect(levelFor(20_000)).toBe(1);
    expect(levelFor(44_999)).toBe(1);
    expect(levelFor(45_000)).toBe(2);
    expect(levelFor(89_999)).toBe(2);
    expect(levelFor(90_000)).toBe(3);
  });
});

describe('hysteresis — Doc 03 §7.1', () => {
  it('widens an upper bound only while active', () => {
    expect(upperBound(0.1, false)).toBeCloseTo(0.1, 6);
    expect(upperBound(0.1, true)).toBeCloseTo(0.13, 6);
  });

  it('widens a lower bound downward while active', () => {
    expect(lowerBound(0.13, false)).toBeCloseTo(0.13, 6);
    expect(lowerBound(0.13, true)).toBeCloseTo(0.1, 6);
  });

  it('lets a hand that has just left the bound stay accepted', () => {
    const { handA, handB } = borderlineHeartPair();
    // Rejected on entry at level 0…
    expect(evaluateG1({ handA, handB, ...level0 }).pass).toBe(false);
    // …but the same geometry holds once already active.
    expect(
      evaluateG1({ handA, handB, mercyMultiplier: MERCY.multiplier[0], active: true })
        .pass,
    ).toBe(true);
  });
});

describe('N-of-M — Doc 03 §4.5', () => {
  it('requires 5 of the last 7', () => {
    const buffer = new RingBuffer(NOFM.window, NOFM.required);
    expect(buffer.push(true)).toBe(false);
    for (let i = 0; i < 3; i += 1) buffer.push(true);
    expect(buffer.trueCount).toBe(4);
    expect(buffer.push(true)).toBe(true);
  });

  it('absorbs a single dropped frame', () => {
    const buffer = new RingBuffer(NOFM.window, NOFM.required);
    for (let i = 0; i < 7; i += 1) buffer.push(true);
    expect(buffer.push(false)).toBe(true);
  });

  it('drops out once too many frames are lost', () => {
    const buffer = new RingBuffer(NOFM.window, NOFM.required);
    for (let i = 0; i < 7; i += 1) buffer.push(true);
    buffer.push(false);
    buffer.push(false);
    expect(buffer.push(false)).toBe(false);
  });
});

describe('hold timer — Doc 03 §7.2', () => {
  /**
   * Wall-clock accuracy at any cadence. A tick-count implementation would make
   * the gesture 50% longer at 10 Hz — on exactly the devices whose users are
   * least patient.
   */
  it.each([
    ['15 Hz', 66],
    ['10 Hz', 100],
  ])('takes 900 ms of real time at %s', (_label, dtMs) => {
    const timer = new HoldTimer();
    let elapsed = 0;
    let completedAt = -1;

    for (let i = 0; i < 40; i += 1) {
      elapsed += dtMs;
      const state = timer.update(true, dtMs);
      if (state.completed) {
        completedAt = elapsed;
        break;
      }
    }

    expect(completedAt).toBeGreaterThanOrEqual(HOLD.targetMs);
    expect(completedAt).toBeLessThan(HOLD.targetMs + dtMs + 1);
  });

  // Each step stays under `HOLD.maxDtMs`, so the stall guard is not what is
  // under test here.
  it('spends the 200 ms grace before decaying', () => {
    const timer = new HoldTimer();
    timer.update(true, 200);
    timer.update(true, 200);
    const afterGrace = timer.update(false, 200);
    expect(afterGrace.holdMs).toBe(400);
  });

  /**
   * A hard reset on one dropped frame is punishing and feels broken. Visible
   * decay says "you had it, come back" — the only coaching that operates on a
   * sub-second timescale.
   */
  it('DECAYS rather than resetting, at twice the fill rate', () => {
    const timer = new HoldTimer();
    timer.update(true, 200);
    timer.update(true, 200);
    timer.update(false, 200); // consumes the grace
    const decayed = timer.update(false, 100);
    expect(decayed.holdMs).toBe(200); // 400 − 100×2
    expect(decayed.holdMs).toBeGreaterThan(0);
  });

  it('fires HOLD_COMPLETE exactly once per charge', () => {
    const timer = new HoldTimer();
    let fires = 0;
    for (let i = 0; i < 30; i += 1) {
      if (timer.update(true, 66).completed) fires += 1;
    }
    expect(fires).toBe(1);
  });

  it('caps an enormous dt from a stalled tab', () => {
    const timer = new HoldTimer();
    const state = timer.update(true, 60_000);
    expect(state.holdMs).toBeLessThanOrEqual(HOLD.maxDtMs);
  });
});

describe('closeness — Doc 03 §6.5', () => {
  it('is 1 for a comfortably satisfied gesture', () => {
    const { handA, handB } = heartPair();
    const result = evaluateG1({ handA, handB, ...level0 });
    expect(rawCloseness(result.conditions)).toBeGreaterThan(0.5);
  });

  it('is low for a pose that satisfies almost nothing', () => {
    const { handA, handB } = highFivePair();
    const result = evaluateG1({ handA, handB, ...level0 });
    expect(rawCloseness(result.conditions)).toBeLessThan(0.6);
  });

  it('excludes C1, which is a size gate rather than a shape cue', () => {
    const { handA, handB } = heartPair();
    const conditions = evaluateG1({ handA, handB, ...level0 }).conditions;
    const withoutC1 = conditions.filter((c) => c.id !== 'C1');
    expect(rawCloseness(conditions)).toBeCloseTo(rawCloseness(withoutC1), 6);
  });
});

describe('coaching priority — Doc 04 §B.9, first match wins', () => {
  const base: CoachingInput = {
    tooDark: false,
    faceCount: 2,
    handCount: 2,
    togetherConfirmed: true,
    maxPalmScale: 0.06,
    closeness: 0,
    holdMs: 0,
    faceDwellMs: 5000,
    noHandsDwellMs: 0,
  };

  it('TOO_DARK pre-empts everything', () => {
    expect(deriveCoaching({ ...base, tooDark: true, faceCount: 0 })).toBe('TOO_DARK');
  });

  it('NO_FACES after 1.0 s of nothing', () => {
    expect(deriveCoaching({ ...base, faceCount: 0, faceDwellMs: 1200 })).toBe('NO_FACES');
    expect(deriveCoaching({ ...base, faceCount: 0, faceDwellMs: 400 })).not.toBe(
      'NO_FACES',
    );
  });

  it('ONE_FACE only before the latch closes', () => {
    expect(deriveCoaching({ ...base, faceCount: 1, togetherConfirmed: false })).toBe(
      'ONE_FACE',
    );
    expect(deriveCoaching({ ...base, faceCount: 1, togetherConfirmed: true })).not.toBe(
      'ONE_FACE',
    );
  });

  it('HANDS_TOO_SMALL when the size gate fails', () => {
    expect(deriveCoaching({ ...base, maxPalmScale: 0.03 })).toBe('HANDS_TOO_SMALL');
  });

  it('ALMOST once closeness crosses 0.65', () => {
    expect(deriveCoaching({ ...base, closeness: 0.7 })).toBe('ALMOST');
  });

  it('HOLDING outranks IDLE but not ALMOST', () => {
    expect(deriveCoaching({ ...base, holdMs: 100 })).toBe('HOLDING');
    expect(deriveCoaching({ ...base, holdMs: 100, closeness: 0.9 })).toBe('ALMOST');
  });

  it('IDLE is the default', () => {
    expect(deriveCoaching(base)).toBe('IDLE');
  });
});

describe('the realtime status pill — Doc 04 §B.9 companion', () => {
  /**
   * Purely a DISPLAY derivation. `closeness` is a UI-only scalar by design
   * (Doc 03 §6.5) and must never gate a transition — reading it here is exactly
   * what it exists for.
   */
  it('reports what the user needs to know, in order of urgency', () => {
    expect(statusFor(0, 0, 0)).toBe('searching');
    expect(statusFor(1, 0, 0)).toBe('oneHand');
    expect(statusFor(2, 0, 0)).toBe('twoHands');
    expect(statusFor(2, CLOSENESS.almostThreshold, 0)).toBe('almost');
    expect(statusFor(2, 1, 1)).toBe('complete');
  });

  it('completion outranks everything, even a lost hand mid-hold', () => {
    expect(statusFor(0, 0, 1)).toBe('complete');
  });

  it('"almost" needs the same threshold the coaching state uses', () => {
    expect(statusFor(2, CLOSENESS.almostThreshold - 0.01, 0)).toBe('twoHands');
  });
});
