# DOCUMENT 1 — SYSTEM DESIGN DOCUMENT

**Project:** Bloom Delivery
**Doc version:** 2.0 — rewritten against PRD v2
**Source of truth:** [`PRD-V2.md`](./PRD-V2.md) (supersedes `../PRD.MD`)
**Status:** Implementation-ready
**Related:** [`02-FSM-SPEC.md`](./02-FSM-SPEC.md) · [`03-DETECTION-ALGORITHM.md`](./03-DETECTION-ALGORITHM.md) · [`04-UIUX-SCREEN-SPEC.md`](./04-UIUX-SCREEN-SPEC.md)

**Relationship to PRD v2.** PRD v2 fixes *what* is built and *which numbers* govern it. This document fixes *how the code is arranged* so those numbers are achievable and enforceable. Where the two touch, PRD v2 wins. Nothing here softens a PRD v2 constraint; every number quoted here is traceable to it.

---

## 1. System Overview

### 1.1 Product in one sentence

A frontend-only, camera-driven web experience in which two co-present people prove togetherness once, then reach toward each other to form a heart — one hand each — which releases a 3D flower delivery and a letter written for one person.

**The governing constraint, restated because every decision below descends from it:**

> The gift must always arrive.
> The gesture determines how magical the arrival feels — never whether it happens.

### 1.2 User journey (canonical, happy path)

| # | Scene | FSM state | Camera | WebGL | User does | System does | Duration |
|---|---|---|---|---|---|---|---|
| 0 | Boot | `BOOT` | off | off | — | Capability routing: secure context, `getUserMedia`, WebGL2, in-app browser, prior unlock | < 100 ms |
| 1 | Landing | `LANDING` | off | off | Taps **Start** | Unlocks `AudioContext`; prefetches vision runtime + face model (~1.5 MB) | user-paced |
| 2 | Pre-flight | `PREFLIGHT` | off | off | Reads the privacy promise, taps **I'm ready** | Prefetches `hand_landmarker.task` (~7.5 MB) in the background | ~6 s |
| 3 | Permission | `REQUESTING_CAMERA` | — | off | Taps **Allow** | `getUserMedia` at 720p, `audio: false` | 1–8 s |
| 4 | Warming up | `LOADING_DETECTION` | on | off | Watches a real progress bar | Attaches stream; blocks **only** on the 230 KB face model | ≤ 2.5 s |
| 5 | Find each other | `SEEKING_FACES` | on | off | Both step into frame, look at the lens | `count(faceValid) >= 2` in ≥ 8 of the last 10 ticks → **latch** | 2–20 s |
| 6 | There you are! | `TOGETHER_CONFIRMED` | on | off | Sees a confetti sting | 1.2 s reward beat (extends to 5 s if the hand model is still in flight) | 1.2–5 s |
| 7 | Make a heart | `SEEKING_GESTURE` → `GESTURE_HOLDING` | on | off | Reach toward each other, one hand each | G1 geometry + N-of-M + hysteresis + 900 ms hold | 3–90 s |
| 8 | Unlock | `UNLOCKING` | **teardown** | on | Watches the screen darken and punch | Capture frame → stop all tracks → close both tasks → cancel loop → assert camera off | ~2.2 s |
| 9 | Delivery | `DELIVERY` | off | on | Box falls, lands, bursts | R3F scene; music starts | ~9 s |
| 10 | Bloom | `BLOOM` | off | on | Tulip field fills the frame | Instanced tulips + pooled petals | ~8 s |
| 11 | Message | `MESSAGE` | off | on | Reads "For Alya 🌷" | Scale-overshoot reveal | ~4 s |
| 12 | Letter | `LETTER_CLOSED` → `LETTER_OPEN` | off | idle | Taps **Open Letter** | Envelope peels; payload decoded on transition | user-paced |
| 13 | Resting | `RESTING` | off | idle | **Read again · Replay · Save our photo** | `frameloop="demand"`; persists `bloom_unlocked` | indefinite |

**Total budget to the letter: ≤ 180 s.** Camera-on budget: **≤ 120 s hard cap**.

### 1.3 System responsibilities

The system **is** responsible for:

1. **Capability routing** — deciding Full / Degraded / Lite / Blocked inside `BOOT`, in under 100 ms, before any UI commits.
2. **Camera lifecycle as a first-class concern** — acquisition, the six distinct `getUserMedia` failure modes, track mute/end recovery, the 120 s cap, and a **teardown that is asserted, not assumed**.
3. **Perception** — converting frames into four discrete edges (`FACES_ACQUIRED`, `GESTURE_ENTER`, `GESTURE_EXIT`, `HOLD_COMPLETE`) plus a continuously updated coaching signal.
4. **Truth ownership** — one hand-rolled FSM whose transition table is exhaustive and whose `canUnlock` latch is set synchronously inside the reducer.
5. **Phase isolation** — guaranteeing that camera + MediaPipe never coexist with WebGL.
6. **Mercy** — a three-stage escalation and a keyboard-reachable escape hatch present in the DOM from t=0.
7. **Presentation** — a scripted, budget-bounded audiovisual sequence with a complete 2D twin.
8. **Memory** — persistence, replay, read-again, and a locally-composited photo.

The system is **explicitly not** responsible for:

- **Any network egress after initial asset load.** No analytics, no telemetry, no error beacon. Enforced structurally by CSP `connect-src 'self'` — this is what makes the privacy sentence true rather than aspirational.
- Recording, encoding, uploading, or persisting any frame. The captured unlock frame lives in an in-memory canvas and touches disk only when the user taps *Save our photo*.
- Identity verification. "Two faces" means two face-shaped regions above a size threshold.
- Knowing the permission state in advance — `navigator.permissions.query({name:'camera'})` **is not supported in Safari** and no code path may depend on it.
- Universal WCAG operability. The experience structurally requires a camera. It is required to be *safe* and *non-trapping*; it is not required to be operable without a camera beyond the Lite path.

### 1.4 Boundaries

