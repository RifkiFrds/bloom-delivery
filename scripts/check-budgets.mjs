#!/usr/bin/env node
/**
 * Asset budget gate — Doc 01 §8.2, Doc 05 §3 task E8.
 *
 *   "A build-time script checks every file against §Performance Budgets and
 *    FAILS CI ON VIOLATION. Budgets that are not enforced are wishes."
 *
 * Run: node scripts/check-budgets.mjs
 * Exits non-zero on any breach.
 *
 * Covers BOTH classes of budget in Doc 01 §8.2:
 *   · static assets in public/  (models, wasm, audio, lottie)
 *   · JAVASCRIPT, measured from the production build in .next/
 * The second is the one that regresses silently — an asset is added
 * deliberately, whereas a 40 KB dependency arrives as a transitive install.
 *
 * ── KNOWN BREACH, PHASE 0 FINDING ────────────────────────────────────────
 * The MediaPipe vision runtime measures ~3.35 MB gzipped (3.28 WASM + 0.07
 * loader) against a 1.3 MB budget. This is recorded as R13 and is awaiting a
 * decision at the Phase 0 gate. `visionRuntime` is therefore reported as a
 * WARNING rather than a failure until that decision lands — flip `blocking` to
 * true once the budget is re-baselined.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { gzipSync } from 'node:zlib';
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KB = 1024;
const MB = 1024 * KB;

/** @type {ReadonlyArray<{id:string,label:string,path:string,limit:number,gzip:boolean,blocking:boolean,doc:string}>} */
const BUDGETS = [
  {
    id: 'faceModel',
    label: 'face_detector.task (blocking download)',
    path: 'public/vision/face_detector.task',
    limit: 260 * KB,
    gzip: false,
    blocking: true,
    doc: 'Doc 01 §8.2',
  },
  {
    id: 'handModel',
    label: 'hand_landmarker.task (background download)',
    path: 'public/vision/hand_landmarker.task',
    limit: 8 * MB,
    gzip: false,
    blocking: true,
    doc: 'Doc 01 §8.2',
  },
  {
    id: 'visionRuntime',
    label: 'vision runtime — ONE wasm + loader, transfer',
    path: 'public/vision/wasm',
    limit: 1.3 * MB,
    gzip: true,
    blocking: false, // R13 — awaiting the Phase 0 gate decision
    doc: 'Doc 01 §8.2',
  },
  {
    id: 'models3d',
    label: 'all .glb combined',
    path: 'public/models',
    limit: 1.2 * MB,
    gzip: false,
    blocking: true,
    doc: 'Doc 01 §8.2 (Phase 6)',
  },
  {
    id: 'audio',
    label: 'music + sfx sprite',
    path: 'public/audio',
    limit: 1.02 * MB,
    gzip: false,
    blocking: true,
    doc: 'Doc 01 §8.2 (Phase 8)',
  },
  {
    id: 'lottie',
    label: 'Lite 2D sequence',
    path: 'public/lottie',
    limit: 150 * KB,
    gzip: false,
    blocking: true,
    doc: 'Doc 01 §8.2 (Phase 5)',
  },
];

const fmt = (bytes) =>
  bytes >= MB ? `${(bytes / MB).toFixed(2)} MB` : `${(bytes / KB).toFixed(0)} KB`;

async function measure(relative, useGzip) {
  const target = join(ROOT, relative);
  if (!existsSync(target)) return null;

  const info = await stat(target);

  if (info.isFile()) {
    const buffer = await readFile(target);
    return useGzip ? gzipSync(buffer).byteLength : buffer.byteLength;
  }

  // Directory. The vision runtime ships three interchangeable WASM variants and
  // a client downloads exactly ONE, so measure the largest single variant plus
  // its loader rather than the sum — the sum would be a fiction.
  const entries = await readdir(target);
  if (relative.endsWith('wasm')) {
    let largestWasm = 0;
    let largestLoader = 0;
    for (const entry of entries) {
      const buffer = await readFile(join(target, entry));
      const size = useGzip ? gzipSync(buffer).byteLength : buffer.byteLength;
      if (extname(entry) === '.wasm') largestWasm = Math.max(largestWasm, size);
      else largestLoader = Math.max(largestLoader, size);
    }
    return largestWasm + largestLoader;
  }

  let total = 0;
  for (const entry of entries) {
    const buffer = await readFile(join(target, entry));
    total += useGzip ? gzipSync(buffer).byteLength : buffer.byteLength;
  }
  return total;
}

/**
 * JavaScript budgets — Doc 01 §8.2.
 *
 * Measured GZIPPED from the real production build, because that is what the
 * phone downloads.
 *
 * ── CHUNKS ARE IDENTIFIED BY CONTENT, NOT BY FILENAME ────────────────────
 * Next names chunks by CONTENT HASH, so any rule that greps a filename for
 * "three" or "scene3d" silently matches nothing and reports a pass. The route
 * entry comes from `app-build-manifest.json`, which is authoritative about what
 * a route downloads eagerly, and the lazy chunks are classified by looking for
 * a marker symbol inside them.
 *
 * That also makes this check verify the `dynamic()` boundary itself: if
 * three.js ever appears in the route entry, the entry budget blows immediately.
 * ─────────────────────────────────────────────────────────────────────────
 */
const ROUTE_ENTRY_LIMIT = 140 * KB;
const SCENE_3D_LIMIT = 450 * KB;
const EXPERIENCE_ROUTE = '/d/[slug]/page';

/** Marker symbols. Present in the bundled source of each library. */
const THREE_MARKER = 'WebGLRenderer';
const VISION_MARKER = 'wasm_internal';

