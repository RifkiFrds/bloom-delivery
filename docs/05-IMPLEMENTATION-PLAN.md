# DOCUMENT 5 — IMPLEMENTATION PLAN

**Project:** Bloom Delivery
**Doc version:** 1.0
**Depends on:** [`PRD-V2.md`](./PRD-V2.md) §Delivery Plan · [`01`](./01-SYSTEM-DESIGN.md) · [`02`](./02-FSM-SPEC.md) · [`03`](./03-DETECTION-ALGORITHM.md) · [`04`](./04-UIUX-SCREEN-SPEC.md)
**Status:** Ready to execute — pending the four Go decisions in §11

**What this document adds.** PRD v2 §Delivery Plan fixes the *phases, estimates and exit criteria*. Docs 01–04 fix the *design*. This document fixes the **order of operations**: the file tree, every module and who may import it, the task list per phase with a definition of done, how each exit criterion is actually measured, and what to do the moment a risk fires. It is the thing you keep open while working.

**Estimates** assume one experienced full-stack/frontend engineer, in working days, and come from PRD v2 unchanged.

---

## 1. Track Strategy

PRD v2 offers two tracks. This plan implements **one spine plus detachable upgrade modules**, which is the arrangement PRD v2 recommends:

> *Decide which track you are on before Phase 1, and if there is a fixed date, start on Compressed and upgrade with slack rather than descoping under pressure.*

```
 ┌──────────────────────────── THE SPINE (Compressed track) ────────────────────────────┐
 │  P0 Spike → P1 Shell/FSM → P2 Camera → P3 Face → P4 Gesture → P5 Unlock+Lite         │
 │                                        → P7 Letter/Resting → P9 Hardening            │
 │  Ships a complete, genuine product: the mechanic, mercy, the letter, every fallback. │
 └──────────────────────────────────────────────────────────────────────────────────────┘
                                        │
              attach with slack, in this order of value:
                                        ▼
     ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐
     │ U1  Phase 6  │  │ U2  Phase 8  │  │ U3  Photo     │  │ U4 Envelope │
     │ 3D delivery  │  │ Music + full │  │ capture +     │  │ 3-beat      │
     │ (6–8 d)      │  │ SFX (2 d)    │  │ save (1 d)    │  │ unfold(0.5d)│
     └──────────────┘  └──────────────┘  └───────────────┘  └─────────────┘
```

| Track | Scope | Days | Calendar (solo) |
|---|---|---|---|
| **Full** | All phases, 3D delivery, audio, photo capture | **31–39** | 7–8 weeks |
| **Compressed** | Spine only. Lite 2D as the *primary* sequence, audio reduced to 3 SFX, no photo capture, **G2 promoted to primary gesture** | **17–21** | 4 weeks |

**The Compressed track is a genuine product, not a degraded one.** It keeps the mechanic, the mercy design, the letter, the art direction, and every fallback. It trades only the third dimension.

**Decision rule:** if a fixed date exists and is under 6 weeks away, start Compressed. Build the spine, then attach upgrades in the order above as slack appears. Never start Full and descope under pressure — descoping late is how the Lite path ends up half-built, which breaks every failure route.

---

## 2. Repository Structure

The tree encodes the architecture. Import rules are enforced by ESLint, not by convention.

