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

/** True when storage is genuinely unavailable — surfaced in the debug panel. */
export function isEphemeral(): boolean {
  return storage() === null;
}
