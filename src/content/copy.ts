/**
 * ★ EVERY USER-FACING STRING ★ — Doc 05 §2 (`content/copy.ts`).
 *
 * One module, so the whole voice of the product can be read in one sitting and
 * changed without hunting through components. Doc 04 fixes the wording; this
 * file is its transcription, not a paraphrase.
 *
 * ── THE VOICE ────────────────────────────────────────────────────────────
 * Never blame the user. Never say "error", "failed", "denied" or "skip".
 * Every failure screen offers a way forward, and the way forward to the gift
 * is always phrased as a gift being handed over early — never as giving up
 * (Doc 01 §9.5, Doc 04 §B.9).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The letter itself does NOT live here. It lives in `content/letter.ts`,
 * alone, because it is the thing most likely to be edited by hand.
 */

import type { CameraErrorKind } from '@/machine';

export const LANDING = {
  title: 'Bloom Delivery',
  subtitle: 'A special delivery is waiting',
  cta: 'Start',
  sound: 'Sound on for the full effect 🔊',
  twoPeople: 'Works best with two people 💕',
} as const;

export const PREFLIGHT = {
  title: 'Before we start ✨',
  promiseHeading: 'Your camera stays on your phone.',
  promiseBody:
    'No photos. No video. No uploads. Nothing is saved anywhere. The magic all happens right here, on this screen. 🌷',
  expectation: 'This one needs two people.',
  duration: 'Takes about a minute. Bring someone.',
  cta: "I'm ready",
  motionLabel: 'Motion',
  motionFull: 'Full',
  motionReduced: 'Reduced',
} as const;

export const PERMISSION = {
  title: 'Ready when you are 💛',
  body: 'Tap Allow so we can see your hearts',
  cta: 'Allow camera',
  announcement: 'Camera permission needed. Nothing is recorded, uploaded, or saved.',
} as const;

export const LOADING = {
  title: 'Warming up the magic ✨',
  progressLabel: 'Loading the magic',
} as const;

export const SEEKING_FACES = {
  title: 'Stand together',
  chipsLabel: (found: number): string => `${String(found)} of 2 people detected`,
  videoDescription: 'A live, mirrored view from your front camera.',
} as const;

export const SOLO = {
  title: "Someone's missing",
  body: 'This one only opens for two.',
  wait: "I'll go get them",
  peek: 'Peek alone',
  announcement:
    "Someone's missing. This only opens for two. You can wait, or peek alone.",
} as const;

export const TOGETHER = {
  title: 'There you are! 💕',
  waiting: 'Warming up the magic ✨',
  announcement: 'Two people detected.',
} as const;

/**
 * Coaching copy — Doc 04 §B.9. Priority order is fixed in
 * `detection/coaching.ts`; this map only supplies the words.
 */
export const COACHING = {
  TOO_DARK: 'A little more light? 💡',
  NO_FACES: 'Come into the frame 👋',
  ONE_FACE: "Someone's missing 💕",
  NO_HANDS: 'Show me your hands ✋',
  HANDS_TOO_SMALL: 'Bring the heart closer 🤏',
  ALMOST: 'Almost! Fingers together 💗',
  HOLDING: '',
  IDLE: 'Make a heart — one hand each 💗',
} as const;

/** The gesture stage headline, warming as mercy escalates (Doc 02 §6.2). */
export const MERCY_COPY = [
  'Make a heart — one hand each 💗',
  'So close! Bring your fingers together 🤏',
  'The flowers are getting impatient 🌷',
  'Honestly? You two are close enough. 💕',
] as const;

/** The escape-hatch label, by mercy level. Never "skip", never "give up". */
export const HATCH_LABEL = [
  'Let them out',
  'Let them out',
  'Let them out',
  'Open it anyway',
] as const;

export const GESTURE = {
  diagramAlt: 'Two hands, one from each person, meeting to form a heart.',
  ringLabel: 'Holding the heart',
  cameraRest: "Let's give your camera a rest 🌷",
} as const;

export const UNLOCK = {
  stamp: 'DELIVERY UNLOCKED',
  announcement: 'Delivery unlocked!',
} as const;

export const SEQUENCE = {
  announcement:
    'A gift box falls from the sky, opens, and tulips bloom across the screen.',
} as const;

export const MESSAGE = {
  prefix: 'For',
  suffix: '🌷',
  returning: 'There you are. Now the real one.',
} as const;