```
bloom-delivery/
├─ public/
│  ├─ vision/                        SELF-HOSTED — never a CDN
│  │  ├─ wasm/                       @mediapipe/tasks-vision runtime
│  │  ├─ face_detector.task          ~230 KB  · blocking
│  │  └─ hand_landmarker.task        ~7.5 MB  · background
│  ├─ models/                        *.glb, meshopt, content-hashed
│  ├─ audio/                         sfx-sprite.webm|m4a · music.webm|m4a
│  ├─ lottie/                        lite-sequence.json
│  ├─ og/                            og-image.png  (teaser only, NO name)
│  └─ robots.txt                     User-agent: * / Disallow: /
│
├─ scripts/
│  ├─ check-budgets.mjs              CI gate — fails the build on violation
│  ├─ optimize-models.mjs            gltf-transform pipeline
│  └─ dump-landmarks.mjs             clip → landmark JSON fixtures
│
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                  next/font · CSP meta · robots meta · tokens
│  │  ├─ page.tsx                    NEUTRAL placeholder at / — must not link on
│  │  └─ d/[slug]/page.tsx           the experience · dynamic(ssr:false)
│  │
│  ├─ machine/                       ⛔ ZERO React / Zustand / Three imports
│  │  ├─ states.ts                   the 21 state literals
│  │  ├─ events.ts                   the event union + payloads
│  │  ├─ context.ts                  MachineContext + initial value
│  │  ├─ guards.ts                   canUnlock, canSeekGesture, mercyReached, …
│  │  ├─ transitions.ts              THE FROZEN TABLE
│  │  ├─ effects.ts                  declarative effect descriptors
│  │  └─ reducer.ts                  (state, event) => {state, context, effects}
│  │
│  ├─ store/
│  │  ├─ machineStore.ts             Zustand host · ~8 writes/session
│  │  └─ prefs.ts                    muted · motionSafe
│  │
│  ├─ events/
│  │  └─ bus.ts                      the ONLY entry point into the machine
│  │
│  ├─ detection/                     ⛔ ZERO React / Zustand / Three / FM imports
│  │  ├─ config.ts                   ★ THE CONSTANT REGISTRY — every threshold
│  │  ├─ ref.ts                      the single 15 Hz mutable ref
│  │  ├─ camera/
│  │  │  ├─ acquire.ts               getUserMedia + the 6-error taxonomy
│  │  │  ├─ lifecycle.ts             onmute / onended / visibility / 120 s cap
│  │  │  └─ teardown.ts              capture → cancel rAF → stop → close → ASSERT
│  │  ├─ vision/
│  │  │  ├─ bootstrap.ts             task creation, GPU→CPU fallback, warm-up
│  │  │  └─ loop.ts                  rAF + accumulator · cadence gate · adaptive
│  │  ├─ gesture/
│  │  │  ├─ space.ts                 square correction  (PURE)
│  │  │  ├─ metrics.ts               S · curled · palmDir · midY  (PURE)
│  │  │  ├─ g1.ts · g2.ts · g3.ts    condition vectors  (PURE)
│  │  │  ├─ closeness.ts             UI scalar + EMA  (PURE)
│  │  │  ├─ nofm.ts                  ring buffers  (PURE)
│  │  │  ├─ hysteresis.ts            enter ≤ T · exit > T×1.30  (PURE)
│  │  │  └─ hold.ts                  900 ms · 200 ms grace · ×2 decay  (PURE)
│  │  ├─ face.ts                     faceValid · latch buffer · liveness
│  │  ├─ luma.ts                     32×32 · 500 ms · Y < 45
│  │  └─ coaching.ts                 8-state derivation, first match wins  (PURE)
│  │
│  ├─ scenes/                        one component per FSM state
│  │  ├─ Landing.tsx  Preflight.tsx  RequestingCamera.tsx
│  │  ├─ LoadingDetection.tsx  SeekingFaces.tsx  SoloPrompt.tsx
│  │  ├─ TogetherConfirmed.tsx  SeekingGesture.tsx  Unlocking.tsx
│  │  ├─ Delivery.tsx  Bloom.tsx  Message.tsx  Letter.tsx  Resting.tsx
│  │  └─ errors/  BlockedEnvironment.tsx  CameraDenied.tsx
│  │                CameraError.tsx  CameraInterrupted.tsx  FatalError.tsx
│  │
│  ├─ components/                    Button · Card · CoachingHUD · FrameRing
│  │                                 FramingGuide · EscapeHatch · MuteToggle
│  │                                 CameraStage · DebugHUD
│  ├─ scene3d/                       ⚠ separate chunk — unreachable from Phase A
│  │  ├─ FlowerScene.tsx  BoxDrop.tsx  TulipField.tsx  PetalSystem.tsx
│  │  ├─ materials.ts                toon + inverted hull
│  │  └─ Degrader.tsx                rolling median FPS → one-way ladder
│  ├─ lite/                          parallel 2D implementation of Phase B
│  ├─ audio/                         unlock.ts · howler.ts · sprite map
│  ├─ motion/tokens.ts               durations · easings · 4 springs
│  ├─ lib/
│  │  ├─ capability.ts               BOOT probe · in-app UA list
│  │  ├─ persistence.ts              4 keys, every access try/catch
│  │  ├─ diagnostics.ts              ring buffer + copyable string
│  │  ├─ sanitize.ts                 the 5-line ?to= regex
│  │  ├─ letter.ts                   base64 + XOR payload
│  │  └─ photo.ts                    local composite (un-mirrored!)
│  ├─ content/
│  │  ├─ letter.ts                   ★ THE LETTER — one obvious module
│  │  └─ copy.ts                     every user-facing string
│  └─ styles/tokens.css
│
├─ tests/
│  ├─ fixtures/                      15 clips' landmark JSON + expectations
│  ├─ gesture.test.ts                pure functions vs fixtures
│  ├─ machine.test.ts                transition table + canUnlock idempotency
│  └─ e2e/smoke.spec.ts              Playwright + fake video capture
│
└─ tools/spike/                      Phase 0 throwaway — never imported by src/
```

