/**
 * Local diagnostics — Doc 01 §9.2 (FATAL), PRD v2 §Rejected Recommendations.
 *
 * PRD v2 REJECTED an opt-in error beacon:
 *
 *   "the promise 'your camera never leaves this phone' is the single
 *    highest-leverage sentence in the product. Any network egress, however
 *    small and however opt-in, makes that sentence require an asterisk. The
 *    asterisk costs more than the telemetry is worth."
 *
 * The agreed substitute is this: a ring buffer and a COPYABLE local diagnostic
 * string. If it breaks, she screenshots it. Nothing is ever sent — enforced
 * structurally by CSP `connect-src 'self'`.
 */

const CAPACITY = 60;

const entries: string[] = [];

export function record(message: string): void {
  const stamped = `${new Date().toISOString().slice(11, 23)} ${message}`;
  entries.push(stamped);
  if (entries.length > CAPACITY) entries.shift();
}

export function log(): readonly string[] {
  return [...entries].reverse();
}

export function clear(): void {
  entries.length = 0;
}

export interface DiagnosticEnvironment {
  readonly userAgent: string;
  readonly viewport: string;
  readonly devicePixelRatio: number;
  readonly webgl2: boolean;
  readonly secureContext: boolean;
  readonly language: string;
}

function environment(): DiagnosticEnvironment {
  if (typeof window === 'undefined') {
    return {
      userAgent: 'server',
      viewport: '0×0',
      devicePixelRatio: 1,
      webgl2: false,
      secureContext: false,
      language: 'unknown',
    };
  }

  let webgl2 = false;
  try {
    webgl2 = document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    webgl2 = false;
  }

  return {
    userAgent: navigator.userAgent,
    viewport: `${String(window.innerWidth)}×${String(window.innerHeight)}`,
    devicePixelRatio: window.devicePixelRatio,
    webgl2,
    secureContext: window.isSecureContext,
    language: navigator.language,
  };
}

/** The copyable string rendered on FATAL_ERROR. */
export function buildDiagnosticString(lastState: string, error: unknown): string {
  const env = environment();
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  return [
    'Bloom Delivery — diagnostic',
    `time      ${new Date().toISOString()}`,
    `state     ${lastState}`,
    `error     ${message}`,
    `ua        ${env.userAgent}`,
    `viewport  ${env.viewport} @${String(env.devicePixelRatio)}x`,
    `webgl2    ${String(env.webgl2)}`,
    `secure    ${String(env.secureContext)}`,
    `lang      ${env.language}`,
    '',
    'recent:',
    ...log()
      .slice(0, 10)
      .map((line) => `  ${line}`),
  ].join('\n');
}