```
┌───────────────────────────── DEVICE (browser tab) ─────────────────────────────┐
│                                                                                │
│  TRUST BOUNDARY — enforced by CSP connect-src 'self'                           │
│  Every frame, landmark and metric lives and dies in this tab's memory.         │
│  Zero fetch / XHR / WebSocket / sendBeacon after initial asset load.           │
│                                                                                │
│   ┌────────────┐   ┌───────────────┐   ┌──────────────┐   ┌────────────────┐   │
│   │ Camera HW  │──▶│ MediaStream   │──▶│ Detection    │──▶│ FSM (truth)    │   │
│   │ (OS-gated) │   │ (revocable,   │   │ main thread  │   │ pure reducer   │   │
│   │            │   │  120 s cap)   │   │ 15 Hz        │   │ canUnlock latch│   │
│   └────────────┘   └───────────────┘   └──────────────┘   └───────┬────────┘   │
│                            ║ TEARDOWN BOUNDARY (UNLOCKING)        ▼            │
│                            ║                    ┌────────────────────────────┐ │
│                            ╚═══════════════════▶│ Presentation: R3F + FM +   │ │
│                              camera off,        │ Howler (Phase B only)      │ │
│                              tasks closed       └────────────────────────────┘ │
│                                                                  │             │
│                                        ┌─────────────────────────▼──────────┐  │
│                                        │ localStorage: 4 keys, no PII       │  │
│                                        └────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
        ▲                                                    ▲
        │ static assets, one-way, immutable cache            │ zero runtime calls
   ┌────┴──────────────┐                              ┌──────┴───────────────┐
   │ Vercel Edge       │                              │ (no backend exists)  │
   │ incl. /vision/*   │  ← self-hosted, never a CDN  └──────────────────────┘
   └───────────────────┘
```

**Boundary rules (normative):**

| # | Rule |
|---|---|
| **B1** | **All detection code is framework-free.** `detection/`, `vision/` and `gesture/` must not import React, Zustand, Three.js, or Framer Motion. Enforced by an ESLint `no-restricted-imports` rule scoped to those directories. |
| **B2** | Only the FSM reducer may change experience phase. Components dispatch events; detection emits events; neither writes state. |
| **B3** | No React component holds a `MediaStream`. The camera is owned by one non-React service module. |
| **B4** | **The detection loop never calls `setState`.** It writes one mutable ref at 15 Hz. The HUD reads that ref inside its own `rAF`. Per-frame `setState` is a defect, not a style preference. |
| **B5** | Zustand is written **only** on discrete FSM transitions — ~8 writes across an entire session. |
| **B6** | Phase A and Phase B code are separate chunks. The 3D chunk is not in the graph reachable from any Phase A module. |
| **B7** | Everything from `LANDING` onward is one `dynamic({ ssr:false })` client boundary. `use client` appears exactly once. |
| **B8** | Inference runs on the **raw, unmirrored** frame. Mirroring is a CSS concern applied identically to the `<video>` and the overlay canvas. One conversion, one place. |

---

## 2. High-Level Architecture

### 2.1 The governing principle — two disjoint runtime phases

```
                ═══════════════════════════════════════
                 RUNTIME PHASE A — "THE GATE"
                ═══════════════════════════════════════
   Camera ON · MediaPipe ON · WebGL OFF · heavy audio OFF
   Renderer: DOM + CSS + Framer Motion + ONE 2D overlay canvas
   Loop:     single rAF with a time accumulator, 15 Hz detection
   Budget:   66 ms per detection tick, ≥ 40 ms main-thread headroom
   Cap:      120 s of camera-on, absolute

                              ║
                              ║  UNLOCKING — hard teardown boundary
                              ║  1. capture last frame → offscreen canvas
                              ║  2. cancelAnimationFrame(detectionLoop)
                              ║  3. stop() every MediaStreamTrack
                              ║  4. close() FaceDetector + HandLandmarker
                              ║  5. assert camera indicator off
                              ▼

                ═══════════════════════════════════════
                 RUNTIME PHASE B — "THE GIFT"
                ═══════════════════════════════════════
   Camera OFF · MediaPipe OFF · WebGL ON · Audio ON
   Renderer: R3F canvas + DOM overlay (transform/opacity only)
   Budget:   16.7 ms target / 33 ms floor
   Duration: ~45 s active, then frameloop="demand" idle
```

**Nothing heavy ever runs concurrently with anything else heavy.** This is the most important architectural statement in the project. It removes the four-system contention problem, the thermal-throttling-during-the-climax problem, the need for a Web Worker in MVP, and most of the mobile performance risk.

The teardown order matters and is not negotiable: **cancel the loop before closing the tasks**, or an in-flight `detectForVideo` will resolve against a closed task and throw.

### 2.2 Component map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ app/  Next.js 15 App Router · single route · all client                       │
│   layout: next/font (Fredoka, Plus Jakarta) · CSP meta · robots · tokens      │
│   page:   <ExperienceRoot/>  dynamic, ssr:false                               │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ ORCHESTRATION                                                                │
│   machine/   pure reducer (state, event) → {state, effects}                  │
│              transition table + guards · ZERO React imports · throws on       │
│              illegal (state,event) in dev, logs to diagnostic buffer in prod  │
│   store/     Zustand: machine state + MachineContext. ~8 writes/session       │
│   events/    typed event bus — the ONLY entry point into the machine          │
│   effects/   declarative effect runner (teardown, prefetch, persist, audio)   │
└───────┬──────────────────────────┬───────────────────────────┬───────────────┘
        │ Phase A                  │ Phase B                   │ both
        ▼                          ▼                           ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────────┐