### 2.1 Import rules (ESLint `no-restricted-imports`, enforced in CI)

| Directory | May not import |
|---|---|
| `machine/**` | `react`, `zustand`, `three`, `@react-three/*`, `framer-motion`, `howler` |
| `detection/**` | same list |
| `scenes/**`, `components/**` | `three`, `@react-three/*` (only `scene3d/` may) |
| Anything in Phase A | `scene3d/**` — except via the one `dynamic()` boundary |

**Why this is a lint rule and not a code review note.** Doc 01 §B1 is the rule that keeps detection testable as pure functions and keeps the two phases from tangling. It is violated by a single convenient import, silently, and the cost surfaces three phases later.

---

## 3. Environment Setup — Day 0 (½ day, before Phase 0)

| # | Task | Definition of done |
|---|---|---|
| E1 | Next.js 15 + TS `strict` + `noUncheckedIndexedAccess` | `pnpm dev` serves a blank page |
| E2 | **Verify R3F v9 + React 19 + Next 15 resolve together** | A trivial `<Canvas>` with one mesh renders. **Do this on day one** — a version conflict here reshapes the whole 3D plan |
| E3 | Tailwind + design tokens from Doc 04 §A | Token file exists; a swatch page renders |
| E4 | `next/font` for Fredoka + Plus Jakarta Sans, Latin subset | No network font request in DevTools |
| E5 | **HTTPS dev tunnel** (`ngrok` / `cloudflared` / `next dev --experimental-https`) | `getUserMedia` works from a real phone against your laptop |
| E6 | Device lab assembled | Older iPhone · mid-range Android · flagship · desktop, all reachable |
| E7 | Vitest + Playwright installed | `pnpm test` and `pnpm e2e` both run green on a placeholder |
| E8 | `scripts/check-budgets.mjs` wired into CI | Deliberately oversizing a file **fails the build** |
| E9 | Vercel project + preview deploys | A preview URL loads on the phone |

> **E5 is the one people skip and regret.** `getUserMedia` requires a secure context. Without a tunnel, every camera test is a deploy cycle, and Phases 2–4 are almost entirely camera testing.

---

## 4. Phase 0 — Feasibility Spike · 2–3 days · **DO THIS FIRST**

**Goal:** prove the geometry before building anything on top of it.
**Prerequisite:** Day 0 complete.
**Nothing in `src/` is written during this phase.** Everything lives in `tools/spike/`.

| # | Task | DoD |
|---|---|---|
| P0.1 | Throwaway page: camera + `HandLandmarker` + `FaceDetector`, self-hosted from `/public/vision/` | Live preview with a landmark skeleton overlay on a real phone |
| P0.2 | Implement `space.ts` + `metrics.ts` (square correction, `S`, `curled`, `palmDir`) | Live numeric readout of `S(A)`, `S(B)` |
| P0.3 | Implement G1 C1–C7 and G2 C1–C4 as pure functions | Live pass/fail per condition with measured value and threshold |
| P0.4 | **Record 15 fixture clips** per Doc 03 §10.3 | 15 clips at 720p, 5–10 s, labelled, stored |
| P0.5 | `dump-landmarks.mjs` — clip → landmark JSON | Each clip has a JSON of landmark arrays for a handful of frames |
| P0.6 | Expected-outcome JSON per clip | Every clip has its accept/reject expectation recorded |
| P0.7 | **Measure `S` on three real devices**, daylight and evening, in the actual pose | A written measurement report with numbers, not impressions |
| P0.8 | First-pass calibration of every threshold in `detection.config` | Values committed with the measurement that justified each |
| P0.9 | **THE DECISION GATE** (§4.1) | Written down, dated, and acted on |

### 4.1 The Phase 0 decision gate

```
 The single number that governs this project:
 S = dist(landmark 0, landmark 9), in frame-width units, at arm's length.

   S >= 0.045  ──▶  Build exactly what Docs 01–04 specify. G1 primary.

   S <  0.045  ──▶  PROMOTE G2 TO PRIMARY.
                    · Re-coach to the one-hand finger heart
                    · Move mercy level 1 to t = 10 s
                    · G1 becomes an accepted alternative
                    · Doc 04 §B.9 diagram asset changes
                    · Doc 03 §6.7 acceptance table changes
                    This is a 1-day documentation change now,
                    or a 3-week rework in Phase 4.
```

### 4.2 Exit criteria — all must pass

