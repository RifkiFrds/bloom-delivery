/**
 * Phase 0 spike — entry point.
 *
 * Wires: camera → MediaPipe → square correction → pure metrics → N-of-M →
 * hysteresis → hold, publishing one snapshot per tick. The HUD and overlay read
 * that snapshot on their OWN rAF; the detection loop never touches them
 * directly. That is the production React boundary rule (Doc 01 §B4), practised
 * here so it is habit by Phase 3.
 *
 * THROWAWAY. Never imported by src/. The pure modules it exercises are what get
 * ported at Phase 4 task P4.1.
 */

import { CADENCE, MERCY, NOFM } from './config';
import { acquireCamera, CameraError, releaseCamera, type CameraHandle } from './camera';
import { ClosenessFilter, rawCloseness } from './closeness';
import { evaluateG1 } from './g1';
import { evaluateG2 } from './g2';
import { evaluateG3 } from './g3';
import { FaceGate } from './face';
import { HoldTimer } from './hold';
import { Hud } from './hud';
import { DetectionLoop, type TickContext } from './loop';
import { LumaSampler } from './luma';
import { downloadJson, Measurement } from './measure';
import { palmScale } from './metrics';
import { RingBuffer } from './nofm';
import { Overlay } from './overlay';
import { aspectFactor, correctFaceBox, correctHand } from './space';
import {
  createFaceDetector,
  createHandLandmarker,
  warmUp,
  type FaceDetectorResult,
  type HandLandmarkerResult,
} from './vision';
import type {
  CoachingState,
  DetectionSnapshot,
  FaceBox,
  Hand,
  MercyLevel,
  VariantResult,
} from './types';

// ── DOM ──────────────────────────────────────────────────────────────────────

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`missing #${id}`);
  return node as T;
};

const video = el<HTMLVideoElement>('video');
const canvas = el<HTMLCanvasElement>('overlay');
const hudElement = el<HTMLPreElement>('hud');
const statusElement = el<HTMLDivElement>('status');
const startButton = el<HTMLButtonElement>('start');
const stopButton = el<HTMLButtonElement>('stop');
const clipInput = el<HTMLInputElement>('clip');
const deviceInput = el<HTMLInputElement>('device');
const lightingSelect = el<HTMLSelectElement>('lighting');
const mercySelect = el<HTMLSelectElement>('mercy');

// ── State ────────────────────────────────────────────────────────────────────

const overlay = new Overlay(canvas);
const hud = new Hud(hudElement);
const measurement = new Measurement();
const luma = new LumaSampler();
const faceGate = new FaceGate();
const holdTimer = new HoldTimer();
const nofm = new RingBuffer(NOFM.window, NOFM.required);
const closeness = new ClosenessFilter();

let camera: CameraHandle | null = null;
let faceDetector: Awaited<ReturnType<typeof createFaceDetector>> | null = null;
let handLandmarker: Awaited<ReturnType<typeof createHandLandmarker>> | null = null;
let snapshot: DetectionSnapshot | null = null;
let gestureActive = false;
let mercyLevel: MercyLevel = 0;
let gestureStageEnteredAt: number | null = null;
const notes: string[] = [];

function note(message: string): void {
  notes.unshift(`${new Date().toLocaleTimeString()}  ${message}`);
  if (notes.length > 6) notes.pop();
}

function setStatus(message: string): void {
  statusElement.textContent = message;
}

// ── Detection tick ───────────────────────────────────────────────────────────

const loop = new DetectionLoop(runTick, (error) => {
  note(`loop error: ${error instanceof Error ? error.message : String(error)}`);
  loop.stop();
});