async function gzipOf(relative) {
  const target = join(ROOT, '.next', relative);
  if (!existsSync(target)) return 0;
  return gzipSync(await readFile(target)).byteLength;
}

async function classifyChunks(eager) {
  const dir = join(ROOT, '.next', 'static', 'chunks');
  if (!existsSync(dir)) return [];

  const found = [];

  async function walk(base, prefix) {
    for (const entry of await readdir(base, { withFileTypes: true })) {
      const full = join(base, entry.name);
      const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(full, name);
        continue;
      }
      if (extname(entry.name) !== '.js') continue;

      const relative = `static/chunks/${name}`;
      if (eager.has(relative)) continue;

      const buffer = await readFile(full);
      const text = buffer.toString('utf8');
      found.push({
        relative,
        gzip: gzipSync(buffer).byteLength,
        three: text.includes(THREE_MARKER),
        vision: text.includes(VISION_MARKER),
      });
    }
  }

  await walk(dir, '');
  return found;
}

async function checkJs() {
  console.log('\nJavaScript budgets — Doc 01 §8.2\n');

  const manifestPath = join(ROOT, '.next', 'app-build-manifest.json');
  if (!existsSync(manifestPath)) {
    console.log('  ·  no production build found — run `pnpm build` first');
    return 0;
  }

  // `pnpm dev` overwrites .next with UNMINIFIED chunks. Measuring those would
  // report a 1.7 MB entry budget and fail a build that is actually fine — a
  // false alarm is worse than no alarm, because it teaches people to ignore the
  // gate. Only a production build writes BUILD_ID.
  const buildIdPath = join(ROOT, '.next', 'BUILD_ID');
  const buildId = existsSync(buildIdPath)
    ? (await readFile(buildIdPath, 'utf8')).trim()
    : '';
  if (buildId === '' || buildId === 'development') {
    console.log('  ·  .next holds a DEVELOPMENT build — run `pnpm build`, then re-run');
    console.log('  ·  JS budgets NOT measured');
    return 0;
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const routeChunks = manifest.pages?.[EXPERIENCE_ROUTE];
  if (!Array.isArray(routeChunks)) {
    console.log(`  ✗  route ${EXPERIENCE_ROUTE} missing from the build manifest`);
    return 1;
  }

  let failures = 0;

  let entryTotal = 0;
  for (const chunk of routeChunks) {
    if (extname(chunk) !== '.js') continue;
    entryTotal += await gzipOf(chunk);
  }

  const overEntry = entryTotal > ROUTE_ENTRY_LIMIT;
  console.log(
    `  ${overEntry ? '✗' : '✓'}  ${'route entry JS (no CV, no 3D)'.padEnd(46)} ` +
      `${(fmt(entryTotal) + ' gz').padStart(11)} / ${fmt(ROUTE_ENTRY_LIMIT)}`,
  );
  if (overEntry) {
    failures += 1;
    console.log('     ↳ OVER BUDGET (Doc 01 §8.2)');
  }

  const eager = new Set();
  for (const chunks of Object.values(manifest.pages ?? {})) {
    for (const chunk of chunks) eager.add(chunk);
  }

  const lazy = await classifyChunks(eager);
  const sceneTotal = lazy
    .filter((chunk) => chunk.three)
    .reduce((sum, chunk) => sum + chunk.gzip, 0);
  const visionTotal = lazy
    .filter((chunk) => chunk.vision)
    .reduce((sum, chunk) => sum + chunk.gzip, 0);

  if (sceneTotal === 0) {
    failures += 1;
    console.log(
      `  ✗  ${'3D chunk (three + R3F + drei)'.padEnd(46)} not split out — check dynamic()`,
    );
  } else {
    const overScene = sceneTotal > SCENE_3D_LIMIT;
    console.log(
      `  ${overScene ? '✗' : '✓'}  ${'3D chunk (three + R3F + drei)'.padEnd(46)} ` +
        `${(fmt(sceneTotal) + ' gz').padStart(11)} / ${fmt(SCENE_3D_LIMIT)}`,
    );
    if (overScene) {
      failures += 1;
      console.log('     ↳ OVER BUDGET (Doc 01 §8.2)');
    }
  }

  // Informational: the JS half of the vision runtime. Its transfer budget is
  // dominated by the WASM, which the asset section already reports.
  console.log(
    `  ·  vision runtime JS ${fmt(visionTotal)} gz · ${String(routeChunks.length)} eager, ${String(
      lazy.length,
    )} lazy chunk(s)`,
  );

  return failures;
}

async function main() {
  console.log('\nAsset budgets — Doc 01 §8.2\n');

  let failures = 0;
  let warnings = 0;

  for (const budget of BUDGETS) {
    const size = await measure(budget.path, budget.gzip);

    if (size === null) {
      console.log(`  ·  ${budget.label.padEnd(46)} not present yet`);
      continue;
    }

    const over = size > budget.limit;
    const suffix = budget.gzip ? ' gz' : '';
    const line =
      `  ${over ? (budget.blocking ? '✗' : '!') : '✓'}  ` +
      `${budget.label.padEnd(46)} ${(fmt(size) + suffix).padStart(11)} / ${fmt(budget.limit)}`;

    console.log(line);

    if (over && budget.blocking) {
      failures += 1;
      console.log(`     ↳ OVER BUDGET (${budget.doc})`);
    } else if (over) {
      warnings += 1;
      console.log(`     ↳ over budget — non-blocking, see R13 in the Phase 0 report`);
    }
  }

  failures += await checkJs();

  console.log('');
  if (warnings > 0) console.log(`  ${warnings} warning(s)`);
  if (failures > 0) {
    console.log(`  ${failures} budget violation(s) — failing the build.\n`);
    process.exitCode = 1;
    return;
  }
  console.log('  All blocking budgets pass.\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