- [ ] `S >= 0.045` for both hands at selfie distance on **all three** devices
- [ ] G1 true-positive **≥ 80%** over 20 attempts in good light
- [ ] G1 true-positive **≥ 60%** over 20 attempts in evening light
- [ ] G1 false-positive **= 0** over 20 attempts of clasped hands / high-five / open palms
- [ ] Combined inference **≤ 60 ms** on the slowest device
- [ ] Face detection **≥ 90%** with both people looking at the camera
- [ ] 15 fixture clips recorded with landmark dumps and expectations

**If Phase 0 fails, the detection strategy changes before Phase 1 begins.** That is a two-day cost instead of a three-week one.

---

## 5. Phase 1 — Shell, FSM, Foundations · 3 days

**Goal:** the skeleton every other phase hangs on.

| # | Task | DoD |
|---|---|---|
| P1.1 | Repo structure per §2 + ESLint import rules | Deliberately importing `react` into `machine/` fails lint |
| P1.2 | `machine/states.ts`, `events.ts`, `context.ts` | All 21 states and the full event union typed |
| P1.3 | `machine/guards.ts` — `canUnlock` first | `canUnlock` sets `hasUnlocked` **synchronously inside the reducer** |
| P1.4 | `machine/transitions.ts` — the frozen table from Doc 02 §5 | Every row transcribed; no row invented |
| P1.5 | `machine/reducer.ts` — pure, total | **Throws** on an illegal `(state, event)` in dev; logs to diagnostics in prod |
| P1.6 | `events/bus.ts` + `store/machineStore.ts` | The only way into the machine is `bus.emit()` |
| P1.7 | `motion/tokens.ts` + `MotionConfig` root with `motionSafe` | A test animation demonstrably changes with the toggle |
| P1.8 | Error boundary → `FATAL_ERROR` + `lib/diagnostics.ts` | Throwing in a scene renders the fatal screen with a copyable string |
| P1.9 | `?debug=1` scaffold: state, last 10 events, forced transitions | Every state reachable from the debug panel |
| P1.10 | All 21 scenes as labelled placeholders wired to the FSM | Clicking through reaches every state |
| P1.11 | `machine.test.ts` | Transition table covered; illegal pairs asserted to throw |
| P1.12 | `lib/persistence.ts` — 4 keys, all `try/catch` | Works with `localStorage` fully disabled |
| P1.13 | `lib/sanitize.ts` + `content/copy.ts` + `content/letter.ts` | `?to=<script>` renders "Someone Special" |

### Exit criteria

- [ ] Every state reachable via debug controls; every illegal transition throws in dev
- [ ] **`canUnlock` proven idempotent by test: 10 concurrent `HOLD_COMPLETE` events → exactly one transition**
- [ ] Reduced-motion toggle demonstrably affects a test animation
- [ ] Bundle budget check fails the build when deliberately exceeded
- [ ] Lint fails on a cross-boundary import

**Risk:** over-abstracting the FSM. It is ~150 lines. If it grows past ~300, stop and simplify.

---

## 6. Phase 2 — Camera, Permissions, Environment · 4 days

**Goal:** a reliable live preview on real phones, and every way that fails handled.

| # | Task | DoD |
|---|---|---|
| P2.1 | `lib/capability.ts` — secure context, `getUserMedia`, WebGL2, in-app UA, prior unlock | `BOOT` routes correctly to Full / Lite / Blocked / Resting in < 100 ms |
| P2.2 | **In-app browser interstitial** — Android `intent://`, iOS copy-link + illustrated `•••` | Verified by actually opening the link in the apps |
| P2.3 | `detection/camera/acquire.ts` — constraints + the six-error taxonomy | Each `DOMException` name maps to its own branch |
| P2.4 | Three platform-specific denial screens (Doc 04 §B.16) | **iOS variant has no "Try again" button** — it has **[ Reload ]** |
| P2.5 | `CAMERA_ERROR` — five copies (Doc 04 §B.17) | Each forced via debug and visually checked |
| P2.6 | Pre-flight screen with the privacy notice + motion toggle | Copy matches Doc 02 §6.4 exactly |
| P2.7 | `<video playsInline muted autoPlay>` + `scaleX(-1)` + overlay canvas with the same transform | No fullscreen takeover on iOS |
| P2.8 | `detection/camera/lifecycle.ts` — `onmute`/`onended`/`visibilitychange`/120 s cap | `CAMERA_INTERRUPTED` reached and recovered |
| P2.9 | `detection/camera/teardown.ts` with the **assertion** | `track.readyState === 'ended'` for every track |
| P2.10 | Landing scene, real | Start tap unlocks `AudioContext` synchronously |

### Exit criteria

- [ ] Live preview on a **real iPhone and a real Android**, over a tunnel **and** a Vercel preview
- [ ] All six `getUserMedia` errors produce distinct, correct screens (forced via debug)
- [ ] Interstitial verified in **WhatsApp, Instagram, and one more** in-app browser
- [ ] Teardown verified: **camera indicator light off**, tracks `ended`, no leaked loop