│ DETECTION            │  │ RENDERING            │  │ AUDIO                  │
│ (framework-free)     │  │                      │  │                        │
│  camera/             │  │  scene/  R3F v9      │  │  audio/                │
│   acquire (ladder)   │  │   BoxDrop            │  │   unlock() @ Scene 1    │
│   lifecycle listeners│  │   TulipField (inst.) │  │   Howler sprite sheet  │
│   teardown + assert  │  │   PetalSystem (pool) │  │   duck/resume on vis.  │
│  vision/             │  │   Degrader           │  │   mute → localStorage  │
│   tasks bootstrap    │  │  overlay/ DOM + FM   │  └────────────────────────┘
│   loop 15 Hz (rAF)   │  │   Message · Letter   │
│   luma sampler 2 Hz  │  │   Resting            │  ┌────────────────────────┐
│  gesture/            │  │  lite/  2D Lottie    │  │ INFRASTRUCTURE         │
│   metrics (pure fns) │  │   parallel impl. of  │  │  capability probe      │
│   G1 · G2 · G3       │  │   every Phase B beat │  │  persistence (4 keys)  │
│   N-of-M · hysteresis│  └──────────────────────┘  │  diagnostics buffer    │
│   hold timer         │                            │  error boundary        │
│   coaching derivation│  ALL Phase B code is in a  │  motionSafe provider   │
│  → writes ONE ref    │  separate chunk, loaded    │  photo compositor      │
│  → emits 4 edges     │  at SEEKING_FACES.         └────────────────────────┘
└──────────────────────┘
```

### 2.3 Data flow — Phase A (detection, steady state)

```
 [Camera HW] 720p @30fps
      │
      ▼
 [<video> playsInline muted autoPlay]   display: transform: scaleX(-1)
      │                                  inference: RAW, unmirrored
      │
      ▼  single requestAnimationFrame loop with a time accumulator
 ┌────────────────────────────────────────────────────────────────┐
 │ 1. CADENCE GATE   now - lastRun >= interval ? run : skip        │
 │    interval 66 ms → 100 ms if last inference > 60 ms            │
 └────────────────────────────────────────────────────────────────┘
      │
      ▼  ONE monotonically increasing timestamp per tick, shared by both models
 ┌────────────────────────────────────────────────────────────────┐
 │ 2. INFERENCE (main thread)                                      │
 │    SEEKING_FACES : FaceDetector.detectForVideo(video, ts)       │
 │    SEEKING_GESTURE: FaceDetector + HandLandmarker, same ts      │
 │    (face dropped entirely if inference > 110 ms — latch holds)  │
 └────────────────────────────────────────────────────────────────┘
      │
      ▼
 ┌────────────────────────────────────────────────────────────────┐
 │ 3. NORMALIZE — square-corrected space                           │
 │    x' = x ;  y' = y * (videoHeight / videoWidth)                │
 │    All distances hereafter in units of FRAME WIDTH.             │
 └────────────────────────────────────────────────────────────────┘
      │
      ▼
 ┌────────────────────────────────────────────────────────────────┐
 │ 4. METRICS — pure functions, zero state, zero allocation        │
 │    faceCount, faceBoxWidths · per hand S = dist(L0,L9)          │
 │    G1/G2/G3 condition vectors · closeness ∈ [0,1]               │
 └────────────────────────────────────────────────────────────────┘
      │
      ▼
 ┌────────────────────────────────────────────────────────────────┐
 │ 5. SMOOTHING                                                    │
 │    booleans → N-of-M ring buffer (5 of last 7)                  │
 │    closeness → EMA α = 0.4   [UI ONLY — never gates]            │
 └────────────────────────────────────────────────────────────────┘
      │
      ▼
 ┌────────────────────────────────────────────────────────────────┐
 │ 6. HYSTERESIS   enter: metric ≤ T · exit: metric > T × 1.30     │
 └────────────────────────────────────────────────────────────────┘
      │
      ▼
 ┌────────────────────────────────────────────────────────────────┐
 │ 7. HOLD TIMER   present: hold += dt (cap 900)                   │
 │                 absent : 200 ms grace, then hold -= dt×2        │
 └────────────────────────────────────────────────────────────────┘
      │
      ├─▶ ref.current = { coachingState, holdProgress, debugMetrics }
      │        HUD reads this inside its own rAF. NEVER setState here.
      │
      └─▶ on DISCRETE EDGES ONLY:
             FACES_ACQUIRED · GESTURE_ENTER · GESTURE_EXIT · HOLD_COMPLETE
             SOLO_TIMEOUT · MERCY_TICK
                    │
                    ▼
              [event bus] ──▶ [FSM reducer] ──▶ [Zustand] ──▶ React
```

**React re-render budget during detection: ≤ 2 per second.** A counter in `?debug=1` proves it; Phase 3's exit criteria gate on it.

### 2.4 Data flow — Phase B (presentation)

```
 UNLOCKING entry effect
   ├ capture last frame → ImageBitmap (kept in MachineContext for the photo)
   ├ cancelAnimationFrame(detectionLoop)
   ├ stream.getTracks().forEach(t => t.stop())
   ├ faceDetector.close() ; handLandmarker.close()
   └ assert: every track.readyState === 'ended'
        │
        ▼
 [SEQUENCE DIRECTOR] — one authoritative clock (performance.now)
   emits named markers; the R3F scene interpolates against them
        │
        ├─▶ R3F <Canvas>  : BoxDrop → impact → open → burst → TulipField → petals
        ├─▶ Framer Motion : darken, one 350 ms shake, single radial bloom, copy
        ├─▶ Howler        : music.play() with an 800 ms fade-in; SFX at markers
        └─▶ Degrader      : rolling 2 s median FPS → one-way ladder
        │
        ▼ SEQUENCE_STEP_DONE per beat
     DELIVERY → BLOOM → MESSAGE → LETTER_CLOSED → LETTER_OPEN → RESTING
```

The Director owns wall-clock time; `useFrame` delta is used only for interpolation. A sequence therefore takes the same real duration at 60 fps and at 30 fps, so audio never desynchronizes.

---

## 3. Runtime Architecture (layered)

```
╔══════════════════════════════════════════════════════════════════════╗
║ 1. USER INTERACTION LAYER                                            ║
║    pointer/touch/keyboard · native permission prompt · physical      ║
║    gestures in front of the lens · device orientation · ringer switch║
╚══════════════════════════════╤═══════════════════════════════════════╝
                               ▼ intents
╔══════════════════════════════════════════════════════════════════════╗
║ 2. APPLICATION LAYER                                                 ║
║    Scene components · SequenceDirector · CoachingHUD · AudioControl  ║
║    CapabilityProbe · copy catalogue · PhotoCompositor                ║
╚══════════════════════════════╤═══════════════════════════════════════╝
                               ▼ bus.emit(event)
╔══════════════════════════════════════════════════════════════════════╗
║ 3. STATE LAYER                                                       ║
║    FSM reducer + frozen transition table + guards · MachineContext   ║
║    (latches: togetherConfirmed, hasUnlocked, peekedAlone) · effects  ║
╚══════════════════════════════╤═══════════════════════════════════════╝
                               ▼ start/stop/configure
╔══════════════════════════════════════════════════════════════════════╗
║ 4. DETECTION LAYER  (framework-free)                                 ║
║    camera service · 15 Hz loop · tasks bootstrap · metrics · G1/G2/G3║
║    N-of-M · hysteresis · hold timer · luma · coaching derivation     ║
╚══════════════════════════════╤═══════════════════════════════════════╝
                               ▼ scene commands
╔══════════════════════════════════════════════════════════════════════╗
║ 5. RENDERING LAYER                                                   ║
║    React reconciler · Framer Motion · R3F v9 / Three.js · 2D overlay ║
║    canvas · Lottie (Lite) · Tailwind tokens                          ║
╚══════════════════════════════╤═══════════════════════════════════════╝
                               ▼ platform calls
