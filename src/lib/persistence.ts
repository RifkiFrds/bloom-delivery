/**
 * Persistence — Doc 02 §6.6.
 *
 * FOUR KEYS. No PII. No frames. No landmarks. No scores.
 *
 * EVERY access is wrapped in try/catch: Safari private mode, blocked site data
 * and thumbnail-capture contexts can all throw on ACCESS, not just on write.
 * Storage being unavailable must degrade to an in-memory shim, never crash.
 */

import type { PersistKey } from '@/machine';

const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const probe = '__bloom_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function read(key: PersistKey): string | null {
  const store = storage();
  if (store === null) return memory.get(key) ?? null;
  try {
    return store.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export function write(key: PersistKey, value: string): void {
  memory.set(key, value);
  const store = storage();
  if (store === null) return;
  try {
    store.setItem(key, value);
  } catch {
    /* quota or blocked — the in-memory shim already holds it */
  }
}

export function readFlag(key: PersistKey): boolean {
  return read(key) === '1';
}

export type MotionPreference = 'full' | 'reduced' | null;

export function readMotionPreference(): MotionPreference {
  const value = read('bloom_motion');
  return value === 'full' || value === 'reduced' ? value : null;
}

/** The four keys, in one list, so a clear cannot miss one (Doc 02 §6.6). */
const ALL_KEYS: readonly PersistKey[] = [
  'bloom_unlocked',
  'bloom_muted',
  'bloom_motion',
  'bloom_peeked',
];

/**
 * Wipes every persisted flag. Used by the `?reset=1` development switch.
 *
 * A returning visitor is routed `BOOT → RESTING` by `bloom_unlocked`, which is
 * correct in production and makes the landing unreachable while testing. There
 * is deliberately no in-app control for this: the flags ARE the returning-
 * visitor behaviour, and a button that clears them would be a button that
 * throws away someone's letter.
 */
export function clearPersisted(): void {
  for (const key of ALL_KEYS) {
    memory.delete(key);
    const store = storage();
    if (store === null) continue;
    try {
      store.removeItem(key);
    } catch {
      /* blocked storage — the in-memory shim is already cleared */
    }
  }
}

/** True when storage is genuinely unavailable — surfaced in the debug panel. */
export function isEphemeral(): boolean {
  return storage() === null;
}