**Risks:** iOS denial is unrecoverable in-page — a design constraint, not a bug to fix. In-app browsers behave inconsistently across app versions; test the versions actually installed.

---

## 7. Phase 3 — Face Stage + Coaching · 3 days

**Goal:** the latch closes reliably, and the HUD tells the truth cheaply.

| # | Task | DoD |
|---|---|---|
| P3.1 | Self-host vision assets; `vision/bootstrap.ts` with GPU→CPU fallback + warm-up | Both tasks instantiate on all lab devices |
| P3.2 | **Split model loading** — block on face (230 KB), background the hand model (7.5 MB) | Preview visible ≤ 2.5 s after grant on throttled 4G |
| P3.3 | `vision/loop.ts` — one rAF + accumulator, 15 Hz, adaptive to 10 Hz | Cadence verified in the debug HUD |
| P3.4 | `detection/face.ts` — `faceValid`, `>= 2` (not `== 2`), N-of-M 8-of-10, latch | `togetherConfirmed` latches and never resets |
| P3.5 | `detection/ref.ts` + HUD reading it in its own `rAF` | **Re-render counter proves ≤ 2/second** |
| P3.6 | `detection/coaching.ts` — 8 states, first match wins, 1.5 s debounce | Matches ground truth on every fixture clip |
| P3.7 | `detection/luma.ts` — 32×32, 500 ms, `Y < 45` | `TOO_DARK` fires in a dim room |
| P3.8 | `SOLO_PROMPT` + peek-alone branch | Both exits correct; a partner arriving overrides |
| P3.9 | `TOGETHER_CONFIRMED` with the 1.2 s → 5 s extension | Extends only while `!handModelReady` |
| P3.10 | `aria-live="polite"` mirroring, debounced | Announcements are not flooded |

### Exit criteria

- [ ] Two faces reliably latch within **3 s** in normal light on all lab devices
- [ ] Coaching state matches ground truth for **every** fixture clip
- [ ] **Re-render counter shows ≤ 2/second during detection**
- [ ] Solo path reachable and both branches correct
- [ ] Camera preview visible **≤ 2.5 s** after grant on 4G

---

## 8. Phase 4 — Gesture Stage + Tuning + Mercy · 5–8 days · **HIGHEST RISK**

**Goal:** the gate works for real people, in a real room, at night.

**The wide estimate is honest.** This is the only phase whose duration depends on empirical tuning.

| # | Task | DoD |
|---|---|---|
| P4.1 | Port `gesture/*` pure functions from the spike into `src/detection/gesture/` | Unchanged behaviour; now unit-tested |
| P4.2 | **`gesture.test.ts` against the fixture landmark dumps** | Runs in milliseconds; green on all 15 clips |
| P4.3 | G1 implementation exactly per Doc 03 §6.2 | All seven conditions, all thresholds from `config.ts` |
| P4.4 | `nofm.ts` (5-of-7 on the **final** boolean) | Never applied per-condition |
| P4.5 | `hysteresis.ts` — enter ≤ T, exit > T×1.30 | No `ENTER`/`EXIT` chatter at the boundary |
| P4.6 | `hold.ts` — 900 ms cap, 200 ms grace, ×2 decay, `dt`-based | Hold takes 900 ms of wall clock at 10 Hz *and* 15 Hz |
| P4.7 | Frame progress ring driven from `ref`, ~60 ms lerp, **not** a spring | Ring never finishes after the unlock has fired |
| P4.8 | G2 and G3 | Accepted only at mercy ≥ 1 |
| P4.9 | Mercy escalation, `M` multiplier, confidence 0.50→0.40 | **Unit test: level 1 thresholds are strictly more permissive than level 0** |
| P4.10 | Mercy timers on **active** time, paused on hidden/interrupted | Backgrounding for 60 s costs zero mercy budget |
| P4.11 | **Escape hatch in the DOM and keyboard-focusable from t=0**, revealed at 45 s | Reachable by Tab at t=0 with a screen reader |
| P4.12 | Full `?debug=1` readout per Doc 03 §10.2 | Every condition, value and threshold visible live |
| P4.13 | **Calibration against fixtures, then against real people** | Thresholds committed with the data behind them |

### Exit criteria

- [ ] G1 true-positive **≥ 85% within 20 s**, over 20 attempts by **3 different pairs**
- [ ] **False-positive = 0** across all rejection fixtures
- [ ] Mercy escalation verified at all four levels, including pause-on-background
- [ ] Escape hatch reachable by keyboard at t=0
- [ ] Fixture test suite green and running in CI