╔══════════════════════════════════════════════════════════════════════╗
║ 6. INFRASTRUCTURE LAYER                                              ║
║    CameraService · AssetLoader · Persistence · Degrader · Diagnostics║
║    ErrorBoundary · WebGLContextManager · Howler engine · motionSafe  ║
╚══════════════════════════════════════════════════════════════════════╝
```

**L1 — User Interaction.** Normalizes raw input. Owns one critical responsibility: **the Scene-1 Start tap must synchronously create and `resume()` the `AudioContext` and play a one-sample silent buffer.** That tap is the only reliable user gesture before music is needed ~45 s later. Likewise, `getUserMedia` is called synchronously inside the Allow handler; any `await` before the call breaks iOS Safari's user-activation requirement.

**L2 — Application.** Scenes are pure projections of FSM state and must be safely remountable. The **SequenceDirector** is the only long-lived timeline. The **CoachingHUD** subscribes to the detection ref via its own `rAF` and applies a 1.5 s minimum dwell per message so text never flickers.

**L3 — State.** A pure reducer plus a frozen transition table. **Any `(state, event)` pair not in the table is illegal** — in development the reducer throws; in production it appends to the diagnostic buffer and returns state unchanged. This is how "execute once" is actually enforced, together with the synchronous `canUnlock` latch. Effects are declarative descriptors executed by a runner in L2, which makes the whole experience testable by replaying event logs with no camera.

**L4 — Detection.** Owns all perception. Runs on its own cadence, entirely decoupled from React. Two outputs only: one mutable ref (15 Hz) and six discrete events. Never renders; never touches the DOM beyond the `<video>` and the overlay canvas it was handed.

**L5 — Rendering.** Owns pixels. Ownership is exclusive per §5. Phase A renders DOM/CSS/FM only; Phase B mounts WebGL.

**L6 — Infrastructure.** Every browser API is wrapped exactly once, so iOS quirks and capability fallbacks live in one auditable place. All singletons expose an idempotent `dispose()`.

---

## 4. Detection Pipeline Architecture

### 4.1 Exact flow

```
STAGE 0  CAMERA STREAM  (REQUESTING_CAMERA)
  ├ Constraints — single set, no ladder needed at 720p:
  │     { video: { facingMode:'user',
  │                width:  { ideal: 1280 },
  │                height: { ideal:  720 },
  │                frameRate: { ideal: 30, max: 30 } },
  │       audio: false }
  │   720p not 1080p: halves decode cost, and MediaPipe downsamples anyway.
  │   audio:false matters — requesting audio triggers a scarier prompt and a
  │   second permission to lose.
  ├ Six distinct rejections, six distinct screens (§9):
  │     NotAllowedError · NotFoundError · NotReadableError
  │     OverconstrainedError · SecurityError · AbortError
  ├ <video playsInline muted autoPlay> — all three required. Without
  │   playsInline, iOS Safari takes the video fullscreen and the UI vanishes.
  ├ Bind track listeners: onmute → TRACK_MUTED · onended → TRACK_ENDED
  ├ Arm the 120 s absolute camera timer
  └ → LOADING_DETECTION
        │
        ▼
STAGE 1  MODEL BOOTSTRAP  (LOADING_DETECTION)
  ├ Self-hosted from /public/vision/ — never a CDN. A jsDelivr hiccup at the
  │   emotional peak of a one-shot gift is an unacceptable dependency, and
  │   self-hosting is what keeps connect-src 'self' intact.
  ├ BLOCKS on face_detector.task (~230 KB) only.
  ├ hand_landmarker.task (~7.5 MB) continues in the background; it was started
  │   at PREFLIGHT_CONTINUE and is covered by the permission prompt + face stage.
  ├ 30 s timeout → MODELS_FAILED → CAMERA_ERROR with a Lite escape.
  └ MODELS_READY → SEEKING_FACES; start the 15 Hz loop; prefetch the 3D chunk
        │
        ▼
STAGE 2  FRAME ACQUISITION  (every tick)
  ├ Driver: ONE requestAnimationFrame loop with a time accumulator.
  │   Not setInterval — it drifts and does not pause with the tab.
  ├ Cadence gate: run only if now - lastRun >= interval.
  │   interval = 66 ms (15 Hz) · → 100 ms (10 Hz) if last inference > 60 ms
  ├ ONE timestamp per tick, reused by both detectors. Timestamps must be
  │   monotonically increasing across both or MediaPipe throws.
  ├ No ImageBitmap, no OffscreenCanvas, no transfer: detectForVideo takes the
  │   <video> element directly on the main thread.
  └ Loop is cancelled on VISIBILITY_HIDDEN and on teardown. Never leaked.
        │
        ▼
STAGE 3  FACE DETECTION
  ├ Model: BlazeFace short-range, runningMode VIDEO, GPU delegate → CPU fallback
  ├ faceValid(d) := d.categories[0].score >= 0.50
  │              AND d.boundingBox.width >= 0.10   (frame-width units)
  ├ SEEKING_FACES : facesPresent := count(faceValid) >= 2   ← NOT == 2
  │     >= 2 is deliberate: a poster, a TV, a mirror or a passer-by adding a
  │     third face must not close the gate. The 0.10 width gate rejects small
  │     background faces.
  ├ SEEKING_GESTURE : liveness := count(faceValid) >= 1
  │     in >= 5 of the last 10 ticks. If face inference has been dropped for
  │     performance, liveness is assumed true — the latch already established
  │     presence.
  └ No tracking, no IDs, no box smoothing. The gate is a count, not an identity
    system. Anything more is unused complexity.
        │
        ▼
STAGE 4  HAND DETECTION  (SEEKING_GESTURE only)
  ├ Model: HandLandmarker, VIDEO, numHands: 2 (NOT 4), GPU → CPU fallback
  ├ 21 normalized landmarks per hand.
  ├ Handedness (Left/Right) is IGNORED ENTIRELY. It is unreliable when the two
  │   hands belong to different people, and no geometry below needs it.
  └ Raw landmarks are NOT filtered. MediaPipe's VIDEO running mode already
    applies internal temporal tracking; a second filter costs latency and buys
    nothing at 15 Hz.
        │
        ▼
