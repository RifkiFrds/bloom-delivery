#!/usr/bin/env node
/**
 * Self-hosts the MediaPipe Tasks Vision runtime and models into `public/vision/`.
 *
 * Doc 01 §7.3: models and WASM are served from our own origin, never a CDN.
 * A third-party CDN failure at the emotional peak of a one-shot gift is an
 * unacceptable dependency, and self-hosting is what keeps `connect-src 'self'`
 * intact (Doc 02 §6.4).
 *
 * Idempotent: existing files of the expected size are skipped.
 *
 *   node scripts/fetch-vision-assets.mjs
 *   node scripts/fetch-vision-assets.mjs --force
 */

import { mkdir, readdir, copyFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'vision');
const FORCE = process.argv.includes('--force');

/** Budgets from Doc 01 §8.2. Exceeding these fails the fetch loudly. */
const MODELS = [
  {
    name: 'face_detector.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
    maxBytes: 260 * 1024,
    note: 'BlazeFace short-range — BLOCKING download (Doc 03 §3.1)',
  },
  {
    name: 'hand_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    maxBytes: 8.0 * 1024 * 1024,
    note: 'HandLandmarker — BACKGROUND download (Doc 03 §4.2)',
  },
];

/** Candidate locations for the WASM runtime shipped inside the npm package. */
const WASM_SOURCES = [
  join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'),
  join(ROOT, 'tools', 'spike', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'),
  join(ROOT, 'node_modules', '.pnpm'),
];

const fmt = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

async function fetchModel({ name, url, maxBytes, note }) {
  const dest = join(OUT, name);

  if (!FORCE && existsSync(dest)) {
    const { size } = await stat(dest);
    if (size > 0) {
      console.log(`  = ${name.padEnd(24)} ${fmt(size).padStart(9)}  (cached)`);
      return { name, size, cached: true };
    }
  }

  process.stdout.write(`  ↓ ${name.padEnd(24)} ${note}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} from ${url}`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new Error(
      `${name} is ${fmt(buf.byteLength)} — over the Doc 01 §8.2 budget of ${fmt(maxBytes)}.`,
    );
  }

  await writeFile(dest, buf);
  console.log(`  ✓ ${name.padEnd(24)} ${fmt(buf.byteLength).padStart(9)}`);
  return { name, size: buf.byteLength, cached: false };
}

/** Recursively locate a `tasks-vision/wasm` directory under pnpm's store layout. */
async function findWasmDir(base, depth = 0) {
  if (depth > 4 || !existsSync(base)) return null;
  const direct = join(base, 'wasm');
  if (existsSync(join(direct, 'vision_wasm_internal.wasm'))) return direct;

  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' && depth > 2) continue;
    const found = await findWasmDir(join(base, entry.name), depth + 1);
    if (found) return found;
  }
  return null;
}

async function copyWasm() {
  let src = null;
  for (const candidate of WASM_SOURCES) {
    src = await findWasmDir(candidate);
    if (src) break;
  }

  if (!src) {
    console.log(
      '\n  ! WASM runtime not found in node_modules.\n' +
        '    Run `pnpm install` first (in the root and in tools/spike), then re-run this script.',
    );
    return 0;
  }

  const wasmOut = join(OUT, 'wasm');
  await mkdir(wasmOut, { recursive: true });
  const files = await readdir(src);
  let total = 0;

  for (const file of files) {
    const from = join(src, file);
    const info = await stat(from);
    if (!info.isFile()) continue;
    await copyFile(from, join(wasmOut, file));
    total += info.size;
  }

  console.log(
    `  ✓ wasm/ (${files.length} files)${' '.repeat(10)}${fmt(total).padStart(9)}`,
  );
  return total;
}

async function main() {
  console.log('\nSelf-hosting MediaPipe vision assets → public/vision/\n');
  await mkdir(OUT, { recursive: true });

  let total = 0;
  for (const model of MODELS) {
    const { size } = await fetchModel(model);
    total += size;
  }
  total += await copyWasm();

  console.log(`\n  Total: ${fmt(total)}\n`);
  console.log('  Doc 01 §8.2 budget check:');
  console.log('    face_detector.task    ≤ 260 KB   (blocking)');
  console.log('    hand_landmarker.task  ≤ 8.0 MB   (background)');
  console.log('    vision runtime        ≤ 1.3 MB transfer (gzipped over the wire)\n');
}

main().catch((error) => {
  console.error(`\n  ✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