### 8.1 The day-8 contingency — pre-decided

```
 IF G1 true-positive is still below 70% after 8 days:
   · Promote G2 to primary
   · Re-coach to the finger heart
   · Move mercy level 1 to t = 10 s
   · G1 stays as an accepted variant

 TAKE THIS DECISION ON DAY 8 AND DO NOT LET IT SLIDE.
 The gate is not the gift.
```

Write the date on the wall at the start of the phase. The failure mode here is not the decision; it is spending days 9–14 believing the next tuning pass will fix it.

---

## 9. Phase 5 — Unlock, Teardown, Lite Path · 3 days

**Goal:** the boundary is clean, and every failure route actually reaches the letter.

| # | Task | DoD |
|---|---|---|
| P5.1 | `UNLOCKING` entry effect in the exact order: capture → cancel rAF → stop tracks → close tasks → assert | Cancel **before** close, always |
| P5.2 | Frame capture → `capturedFrame` | An `ImageBitmap` survives into `RESTING` |
| P5.3 | Darken 35% · one shake ≤ 350 ms / ≤ 8 px · **one** 400 ms radial bloom | No strobe; verified against Doc 04 §C.6 |
| P5.4 | "DELIVERY UNLOCKED" card | `--yellow`, `--border`, `--shadow-xl`, overshoot |
| P5.5 | Reduced-motion twin of the whole beat | No shake, no bloom, instant crossfade |
| P5.6 | **The complete Lite 2D sequence** | Every Phase B beat has a Lottie/CSS implementation |
| P5.7 | `SKIP_TO_LETTER` wired from **every** failure state | Six routes, all tested |
| P5.8 | Replay path: `skipCameraStage` makes teardown a no-op | Camera never re-requested |

### Exit criteria

- [ ] **Camera indicator light off within 500 ms of unlock, verified visually on hardware**
- [ ] **JS heap drops measurably after teardown** (Chrome DevTools, before/after snapshot)
- [ ] **Every failure state reaches the letter via Lite**
- [ ] `canUnlock` prevents a second `UNLOCKING` even when `HOLD_COMPLETE` and `MERCY_UNLOCK` fire in the same tick

> **Do not let Lite slip.** It is the deliverable most likely to be deprioritised, and deprioritising it leaves *every* fallback path broken. On the Compressed track, Lite **is** the primary sequence and this phase is the payoff.

---

## 10. Phases 6–9

### Phase 6 — 3D Delivery + Bloom · 6–8 days · *(upgrade module U1)*

| # | Task | DoD |
|---|---|---|
| P6.1 | Author tulip, box, petal in Blender — flat shade, vertex colors, no UVs | Tulip ≤ 1,000 tris, box ≤ 2,500 tris |
| P6.2 | `optimize-models.mjs` — dedup → prune → weld → join → simplify → meshopt | `.glb` total ≤ 1.2 MB; build fails if exceeded |
| P6.3 | `materials.ts` — toon + **inverted-hull outline** (`BackSide`, 1.03, `#111`) | The 3D reads as the same drawing as the 2D UI |
| P6.4 | Box fall / land / open choreography | Squash-and-stretch per Doc 04 §C.4 |
| P6.5 | `TulipField` — one `InstancedMesh`, ≤ 60 | Verified in the draw-call counter |
| P6.6 | `PetalSystem` — one `InstancedMesh`, pool of 300, **pre-allocated at mount** | Zero allocation after mount |
| P6.7 | Faked bloom — additive sprites + CSS radial gradient | **No post-processing pass** |
| P6.8 | `Degrader` — rolling 2 s median FPS, one-way ladder | All four rungs fire under throttling |
| P6.9 | `webglcontextlost` handling | Restore once, then cut to Lite at the current beat |
| P6.10 | `frameloop="demand"` from `RESTING` | Idle < 5% GPU |
| P6.11 | Reduced-motion variant of every beat | Box pre-landed, 60 petals, no rotation |

**Exit:** ≥ 30 fps on the slowest lab device · ≥ 55 fps Tier 1 · triangle/draw-call/particle budgets **measured** not estimated · **zero allocations in `useFrame` verified by an allocation profile** · ladder fires correctly under artificial throttling · reduced-motion complete.

**Risk:** modelling time is easy to underestimate if you are not fluent in Blender. **Decide this before Phase 6 starts** — commission the assets, or take the Compressed track. The second risk is the temptation to add post-processing; the budget forbids it.

### Phase 7 — Message, Letter, Resting, Replay · 3 days

Message reveal · envelope unfold + crossfade twin · letter as **real selectable DOM text** · obfuscated payload decode on transition · `RESTING` with three actions · `localStorage` persistence + returning-visitor routing · replay and read-again · photo composite *(U3)*.