STAGE 5  GESTURE CLASSIFICATION  (pure functions, Doc 3 §5)
  ├ Square-correct every landmark once: x'=x, y'=y·(videoHeight/videoWidth)
  ├ S(h) = dist(h[0], h[9])           ← palm scale, every threshold ×S
  ├ G1  two-hand heart   C1..C7       ← PRIMARY, coached
  ├ G2  one-hand finger heart C1..C4  ← accepted from mercy level ≥ 1
  ├ G3  mirrored finger hearts        ← accepted from mercy level ≥ 1
  └ closeness = clamp01(mean over C2..C7 of (1 - measured/threshold))
        │
        ▼
STAGE 6  VALIDATION
  ├ accepted := (level 0) G1
  │           | (level ≥ 1) G1 ∨ G2 ∨ G3
  ├ gate on liveness
  ├ N-of-M: gesturePresent := accepted true in >= 5 of the last 7 ticks
  │     Applied to the FINAL boolean, never to individual conditions. This is
  │     what absorbs single-frame dropouts from motion blur and occlusion.
  ├ Hysteresis per distance condition: enter ≤ T, exit > T × 1.30
  └ Hold timer: +dt to a 900 ms cap · 200 ms grace · then −dt×2 decay
        │
        ▼
STAGE 7  EDGE EMISSION
  ├ FACES_ACQUIRED   (once; latches togetherConfirmed permanently)
  ├ SOLO_TIMEOUT     (1 face continuously for 15 s, pre-latch)
  ├ GESTURE_ENTER / GESTURE_EXIT  (N-of-M boolean edges)
  ├ HOLD_COMPLETE    (hold >= 900; guarded by canUnlock; fires once)
  ├ MERCY_TICK       (at 20 s / 45 s / 90 s of gesture-stage active time)
  └ Everything else — coaching state, ring progress, debug metrics — goes to
    the ref, never to the machine.
```

### 4.2 Latency and budget

| Segment | Target | Degrade at |
|---|---|---|
| Both models, one tick | ≤ 45 ms | > 60 ms → 10 Hz · > 110 ms → drop face |
| Metrics + smoothing + hold (pure) | ≤ 2 ms | — |
| Main-thread headroom per 66 ms frame | ≥ 40 ms | — |
| Edge → FSM → React commit | ≤ 16 ms | — |
| React re-renders during detection | ≤ 2 /s | — |

---

## 5. Rendering Architecture

Ownership is exclusive and phase-scoped. Overlap is the primary source of jank, so it is eliminated by construction rather than managed.

### 5.1 Ownership matrix

| Concern | Phase | Owner | Never owned by |
|---|---|---|---|
| App shell, scene swap, layout | both | **React DOM** | FM, R3F |
| Copy, buttons, cards, coaching HUD | A | **React DOM + Tailwind** | R3F |
| Camera preview surface | A | **DOM `<video>`** + CSS `scaleX(-1)` | R3F texture |
| Landmark / framing overlay | A | **one 2D canvas**, same mirror transform | R3F, SVG |
| Progress ring, coach card, badges | A | **Framer Motion** | R3F |
| Screen darken, 350 ms shake, radial bloom | A→B | **Framer Motion** on a wrapper div | R3F post-processing |
| Box, tulips, petals | B | **R3F v9 / Three.js** | FM |
| Message, letter, resting UI | B | **Framer Motion + CSS 3D** | R3F |
| Lite 2D sequence | B | **Lottie + CSS** | R3F |
| All audio | both | **Howler** | — |

### 5.2 React

- Scenes are pure functions of `(state, context, motionSafe)`. Atomic selectors only (`s => s.state`), never object literals.
- Next.js 15 App Router, **single route**, everything client. Root layout carries `next/font`, CSP meta, robots meta and design tokens.
- **R3F v9 is pinned.** R3F v8 does not support React 19, which Next 15 ships. Verifying this on day 1 of Phase 1 is an explicit exit criterion.

### 5.3 Framer Motion

- Carries the "juicy, bouncy, overshooting" identity in Phase A and in all Phase B overlays.
- **DOM-over-WebGL rule:** overlay elements animate **only `transform` and `opacity`**. No `width`, `height`, `top`, `left`, `filter`, or `box-shadow` animation over the canvas — those force full-screen recomposites on mobile Safari. `will-change` is applied on animation start and removed on completion.
- Every spring references a named token (Doc 4 §C). Ad-hoc stiffness/damping is a review-blocking defect.
- One root `MotionConfig` reads `motionSafe`; every variant set declares both branches.

### 5.4 Three.js

```
<Canvas dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        flat >
```

| Aspect | Decision |
|---|---|
| Camera | `PerspectiveCamera`, fov 45, **fixed**. No `OrbitControls`. |
| Lighting | 1 ambient + 1 directional. **Zero shadow maps. No environment map.** |
| Materials | `MeshBasicMaterial` / `MeshToonMaterial`, **vertex colors**. No PBR, no envMap, no normal maps, no textures if avoidable. |
| Outlines | **Inverted hull** — `BackSide`, scale 1.03, flat `#111111`. This *is* the neo-brutalist look and costs one extra draw call. |
| Post-processing | **NONE.** "Bloom" is faked with additive sprites plus a CSS radial gradient overlay. A full-screen pass costs 30–50% of the mobile frame budget and buys almost nothing at this art style. |
| Instancing | `TulipField` = 1 `InstancedMesh`, ≤ 60 instances. `PetalSystem` = 1 `InstancedMesh`, pool of 300, **pre-allocated at mount**. |
| Allocation | **Zero allocations inside `useFrame`.** Scratch vectors are module-level singletons. Verified by an allocation profile in Phase 6. |

### 5.5 React Three Fiber

- `frameloop="always"` only during the active sequence; **`frameloop="demand"` from `RESTING` onward**, with `invalidate()` on interaction. `RESTING` idle must cost < 5% GPU.
- No component inside `<Canvas>` may subscribe to a store selector that changes per frame. Per-frame values come from the Director's shared ref.
- Drei is **cherry-picked import only** — never the barrel import, which defeats tree-shaking and blows the 450 KB chunk budget.
- `webglcontextlost` → attempt restore once; on failure `DEGRADE_TO_LITE` and continue the remaining scenes in 2D. **Never lose the letter.**

### 5.6 The Lite path is a parallel implementation, not a stub

Every Phase B beat exists twice: R3F and Lottie+CSS. The letter is **identical** in both. Lite is reached by: no WebGL2, no camera hardware, model download failure, permission denial, in-app browser refusal, `DEGRADE_TO_LITE`, or a fatal error. It is not a degraded experience — it trades only the third dimension.

**Schedule risk to name explicitly:** Lite is the thing most likely to be deprioritised, and deprioritising it leaves *every* fallback path broken. It is a Phase 5 deliverable with its own exit criterion.