function runTick(context: TickContext): number {
  if (camera === null) return 0;

  const started = performance.now();
  const factor = aspectFactor(video.videoWidth, video.videoHeight);

  let faceResult: FaceDetectorResult | null = null;
  if (faceDetector !== null && context.runFaceInference) {
    faceResult = faceDetector.detector.detectForVideo(video, context.timestampMs);
  }

  let handResult: HandLandmarkerResult | null = null;
  if (handLandmarker !== null) {
    handResult = handLandmarker.landmarker.detectForVideo(video, context.timestampMs);
  }

  const inferenceMs = performance.now() - started;

  // ── Normalize (Doc 03 §2.1) ────────────────────────────────────────────────
  const faces: FaceBox[] = (faceResult?.detections ?? []).map((detection) => {
    const box = correctFaceBox(detection.boundingBox ?? { originX: 0, originY: 0, width: 0, height: 0 }, video.videoWidth, factor);
    return { ...box, score: detection.categories[0]?.score ?? 0 };
  });

  const hands: Hand[] = (handResult?.landmarks ?? []).map((landmarks) =>
    correctHand(landmarks, factor),
  );

  // ── Face gate ──────────────────────────────────────────────────────────────
  luma.update(video, started);
  const relaxed = mercyLevel >= MERCY.acceptsFingerHeartFrom;
  const gate = faceGate.update(faces, context.dtMs, relaxed, context.runFaceInference, started);

  if (gate.justLatched) {
    measurement.recordLatch(started);
    gestureStageEnteredAt = started;
    note('FACES_ACQUIRED — togetherConfirmed latched');
  }
  if (gate.soloTimeout) note('SOLO_TIMEOUT — one face for 15 s');

  // ── Mercy escalation (active time only) ────────────────────────────────────
  if (gestureStageEnteredAt !== null && mercySelect.value === 'auto') {
    const elapsed = started - gestureStageEnteredAt;
    for (let level = 3; level >= 1; level -= 1) {
      const threshold = MERCY.thresholdsMs[level];
      if (threshold !== undefined && elapsed >= threshold && mercyLevel < level) {
        mercyLevel = level as MercyLevel;
        note(`MERCY level ${level}`);
        break;
      }
    }
  }

  const m = MERCY.multiplier[mercyLevel];
  const palmScales = hands.map(palmScale);

  // ── Gesture classification (pure) ──────────────────────────────────────────
  const [handA, handB] = hands;
  let g1: VariantResult | null = null;
  let g3: VariantResult | null = null;

  if (handA !== undefined && handB !== undefined) {
    g1 = evaluateG1({ handA, handB, mercyMultiplier: m, active: gestureActive });
    g3 = evaluateG3({ handA, handB, mercyMultiplier: m, active: gestureActive });
  }

  const g2 = hands.map((hand) =>
    evaluateG2({ hand, mercyMultiplier: m, active: gestureActive }),
  );

  // ── Acceptance policy (Doc 03 §6.7) ────────────────────────────────────────
  const fingerHeartsAccepted = mercyLevel >= MERCY.acceptsFingerHeartFrom;
  const accepted =
    gate.liveness &&
    ((g1?.pass ?? false) ||
      (fingerHeartsAccepted && (g2.some((r) => r.pass) || (g3?.pass ?? false))));

  // ── Smoothing, hysteresis, hold ────────────────────────────────────────────
  const gesturePresent = nofm.push(accepted);
  gestureActive = gesturePresent;

  const conditions = g1?.conditions ?? g2[0]?.conditions ?? [];
  const closenessValue = closeness.update(rawCloseness(conditions));

  const hold = holdTimer.update(gesturePresent, context.dtMs);
  if (hold.completed) note('HOLD_COMPLETE — 900 ms reached');

  snapshot = {
    tick: context.tick,
    timestampMs: context.timestampMs,
    faceCount: gate.validCount,
    faceBoxes: faces,
    togetherConfirmed: gate.togetherConfirmed,
    liveness: gate.liveness,
    hands,
    palmScales,
    g1,
    g2,
    g3,
    accepted,
    gesturePresent,
    closeness: closenessValue,
    holdMs: hold.holdMs,
    holdProgress: hold.progress,
    nofmWindow: nofm.snapshot(),
    coaching: deriveCoaching({
      tooDark: luma.tooDark,
      faceCount: gate.validCount,
      latched: gate.togetherConfirmed,
      handCount: hands.length,
      palmScales,
      almost: closeness.isAlmost,
      holdMs: hold.holdMs,
    }),
    mercyLevel,
    lumaY: luma.value,
    tooDark: luma.tooDark,
    inferenceMs,
    effectiveHz: 0,
    intervalMs: CADENCE.targetIntervalMs,
  };

  measurement.observe(snapshot, inferenceMs);
  return inferenceMs;
}

/** Coaching derivation — first match wins (Doc 04 §B.9). */
function deriveCoaching(input: {
  tooDark: boolean;
  faceCount: number;
  latched: boolean;
  handCount: number;
  palmScales: readonly number[];
  almost: boolean;
  holdMs: number;
}): CoachingState {
  if (input.tooDark) return 'TOO_DARK';
  if (input.faceCount === 0) return 'NO_FACES';
  if (input.faceCount === 1 && !input.latched) return 'ONE_FACE';
  if (input.latched && input.handCount === 0) return 'NO_HANDS';
  if (input.palmScales.length > 0 && input.palmScales.some((s) => s < 0.045)) {
    return 'HANDS_TOO_SMALL';
  }
  if (input.almost) return 'ALMOST';
  if (input.holdMs > 0) return 'HOLDING';
  return 'IDLE';
}

// ── Presentation rAF — separate from the detection loop, by design ───────────