**Exit:** letter readable at 375 px **and at 200% zoom with no horizontal scroll** · letter selectable and announced correctly by VoiceOver · returning visit routes to `RESTING` · replay never re-requests the camera · **saved photo correctly oriented and un-mirrored**.

### Phase 8 — Audio · 2 days · *(upgrade module U2)*

`AudioContext` unlock on the Scene-1 tap · Howler with the SFX sprite · music with an 800 ms fade-in · persistent mute · visibility duck/resume · ringer-switch hint copy.

**Exit:** **music plays on a real iPhone after the full ~45 s gap from the Start tap** · backgrounding and returning restores audio · mute persists across reload · ringer-switch behaviour understood and explained by the UI.

**Risk:** iOS audio is historically the buggiest surface in any web experience. Budget the full two days **on device**, not in the simulator.

### Phase 9 — Hardening, Device Lab, Rehearsal · 4 days

Device lab pass · **night-time test** · in-app browser matrix · 4G throttled test · security headers verified in production · **OG preview verified in a real chat app** · Playwright smoke with `--use-file-for-fake-video-capture` · full accessibility pass (VoiceOver, keyboard, reduced motion, contrast audit) · **a complete end-to-end rehearsal on the recipient's actual phone model, at the actual time of day, with the actual link** · a one-page runbook.

**Exit:** green on all four lab devices including the night test · **link preview shows the teaser, never the message** · Lighthouse performance ≥ 85 mobile, accessibility ≥ 95 · full run ≤ 180 s · **rehearsal completed by two people who have never seen it, with no verbal help**.

---

## 11. Critical Path and What Can Run in Parallel

```
 E (½d) ──▶ P0 (2–3d) ──▶ P1 (3d) ──▶ P2 (4d) ──▶ P3 (3d) ──▶ P4 (5–8d) ──▶ P5 (3d) ──▶ P7 (3d) ──▶ P9 (4d)
             ▲ GATE                                              ▲ GATE (day 8)
             │                                                   │
             └─ decides G1 vs G2 primary                          └─ decides G1 vs G2 primary, again

 Detachable, can run late or be dropped:
   P6 3D (6–8d)  ── needs P5 · art assets can be authored/commissioned in parallel from day 1
   P8 Audio (2d) ── needs P1 only · SFX sourcing can start day 1
   U3 Photo (1d) ── needs P5
   U4 Envelope unfold (½d) ── needs P7
```

**Start these on day 1 regardless of phase, because they have lead time you do not control:**

- Music track selection and **licence confirmation** (blocks Phase 8 shipping, not starting)
- Blender asset authoring or commissioning (blocks Phase 6)
- Acquiring the recipient's phone model, or the closest match, for the lab (blocks Phase 9)
- Recording the 15 fixture clips — you need a second person and good light *and* evening light

**The critical path is P0 → P4.** Everything else has slack. Protect those two phases from interruption.

---

## 12. Verification Plan — how each criterion is actually measured

| Criterion | Method |
|---|---|
| `canUnlock` idempotency | Unit test: dispatch 10 `HOLD_COMPLETE` synchronously, assert one transition and one effect list |
| Illegal transitions throw | Unit test over the full `(state × event)` cross-product minus the table |
| ≤ 2 re-renders/second | A render counter component incrementing a ref, displayed in the debug HUD, watched for 30 s |
| Zero `useFrame` allocations | Chrome DevTools → Memory → Allocation sampling during the sequence; assert a flat line |
| Heap drops after teardown | Heap snapshot immediately before and 2 s after `UNLOCKING`; compare |
| Camera light off | **Physical observation on hardware.** No software check substitutes. |
| Inference ≤ 60 ms | Debug HUD rolling p50/p95, on the slowest lab device, in evening light |
| G1 true-positive ≥ 85% | 20 attempts × 3 pairs, tallied by hand, in the actual room |
| False-positive = 0 | Fixture suite in CI + 20 live attempts per rejection pose |
| Budgets | `check-budgets.mjs` in CI; deliberately break one to prove the gate works |
| Contrast | Automated token-pair test + a manual audit of any text over a non-token surface |
| OG preview | Send the real production link to yourself in WhatsApp and look at the card |
| In-app browsers | Send the real link through each app and open it |
| Letter at 200% zoom | Browser zoom to 200% at 375 px width; assert no horizontal scroll |
| Full run ≤ 180 s | Stopwatch, twice, on the slowest device |

**Rule:** a criterion measured in the simulator is not measured. Camera, audio, thermals and in-app browsers are all hardware-only facts.

---

## 13. Risk Register — with pre-decided responses

