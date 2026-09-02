/**
 * The two live regions — Doc 04 §F.4.
 *
 * ── THROTTLING IS MANDATORY, NOT POLITE ──────────────────────────────────
 * The coaching state is derived from a 15 Hz detection loop. An unthrottled
 * `aria-live` region driven by that is unusable with a screen reader — it
 * speaks over itself continuously and the user cannot hear the app at all.
 *
 * So: identical text is never re-announced, and polite announcements are
 * debounced to a 1.5 s minimum gap. Assertive announcements bypass the debounce
 * because they are rare, discrete and important (the unlock, an error).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The regions themselves are rendered once, by `ExperienceRoot`, and are always
 * present in the DOM: a live region created at the moment of the announcement
 * is not reliably read by any screen reader.
 */

const POLITE_MIN_GAP_MS = 1500;

let lastPolite = '';
let lastPoliteAt = 0;
let pendingTimer: number | null = null;

function write(id: string, message: string): void {
  if (typeof document === 'undefined') return;
  const region = document.getElementById(id);
  if (region === null) return;
  // Text node only. Announcements are never markup.
  region.textContent = message;
}

/**
 * Polite announcement: coaching, progress, scene descriptions.
 *
 * Repeats of the current message are dropped. A message arriving inside the
 * 1.5 s window is deferred, not discarded — the user still hears the latest
 * state, just not the flood.
 */
export function announce(message: string, nowMs = Date.now()): void {
  if (message === '' || message === lastPolite) return;

  const elapsed = nowMs - lastPoliteAt;
  if (elapsed >= POLITE_MIN_GAP_MS) {
    lastPolite = message;
    lastPoliteAt = nowMs;
    write('sr-status', message);
    return;
  }

  if (pendingTimer !== null) window.clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(() => {
    pendingTimer = null;
    lastPolite = message;
    lastPoliteAt = Date.now();
    write('sr-status', message);
  }, POLITE_MIN_GAP_MS - elapsed);
}

/** Assertive: the unlock, permission outcomes, errors. Never debounced. */
export function alert(message: string): void {
  write('sr-alert', message);
}

/** Called at teardown and between sessions so a stale message is not repeated. */
export function resetAnnouncements(): void {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  lastPolite = '';
  lastPoliteAt = 0;
}
