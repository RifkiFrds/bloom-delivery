/**
 * Asset staging — Doc 01 §7.2.
 *
 * ── THE PROBLEM THIS EXISTS TO SOLVE ─────────────────────────────────────
 * The largest asset in the project is the 7.5 MB hand model. The scene
 * structure exists partly to hide it. Blocking the camera stage on 7.5 MB means
 * a fifteen-second stare at a loader on 4G; blocking only on 230 KB means the
 * camera appears in ~2 s and the hand model lands while the pair is getting
 * into position.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Prefetching is done with `fetch` and a streaming reader rather than
 * `<link rel="prefetch">` for two reasons: Safari's support for the hint is
 * unreliable, and Doc 04 §B.5 requires a REAL download percentage on the
 * loading screen — a hint reports nothing.
 *
 * The response body is read to completion and discarded. That populates the HTTP
 * cache, so MediaPipe's own request for the same URL is served locally. The
 * bytes are not retained: holding 7.5 MB in JS as well as in the cache would
 * double the peak for no benefit.
 *
 * All URLs are same-origin. `connect-src 'self'` makes that structural rather
 * than conventional.
 */

import type { AssetBundle } from '@/machine';
import { ASSETS } from '@/detection/config';
import { record } from './diagnostics';

interface BundleProgress {
  loaded: number;
  total: number;
  done: boolean;
  failed: boolean;
  started: boolean;
}

const BUNDLE_URLS: Readonly<Record<AssetBundle, readonly string[]>> = {
  // The WASM runtime. Its exact filename is chosen by MediaPipe at runtime
  // based on SIMD support, so the SIMD build is warmed and the no-SIMD variant
  // is left to be fetched on demand by the Tier 2 devices that need it.
  'vision-runtime': [
    `${ASSETS.wasmPath}/vision_wasm_internal.js`,
    `${ASSETS.wasmPath}/vision_wasm_internal.wasm`,
  ],
  'face-model': [ASSETS.faceModel],
  'hand-model': [ASSETS.handModel],
  // The 3D chunk is JavaScript, prefetched by a dynamic import rather than a
  // URL fetch — see `noteChunkPrefetch`.
  'scene-3d': [],
  audio: ['/audio/sfx-sprite.webm', '/audio/music.webm'],
};

const progress = new Map<AssetBundle, BundleProgress>();

function stateOf(bundle: AssetBundle): BundleProgress {
  let entry = progress.get(bundle);
  if (entry === undefined) {
    entry = { loaded: 0, total: 0, done: false, failed: false, started: false };
    progress.set(bundle, entry);
  }
  return entry;
}

async function fetchInto(url: string, entry: BundleProgress): Promise<void> {
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error(`${String(response.status)} for ${url}`);

  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > 0) entry.total += declared;

  const body = response.body;
  if (body === null) {
    await response.arrayBuffer();
    entry.loaded = entry.total;
    return;
  }

  const reader = body.getReader();
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    entry.loaded += chunk.value.byteLength;
    // The bytes are intentionally not retained — see the header.
  }
}

/**
 * Start a bundle. Idempotent: calling it again while in flight, or after it
 * completed, is a no-op. Failures are recorded and never thrown — a prefetch
 * is an optimisation, and the consumer that actually needs the asset owns the
 * error path (Doc 01 §7.5).
 */
export function prefetchBundle(bundle: AssetBundle): void {
  const entry = stateOf(bundle);
  if (entry.started) return;
  entry.started = true;

  const urls = BUNDLE_URLS[bundle];
  if (urls.length === 0) {
    entry.done = true;
    return;
  }

  void Promise.all(urls.map((url) => fetchInto(url, entry))).then(
    () => {
      entry.done = true;
      record(`prefetch: ${bundle} ready (${String(Math.round(entry.loaded / 1024))} KB)`);
    },
    (error: unknown) => {
      entry.failed = true;
      entry.done = true;
      record(
        `prefetch: ${bundle} failed — ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  );
}

/** 0–1. Reported to the loading screen as a REAL percentage, never a fake one. */
export function bundleProgress(bundle: AssetBundle): number {
  const entry = stateOf(bundle);
  if (entry.done) return 1;
  if (entry.total <= 0) return entry.started ? 0.05 : 0;
  return Math.min(0.99, entry.loaded / entry.total);
}

export function bundleReady(bundle: AssetBundle): boolean {
  return stateOf(bundle).done && !stateOf(bundle).failed;
}

export function bundleFailed(bundle: AssetBundle): boolean {
  return stateOf(bundle).failed;
}

/**
 * Bundles delivered as JavaScript chunks report completion through their own
 * dynamic import rather than through a URL fetch.
 */
export function noteChunkPrefetch(bundle: AssetBundle, promise: Promise<unknown>): void {
  const entry = stateOf(bundle);
  entry.started = true;
  void promise.then(
    () => {
      entry.done = true;
      record(`prefetch: ${bundle} chunk ready`);
    },
    () => {
      entry.failed = true;
      entry.done = true;
      record(`prefetch: ${bundle} chunk failed`);
    },
  );
}