function present(): void {
  requestAnimationFrame(present);

  if (video.videoWidth > 0) {
    const rect = video.getBoundingClientRect();
    if (canvas.style.width !== `${rect.width}px`) overlay.resize(rect.width, rect.height);
    overlay.draw({
      hands: snapshot?.hands ?? [],
      faces: snapshot?.faceBoxes ?? [],
      g1: snapshot?.g1 ?? null,
      aspect: aspectFactor(video.videoWidth, video.videoHeight),
      mirrored: true,
    });
  }

  hud.render({
    snapshot,
    stats: loop.stats(),
    measurement,
    delegates: {
      face: faceDetector?.delegate ?? '—',
      hands: handLandmarker?.delegate ?? '—',
    },
    notes,
  });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  startButton.disabled = true;
  try {
    setStatus('requesting camera…');
    camera = await acquireCamera(video);
    note(`camera ${camera.settings.width}×${camera.settings.height}`);

    setStatus('loading face model (blocking, ~230 KB)…');
    faceDetector = await createFaceDetector({
      onWarning: (message) => note(message),
    });
    note(`face model ready (${faceDetector.delegate})`);

    setStatus('warming up…');
    warmUp(faceDetector.detector, null, video, performance.now());

    measurement.beginLatchTiming(performance.now());
    loop.start();
    setStatus('running — hand model loading in background');

    createHandLandmarker({ onWarning: (message) => note(message) })
      .then((handle) => {
        handLandmarker = handle;
        warmUp(null, handle.landmarker, video, performance.now() + 1_000_000);
        note(`hand model ready (${handle.delegate}, ~7.5 MB)`);
        setStatus('running');
      })
      .catch((error: unknown) => {
        note(`hand model FAILED: ${error instanceof Error ? error.message : String(error)}`);
        setStatus('hand model failed — face stage only');
      });

    stopButton.disabled = false;
  } catch (error) {
    startButton.disabled = false;
    if (error instanceof CameraError) {
      setStatus(`camera error: ${error.kind}`);
      note(`${error.kind}: ${error.message}`);
    } else {
      setStatus('failed to start');
      note(error instanceof Error ? error.message : String(error));
    }
  }
}

/** Teardown in the order Doc 02 §2.15 requires: cancel the loop FIRST. */
function stop(): void {
  loop.stop();
  faceDetector?.detector.close();
  handLandmarker?.landmarker.close();
  faceDetector = null;
  handLandmarker = null;

  const clean = releaseCamera(camera);
  camera = null;
  note(`teardown: tracks ended = ${clean}`);
  setStatus('stopped');
  startButton.disabled = false;
  stopButton.disabled = true;
}

/** Replay a recorded clip through the identical pipeline (Doc 03 §10.3). */
function loadClip(file: File): void {
  loop.stop();
  releaseCamera(camera);
  camera = null;
  video.srcObject = null;
  video.src = URL.createObjectURL(file);
  video.loop = true;
  void video.play();
  camera = { stream: new MediaStream(), video, settings: {} };
  faceGate.reset();
  nofm.reset();
  holdTimer.reset();
  closeness.reset();
  loop.start();
  note(`replaying clip: ${file.name}`);
  setStatus(`replaying ${file.name}`);
}

// ── Operator controls ────────────────────────────────────────────────────────

startButton.addEventListener('click', () => void start());
stopButton.addEventListener('click', stop);

clipInput.addEventListener('change', () => {
  const file = clipInput.files?.[0];
  if (file !== undefined) loadClip(file);
});

deviceInput.addEventListener('change', () => measurement.setDevice(deviceInput.value));
lightingSelect.addEventListener('change', () => {
  const value = lightingSelect.value;
  measurement.setLighting(value === 'evening' ? 'evening' : 'daylight');
});
mercySelect.addEventListener('change', () => {
  if (mercySelect.value === 'auto') return;
  mercyLevel = Number(mercySelect.value) as MercyLevel;
  note(`mercy forced to ${mercyLevel}`);
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
    return;
  }
  switch (event.key.toLowerCase()) {
    case 'p':
      measurement.recordTrial('accept', 'G1', true);
      note('trial: ACCEPT pass');
      break;
    case 'f':
      measurement.recordTrial('accept', 'G1', false);
      note('trial: ACCEPT fail');
      break;
    case 'r':
      measurement.recordTrial('reject', 'rejection pose', true);
      note('trial: REJECT correct');
      break;
    case 'x':
      measurement.recordTrial('reject', 'rejection pose', false);
      note('trial: REJECT FALSE POSITIVE');
      break;
    case 'e': {
      const name = window.prompt('fixture name (e.g. 08-clasped-hands)') ?? 'fixture';
      const expectation = window.prompt('expectation (accept / reject-C5 / …)') ?? 'unknown';
      downloadJson(`${name}.fixture.json`, measurement.buildFixture(name, expectation));
      note(`exported fixture ${name}`);
      break;
    }
    case 'm':
      downloadJson(
        `phase0-report-${deviceInput.value || 'device'}.json`,
        measurement.buildReport(),
      );
      note('exported measurement report');
      break;
    default:
      break;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && loop.running) {
    loop.stop();
    note('paused (tab hidden)');
  } else if (!document.hidden && camera !== null && !loop.running) {
    loop.start();
    note('resumed');
  }
});

setStatus('idle — press Start');
present();
