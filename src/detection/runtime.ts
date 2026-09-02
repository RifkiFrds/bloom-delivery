/**
 * ★ THE DETECTION RUNTIME ★ — the orchestrator. Doc 01 §4.1, Doc 03 §11.
 *
 * Owns the MediaPipe tasks, the rAF loop, and every stateful detector. Composes
 * the pure modules — they hold no state, this holds all of it.
 *
 * ── THE TWO RULES THIS MODULE EXISTS TO KEEP ─────────────────────────────
 * B1  Framework-free. No React, no Zustand, no Three, no Framer Motion. It
 *     emits FSM events on the bus and writes one ref. Enforced by ESLint.
 *
 * B4  `tick()` NEVER calls `setState`. It mutates `detectionRef` in place and
 *     returns. Every continuous value — hold progress, closeness, coaching, the
 *     debug metrics — reaches the UI through that ref, read by the HUD in its
 *     own rAF. Only the seven discrete EDGES below become events.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The edges, and nothing else (Doc 01 §4.1 stage 7):
 *   FACES_ACQUIRED · SOLO_TIMEOUT · GESTURE_ENTER · GESTURE_EXIT ·
 *   HOLD_COMPLETE · MODELS_READY · MODELS_FAILED · HAND_MODEL_READY
 */

import { bus } from '@/events/bus';
import { record } from '@/lib/diagnostics';
import type { MercyLevel } from '@/machine';
import { cameraRuntime } from './camera/runtime';
import { CoachingFilter, DwellTracker } from './coaching';
import { FACE, NOFM, relaxedConfidence } from './config';
import { FaceGate } from './face';
import { ClosenessFilter } from './gesture/closeness';
import { HoldTimer } from './gesture/hold';
import { palmScale } from './gesture/metrics';
import { RingBuffer } from './gesture/nofm';
import { anyHorns } from './gesture/horns';
import { selectGesture } from './gesture/select';
import {
  aspectFactor,
  correctFaceBox,
  correctHand,
  correctKeypoint,
} from './gesture/space';
import { LumaSampler } from './luma';
import { detectionRef, resetDetectionRef } from './ref';
import type { DetectionMode, FaceBox, Hand, Point } from './types';
import {
  createFaceDetector,
  createHandLandmarker,
  relaxHandConfidence,
  warmUp,
  type FaceDetector,
  type HandLandmarker,
} from './vision/bootstrap';
import { DetectionLoop, type TickContext } from './vision/loop';

export class DetectionRuntime {
  private readonly loop: DetectionLoop;
  private faceDetector: FaceDetector | null = null;
  private handLandmarker: HandLandmarker | null = null;

  private readonly faceGate = new FaceGate();
  private readonly luma = new LumaSampler();
  private readonly nofm = new RingBuffer(NOFM.window, NOFM.required);
  private readonly hold = new HoldTimer();
  private readonly closeness = new ClosenessFilter();
  private readonly coaching = new CoachingFilter();
  private readonly faceDwell = new DwellTracker();
  private readonly handDwell = new DwellTracker();

  private mode: DetectionMode = 'idle';
  private gestureActive = false;
  private mercyLevel: MercyLevel = 0;
  private bootstrapping = false;
  private closed = false;
  private tripodMode = false;

  constructor() {
    this.loop = new DetectionLoop(
      (context) => this.tick(context),
      (error) => {
        record(
          `detection: loop error — ${error instanceof Error ? error.message : String(error)}`,
        );
        bus.emit({
          type: 'FATAL',
          diagnostic: error instanceof Error ? error.message : String(error),
        });
      },
    );
  }

