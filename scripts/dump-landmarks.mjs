#!/usr/bin/env node
/**
 * Landmark fixture indexer — Doc 03 §10.3, Doc 05 §2 (`scripts/dump-landmarks.mjs`).
 *
 * ── WHAT THIS CLOSES ─────────────────────────────────────────────────────
 * The Phase 4 exit criteria — G1 true-positive ≥ 85%, false-positive = 0 — can
 * only be measured against RECORDED CLIPS of real hands. The geometry suite in
 * `tests/gesture.test.ts` pins the maths; it cannot pin the rates.
 *
 * The Phase 0 spike already exports landmark dumps in exactly the shape the
 * tests consume (press E in its HUD). This script is the missing link: it
 * validates those exports, indexes them, and makes `tests/recorded.test.ts`
 * light up automatically.
 *
 * So the outstanding verification debt is a THREE-STEP TASK, not a project:
 *
 *   1. Record the 15 clips from Doc 03 §10.3, with a second person, in
 *      daylight AND in evening light.
 *   2. Replay each through `pnpm spike`, press E, save the JSON into
 *      `tests/fixtures/recorded/`.
 *   3. `node scripts/dump-landmarks.mjs && pnpm test`
 *
 * Step 3 then reports the true-positive and false-positive rates directly.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Run: node scripts/dump-landmarks.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RECORDED = join(ROOT, 'tests', 'fixtures', 'recorded');
const INDEX = join(RECORDED, 'index.json');

/**
 * The expectations from Doc 03 §10.3, in order. A dump whose `expectation` is
 * not one of these is rejected — a typo there would silently produce a fixture
 * that asserts nothing.
 */
const EXPECTATIONS = new Set([
  'accept-G1',
  'accept-G2-mercy1',
  'accept-G3-mercy1',
  'latch',
  'no-latch',
  'too-dark',
  'reject-C1',
  'reject-C5',
  'reject-C6',
  'reject-C7',
  'hold-decays-not-resets',
  'documents-accepted-risk',
  'documents-accepted-G2-false-positive',
]);

/** @param {unknown} value */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Validates one exported fixture. Returns a list of problems, empty if sound. */
function validate(name, payload) {
  const problems = [];

  if (typeof payload !== 'object' || payload === null) {
    return [`${name}: not an object`];
  }

  if (typeof payload.name !== 'string' || payload.name.length === 0) {
    problems.push(`${name}: missing "name"`);
  }
  if (!EXPECTATIONS.has(payload.expectation)) {
    problems.push(
      `${name}: unknown expectation "${String(payload.expectation)}" — expected one of ${[...EXPECTATIONS].join(', ')}`,
    );
  }
  if (payload.lighting !== 'daylight' && payload.lighting !== 'evening') {
    problems.push(`${name}: lighting must be "daylight" or "evening"`);
  }
  if (typeof payload.device !== 'string' || payload.device.length === 0) {
    problems.push(`${name}: missing "device" — set the device label before recording`);
  }
  if (!Array.isArray(payload.frames) || payload.frames.length === 0) {
    problems.push(`${name}: no frames`);
    return problems;
  }

  for (const [index, frame] of payload.frames.entries()) {
    if (!isFiniteNumber(frame?.aspect) || frame.aspect <= 0) {
      problems.push(`${name}: frame ${index} has no aspect factor`);
      break;
    }
    if (!Array.isArray(frame.hands) || !Array.isArray(frame.faces)) {
      problems.push(`${name}: frame ${index} is missing hands or faces`);
      break;
    }
    // Landmarks must already be square-corrected by the spike. A hand with an
    // unexpected length means the export format drifted.
    for (const hand of frame.hands) {
      if (!Array.isArray(hand) || hand.length !== 21) {
        problems.push(
          `${name}: frame ${index} has a hand with ${hand?.length} landmarks`,
        );
        break;
      }
    }
  }

  return problems;
}

async function main() {
  console.log('\nLandmark fixtures — Doc 03 §10.3\n');

  if (!existsSync(RECORDED)) {
    console.log(`  ·  ${RECORDED} does not exist yet.`);
    console.log(
      '  ·  Record the 15 clips, export them from the spike, drop them here.\n',
    );
    return;
  }

  const files = (await readdir(RECORDED)).filter(
    (file) => extname(file) === '.json' && file !== 'index.json',
  );

  if (files.length === 0) {
    console.log('  ·  no recorded fixtures yet — the geometry suite runs alone.\n');
    return;
  }

  const entries = [];
  const problems = [];

  for (const file of files) {
    const payload = JSON.parse(await readFile(join(RECORDED, file), 'utf8'));
    const found = validate(file, payload);
    if (found.length > 0) {
      problems.push(...found);
      continue;
    }
    entries.push({
      file,
      name: payload.name,
      expectation: payload.expectation,
      lighting: payload.lighting,
      device: payload.device,
      frames: payload.frames.length,
    });
  }

  for (const problem of problems) console.log(`  ✗  ${problem}`);

  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    console.log(
      `  ✓  ${entry.name.padEnd(34)} ${entry.expectation.padEnd(38)} ` +
        `${String(entry.frames).padStart(4)} frames · ${entry.lighting} · ${entry.device}`,
    );
  }

  await writeFile(INDEX, `${JSON.stringify({ fixtures: entries }, null, 2)}\n`, 'utf8');

  console.log(`\n  ${String(entries.length)} fixture(s) indexed → ${INDEX}`);
  if (entries.length < 15) {
    console.log(
      `  ·  Doc 03 §10.3 specifies 15 clips; ${String(15 - entries.length)} still missing.`,
    );
  }
  console.log('');

  if (problems.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