export const LETTER = {
  openCta: 'Open Letter 💌',
  closedLabel: 'A sealed envelope with a wax seal.',
} as const;

export const RESTING = {
  readAgain: 'Read again 📖',
  replay: 'Replay the moment ↺',
  savePhoto: 'Save our photo 📷',
  replayFresh: 'Do it all again ↺',
  colophon: 'made with 🌷',
  peekHold: "The rest is for when you're together 💌",
  peekRetry: 'Try again with them',
  announcement: 'Read again. Replay the moment. Save our photo.',
} as const;

export const BLOCKED = {
  title: 'Pssst — open this in your real browser 🌷',
  body: "This delivery needs your camera, and it can't reach it from here.",
  openAndroid: 'Open in Chrome',
  openIos: 'Open in Safari',
  copyLink: 'Copy link',
  copied: 'Copied ✓',
  iosSteps: 'Tap ••• at the top right → Open in Safari',
  insecureTitle: 'This link needs a secure connection',
  insecureBody: 'Open it again starting with https:// and the camera will work.',
  nomediaTitle: 'This browser keeps its camera to itself',
  nomediaBody: "Let's go straight to the good part instead 🌷",
} as const;

export const DENIED = {
  title: "We can't see yet",
  body: 'Your browser is keeping the camera to itself 💛',
  reload: 'Reload',
  retry: 'Try again',
  iosSteps: ['Tap AA in the address bar', 'Website Settings', 'Camera → Allow'],
  androidSteps: ['Tap the lock icon in the address bar', 'Permissions', 'Camera → Allow'],
  desktopSteps: [
    'Click the camera icon in the address bar',
    'Always allow camera',
    'Reload the page',
  ],
} as const;

export interface CameraErrorCopy {
  readonly title: string;
  readonly body: string;
  readonly primary: 'retry' | 'lite';
}

/**
 * Five failures, five copies — Doc 04 §B.17.
 *
 * `primary: 'lite'` is used exactly where retry genuinely cannot work. A retry
 * button that no-ops is worse than no button.
 */
export const CAMERA_ERRORS: Readonly<Record<CameraErrorKind, CameraErrorCopy>> = {
  NotFoundError: {
    title: 'No camera? No problem.',
    body: "Let's skip straight to the good part 🌷",
    primary: 'lite',
  },
  NotReadableError: {
    title: "Camera's busy!",
    body: 'Something else is using it — close that app and tap below 📸',
    primary: 'retry',
  },
  OverconstrainedError: {
    title: "That camera's a bit unusual",
    body: "Let's do this the easy way 🌷",
    primary: 'lite',
  },
  AbortError: {
    title: "That didn't quite start",
    body: "Let's give it another go 🫶",
    primary: 'retry',
  },
  SecurityError: {
    title: 'This page needs a secure connection',
    body: "Let's do this the easy way 🌷",
    primary: 'lite',
  },
  Unsupported: {
    title: 'This browser keeps its camera to itself',
    body: "Let's skip straight to the good part 🌷",
    primary: 'lite',
  },
  NotAllowedError: {
    title: "We can't see yet",
    body: 'Your browser is keeping the camera to itself 💛',
    primary: 'retry',
  },
  Unknown: {
    title: 'The magic is being shy',
    body: 'The flowers are having trouble loading ✨',
    primary: 'retry',
  },
};

/** `MODELS_FAILED` shares CAMERA_ERROR but has its own copy (Doc 04 §B.17). */
export const MODELS_FAILED_COPY: CameraErrorCopy = {
  title: 'The magic is being shy',
  body: 'The flowers are having trouble loading ✨',
  primary: 'retry',
};

export const INTERRUPTED = {
  title: 'Camera paused',
  body: 'Tap to bring it back',
  cta: 'Resume',
} as const;

export const FATAL = {
  title: 'Something wobbled 🌷',
  body: 'But your letter is safe 💌',
  cta: 'Take me to the letter',
  copy: 'Copy diagnostic',
  diagnosticLabel: 'Diagnostic',
} as const;

/** The one escape used on every failure screen. Never labelled as a skip. */
export const ESCAPE = {
  toLetter: 'Just show me the flowers',
  liteEntry: 'Open your delivery',
} as const;

export const MUTE = {
  mute: 'Mute sound',
  unmute: 'Unmute sound',
} as const;