  /**
   * Blocks on the 230 KB face model; the 7.5 MB hand model continues in the
   * background and announces itself with `HAND_MODEL_READY` (Doc 01 §7.2).
   *
   * The 30 s `modelTimeout` is armed by the FSM, not here — a timeout is a
   * machine concern, and duplicating it would give two owners to one deadline.
   */
  async bootstrap(): Promise<void> {
    if (this.bootstrapping || this.faceDetector !== null) return;
    this.bootstrapping = true;

    try {
      const face = await createFaceDetector();
      this.faceDetector = face.detector;
      detectionRef.faceDelegate = face.delegate;
      record(`vision: face model ready (${face.delegate})`);
      bus.emit({ type: 'MODELS_READY' });
    } catch (error) {
      this.bootstrapping = false;
      record(
        `vision: face model FAILED — ${error instanceof Error ? error.message : String(error)}`,
      );
      bus.emit({ type: 'MODELS_FAILED' });
      return;
    }

    // Background, and deliberately un-awaited: nothing downstream of this line
    // may block on 7.5 MB.
    void createHandLandmarker().then(
      (hands) => {
        if (this.closed) {
          hands.landmarker.close();
          return;
        }
        this.handLandmarker = hands.landmarker;
        detectionRef.handDelegate = hands.delegate;
        record(`vision: hand model ready (${hands.delegate})`);
        bus.emit({ type: 'HAND_MODEL_READY' });
      },
      (error: unknown) => {
        // The face stage has already succeeded, so the user is never sent
        // backwards. `TOGETHER_CONFIRMED` holds to 5 s and then offers the
        // escape hatch (Doc 01 §7.5).
        record(
          `vision: hand model FAILED — ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    );
  }

  start(): void {
    if (this.faceDetector === null) return;
    resetDetectionRef();
    this.faceGate.reset();
    this.coaching.reset();
    this.mode = 'face';
    detectionRef.mode = this.mode;
    detectionRef.running = true;

    const video = cameraRuntime.currentVideo();
    if (video !== null) warmUp(this.faceDetector, null, video, performance.now());

    this.loop.start();
    record('detection: loop started (face)');
  }

  /** `TOGETHER_CONFIRMED` exit. The gesture stage cannot begin without this. */
  enableHands(): void {
    this.mode = 'face+hands';
    detectionRef.mode = this.mode;
    this.nofm.reset();
    this.hold.reset();
    this.closeness.reset();
    this.gestureActive = false;
    record('detection: hands enabled');
  }

  /** Landscape phone → Tripod Mode: G2 is accepted at every level. */
  setTripodMode(enabled: boolean): void {
    this.tripodMode = enabled;
  }

  setMercyLevel(level: MercyLevel): void {
    if (level === this.mercyLevel) return;
    this.mercyLevel = level;
    detectionRef.mercyLevel = level;
    if (relaxedConfidence(level) && this.handLandmarker !== null) {
      relaxHandConfidence(this.handLandmarker);
    }
  }

  /** `WAIT_FOR_PARTNER` — the solo accumulator restarts, the latch does not. */
  resetSolo(): void {
    this.faceGate.resetSolo();
  }

  pause(): void {
    this.loop.pause();
    detectionRef.running = false;
  }

  resume(): void {
    if (this.closed) return;
    this.loop.resume();
    detectionRef.running = this.loop.running;
  }

  /** Cancels the rAF. MUST happen before `close()` — see `camera/teardown.ts`. */
  cancelLoop = (): void => {
    this.loop.stop();
    detectionRef.running = false;
  };

  /** Closes both tasks. Idempotent, and only ever called after `cancelLoop`. */
  closeTasks = (): void => {
    if (this.closed) return;
    this.closed = true;
    try {
      this.faceDetector?.close();
    } catch {
      /* a task that refuses to close must not break the unlock */
    }
    try {
      this.handLandmarker?.close();
    } catch {
      /* as above */
    }
    this.faceDetector = null;
    this.handLandmarker = null;
    record('detection: tasks closed');
  };

  // ── The hot path ─────────────────────────────────────────────────────────

  private tick(context: TickContext): number {
    const video = cameraRuntime.currentVideo();
    if (video === null || video.videoWidth === 0) return 0;

    const factor = aspectFactor(video.videoWidth, video.videoHeight);
    const now = performance.now();
    this.luma.update(video, now);

    const started = performance.now();
    const runFace = this.mode !== 'idle' && context.runFaceInference;
    const runHands = this.mode === 'face+hands' && this.handLandmarker !== null;

    const faceBoxes = runFace ? this.detectFaces(video, context, factor) : [];
    const hands = runHands ? this.detectHands(video, context, factor) : [];
    const inferenceMs = performance.now() - started;

    this.updateFaceStage(faceBoxes, context, runFace, now);
    if (this.mode === 'face+hands') this.updateGestureStage(hands, context);

    this.publish(faceBoxes, hands, context, inferenceMs);
    return inferenceMs;
  }

  private detectFaces(
    video: HTMLVideoElement,
    context: TickContext,
    factor: number,
  ): FaceBox[] {
    if (this.faceDetector === null) return [];
    const result = this.faceDetector.detectForVideo(video, context.timestampMs);
    const boxes: FaceBox[] = [];
    for (const detection of result.detections) {
      const box = detection.boundingBox;
      if (box === undefined) continue;
      const corrected = correctFaceBox(box, video.videoWidth, factor);

      // Carried for the mask overlay only. No gate reads them.
      const keypoints: Point[] = [];
      for (const keypoint of detection.keypoints) {
        keypoints.push(correctKeypoint(keypoint, factor));
      }

      boxes.push({
        ...corrected,
        score: detection.categories[0]?.score ?? 0,
        keypoints,
      });
    }
    return boxes;
  }

  private detectHands(
    video: HTMLVideoElement,
    context: TickContext,
    factor: number,
  ): Hand[] {
    if (this.handLandmarker === null) return [];
    // +1 keeps both detectors on one strictly-increasing clock without a
    // second counter (Doc 03 §11.1).
    const result = this.handLandmarker.detectForVideo(video, context.timestampMs + 1);
    const hands: Hand[] = [];
    for (const landmarks of result.landmarks) {
      hands.push(correctHand(landmarks, factor));
    }
    return hands;
  }

  private updateFaceStage(
    boxes: readonly FaceBox[],
    context: TickContext,
    faceInferenceRan: boolean,
    nowMs: number,
  ): void {
    const gate = this.faceGate.update(
      boxes,
      context.dtMs,
      relaxedConfidence(this.mercyLevel),
      faceInferenceRan,
      nowMs,
    );

    if (gate.justLatched) {
      record('detection: FACES_ACQUIRED (latch closed)');
      bus.emit({ type: 'FACES_ACQUIRED' });
    }
    if (gate.soloTimeout) {
      record('detection: SOLO_TIMEOUT');
      bus.emit({ type: 'SOLO_TIMEOUT' });
    }

    detectionRef.faceCount = gate.validCount;
    detectionRef.togetherConfirmed = gate.togetherConfirmed;
    detectionRef.liveness = gate.liveness;
    detectionRef.soloElapsedMs = gate.soloElapsedMs;
  }

  private updateGestureStage(hands: readonly Hand[], context: TickContext): void {
    const selection = selectGesture({
      hands,
      mercyLevel: this.mercyLevel,
      active: this.gestureActive,
      tripodMode: this.tripodMode,
    });

    // Layer 4 of the defence: someone must still be there (Doc 03 §8.3).
    const accepted = selection.accepted && detectionRef.liveness;

    // N-of-M on the FINAL boolean, never per-condition. Smoothing conditions
    // separately would let C2 from one frame and C5 from another combine into a
    // false positive constructed out of thin air (Doc 03 §4.5).
    const present = this.nofm.push(accepted);

    if (present && !this.gestureActive) {
      this.gestureActive = true;
      bus.emit({
        type: 'GESTURE_ENTER',
        variant: selection.variant ?? 'G1',
      });
    } else if (!present && this.gestureActive) {
      this.gestureActive = false;
      bus.emit({ type: 'GESTURE_EXIT' });
    }

    const hold = this.hold.update(present, context.dtMs);
    if (hold.completed) {
      record('detection: HOLD_COMPLETE');
      bus.emit({ type: 'HOLD_COMPLETE' });
    }

    detectionRef.g1 = selection.g1;
    detectionRef.g2 = selection.g2;
    detectionRef.g3 = selection.g3;
    detectionRef.acceptedVariant = selection.variant;
    detectionRef.accepted = accepted;
    detectionRef.gesturePresent = present;
    detectionRef.closeness = this.closeness.update(selection.closeness);
    detectionRef.holdMs = hold.holdMs;
    detectionRef.holdProgress = hold.progress;
    detectionRef.nofmWindow = this.nofm.snapshot();
  }

  private publish(
    boxes: readonly FaceBox[],
    hands: readonly Hand[],
    context: TickContext,
    inferenceMs: number,
  ): void {
    const scales: number[] = [];
    let maxScale = 0;
    for (const hand of hands) {
      const scale = palmScale(hand);
      scales.push(scale);
      if (scale > maxScale) maxScale = scale;
    }

    const faceDwellMs = this.faceDwell.update(detectionRef.faceCount, context.dtMs);
    const noHandsDwellMs = this.handDwell.update(hands.length, context.dtMs);

    detectionRef.tick = context.tick;
    detectionRef.timestampMs = context.timestampMs;
    detectionRef.faceBoxes = boxes;
    detectionRef.hands = hands;
    detectionRef.handCount = hands.length;
    detectionRef.palmScales = scales;
    // Display only. Deliberately NOT an FSM event: the unlock is the heart, and
    // adding a second way in would be a second thing that can go wrong on the
    // one screen that must not.
    const horns = anyHorns(hands);
    detectionRef.hornsPose = horns;
    if (horns) detectionRef.hornsLatched = true;

    detectionRef.lumaY = this.luma.value;
    detectionRef.tooDark = this.luma.tooDark;

    detectionRef.coaching = this.coaching.update(
      {
        tooDark: this.luma.tooDark,
        faceCount: Math.max(0, detectionRef.faceCount),
        handCount: hands.length,
        togetherConfirmed: detectionRef.togetherConfirmed,
        maxPalmScale: maxScale,
        closeness: detectionRef.closeness,
        holdMs: detectionRef.holdMs,
        faceDwellMs,
        noHandsDwellMs,
      },
      performance.now(),
    );

    const stats = this.loop.stats();
    detectionRef.inferenceMs = inferenceMs;
    detectionRef.inferenceP50 = stats.inferenceP50;
    detectionRef.inferenceP95 = stats.inferenceP95;
    detectionRef.effectiveHz = stats.effectiveHz;
    detectionRef.intervalMs = stats.intervalMs;
    detectionRef.droppedFaceTicks = stats.droppedFaceTicks;
  }

  /** Debug only: the latch threshold, surfaced so the HUD can explain itself. */
  static get latchRequirement(): string {
    return `${String(FACE.latchRequired)} of ${String(FACE.latchWindow)}`;
  }
}

export const detectionRuntime = new DetectionRuntime();