### 5.7 Compositing order

```
 z   layer                                phase   renderer
 ──────────────────────────────────────────────────────────────
  0  page background (flat + grain)        both    CSS
 10  camera <video>, mirrored              A       DOM
 20  framing / landmark overlay canvas     A       Canvas2D
 30  R3F <Canvas>, transparent             B       WebGL
 40  Lottie stage (Lite)                   B       DOM/SVG
 50  UI chrome: coaching HUD, ring, buttons both    React + FM
 60  screen overlays: darken, radial bloom  A→B     FM
 70  modals: interstitial, denial help      A       React + FM
 80  aria-live regions (visually hidden)    both    DOM
```

Layers 10–20 and 30–40 are **never simultaneously mounted**, except across the ~2.2 s `UNLOCKING` cross-fade, where the live `<video>` has already been replaced by the captured still frame.

---

## 6. State Architecture

### 6.1 Families

| Family | Owner | Lifetime | Written by | Persisted |
|---|---|---|---|---|
| **FSM state** | `machine/` reducer | session | `bus.emit(event)` only | no |
| **MachineContext** | same reducer | session | reducer only | 4 flags mirrored |
| **Detection ref** | `detection/` module | Phase A | the 15 Hz loop | no |
| **Local UI state** | component `useState` | mount | the component | no |
| **Preferences** | Zustand + localStorage | cross-session | user actions | yes |

### 6.2 MachineContext

```
MachineContext {
  // latches — write-once, never cleared during a session
  togetherConfirmed : boolean    // set on FACES_ACQUIRED, never reset
  hasUnlocked       : boolean    // THE idempotency latch
  peekedAlone       : boolean

  // config
  recipientName     : string     // sanitised, default "Someone Special"
  motionSafe        : boolean    // !prefers-reduced-motion, user-overridable
  renderTier        : 'full' | 'lite'
  muted             : boolean

  // runtime
  gestureStageEnteredAt : number | null
  mercyLevel            : 0 | 1 | 2 | 3
  lastError             : DiagnosticInfo | null
  capturedFrame         : ImageBitmap | null
  skipCameraStage       : boolean    // true during replay
}
```

`hasUnlocked` is set **synchronously inside the reducer**, before any async work. This is what kills the double-fire race when `HOLD_COMPLETE` and `MERCY_UNLOCK` arrive in the same tick.

### 6.3 The detection ref — the load-bearing performance decision

The detection loop writes `{ coachingState, holdProgress, closeness, debugMetrics }` into one mutable ref at 15 Hz. The HUD reads it inside its own `rAF` (or via `useSyncExternalStore` with an rAF-driven notifier). **Zustand is never written from this path.**

Without this rule, 15 Hz × several subscribers of `setState` produces 30–60 React commits per second during the single most performance-sensitive phase, on the weakest devices, while two neural networks are running. With it, the store sees roughly **8 writes across an entire session**.

### 6.4 Local UI state

Permitted: focus, hover/press visuals, disclosure open/closed, animation-completion latches inside one component. Prohibited: anything another component needs, anything that must survive a remount, anything derived from detection.

### 6.5 Persistence

Four keys, all non-sensitive, every access wrapped in `try/catch` (private mode, blocked site data, and thumbnail-capture contexts all throw):

| Key | Value | Purpose |
|---|---|---|
| `bloom_unlocked` | `'1'` | route returning visitors `BOOT → RESTING` |
| `bloom_muted` | `'0' \| '1'` | audio preference |
| `bloom_motion` | `'full' \| 'reduced'` | motion override |
| `bloom_peeked` | `'1'` | solo-peek acknowledgement |

No PII. No frames. No landmarks. No scores. **No Zod** — the only untrusted input is `?to=`, handled by a five-line regex (§Doc 2 §6.3).

---

## 7. Asset Loading Architecture

### 7.1 The problem this section exists to solve

The largest asset in the project is the **7.5 MB hand model**. The scene structure exists partly to hide it. Blocking the camera stage on 7.5 MB means a 15-second stare at a loader on 4G; blocking only on 230 KB means the camera appears in ~2 s and the hand model lands while the pair is getting into position.

### 7.2 Load staging schedule

| Trigger | Prefetch started | Size | Cover time |
|---|---|---|---|
| `LANDING` mount | vision WASM runtime + `face_detector.task` | ~1.5 MB | user reads the landing |
| `START_TAPPED` | *(continues)* | — | pre-flight reading time |
| `PREFLIGHT_CONTINUE` | **`hand_landmarker.task`** | ~7.5 MB | permission prompt + face stage (~20 s) |
| `LOADING_DETECTION` | blocks on the face model only | — | — |
| `SEEKING_FACES` enter | 3D chunk + `.glb` models | ~1.6 MB | face + gesture stages |
| `TOGETHER_CONFIRMED` enter | audio (music + SFX sprite) | ~950 KB | gesture stage |

`TOGETHER_CONFIRMED` is a 1.2 s reward beat that **extends up to 5 s** if the hand model is still in flight, disguised as *"warming up the magic ✨"*. It is both a celebration and a load buffer; that dual purpose is deliberate.

### 7.3 Serving rules

- **Self-hosted, never CDN:** `/public/vision/wasm/*.wasm`, `/public/vision/face_detector.task`, `/public/vision/hand_landmarker.task`.
- `Cache-Control: public, max-age=31536000, immutable` with content-hashed names for models and `.glb`.
- `.wasm` served as `application/wasm` for streaming compilation.
- Fonts via `next/font` (self-hosted, Latin subset) — **no Google Fonts network request at runtime**, which would also break `connect-src 'self'`.

### 7.4 3D asset pipeline

```
 Blender (flat shade · vertex colors · no UVs · joined by material)
    │  glTF 2.0, +Y up, single scene, no cameras/lights
    ▼
 gltf-transform:  dedup → prune → weld → join → simplify (ratio ≤ 0.75)
                  → meshopt   (preferred over Draco: no decoder wasm, faster)
                  → textures only if unavoidable: 512 max, toktx UASTC
    ▼
 Budget validation  ──▶  FAIL THE BUILD if exceeded
    ▼
 /public/models/*.glb
```

**Hero 3D assets are authored, not downloaded.** Sketchfab/Poly Pizza models carry unpredictable topology (50k–500k triangles), embedded 2K–4K textures, and attribution burden. A tulip in this art style is ~1,000 triangles with vertex colors and no texture at all — authoring is both cheaper to render and more on-brand.