| # | Risk | Trigger | Pre-decided response |
|---|---|---|---|
| R1 | **`S < 0.045`** at the real pose | Phase 0 measurement | Promote G2 to primary; mercy 1 → t=10 s. Costs 1 day now. |
| R2 | **G1 true-positive < 70%** after 8 days of Phase 4 | Day 8 tally | Same as R1. **Decide on the day.** |
| R3 | R3F v9 / React 19 / Next 15 conflict | Day 0, task E2 | Pin exact versions; if unresolvable, Compressed track (Lite primary) — do not fight it for days |
| R4 | Blender skill gap | Before Phase 6 | Commission the assets, or take the Compressed track |
| R5 | In-app browser breaks silently | Phase 2 testing | Interstitial is already Must-Have; if an app defeats even the interstitial, its users go to Lite |
| R6 | iOS audio does not resume after 45 s | Phase 8 | Ship silent; the ringer-switch copy already frames sound as optional. All sound is decorative by design |
| R7 | Thermal throttling mid-sequence | Phase 9 device lab | The Phase A/B split already prevents compounding; if it still throttles, drop a ladder rung earlier |
| R8 | Lite path half-built at Phase 9 | Phase 5 exit criteria fail | **Stop and finish Lite.** Every failure route depends on it |
| R9 | Model download too slow on 4G | Phase 3 throttled test | The staging schedule is the mitigation; if still slow, extend `TOGETHER_CONFIRMED` to 5 s and lengthen the pre-flight copy |
| R10 | Letter typography breaks at 375 px | Phase 7 | Shrink, never truncate; add internal scroll |
| R11 | Scope creep into "nice to have" | Any time | The MVP table in PRD v2 is the contract. Petal cursor trails are the first thing cut, by name |
| R12 | Fixed date arrives with Phase 6 half-done | Any time | Ship the Compressed track. Lite is a complete experience. **Never ship a half-built 3D scene** |

---

## 14. Definition of Done

**Per task**
- [ ] Behaviour matches the governing section of Docs 01–04 (cited in the PR)
- [ ] Constants live in `detection.config` / `motion/tokens` / the Tailwind theme — **never at the call site**
- [ ] Pure logic is unit-tested; UI is exercised through the debug panel
- [ ] Reduced-motion variant exists if anything animates
- [ ] `aria-live` / focus handled if state changes visibly
- [ ] No cross-boundary import (lint passes)
- [ ] Verified on **one real phone**, not only the desktop browser

**Per phase**
- [ ] All exit criteria checked off with evidence, not assertion
- [ ] Budgets still pass in CI
- [ ] The debug panel can still reach every state
- [ ] A one-line note in the decision log if any threshold or constant changed

**PR checklist**
```
[ ] Cites the spec section it implements
[ ] No new dependency (or: justified against "avoid unnecessary dependencies")
[ ] No animated width/height/top/left/filter/box-shadow over the canvas
[ ] No setState in the detection path
[ ] No #FFFFFF text on a brand fill
[ ] Tested on hardware
```

---

## 15. Open Decisions — needed before execution

From PRD v2 Appendix A. **Four of these gate the start.**

| # | Decision | Needed by | Default if unanswered |
|---|---|---|---|
| **1** | **Full track (7–8 weeks) or Compressed (4 weeks)?** | **Before Phase 1** | Compressed, upgrade with slack |
| **2** | **Is there a fixed date?** (birthday, anniversary) | **Now** | Assume yes; plan Compressed |
| **3** | **Recipient's exact phone model** | **Before Phase 0** | Buy or borrow the closest match for the lab |
| **4** | **Can you model in Blender, or should the 3D be commissioned?** | Before Phase 6 | Commission, or take Compressed |
| 5 | Letter language → `<html lang>` | Phase 7 | Match the letter copy |
| 6 | Recipient name: hardcoded or `?to=`? | Phase 1 | Hardcoded — simpler, no sanitization surface |
| 7 | Music track and its licence | Phase 8 | Instrumental, licence confirmed before ship |

---

## 16. Go / No-Go

**Execution starts when:**

- [ ] Decisions 2 and 3 are answered (date, and the recipient's phone)
- [ ] Day-0 environment tasks E1–E9 are complete, especially **E2** (R3F/React 19) and **E5** (HTTPS tunnel)
- [ ] A second person is available for ~2 hours to record the Phase 0 fixture clips, in daylight **and** in the evening

**Then: Phase 0, and nothing else.**

Do not write production code, do not style the landing page, do not model a tulip. Stand in the actual room, at the actual time of evening, with the actual phone, and measure `S`.

Everything else in this plan is bounded engineering with known solutions. That one number is the only thing here that no amount of code quality can guarantee.
