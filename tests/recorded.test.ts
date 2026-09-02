/**
 * Recorded-clip rates — the Phase 4 exit criteria, measured. Doc 03 §10.3,
 * Doc 05 §8.
 *
 * ── THIS SUITE IS DORMANT UNTIL THE CLIPS EXIST ──────────────────────────
 * `tests/gesture.test.ts` pins the GEOMETRY against hand-constructed landmark
 * sets. It cannot establish a true-positive or false-positive RATE — that needs
 * real hands, a real room, and evening light.
 *
 * When `tests/fixtures/recorded/index.json` exists, this suite measures both
 * rates automatically against the Doc 05 §8 thresholds:
 *
 *   G1 true-positive  ≥ 85%   ·   false-positive = 0
 *
 * Until then it reports what is missing rather than passing silently, because a
 * dormant suite that looks green is worse than no suite: it converts an
 * outstanding measurement into an apparent one.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * See `scripts/dump-landmarks.mjs` for the three-step recording workflow.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { MERCY } from '@/detection/config';
import { selectGesture } from '@/detection/gesture/select';
import type { Hand, Point } from '@/detection/types';
import type { MercyLevel } from '@/machine';

const INDEX_URL = new URL('./fixtures/recorded/index.json', import.meta.url);
const INDEX_PATH = fileURLToPath(INDEX_URL);

interface IndexEntry {
  readonly file: string;
  readonly name: string;
  readonly expectation: string;
  readonly lighting: 'daylight' | 'evening';
  readonly device: string;
  readonly frames: number;
}

interface RecordedFrame {
  readonly aspect: number;
  readonly hands: readonly (readonly Point[])[];
  readonly faces: readonly { readonly score: number; readonly width: number }[];
}

interface RecordedFixture {
  readonly name: string;
  readonly expectation: string;
  readonly frames: readonly RecordedFrame[];
}

function loadIndex(): readonly IndexEntry[] {
  if (!existsSync(INDEX_PATH)) return [];
  const parsed: unknown = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('fixtures' in parsed) ||
    !Array.isArray(parsed.fixtures)
  ) {
    return [];
  }
  return parsed.fixtures as readonly IndexEntry[];
}

function loadFixture(file: string): RecordedFixture {
  const path = fileURLToPath(new URL(`./fixtures/recorded/${file}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as RecordedFixture;
}

/**
 * Replays one clip and reports whether the gesture was ever accepted.
 *
 * Deliberately uses the SAME `selectGesture` the runtime calls, so a threshold
 * change moves this number and the live behaviour together.
 */
function everAccepted(fixture: RecordedFixture, mercyLevel: MercyLevel): boolean {
  let active = false;
  for (const frame of fixture.frames) {
    const hands: Hand[] = frame.hands.map((hand) => hand);
    const result = selectGesture({ hands, mercyLevel, active, tripodMode: false });
    active = result.accepted;
    if (result.accepted) return true;
  }
  return false;
}

const index = loadIndex();

describe('recorded-clip rates — Doc 05 §8 exit criteria', () => {
  if (index.length === 0) {
    it.skip('NOT MEASURED — no recorded clips in tests/fixtures/recorded/', () => {
      /* See the module header. Run `node scripts/dump-landmarks.mjs`. */
    });
    return;
  }

  const accepts = index.filter((entry) => entry.expectation.startsWith('accept-'));
  const rejects = index.filter((entry) => entry.expectation.startsWith('reject-'));

  /** Level 0 accepts G1 only; level 1 opens G2 and G3 (Doc 03 §6.7). */
  const levelFor = (expectation: string): MercyLevel =>
    expectation.endsWith('mercy1') ? MERCY.acceptsFingerHeartFrom : 0;

  it('G1 true-positive is at least 85%', () => {
    const g1 = accepts.filter((entry) => entry.expectation === 'accept-G1');
    if (g1.length === 0) {
      throw new Error('no accept-G1 clips recorded — the primary gesture is unmeasured');
    }

    const passed = g1.filter((entry) => everAccepted(loadFixture(entry.file), 0)).length;
    const rate = passed / g1.length;
    expect(
      rate,
      `${String(passed)} of ${String(g1.length)} accept-G1 clips`,
    ).toBeGreaterThanOrEqual(0.85);
  });

  it('every accept clip is accepted at its own mercy level', () => {
    const failures = accepts
      .filter(
        (entry) => !everAccepted(loadFixture(entry.file), levelFor(entry.expectation)),
      )
      .map((entry) => entry.name);
    expect(failures, `never accepted: ${failures.join(', ')}`).toHaveLength(0);
  });

  /**
   * The number that must stay at zero. Any rejection pose that unlocks is a
   * blocking failure — the HUD's `FAIL@Cn` readout names which threshold to
   * tighten (Doc 03 §8).
   */
  it('false-positive rate is ZERO across every rejection clip', () => {
    const leaks = rejects
      .filter((entry) => everAccepted(loadFixture(entry.file), 0))
      .map((entry) => `${entry.name} (${entry.expectation})`);
    expect(leaks, `falsely accepted: ${leaks.join(', ')}`).toHaveLength(0);
  });

  it('evening-light clips are represented', () => {
    // Doc 05 §8: the evening set must be run "in an actual evening room". A
    // suite with only daylight clips reports a rate that does not describe the
    // condition the gate actually fails in.
    const evening = index.filter((entry) => entry.lighting === 'evening');
    expect(evening.length, 'no evening-light clips recorded').toBeGreaterThan(0);
  });
});