### 7.5 Failure handling

| Failure | Result |
|---|---|
| Face model fails / 30 s timeout | `MODELS_FAILED` → `CAMERA_ERROR` with *"The magic is being shy."* + **Skip to the delivery** (Lite) |
| Hand model fails | `TOGETHER_CONFIRMED` holds to 5 s, then routes to Lite via the escape hatch — the face stage already succeeded, so the user is never sent backwards |
| 3D chunk or `.glb` fails | `renderTier = 'lite'`; the sequence plays in 2D; the user is never told |
| Audio fails | Silent run; mute control shows unavailable |
| Lottie fails (Lite) | Static illustrated sequence + the letter. The letter is always reachable. |

**Rule:** the user must never see a bare spinner after `START_TAPPED`. Every wait is a designed beat — the pre-flight read, the real-percentage loader, the `TOGETHER_CONFIRMED` sting.

---

## 8. Performance Strategy

### 8.1 Tiers

| Tier | Devices | Experience |
|---|---|---|
| **1 — Full** | iOS 16.4+ Safari · Android Chrome 110+ (≥ 4 GB) · desktop latest with a camera | Detection @15 Hz, full 3D |
| **2 — Degraded** | iOS 15.0–16.3 (no WASM SIMD → CV ~3× slower) · Android Chrome 90–109 · low-RAM Android | Detection @10 Hz, mercy thresholds start relaxed, particles halved, `dpr` 1.0 |
| **3 — Lite** | No WebGL2 · no camera · Firefox mobile · users who opt out | Skip detection entirely → 2D Lottie sequence → full letter |
| **0 — Blocked** | In-app browsers | Interstitial first; escape to Tier 3 if they refuse |

The iOS 16.4 line is where WebAssembly SIMD shipped in Safari. Below it MediaPipe is multiple times slower — playable but not pleasant. We support it as Tier 2 rather than blocking it, because the recipient's phone is not a variable we control.

### 8.2 Network budgets

| Item | Budget |
|---|---|
| Initial JS (route entry, no CV, no 3D) | **≤ 140 KB gzip** |
| Vision runtime chunk (JS + WASM) | ≤ 1.3 MB transfer |
| `face_detector.task` | ≤ 260 KB (**blocking**) |
| `hand_landmarker.task` | ≤ 8.0 MB (**non-blocking**) |
| 3D chunk (three + R3F v9 + drei subset) | **≤ 450 KB gzip** |
| All `.glb` combined | **≤ 1.2 MB** |
| Music | ≤ 900 KB |
| SFX sprite sheet | ≤ 120 KB (6 sounds, one file) |
| Lottie (Lite) | ≤ 150 KB |
| Fonts | ≤ 90 KB |
| **Total transfer, full experience** | **≤ 13 MB** (8 MB background-loaded) |

**A build-time script checks every file against these and fails CI on violation. Budgets that are not enforced are wishes.**

### 8.3 Timing budgets (4G ~5 Mbps, mid-tier Android)

| Metric | Target | Hard limit |
|---|---|---|
| Scene 1 LCP | ≤ 1.8 s | 3.0 s |
| Scene 1 interactive | ≤ 2.2 s | 3.5 s |
| Camera preview visible after grant | ≤ 2.5 s | 5.0 s |
| Gesture stage ready (hand model loaded) | ≤ 25 s from first paint | 40 s |
| 3D sequence ready at unlock | must be **pre-loaded** | — |

v1's *"initial load < 3 seconds"* is retained for **Scene 1 only**. For the whole experience it is arithmetically impossible — 13 MB does not move in 3 s on cellular. The staging schedule is the honest answer: the user is never waiting on something that has not already started downloading.

### 8.4 Rendering budgets (Phase B)

| Item | Budget |
|---|---|
| FPS target | 60 (desktop, Tier 1 mobile) |
| **FPS floor** | **30 sustained** — below this the ladder fires |
| `dpr` | `min(dpr, 2)` desktop · `min(dpr, 1.5)` mobile |
| Scene triangles (incl. outline hulls) | **≤ 45,000** |
| Draw calls | **≤ 40** |
| Tulip | ≤ 1,000 tris (≤ 2,000 with hull), instanced |
| Flower box | ≤ 2,500 tris |
| Tulip instances | ≤ 60 |
| Petal particles | **≤ 300**, one `InstancedMesh`, pre-allocated |
| Textures | prefer none; if required ≤ 512², ≤ 4 total, KTX2 |
| Shadow maps · post passes | **0 · 0** |
| Lights | ≤ 2 |
| Allocations in `useFrame` | **0** |
| GPU memory | ≤ 120 MB |
| JS heap after unlock | ≤ 180 MB (Phase A resources must be released) |

### 8.5 Detection budgets (Phase A)

| Item | Budget |
|---|---|
| Detection rate | 15 Hz target, 10 Hz degraded |
| Inference per tick, both models | ≤ 45 ms target, ≤ 60 ms before degrading |
| Main-thread headroom per 66 ms frame | ≥ 40 ms |
| React re-renders/second, detection scenes | **≤ 2** |
| Zustand writes per session | ~8 |
| Camera-on duration | **≤ 120 s hard** |

### 8.6 Degradation ladder — one-way, never climbs back

Driven by a rolling **median** FPS over a 2 s window. It never reverses: oscillation is worse than a slightly conservative setting.

| Trigger | Action |
|---|---|
| median < 45 fps | `dpr` → 1.0 |
| median < 34 fps | petals 300 → 150; **disable the inverted-hull outline pass** |
| median < 26 fps | tulips 60 → 24; petals → 60; freeze ambient drift |
| median < 20 fps for 3 s | **`DEGRADE_TO_LITE`** — unmount the R3F canvas, continue in 2D from the current beat |
| Phase A: inference > 60 ms | detection interval 66 → 100 ms |
| Phase A: inference > 110 ms | drop face detection during the gesture stage (the latch already holds) |

### 8.7 Battery and thermals

- Camera-on ≤ 120 s; total experience ≤ 180 s to the letter.
- The Phase A / Phase B split means the heaviest GPU work happens *after* the camera is off, so thermal load never compounds.
- `RESTING` idle < 5% GPU via `frameloop="demand"`.
- Estimated total cost ≤ 2% battery on a typical 2022+ phone.

---

## 9. Failure Architecture

### 9.1 The invariant

**Every failure state has a path to the letter. There is no dead end in this application.**

### 9.2 Failure taxonomy

| Condition | Signal | FSM target | Handling |
|---|---|---|---|
| **Camera permission denied** | `NotAllowedError` | `CAMERA_DENIED` | **Platform-specific recovery, authored not generic.** iOS Safari: a second `getUserMedia` throws immediately with no prompt, so retry is impossible in-page — show illustrated **AA → Website Settings → Camera → Allow → Reload**. Android Chrome: lock-icon instructions **plus a genuine Try again**. Desktop: address-bar camera icon illustration + Try again. Every screen also carries **[ Just show me the flowers ]**. |
| **No camera hardware** | `NotFoundError` | `CAMERA_ERROR` | Straight to Lite: *"No camera? No problem."* → 2D sequence → full letter. |
| **Camera busy** | `NotReadableError` | `CAMERA_ERROR` | *"Something else is using your camera — close it and tap below."* Retry is genuine here. |
| **Over-constrained** | `OverconstrainedError` | `CAMERA_ERROR` | Terminal → Lite (`isTerminalCameraError`). |
| **Insecure context / no `mediaDevices`** | `SecurityError`, probe | `BLOCKED_ENVIRONMENT` | Blocked screen showing the correct URL. |
| **Aborted** | `AbortError` | `CAMERA_ERROR` | Retry. |
| **In-app browser** | UA substring in `BOOT` | `BLOCKED_ENVIRONMENT` | See §9.3 — the highest-severity mobile risk. |
| **Model download fails / 30 s** | fetch error, timeout | `CAMERA_ERROR` | *"The magic is being shy."* → Retry, or **Skip to the delivery** (Lite). |
| **Track muted** (call, app switch) | `track.onmute` | `CAMERA_INTERRUPTED` | *"Camera paused — tap to bring it back."* Mercy timers **pause**. Re-acquire on tap. |
| **Track ended** | `track.onended` | `CAMERA_INTERRUPTED` | Re-acquire automatically **once**; on second failure the escape hatch. |
| **Tab backgrounded** | `visibilitychange` | *self* | Pause the loop, pause audio (`ctx.suspend()`), **pause mercy timers**. A phone call must not cost the user their patience budget. |
| **Low light** | luma `Y < 45`, 2 consecutive 500 ms samples | *self* | Coaching state `TOO_DARK`: *"A little more light? 💡"* Non-blocking; the mercy timer is the real answer. |
| **Solo (one face 15 s)** | `SOLO_TIMEOUT` | `SOLO_PROMPT` | *"Someone's missing 🌷 This one only opens for two."* → **[ I'll go get them ]** / **[ Peek alone ]**. |
| **Gesture not landing** | mercy timers | *self* | Three-stage escalation (§9.4). |
| **WebGL context lost** | `webglcontextlost` | *self* | Attempt restore once; on failure cut to Lite for the remaining scenes. **Never lose the letter.** |
| **Low FPS** | rolling median | *self* | Degradation ladder §8.6. |
| **Camera 120 s cap** | absolute timer | *self* | Camera hard-off; the escape hatch remains and becomes the way forward. |
| **Unhandled error** | error boundary | `FATAL_ERROR` | **[ Take me to the letter ]** plus a **copyable local diagnostic string** (device, OS, browser, WebGL support, last state, error). If it breaks, she screenshots it. This is the agreed substitute for telemetry. |

### 9.3 In-app browser handling

This link will be sent over WhatsApp, Instagram DM, or LINE. Those open in embedded WebViews where `getUserMedia` is unreliable or unavailable — **the gift can fail before the camera prompt ever appears.**

**Detection** — UA substring match in `BOOT`:
`Instagram` · `FBAN` · `FBAV` · `FB_IAB` · `FBIOS` · `Line/` · `MicroMessenger` · `Twitter` · `TikTok` · `Snapchat` · `KAKAOTALK`

**Response** — a full interstitial, shown **before** any permission prompt:

> **"Pssst — open this in your real browser 🌷"**
> *This delivery needs your camera, and it can't reach it from here.*
> **[ Open in Safari ]** / **[ Open in Chrome ]** · **[ Copy link ]** · *small:* **[ Just show me the flowers ]**

- **Android:** `intent://` URL — reliably escapes most WebViews.
- **iOS:** there is **no programmatic escape.** The button copies the link and shows a labelled illustration of the `•••` → *Open in Safari* menu position for that specific app. Be honest in the copy; **do not ship a button that pretends to work.**
- Escape: *"Just show me the flowers"* → Tier 3.

**Required pre-launch test:** send the actual production link through WhatsApp, Instagram DM, and whichever app will actually be used, and open it. Phase 9 checklist item, not an optional nicety.

### 9.4 Mercy escalation — the mechanism that guarantees delivery

Running from the moment `SEEKING_GESTURE` is entered. Timers **pause** on `VISIBILITY_HIDDEN` and `CAMERA_INTERRUPTED`.

| Time | Accepted | `M` | Hand conf. | Behaviour |
|---|---|---|---|---|
| 0–20 s | G1 only | 1.00 | 0.50 | Strict. Coaching is diagnostic. |
| 20–45 s | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 | Thresholds relax ×1.25. Warmer coaching. |
| 45–90 s | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 | Escape hatch becomes **visible**, styled as a gift: *"The flowers are getting impatient 🌷"* → **[ Let them out ]** |
| 90 s+ | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 | Escape hatch becomes the **primary** CTA: *"Honestly? You two are close enough. 💕"* → **[ Open it anyway ]**. Detection continues — if the heart lands, it still wins. |

**The escape hatch is in the DOM and keyboard-focusable from t=0**, visually revealed at 45 s. Keyboard and screen-reader users are never trapped behind a gesture they cannot perform.

**It never fires itself.** An auto-unlock reads as a bug, not as mercy, and it steals the moment of agency that makes the unlock feel earned. The escape hatch is always a tap.

### 9.5 Handling principles

1. **Never blame the user.** No red — the palette contains no saturated red. No "ERROR". Every screen offers a way forward.
2. **At most two actions per failure screen:** a recovery and an escape to the letter.
3. **Auto-retry silently once** for anything transient (track ended, chunk fetch, context loss) before showing UI.
4. **Never show an error during the magic.** From `UNLOCKING` to `LETTER_OPEN`, recoverable failures degrade silently to Lite. Only a fatal render error may interrupt, and it lands on the letter.
5. **Timeouts coach; they never terminate.** The 20/45/90 s marks escalate help.
6. **Error state is never persisted.** A reload starts clean except for the four flags.
7. **No network egress on failure.** Diagnostics are rendered locally as copyable text.
