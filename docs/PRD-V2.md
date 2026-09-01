# BLOOM DELIVERY — PRD v2
### Production-Oriented Revision · Definitive Source of Truth for Implementation

**Document status:** Approved for implementation planning
**Supersedes:** `PRD.MD` (v1, creative brief)
**Date:** 2026-09-01

---

# Executive Summary

## What changed

**1. The gate can no longer trap the recipient.**
v1 put the entire emotional payload behind a computer-vision lock with no key. v2 adds a three-stage mercy escalation and a permanent, keyboard-reachable escape hatch. The gift always arrives. The gesture decides *how magical the arrival feels*, never *whether it happens*.

**2. The gesture requirement was re-engineered around physics, not aspiration.**
v1 required two faces AND two hands AND a heart, all simultaneously, in portrait, on a handheld phone. That is geometrically impossible when one of the two people is holding the phone. v2 introduces a **togetherness latch**: two faces are proven once, then remembered. The heart is then formed with **one hand from each person** — which is both easier to detect *and* more emotionally intimate, because they have to reach for each other.

**3. The runtime was split into two non-overlapping phases.**
v1 implied camera + two neural nets + WebGL + Framer Motion all running at once — a thermal event on mid-range Android. In v2, **the camera and the 3D scene never coexist.** Detection is DOM/CSS only. The 3D sequence begins only after the camera is fully torn down. This single decision eliminates the largest performance risk in the project and makes a Web Worker unnecessary for MVP.

**4. Asset sourcing flipped from "find models" to "author models."**
v1 pointed at Sketchfab/Poly Pizza — unpredictable topology, unpredictable style, unpredictable licensing. v2 specifies custom low-poly, flat-shaded, inverted-hull-outlined assets. This is *cheaper on GPU* and *more on-brand* for Kawaii + Neo Brutalism than any downloaded model would be. Constraint and identity point the same direction here.

**5. Everything undefined is now defined.**
Formal gesture geometry with landmark indices and normalized thresholds. A complete state machine with guards and a transition table. Numeric performance budgets. A support matrix. A load-staging schedule. Privacy, CSP, robots, and link-preview policy. A phased plan with exit criteria.

**6. The experience now has an ending, a memory, and a second viewing.**
Added: a resting scene, `localStorage` persistence, replay, and a captured photo of the moment.

## What stayed

- **The core mechanic.** A gift that only opens when two people are together. Untouched. It is the reason this project is worth building.
- **Cute Kawaii + Neo Brutalism.** Fully preserved — and now *reinforced* by the engineering constraints (flat colors and thick black outlines are both the art direction and the cheapest thing to render).
- **The full scene arc.** Landing → camera → together → heart → unlock → flower delivery → bloom → message → letter. All nine beats survive.
- **Portrait-first, mobile-first.** The v1 review recommended landscape; that recommendation is **rejected** (see below).
- **3D flowers.** The review recommended cutting them; **rejected**, with a hard budget instead.
- **Frontend-only, no backend, no analytics, no database.** Correct and preserved, with one narrow amendment (local diagnostics, not telemetry).
- **The juicy, bouncy, overshooting animation philosophy.** Preserved, with a reduced-motion twin.

## Why

The v1 document optimized for the *peak* of the experience. v2 optimizes for the *probability the peak is ever reached*. Those are different objectives, and for a gift with an audience of one, the second one dominates: a spectacular sequence that 40% of viewers never see is worth less than a slightly simpler sequence that 95% of viewers reach.

Nothing emotional was cut. What was cut was **fragility**.

---

# Rejected Recommendations

The critical review produced ~60 recommendations. The following were evaluated and **rejected or amended**, with reasoning. Everything not listed here was accepted.

### REJECTED — "Switch the detection scenes to landscape orientation"

**Why it was proposed:** two people side by side don't fit a 9:16 frame.

**Why it's wrong:** the framing analysis assumed people stand side by side at conversational distance. The actual pose is an **arm's-length selfie** — the universal, instinctive posture for two people and a phone. In that pose, portrait is *superior*: two heads fill the horizontal middle comfortably, and portrait's surplus **vertical** space is exactly where the raised heart goes. Landscape would force the pair further apart and shrink the hands, making detection worse. Landscape also breaks the one-handed grip.

**Resolution:** portrait-first stands. Landscape is supported as an optional **Tripod Mode** for people who prop the phone and want both hands free.

### REJECTED — "Remove 3D flowers from MVP; use Lottie/2D"

**Why it was proposed:** unoptimized 3D assets blow the frame and load budget.

**Why it's wrong:** the risk was in the *asset source*, not the *dimension*. Kawaii + Neo Brutalism is a flat-color, hard-edge, chunky-silhouette style with **no PBR, no HDRI, no shadow maps, no normal maps**. A tulip in that style is ~1,000 triangles with vertex colors and an inverted-hull outline. Fifty of them, instanced, is a trivial GPU load — far cheaper than the photoreal assets the review was rightly worried about. And a box falling in real 3D with real depth is the single strongest "this is not a website" signal in the whole experience. Cutting it guts the vision to solve a problem that budgets solve better.

**Resolution:** 3D stays, under a hard budget (§Performance Budgets). A 2D Lottie sequence is built anyway — but as the **Lite fallback** for devices without WebGL2, not as the primary.

### REJECTED — "Add an opt-in error beacon so failures can be diagnosed remotely"

**Why it was proposed:** "no analytics" means total blindness if it fails on the recipient's phone.

**Why it's wrong:** the promise *"your camera never leaves this phone"* is the single highest-leverage sentence in the product — it is what converts the permission prompt. Any network egress, however small and however opt-in, makes that sentence require an asterisk. The asterisk costs more than the telemetry is worth.

**Resolution — amended:** no network egress of any kind. Instead: a `?debug=1` diagnostic overlay, and a fatal-error screen that renders a **copyable local diagnostic string** (device, OS, browser, WebGL support, last state, error). If it breaks, she screenshots it. Enforced technically by `connect-src 'self'` in CSP.

### REJECTED — "Adopt XState for the state machine"

**Why it was proposed:** the flow needs a real FSM, not ad-hoc booleans.

**Why it's half-wrong:** the FSM requirement is correct and accepted. The library is not. This machine has 21 states and no parallel regions, no history nodes, no actors, no invoked services. A frozen transition table plus a pure reducer inside Zustand is ~150 lines with zero new dependencies — and v1's own engineering standards say *"avoid unnecessary dependencies."*

**Resolution:** explicit FSM, hand-rolled, spec in §State Machine Specification.

### REJECTED — "Move MediaPipe into a Web Worker with OffscreenCanvas"

**Why it was proposed:** two models on the main thread will jank the UI.

**Why it's no longer true:** it was true under v1's architecture, where detection and 3D overlapped. In v2 they never do. During detection there is **no WebGL, no Three.js, no particle system** — only DOM, CSS transforms, and a small 2D overlay canvas. Detection runs at a deliberate 15 Hz with a time-sliced loop, leaving roughly 50 ms of every 66 ms frame free. Worker + `OffscreenCanvas` + GPU-delegate interop is also genuinely fiddly on iOS Safari and would cost days.

**Resolution:** main thread for MVP, with a strict inference budget and adaptive frame-skipping. Worker is a documented Phase-9 optimization, triggered only by measured jank on the device lab.

### REJECTED — "Auto-unlock after the timeout expires"

**Why it was proposed:** never leave the user stuck.

**Why it's wrong:** a sequence that fires with no input reads as a **bug**, not as mercy. It also steals the moment of agency that makes the unlock feel earned.

**Resolution — amended:** the escape hatch is always a *tap*. At 45 s it appears warmly; at 90 s it becomes the visually primary CTA. It never fires itself.

### REJECTED — "Keep Zod, scoped to config validation"

Zod is ~14 KB gzip to validate one optional query-string name against a regex. That is a five-line hand-rolled sanitizer.

**Resolution:** **Zod removed from the stack.**

### AMENDED — "Require ≥2 faces simultaneously with the gesture"

Accepted in spirit, rejected in timing. Requiring both *at the same instant* recreates the head-pose contradiction (people turn toward each other to make a heart, which breaks frontal face detection).

**Resolution:** the **togetherness latch** — prove two faces once, remember it for the session, then require only ≥1 face during the gesture stage as a liveness check.

---

# Product Vision

**Bloom Delivery is a gift that will not open for one person.**

It is a small, bright, hand-made web experience that asks two people to stand together, look into a phone, and reach toward each other to form a heart. When they do, a flower delivery arrives from the sky — a box drops, bursts open, and fills the screen with tulips and petals. Then a letter, written for one specific person, unfolds.

The experience is **cute, loud, bouncy, and unmistakably hand-made**. Thick black outlines, flat candy colors, chunky shadows, overshooting springs. It should feel like a Nintendo item-get screen and a Sanrio sticker pack collaborated on a love letter. It must never feel like a product, a brand campaign, or a landing page.

**The design constraint that governs every decision in this document:**

> The gift must always arrive.
>
> The gesture determines how magical the arrival feels — never whether it happens.

A perfect experience that fails to open is worth less than a good experience that always opens. Where visual ambition and delivery reliability conflict, **delivery reliability wins**, and we find a cute way to say so.

## Non-goals

- Not a general-purpose product. Audience: one recipient, plus whoever they choose to show it to.
- Not a platform. No accounts, no CMS, no multi-recipient tooling, no backend.
- Not a demo of computer vision. The detection is a doorway, not a feature.
- Not accessible-to-everyone in the strict WCAG-conformance sense — it structurally requires a camera. It *is* required to be safe (motion, flashing, contrast) and to never dead-end anyone.

---

# Core Experience

## Scene inventory

| # | Scene | FSM state | Camera | WebGL | Purpose |
|---|---|---|---|---|---|
| 0 | Boot | `BOOT` | off | off | Capability routing (invisible, <100 ms) |
| 1 | Landing | `LANDING` | off | off | Hook + audio unlock + begin prefetch |
| 2 | Pre-flight | `PREFLIGHT` | off | off | Privacy promise + expectation-setting + buy download time |
| 3 | Permission | `REQUESTING_CAMERA` | — | off | Native prompt |
| 4 | Warming up | `LOADING_DETECTION` | on | off | Delightful load screen with real progress |
| 5 | Find each other | `SEEKING_FACES` | on | off | Two faces → latch |
| 6 | There you are! | `TOGETHER_CONFIRMED` | on | off | 1.2 s reward beat; hand model finishes loading |
| 7 | Make a heart | `SEEKING_GESTURE` / `GESTURE_HOLDING` | on | off | The gate + mercy escalation |
| 8 | Unlock | `UNLOCKING` | **teardown** | on | Freeze → capture photo → kill camera → bloom flash |
| 9 | Delivery | `DELIVERY` | off | on | Box falls, lands, opens, tulips erupt |
| 10 | Bloom | `BLOOM` | off | on | Field of tulips, petal drift, music peak |
| 11 | Message | `MESSAGE` | off | on | "For Alya 🌷" |
| 12 | Letter | `LETTER_CLOSED` → `LETTER_OPEN` | off | idle | Envelope unfolds, message revealed |
| 13 | Resting | `RESTING` | off | idle | Replay · Save the photo · Read again |

## Happy path

1. Link opens. **Boot** silently checks: secure context, `getUserMedia` present, WebGL2 present, in-app browser? Routes accordingly.
2. **Landing.** Big bouncy "Bloom Delivery" wordmark, "A special delivery is waiting," a chunky **Start** button, and a sound toggle. The tap does three things: unlocks the `AudioContext`, starts prefetching the CV runtime and face model, and advances.
3. **Pre-flight.** *"This one needs two people. And your camera — but it never leaves your phone. No photos, no video, nothing uploaded. Promise. 🌷"* Plus: *"Takes about a minute. Bring someone."* Button: **I'm ready.** This screen is not decoration — it materially raises the permission grant rate and covers ~6 s of downloads.
4. **Permission.** Native prompt. Granted → continue.
5. **Warming up.** Camera preview fades in behind a translucent kawaii loader with a real percentage. Blocks only on the ~230 KB face model — the ~7.5 MB hand model continues in the background.
6. **Find each other.** Live mirrored preview, chunky outlined frame, coaching HUD: *"Stand together 💕"*. Detects ≥2 faces present in 8 of the last 10 frames → **latch** `togetherConfirmed = true` (permanent for the session).
7. **There you are!** 1.2 s celebration — confetti pop, sound sting. Also the buffer that guarantees the hand model is ready.
8. **Make a heart.** *"Now make a heart — one hand each 💗"* with a small animated diagram. A progress ring around the frame fills as the gesture holds. At 900 ms of sustained detection → unlock.
9. **Unlock.** Detection freezes. The last camera frame is captured to an offscreen canvas. **All media tracks stop; both MediaPipe tasks close; the loop cancels.** The camera indicator light goes out. Screen darkens ~35%, one short shake (≤ 350 ms), a single radial bloom, and **DELIVERY UNLOCKED** slams in with a hard drop shadow.
10. **Delivery.** A black sky-hole opens, a chunky wrapped box tumbles down, lands with a screen-punch and a dust ring, sits for a beat, then bursts. Tulips erupt outward. Music starts.
11. **Bloom.** Tulips grow across the lower frame. Petals drift. Particles taper from a burst to a gentle ambient rate.
12. **Message.** *"For Alya 🌷"* — scale-overshoot in, held.
13. **Letter.** Chunky **Open Letter** button. Envelope flap peels, paper unfolds in three beats, the personal message reads in.
14. **Resting.** Everything settles to a low-cost idle. Three chunky buttons: **Read again · Replay the moment · Save our photo.** Unlock state written to `localStorage`.

## Fallback path (detection struggling)

A three-stage mercy escalation, running from the moment `SEEKING_GESTURE` is entered:

| Time | Behaviour | Copy |
|---|---|---|
| 0–20 s | Strict thresholds. Only the two-hand heart (G1) accepted. Coaching is diagnostic. | *"Make a heart — one hand each 💗"* / *"A little more light?"* / *"Bring the heart up between you"* |
| 20–45 s | Thresholds relax ×1.25. **All three gesture variants** (G1, G2, G3) accepted. Coaching gets warmer and more specific. | *"So close! Bring your fingers together 🤏"* |
| 45–90 s | Escape hatch becomes **visible**, styled as a gift, not a failure. | *"The flowers are getting impatient 🌷"* → **[ Let them out ]** |
| 90 s+ | Escape hatch becomes the **primary** CTA. Detection continues in the background — if the heart lands, it still wins. | *"Honestly? You two are close enough. 💕"* → **[ Open it anyway ]** |

The escape hatch **is present in the DOM and keyboard-focusable from t=0**, visually revealed at 45 s. Screen-reader and keyboard users are never trapped.

Camera hard-off at 120 s regardless of state (battery, thermal, and privacy hygiene) — the escape hatch remains.

## Solo path

If **exactly one face** is detected continuously for 15 s in `SEEKING_FACES`, the experience acknowledges it rather than stalling:

> *"Someone's missing 🌷 This one only opens for two."*
> **[ I'll go get them ]** (returns to seeking) · **[ Peek alone ]**

**Peek alone** delivers a deliberately reduced version: the box falls and opens, tulips bloom — but the message and letter stay sealed, with a warm hold-state: *"The rest is for when you're together 💌"*. The session flag `peekedAlone = true` is stored. When they later return together and unlock properly, the full sequence plays with an extra line: *"There you are. Now the real one."*

This turns the single most likely failure — she opens the link on a bus, alone — from a broken website into **anticipation**.

## Timeout & interruption paths

| Situation | Detection | Response |
|---|---|---|
| Camera permission denied | `NotAllowedError` | Platform-specific recovery screen (§Mobile Strategy). **Never** a bare retry button — on iOS a retry silently no-ops. |
| No camera hardware | `NotFoundError` | Straight to **Lite path**: *"No camera? No problem."* → 2D sequence, full letter. |
| Camera busy | `NotReadableError` | *"Something else is using your camera — close it and tap below."* Retry is genuine here. |
| Insecure context | `SecurityError` / no `mediaDevices` | Blocked screen with the correct URL. |
| In-app browser | UA match | Interstitial before any prompt (§Mobile Strategy). |
| Model download fails | fetch error / 30 s timeout | *"The magic is being shy."* → Retry, or **Skip to the delivery** (Lite path). |
| Track muted (call, app switch) | `track.onmute` | *"Camera paused — tap to bring it back."* Re-acquire on tap. |
| Track ended | `track.onended` | Re-acquire automatically once; on second failure → escape hatch. |
| Tab backgrounded | `visibilitychange` | Pause detection loop + audio; resume `AudioContext` on return. Mercy timers **pause** too (no penalty for a phone call). |
| WebGL context lost | `webglcontextlost` | Attempt restore; on failure, cut to Lite for the remaining scenes. Never lose the letter. |
| Low FPS | rolling median | Progressive degradation ladder (§Performance Budgets). |
| Unhandled error | error boundary | Fatal screen with a **[ Take me to the letter ]** button and a copyable diagnostic. |

**The invariant behind all of these:** every failure state has a path to the letter. There is no dead end in this application.

## Replay path

- `RESTING` offers **Replay the moment** → re-enters `UNLOCKING` with `skipCameraStage = true`. The full show replays from the box drop. Camera is never re-requested.
- **Read again** jumps straight to `LETTER_OPEN`.
- **Save our photo** downloads the composited PNG (captured camera frame + flower overlay + "For Alya 🌷"). Generated fully locally from the frame captured at unlock; nothing is uploaded.
- On any later visit, `localStorage.bloom_unlocked === '1'` routes `BOOT → RESTING` directly, with a small **[ Do it all again ]** to replay the ceremony from the box drop.

The v1 rule *"sequence must execute once, no retriggering"* is **preserved as a within-session idempotency guard** on the unlock transition (§State Machine) — it prevents double-fires from detection races. It is **not** a prohibition on replay, which was an anti-user reading of a technical requirement.

---

# Detection Strategy

## The decisions, up front

| Question | Answer |
|---|---|
| **Two faces?** | **Yes — but only once**, as a latched precondition in `SEEKING_FACES`. Threshold: `count >= 2`, not `== 2`. |
| **One face?** | **Yes — during the gesture stage.** After the latch, only `count >= 1` is required, as a liveness check. |
| **Two hands?** | **Yes — but one from each person.** `numHands: 2`, not 4. |
| **One hand?** | **Yes — as an accepted alternative** from t=20 s onward, and always in Tripod Mode. |
| **Korean finger heart?** | **Yes — as G2 (solo) and G3 (mirrored pair).** Accepted, not primary. |
| **Traditional heart?** | **Yes — G1 is the primary and the coached gesture.** But formed by *two people's single hands*, not one person's two hands. The landmark math is identical either way. |

## Justification

### Why the togetherness latch instead of continuous two-face detection

Two people forming a heart together **instinctively turn toward each other**. That is the whole emotional point of the gesture — and it is precisely what breaks a frontal face detector (BlazeFace short-range degrades sharply past roughly ±30–45° of yaw). v1's requirement that two faces and the heart be true *simultaneously* meant the gesture the product wants people to perform is the gesture that prevents the product from working.

Splitting them in time resolves the contradiction completely and costs nothing emotionally:

- `SEEKING_FACES` asks them to *look at the camera*. Natural, easy, high success rate. This proves togetherness.
- `SEEKING_GESTURE` asks them to *make a heart*. They can turn, lean, laugh, look at each other. Only ≥1 face is required to confirm someone is still in frame.

The togetherness is **established, then trusted**. This is also how a human would judge it.

### Why one hand each, not two hands each

This is the decision that makes the project physically possible.

In the actual pose — arm's-length selfie, portrait, one person holding the phone — **the phone-holder has exactly one free hand.** Requiring "both hands" from both people means either (a) four hands in frame, which requires `numHands: 4`, roughly doubles inference cost, and breaks MediaPipe's handedness classifier when hands belong to different people; or (b) a propped phone at 1.5 m, at which distance hands fall well below the size at which 21-landmark tracking is reliable.

One hand each solves all of it:

- `numHands: 2` — the configuration MediaPipe is actually tuned for.
- Both people keep a free hand (one holds the phone).
- Hands stay close to the camera, so they are **large in frame** — the single strongest predictor of landmark accuracy.
- **It is emotionally better.** They have to reach toward each other and physically meet. A person making a heart with their own two hands is performing alone; two people making half a heart each are collaborating. The constraint improved the concept.

### Why the geometry is identical either way

A two-person half-heart and a one-person two-hand heart produce **the same landmark configuration**: two hands, thumbs meeting at the bottom vertex, index fingers arcing over to meet at the top, the other three fingers curled. The detector does not need to know — and must not care — which hands belong to whom. **Handedness labels are ignored entirely.** This is what makes one spec cover both, and it is why the pair can also succeed if one person makes the whole heart alone while the other just stands there.

### Why portrait, not landscape

Rejected recommendation, restated for the record: at arm's length, two heads fit portrait's width comfortably (this is how every two-person selfie in history has worked), and portrait's surplus vertical space is exactly where a raised heart goes. Landscape pushes the pair apart, shrinks the hands, and requires two hands on the phone. Portrait is correct.

### Why the finger heart is a fallback, not the primary

The one-hand Korean finger heart is easier to detect and easier to perform. It is not the primary because:

1. The two-hand heart is the **coached** gesture and it is a better photograph, a better memory, and a better use of two people.
2. The finger heart's landmark signature (thumb tip near index tip, other fingers curled) is close to an "OK" sign and a pinch, so it carries a higher false-positive rate.

Accepting it from t=20 s gives the reliability benefit exactly when it is needed, without diluting the intended moment. **Coach the ideal, accept the alternatives silently** — the user never sees the softening happen.

### Accepted risks

- **False positives on G2:** an "OK" sign or a pinch can satisfy G2's geometry. Accepted. The consequence is a slightly early unlock for two people who are already together, holding a pose for 900 ms, after the two-face latch. This is a benign failure. Tightening it further would cost more true positives than it saves.
- **Posters, TVs, and mirrors adding a third face:** mitigated by `>= 2` (not `== 2`) plus a minimum bounding-box size gate. Not fully eliminated. Accepted.
- **Very low light:** partially mitigated by an explicit luma check and coaching. The mercy timer is the real answer. Accepted.

---

# Technical Architecture

## The governing principle: two disjoint runtime phases

```
                    ================================
                     RUNTIME PHASE A  —  "THE GATE"
                    ================================
    Camera ON  ·  MediaPipe ON  ·  WebGL OFF  ·  Heavy audio OFF
    Renderer: DOM + CSS + Framer Motion + one 2D overlay canvas
    Frame budget: 66 ms (15 Hz detection), ~50 ms headroom
    Duration cap: 120 s hard

                              |
                              |   UNLOCKING  (hard teardown boundary)
                              |   - stop() every MediaStreamTrack
                              |   - close() FaceDetector + HandLandmarker
                              |   - cancelAnimationFrame(detectionLoop)
                              |   - capture last frame -> offscreen canvas
                              |   - camera indicator light OFF
                              v

                    ================================
                     RUNTIME PHASE B  —  "THE GIFT"
                    ================================
    Camera OFF ·  MediaPipe OFF ·  WebGL ON   ·  Audio ON
    Renderer: R3F canvas + DOM overlay (transform/opacity only)
    Frame budget: 16.7 ms target / 33 ms floor
    Duration: ~45 s active, then low-cost idle
```

**Nothing heavy ever runs concurrently with anything else heavy.** This is the most important architectural statement in the document. It removes: the four-system contention problem, the thermal-throttling-during-the-climax problem, the need for a Web Worker, and most of the mobile performance risk.

## System diagram

```
+-----------------------------------------------------------------------+
|  app/  (Next.js App Router, single route, all client)                  |
|  - layout: fonts, CSP meta, robots, theme tokens                       |
|  - page: <ExperienceRoot/>  (dynamic, ssr:false)                       |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|  ORCHESTRATION LAYER                                                   |
|                                                                        |
|   machine/           pure reducer  (state, event) => state             |
|                      transition table + guards; ZERO React imports     |
|   store/             Zustand: holds machine state + context            |
|                      writes ONLY on discrete transitions (~8/session)  |
|   events/            typed event bus; the only way to enter the machine|
+-----------------------------------------------------------------------+
        |                       |                        |
        v                       v                        v
+----------------+   +---------------------+   +------------------------+
| DETECTION      |   | RENDERING           |   | AUDIO                  |
| (Phase A)      |   | (Phase B)           |   | (both)                 |
|                |   |                     |   |                        |
| camera/        |   | scene/  R3F canvas  |   | audio/                 |
|  acquire       |   |  BoxDrop            |   |  unlock (Scene 1 tap)  |
|  lifecycle     |   |  TulipField (inst.) |   |  Howler sprite sheet   |
|  teardown      |   |  PetalSystem (inst.)|   |  duck/resume on vis.   |
| vision/        |   |  Degrader           |   |  mute persisted        |
|  tasks bootstrap|  | overlay/ DOM+FM     |   +------------------------+
|  loop 15Hz     |   |  Message, Letter    |
| gesture/       |   | lite/  2D fallback  |
|  metrics (pure)|   +---------------------+
|  G1 / G2 / G3  |
|  smoothing     |   ALL detection code is FRAMEWORK-FREE.
|  hysteresis    |   It must not import React, Zustand, or Three.
|  coaching      |
+----------------+
```

## Detection pipeline

```
 <video>  (720p, playsInline muted autoPlay, CSS scaleX(-1) for display)
    |
    |  raw, unmirrored frame                         [15 Hz, rAF + accumulator]
    v
 +------------------------------------------------------------------+
 | 1. CADENCE GATE                                                  |
 |    now - lastRun >= interval ? run : skip                        |
 |    interval starts 66ms; adapts to 100ms if inference > 60ms     |
 +------------------------------------------------------------------+
    |
    v
 +------------------------------------------------------------------+
 | 2. INFERENCE                                                     |
 |    Phase A1: FaceDetector.detectForVideo(video, ts)              |
 |    Phase A2: FaceDetector + HandLandmarker (both, same ts)       |
 +------------------------------------------------------------------+
    |
    v
 +------------------------------------------------------------------+
 | 3. NORMALIZE  -- square-corrected space                          |
 |    x' = x ;  y' = y * (videoHeight / videoWidth)                 |
 |    All distances hereafter are in units of FRAME WIDTH.          |
 |    (MediaPipe normalizes each axis independently; skipping this  |
 |     makes every threshold wrong by the aspect ratio. Non-optional)|
 +------------------------------------------------------------------+
    |
    v
 +------------------------------------------------------------------+
 | 4. METRICS  (pure functions, no state)                           |
 |    faceCount, faceBoxWidths                                      |
 |    per hand: S = dist(L0, L9)   [palm scale]                     |
 |    G1/G2/G3 condition vectors + a continuous 0..1 "closeness"    |
 +------------------------------------------------------------------+
    |
    v
 +------------------------------------------------------------------+
 | 5. SMOOTHING                                                     |
 |    booleans -> N-of-M ring buffer (5 of last 7)                  |
 |    scalars  -> EMA alpha 0.4  (for the "almost there" ring only) |
 +------------------------------------------------------------------+
    |
    v
 +------------------------------------------------------------------+
 | 6. HYSTERESIS                                                    |
 |    enter when metric <= T ; exit only when metric > T * 1.30     |
 +------------------------------------------------------------------+
    |
    v
 +------------------------------------------------------------------+
 | 7. HOLD TIMER                                                    |
 |    present: hold += dt   (cap 900ms)                             |
 |    absent : hold -= dt*2 (floor 0, 200ms grace before decay)     |
 +------------------------------------------------------------------+
    |
    +--> ref.current = { coachingState, holdProgress, debugMetrics }
    |        consumed by the HUD via useSyncExternalStore / rAF read.
    |        NEVER setState from this path.
    |
    +--> on discrete edges ONLY: emit FACES_ACQUIRED | GESTURE_ENTER
             | GESTURE_EXIT | HOLD_COMPLETE  --> event bus --> machine
```

**The React boundary rule:** the detection loop writes to a `ref` at 15 Hz. The HUD reads that ref inside its own `rAF`. Zustand is written **only** on discrete transitions — roughly 8 writes across an entire session. Per-frame `setState` is a defect, not a style preference.

## Rendering pipeline (Phase B)

```
  <Canvas dpr={[1, mobile ? 1.5 : 2]} gl={{ antialias:false, alpha:true,
          powerPreference:'high-performance' }} flat legacy={false}>

    Camera: PerspectiveCamera, fov 45, fixed. No OrbitControls.
    Lighting: ambient + one directional. NO shadow maps. NO environment.
    Materials: MeshBasicMaterial / MeshToonMaterial, vertex colors.
               NO PBR, NO envMap, NO normal maps.
    Outlines: inverted-hull (BackSide, scaled 1.03, flat #111111).
              This IS the neo-brutalist look and costs 1 extra draw call.
    Post: NONE. "Bloom" is faked with additive sprites + a CSS radial
          gradient overlay. A full-screen pass costs 30-50% of the
          mobile frame budget and buys almost nothing at this art style.

    Instancing: TulipField  -> 1 InstancedMesh, up to 60 instances
                PetalSystem -> 1 InstancedMesh, pool of 300, PRE-ALLOCATED
                No allocation of any kind inside useFrame.

    Degrader: rolling FPS median over 2 s drives the ladder (see Budgets).
```

**DOM-over-WebGL rule:** overlay elements (message, letter, buttons) animate **only** `transform` and `opacity`. No `width`, `height`, `top`, `left`, `filter`, or `box-shadow` animation over the canvas — those force full-screen recomposites on mobile Safari. `will-change` is applied on animation start and removed on completion.

## Audio pipeline

```
  Scene 1 "Start" tap  (the ONLY reliable user gesture in the flow)
     |
     +--> new AudioContext()  ->  ctx.resume()
     +--> play a 1-sample silent buffer   [iOS unlock ritual]
     +--> Howler initialised, html5:false (Web Audio), preload:false
     |
  Scene 5 enter --> prefetch SFX sprite sheet
  Scene 6 enter --> prefetch music track
  Scene 9 (DELIVERY) --> music.play(), fade in 800 ms
     |
  visibilitychange -> hidden : Howler.volume(0) + ctx.suspend()
  visibilitychange -> visible: ctx.resume() then restore volume
     |
  Mute toggle (persistent, all scenes, localStorage 'bloom_muted')
```

Because the last user gesture before music starts is ~45 s earlier, the `AudioContext` **must** be created and resumed on the Scene-1 tap and kept alive. This is the difference between a silent climax and a working one.

**iOS ringer switch:** Web Audio in Safari respects the physical mute switch. This cannot be worked around. Mitigation: Scene 1 shows *"Sound on for the full effect 🔊"* so a silent experience is understood, not experienced as a bug.

## Mobile strategy (architecture level)

Covered in full in §Mobile Strategy. Architecturally, three things follow from it:

1. **Capability routing happens in `BOOT`, before any UI commits.** The app decides Full / Lite / Blocked in the first 100 ms.
2. **Every scene renders in Lite.** Lite is not a stub — it is a parallel implementation of Phase B using Lottie + CSS. The letter is identical in both.
3. **Teardown is a first-class lifecycle event**, not cleanup. `UNLOCKING` owns it and asserts it completed before emitting `SEQUENCE_STEP_DONE`.

## Final stack (amended from v1)

| Concern | Choice | Change from v1 |
|---|---|---|
| Framework | Next.js 15, App Router, single client route | unchanged |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true` | tightened |
| Styling | Tailwind CSS + CSS custom properties for tokens | unchanged |
| UI animation | Framer Motion (`motion/react`) | unchanged |
| 3D | Three.js + React Three Fiber **v9** + Drei (cherry-picked imports only) | **version pinned — R3F v8 does not support React 19, which Next 15 ships** |
| Vision | **`@mediapipe/tasks-vision`** (`FaceDetector`, `HandLandmarker`) | **replaced** — `@mediapipe/hands` and `@mediapipe/face_detection` are the deprecated legacy Solutions |
| WASM + models | **Self-hosted from `/public/vision/`** | **added** — no CDN dependency at the emotional peak |
| Audio | Howler.js (`html5: false`) | unchanged |
| Icons | Lucide React (tree-shaken, ≤ 8 icons) | capped |
| State | Zustand + hand-rolled FSM reducer | FSM added |
| Validation | *(none)* | **Zod removed** |
| 2D fallback | `lottie-web` (light build) or `@lottiefiles/dotlottie-web` | added |
| Deployment | Vercel, static export where possible | unchanged |

---

# State Machine Specification

## Machine context

```
MachineContext {
  // latches - write-once, never cleared during a session
  togetherConfirmed : boolean   // set true on FACES_ACQUIRED, never reset
  hasUnlocked       : boolean   // THE idempotency latch
  peekedAlone       : boolean

  // config
  recipientName     : string    // sanitised, default "Someone Special"
  motionSafe        : boolean   // !prefers-reduced-motion
  renderTier        : 'full' | 'lite'
  muted             : boolean

  // runtime
  gestureStageEnteredAt : number | null
  mercyLevel            : 0 | 1 | 2 | 3
  lastError             : DiagnosticInfo | null
  capturedFrame         : ImageBitmap | null
  skipCameraStage       : boolean   // true during replay
}
```

## States (21)

**Entry / routing**
| State | Description |
|---|---|
| `BOOT` | Capability detection. No UI. Exits within ~100 ms. |
| `BLOCKED_ENVIRONMENT` | In-app browser, insecure context, or no `mediaDevices`. Terminal-with-escape. |
| `LANDING` | Scene 1. Audio unlock happens on exit. |
| `PREFLIGHT` | Scene 2. Privacy + expectations. |

**Camera acquisition**
| State | Description |
|---|---|
| `REQUESTING_CAMERA` | `getUserMedia` in flight. Spinner-free; shows a reassuring illustration. |
| `CAMERA_DENIED` | `NotAllowedError`. Platform-specific recovery instructions. |
| `CAMERA_ERROR` | `NotFoundError` / `NotReadableError` / `OverconstrainedError` / `AbortError`. Error-specific copy. |
| `LOADING_DETECTION` | Runtime + face model loading. Real progress. 30 s timeout. |

**The gate**
| State | Description |
|---|---|
| `SEEKING_FACES` | Scene 5. Coaching HUD active. Solo prompt at 15 s. |
| `SOLO_PROMPT` | One face for 15 s. Offers wait-or-peek. |
| `TOGETHER_CONFIRMED` | 1.2 s reward beat (extends to max 5 s if the hand model is still loading). |
| `SEEKING_GESTURE` | Scene 7. Mercy timers running. |
| `GESTURE_HOLDING` | Gesture present; ring filling. Decays back to `SEEKING_GESTURE` on loss. |
| `CAMERA_INTERRUPTED` | Track muted/ended. Mercy timers paused. |

**The gift**
| State | Description |
|---|---|
| `UNLOCKING` | Teardown + flash. ~2.2 s. Non-interruptible. |
| `DELIVERY` | Box drop + burst. ~9 s. |
| `BLOOM` | Tulip field + petals. ~8 s. |
| `MESSAGE` | Recipient name reveal. ~4 s. |
| `LETTER_CLOSED` | Button waiting. Indefinite. |
| `LETTER_OPEN` | Letter revealed. Indefinite. |
| `RESTING` | Scene 13. Idle loop + three actions. |

**Failure**
| State | Description |
|---|---|
| `FATAL_ERROR` | Error boundary caught. Offers **[ Take me to the letter ]** + copyable diagnostic. |

## Events

```
System:     BOOT_OK · ENV_BLOCKED · FATAL
User:       START_TAPPED · PREFLIGHT_CONTINUE · RETRY_CAMERA · PEEK_ALONE
            · WAIT_FOR_PARTNER · MERCY_UNLOCK · SKIP_TO_LETTER
            · LETTER_OPEN_TAPPED · REPLAY_TAPPED · READ_AGAIN_TAPPED
            · SAVE_PHOTO_TAPPED · MUTE_TOGGLED
Camera:     PERMISSION_GRANTED · PERMISSION_DENIED · CAMERA_FAILED
            · TRACK_MUTED · TRACK_ENDED · TRACK_RECOVERED
Loading:    MODELS_READY · MODELS_FAILED · HAND_MODEL_READY
Detection:  FACES_ACQUIRED · SOLO_TIMEOUT · GESTURE_ENTER · GESTURE_EXIT
            · HOLD_COMPLETE
Sequence:   SEQUENCE_STEP_DONE
Runtime:    VISIBILITY_HIDDEN · VISIBILITY_VISIBLE · CONTEXT_LOST
            · DEGRADE_TO_LITE · MERCY_TICK
```

## Guards

| Guard | Definition | Purpose |
|---|---|---|
| `canUnlock` | `!ctx.hasUnlocked && (state === 'SEEKING_GESTURE' \|\| state === 'GESTURE_HOLDING' \|\| state === 'SOLO_PROMPT')` | **The single most important guard in the app.** Sets `hasUnlocked = true` *synchronously, inside the reducer*, before any async work. Kills every double-fire race. |
| `canSeekGesture` | `ctx.togetherConfirmed && handModelReady` | Never enter the gesture stage without the model. |
| `canRenderFull` | `renderTier === 'full' && webgl2Available` | Routes to Lite. |
| `isReplay` | `ctx.hasUnlocked && ctx.skipCameraStage` | Replay bypasses all camera states. |
| `mercyReached(n)` | `elapsed(gestureStageEnteredAt) >= [20,45,90][n] * 1000` | Escalation. Paused while `VISIBILITY_HIDDEN` or `CAMERA_INTERRUPTED`. |
| `isTerminalCameraError` | `err.name in {NotFoundError, SecurityError, OverconstrainedError}` | Terminal errors go to Lite, not to a retry loop. |

## Transition table

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| `BOOT` | `BOOT_OK` | localStorage unlocked | `RESTING` | restore ctx |
| `BOOT` | `BOOT_OK` | `!canRenderFull` | `LANDING` | `renderTier = 'lite'` |
| `BOOT` | `BOOT_OK` | — | `LANDING` | — |
| `BOOT` | `ENV_BLOCKED` | — | `BLOCKED_ENVIRONMENT` | — |
| `BLOCKED_ENVIRONMENT` | `SKIP_TO_LETTER` | — | `DELIVERY` | Lite sequence |
| `LANDING` | `START_TAPPED` | — | `PREFLIGHT` | **unlock AudioContext**; prefetch runtime + face model |
| `PREFLIGHT` | `PREFLIGHT_CONTINUE` | — | `REQUESTING_CAMERA` | prefetch hand model |
| `REQUESTING_CAMERA` | `PERMISSION_GRANTED` | — | `LOADING_DETECTION` | attach stream; bind track listeners |
| `REQUESTING_CAMERA` | `PERMISSION_DENIED` | — | `CAMERA_DENIED` | — |
| `REQUESTING_CAMERA` | `CAMERA_FAILED` | `isTerminalCameraError` | `CAMERA_ERROR` | offer Lite |
| `REQUESTING_CAMERA` | `CAMERA_FAILED` | — | `CAMERA_ERROR` | offer retry |
| `CAMERA_DENIED` | `RETRY_CAMERA` | — | `REQUESTING_CAMERA` | (iOS: reload instead) |
| `CAMERA_DENIED` / `CAMERA_ERROR` | `SKIP_TO_LETTER` | `canUnlock` | `UNLOCKING` | Lite path |
| `LOADING_DETECTION` | `MODELS_READY` | — | `SEEKING_FACES` | start loop @15 Hz; prefetch 3D chunk |
| `LOADING_DETECTION` | `MODELS_FAILED` | — | `CAMERA_ERROR` | offer Lite |
| `SEEKING_FACES` | `FACES_ACQUIRED` | — | `TOGETHER_CONFIRMED` | **latch `togetherConfirmed`**; prefetch audio |
| `SEEKING_FACES` | `SOLO_TIMEOUT` | — | `SOLO_PROMPT` | — |
| `SOLO_PROMPT` | `WAIT_FOR_PARTNER` | — | `SEEKING_FACES` | reset solo timer |
| `SOLO_PROMPT` | `PEEK_ALONE` | `canUnlock` | `UNLOCKING` | `peekedAlone = true` |
| `SOLO_PROMPT` | `FACES_ACQUIRED` | — | `TOGETHER_CONFIRMED` | latch |
| `TOGETHER_CONFIRMED` | `SEQUENCE_STEP_DONE` | `canSeekGesture` | `SEEKING_GESTURE` | enable hand model; `gestureStageEnteredAt = now` |
| `SEEKING_GESTURE` | `GESTURE_ENTER` | — | `GESTURE_HOLDING` | start ring |
| `GESTURE_HOLDING` | `GESTURE_EXIT` | — | `SEEKING_GESTURE` | decay ring |
| `GESTURE_HOLDING` | `HOLD_COMPLETE` | `canUnlock` | `UNLOCKING` | **set `hasUnlocked` synchronously** |
| `SEEKING_GESTURE` | `MERCY_TICK` | `mercyReached(n)` | *self* | `mercyLevel = n`; relax thresholds; reveal hatch |
| `SEEKING_GESTURE` / `GESTURE_HOLDING` | `MERCY_UNLOCK` | `canUnlock` | `UNLOCKING` | — |
| `SEEKING_*` | `TRACK_MUTED` / `TRACK_ENDED` | — | `CAMERA_INTERRUPTED` | pause loop + mercy timers |
| `CAMERA_INTERRUPTED` | `TRACK_RECOVERED` | — | *previous* | resume |
| `CAMERA_INTERRUPTED` | `MERCY_UNLOCK` | `canUnlock` | `UNLOCKING` | — |
| `UNLOCKING` | *(entry)* | — | — | **TEARDOWN: capture frame → `track.stop()` all → `.close()` both tasks → cancel rAF → assert camera off** |
| `UNLOCKING` | `SEQUENCE_STEP_DONE` | — | `DELIVERY` | mount R3F canvas; `music.play()` |
| `DELIVERY` | `SEQUENCE_STEP_DONE` | — | `BLOOM` | — |
| `BLOOM` | `SEQUENCE_STEP_DONE` | `peekedAlone` | `RESTING` | show "for when you're together" hold |
| `BLOOM` | `SEQUENCE_STEP_DONE` | — | `MESSAGE` | — |
| `MESSAGE` | `SEQUENCE_STEP_DONE` | — | `LETTER_CLOSED` | — |
| `LETTER_CLOSED` | `LETTER_OPEN_TAPPED` | — | `LETTER_OPEN` | decode letter payload |
| `LETTER_OPEN` | `SEQUENCE_STEP_DONE` | — | `RESTING` | **persist `bloom_unlocked = '1'`** |
| `RESTING` | `REPLAY_TAPPED` | — | `UNLOCKING` | `skipCameraStage = true` |
| `RESTING` | `READ_AGAIN_TAPPED` | — | `LETTER_OPEN` | — |
| `RESTING` | `SAVE_PHOTO_TAPPED` | — | *self* | composite + download locally |
| *any* | `CONTEXT_LOST` | restore fails | *self* | `renderTier = 'lite'`, remount |
| *any* | `FATAL` | — | `FATAL_ERROR` | build diagnostic string |
| `FATAL_ERROR` | `SKIP_TO_LETTER` | — | `LETTER_OPEN` | Lite |
| *any* | `VISIBILITY_HIDDEN` | — | *self* | pause loop, timers, audio |
| *any* | `VISIBILITY_VISIBLE` | — | *self* | `ctx.resume()`, resume loop/timers |

**Any event/state pair not in this table is illegal.** In development the reducer throws; in production it logs to the diagnostic buffer and returns state unchanged. This is how the "execute once" requirement is actually enforced.

## Failure, recovery, and replay state summary

- **Failure states:** `BLOCKED_ENVIRONMENT`, `CAMERA_DENIED`, `CAMERA_ERROR`, `FATAL_ERROR`. Every one exposes a route to the letter.
- **Recovery states:** `CAMERA_INTERRUPTED` (transient, resumes to the previous state), `SOLO_PROMPT` (a soft failure with two exits).
- **Replay states:** `RESTING` is the hub. `REPLAY_TAPPED` → `UNLOCKING` with `skipCameraStage`; `READ_AGAIN_TAPPED` → `LETTER_OPEN`. The camera is never re-requested after the first unlock.

---

# Mobile Strategy

## Support matrix

| Tier | Devices | Experience |
|---|---|---|
| **Tier 1 — Full** | iOS 16.4+ Safari · Android Chrome 110+ (≥4 GB RAM) · desktop Chrome/Edge/Safari latest with a camera | Everything. Detection @15 Hz, full 3D. |
| **Tier 2 — Degraded** | iOS 15.0–16.3 (no WASM SIMD → CV ~3× slower) · Android Chrome 90–109 · low-RAM Android | Detection @10 Hz, mercy thresholds start relaxed, particles halved, dpr 1.0. |
| **Tier 3 — Lite** | No WebGL2 · no camera hardware · Firefox mobile (untested for MediaPipe GPU path) · reduced-motion users who opt out | Skip detection entirely. **[ Open your delivery ]** → 2D Lottie sequence → full letter. |
| **Tier 0 — Blocked** | In-app browsers | Interstitial first. Escape to Tier 3 if they refuse. |

**Rationale for the iOS 16.4 line:** WebAssembly SIMD shipped in Safari 16.4. Below it, MediaPipe inference is multiple times slower — playable but not pleasant. We support it (Tier 2) rather than blocking it, because the recipient's phone is not a variable we control.

## In-app browser handling — the highest-severity mobile risk

This link will be sent over WhatsApp, Instagram DM, or LINE. Those open in embedded WebViews where `getUserMedia` is unreliable or unavailable, particularly Instagram's and Facebook's on iOS. **The gift can fail before the camera prompt ever appears.**

**Detection** — UA substring match, checked in `BOOT`:
`Instagram` · `FBAN` · `FBAV` · `FB_IAB` · `FBIOS` · `Line/` · `MicroMessenger` · `Twitter` · `TikTok` · `Snapchat` · `KAKAOTALK`

**Response** — a full interstitial, shown **before** any permission prompt:

> **"Pssst — open this in your real browser 🌷"**
> *This delivery needs your camera, and it can't reach it from here.*
> **[ Open in Safari ]** / **[ Open in Chrome ]** · **[ Copy link ]** · *small:* **[ Just show me the flowers ]**

- **Android:** the button uses an `intent://` URL, which reliably escapes most WebViews.
- **iOS:** there is **no programmatic escape**. The button copies the link and shows a labelled illustration of the `•••` → *Open in Safari* menu position for that specific app. Be honest about this in the copy; do not ship a button that pretends to work.
- **Escape hatch:** *"Just show me the flowers"* routes to Tier 3. Even here, nobody is trapped.

**Required pre-launch test:** send the actual production link to yourself through WhatsApp, Instagram DM, and whichever app you will actually use, and open it. This is a checklist item in Phase 9, not an optional nicety.

## Camera permissions

**Constraints**
```
{ video: { facingMode: 'user',
           width:  { ideal: 1280 },
           height: { ideal: 720  },
           frameRate: { ideal: 30, max: 30 } },
  audio: false }
```
720p, not 1080p — halves decode cost, and MediaPipe downsamples internally anyway. `audio: false` matters: requesting audio triggers a scarier prompt and a second permission to lose.

**Video element:** `playsInline muted autoPlay` — all three required. Without `playsInline`, iOS Safari takes the video fullscreen and the entire UI disappears. Display is mirrored with `transform: scaleX(-1)`; **inference runs on the raw, unmirrored frame**, and the overlay canvas applies the same mirror. One conversion, one place.

**`navigator.permissions.query({name:'camera'})` is not supported in Safari.** The architecture must never depend on knowing the permission state in advance. The pre-flight screen exists partly because of this — it is our only pre-prompt intervention.

**Denial recovery is platform-specific and must be authored, not generic:**

| Platform | Reality | Screen |
|---|---|---|
| iOS Safari | A second `getUserMedia` throws `NotAllowedError` **immediately, with no prompt**. Retry is impossible in-page. | Illustrated: tap **AA** in the address bar → *Website Settings* → *Camera* → *Allow* → **[ Reload ]** |
| Android Chrome | Recoverable via the lock/tune icon; a re-prompt sometimes works. | Illustrated lock-icon instructions + a genuine **[ Try again ]** |
| Desktop | Recoverable via the address-bar camera icon. | Icon location illustration + **[ Try again ]** |

Every one of these screens also carries **[ Just show me the flowers ]**.

## Audio restrictions

| Restriction | Handling |
|---|---|
| Autoplay requires a user gesture | `AudioContext` created + `resume()`d + silent buffer played on the Scene-1 **Start** tap. |
| The gesture is ~45 s before music starts | Context is kept alive for the whole session, never recreated. |
| iOS suspends context on backgrounding | `visibilitychange` → `resume()` on return, every time. |
| iOS physical ringer switch mutes Web Audio | Unfixable. Scene 1 shows *"Sound on for the full effect 🔊"*. |
| Users may be in public | Persistent mute toggle from Scene 1, state in `localStorage`. Music fades in over 800 ms, never starts at full volume. |

## Performance degradation strategy

A rolling median FPS over a 2-second window drives a one-way ladder (it never climbs back — oscillation is worse than a slightly conservative setting):

| Trigger | Action |
|---|---|
| median < 45 fps | `dpr` → 1.0 |
| median < 34 fps | particles 300 → 150; disable the inverted-hull outline pass |
| median < 26 fps | tulip instances 60 → 24; petals → 60; freeze ambient drift |
| median < 20 fps for 3 s | **`DEGRADE_TO_LITE`** — unmount the R3F canvas, continue in 2D from the current beat |
| Phase A: inference > 60 ms | detection interval 66 ms → 100 ms |
| Phase A: inference > 110 ms | drop face detection during the gesture stage (latch already holds) |

## Battery and thermals

- **Camera-on budget: 120 s hard cap** (enforced by the mercy timer and an absolute timer).
- **Total experience budget: ~180 s** to the letter.
- The Phase A / Phase B split means the heaviest GPU work happens *after* the camera is off, so thermal load never compounds.
- `RESTING` idle must cost < 5% GPU: pause the R3F render loop entirely (`frameloop="demand"`) once the scene settles, and invalidate only on interaction.

## Layout

- `100dvh` with a `100vh` fallback — mobile Safari's collapsing toolbar will otherwise shift a full-screen camera layout mid-experience.
- `env(safe-area-inset-*)` padding on all fixed UI. Neo-brutalist chunky buttons sitting under the home indicator is a real and very likely bug.
- Minimum width 375 px. Touch targets ≥ 48×48 CSS px.
- Portrait-first; landscape supported as Tripod Mode with adjusted framing guides.

---

# Detection Specification

Formal, implementable, no vague language. All thresholds are starting values to be tuned in Phase 0 against recorded fixtures; the *structure* is fixed, the *numbers* are calibrated.

## Coordinate space (mandatory preprocessing)

MediaPipe returns landmarks normalized independently per axis: `x ∈ [0,1]` relative to width, `y ∈ [0,1]` relative to height. In a 9:16 frame these units are **not isotropic** — a vertical distance of 0.1 is 1.78× longer in pixels than a horizontal one.

Every landmark is converted once, on ingest:

```
x' = x
y' = y * (videoHeight / videoWidth)
```

All distances below are Euclidean in this square-corrected space, **in units of frame width**. Skipping this step makes every threshold in this section wrong by the aspect ratio. This is the most commonly skipped step in MediaPipe gesture work and it is not optional.

## Landmark reference

```
0  wrist
1-4    thumb   (4 = tip)
5-8    index   (5 = MCP, 6 = PIP, 8 = tip)
9-12   middle  (9 = MCP, 10 = PIP, 12 = tip)
13-16  ring    (14 = PIP, 16 = tip)
17-20  pinky   (18 = PIP, 20 = tip)
```

**Palm scale:** `S = dist(L0, L9)` — wrist to middle-finger MCP. Scale-invariant, rotation-stable, and unaffected by finger pose. **Every threshold is expressed as a multiple of `S`.** Never use raw pixels or raw normalized units.

**Handedness (`Left`/`Right`) is ignored entirely.** It is unreliable when the two hands belong to different people, and none of the geometry below needs it.

## Model configuration

```
FaceDetector (BlazeFace short-range, ~230 KB)
  runningMode              : VIDEO
  minDetectionConfidence   : 0.50    (Tier 2 / mercy>=1: 0.40)
  minSuppressionThreshold  : 0.30
  delegate                 : GPU, fall back to CPU on init failure

HandLandmarker (~7.5 MB)
  runningMode                : VIDEO
  numHands                   : 2      <-- NOT 4. See Detection Strategy.
  minHandDetectionConfidence : 0.50   (mercy>=1: 0.40)
  minHandPresenceConfidence  : 0.50
  minTrackingConfidence      : 0.50
  delegate                   : GPU, fall back to CPU on init failure
```

## Cadence

- Target **15 Hz** (66 ms interval), driven by a single `requestAnimationFrame` loop with a time accumulator. Not `setInterval` — it drifts and does not pause with the tab.
- `detectForVideo(video, performance.now())`. Timestamps must be **monotonically increasing** across both detectors; reuse one timestamp per tick or MediaPipe will throw.
- Adaptive: if the last inference exceeded 60 ms, interval → 100 ms (10 Hz). If it exceeded 110 ms, drop face detection during the gesture stage.
- Loop is cancelled on `VISIBILITY_HIDDEN` and on teardown. Never leaked.

## Stage A — face gate (`SEEKING_FACES`)

```
faceValid(d)  :=  d.categories[0].score >= 0.50
              AND boundingBox.width >= 0.10   (frame-width units)

facesPresent  :=  count(faceValid) >= 2          -- NOT == 2

FACES_ACQUIRED  when facesPresent is true in >= 8 of the last 10 ticks
                (~0.67 s at 15 Hz)

SOLO_TIMEOUT    when count(faceValid) == 1 continuously for 15 s
```

The `>= 2` (rather than `== 2`) is deliberate: a poster, a TV, a mirror, or a passer-by adding a third face must not close the gate. The `boundingBox.width >= 0.10` gate rejects small background faces.

On `FACES_ACQUIRED`, `togetherConfirmed` latches **permanently for the session**. Face detection is never again a blocking condition.

## Stage B — gesture gate (`SEEKING_GESTURE`)

Liveness precondition, evaluated every tick:
```
liveness := count(faceValid) >= 1  in >= 5 of the last 10 ticks
```
(If face inference has been dropped for performance, `liveness` is assumed true — the latch already established presence.)

### Common helpers

```
S(h)        = dist(h[0], h[9])
curled(h,f) = dist(h[TIP_f], h[0]) < dist(h[PIP_f], h[0])
palmDir(h)  = normalize(h[9] - h[0])
M           = mercy multiplier: 1.00 at level 0, 1.25 at level >= 1
```

### G1 — Two-hand heart (PRIMARY, coached)

Requires exactly two detected hands, `A` and `B`, in any ownership arrangement. Let `S̄ = (S(A) + S(B)) / 2`.

| # | Condition | Formula | Rejects |
|---|---|---|---|
| C1 | Hands large enough | `S(A) >= 0.045 AND S(B) >= 0.045` | too-far / unreliable landmarks |
| C2 | Thumb junction | `dist(A[4], B[4]) <= 0.55 · S̄ · M` | hands not meeting at the base |
| C3 | Index junction | `dist(A[8], B[8]) <= 0.70 · S̄ · M` | open shape / no top vertex |
| C4 | Vertical order | `midY(A[4],B[4]) > midY(A[8],B[8])` *(y grows downward)* | inverted / accidental shapes |
| C5 | Aperture | `dist(A[0], B[0]) >= 0.80 · S̄ / M` | **clasped hands, prayer hands, handshake** |
| C6 | Mirrored posture | `50° <= angle(palmDir(A), palmDir(B)) <= 170°` | **high-five, parallel palms, both hands waving** |
| C7 | Fingers curled | `curled(h, middle) AND curled(h, ring) AND curled(h, pinky)` for both hands | **open palms, splayed fingers** |

`G1 := C1 ∧ C2 ∧ C3 ∧ C4 ∧ C5 ∧ C6 ∧ C7 ∧ liveness`

C5 and C6 are the false-positive workhorses — they are what separate a heart from every other two-hands-together pose.

### G2 — One-hand finger heart (accepted from mercy level ≥ 1, and always in Tripod Mode)

Single hand `h`:

| # | Condition | Formula |
|---|---|---|
| C1 | Hand large enough | `S(h) >= 0.040` |
| C2 | Thumb–index contact | `dist(h[4], h[8]) <= 0.35 · S(h) · M` |
| C3 | Index bent | `dist(h[8], h[0]) < dist(h[6], h[0])` |
| C4 | Other fingers curled | `curled(h, middle) ∧ curled(h, ring) ∧ curled(h, pinky)` |

`G2 := C1 ∧ C2 ∧ C3 ∧ C4 ∧ liveness`

**Known false positives (accepted):** the "OK" sign and a pinch gesture satisfy G2. Consequence: an early unlock for two people who are already together and holding a pose for 900 ms. Benign. Tightening further costs more true positives than it saves.

### G3 — Mirrored finger hearts (accepted from mercy level ≥ 1)

Two hands, each independently satisfying G2, with `dist(A[0], B[0]) >= 0.60`. Emotionally the "one each" version. Free to implement once G2 exists.

### Acceptance policy over time

| Mercy level | Elapsed in gesture stage | Accepted | `M` | Hand confidence |
|---|---|---|---|---|
| 0 | 0–20 s | G1 | 1.00 | 0.50 |
| 1 | 20–45 s | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 |
| 2 | 45–90 s | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 (+ hatch visible) |
| 3 | 90 s+ | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 (+ hatch primary) |

Mercy timers **pause** on `VISIBILITY_HIDDEN` and `CAMERA_INTERRUPTED`. A phone call must not cost the user their patience budget.

## Smoothing

Two separate mechanisms, deliberately:

**1. Boolean stabilisation — N-of-M ring buffer.**
`gesturePresent := true in >= 5 of the last 7 ticks` (~0.47 s window at 15 Hz).
Applied to the *final* boolean, never to individual conditions. This is what absorbs single-frame dropouts from motion blur and momentary occlusion.

**2. Scalar smoothing — EMA, `α = 0.4`.**
Applied only to the continuous "closeness" value that drives the *"almost there"* UI. It must never gate the transition — a smoothed scalar crossing a threshold reintroduces exactly the lag the N-of-M buffer exists to avoid.

```
closeness = clamp01( mean over C2..C7 of ( 1 - (measured / threshold) ) )
```

Raw landmarks are **not** filtered (no One Euro, no Kalman). MediaPipe's VIDEO running mode already applies internal temporal tracking; adding a second filter costs latency and buys nothing at 15 Hz.

## Hysteresis

Every distance-based condition uses asymmetric enter/exit thresholds:

```
enter:  metric <= T
exit:   metric >  T * 1.30
```

Without this, a metric hovering at the boundary produces `GESTURE_ENTER`/`GESTURE_EXIT` chatter several times per second — a flickering progress ring, and an unreliable hold timer. The 1.30 factor is the starting value; tune in Phase 0.

## Hold timer

```
on tick, dt = time since last tick:

  if gesturePresent:
      hold = min(hold + dt, 900)
      graceRemaining = 200
  else:
      if graceRemaining > 0: graceRemaining -= dt        # no penalty yet
      else:                  hold = max(hold - dt * 2, 0) # decay, don't reset

  ringProgress = hold / 900          # drives the UI ring
  emit HOLD_COMPLETE  when hold >= 900   (once; guarded by canUnlock)
```

**The 200 ms grace and the 2× decay are deliberate UX.** A hard reset to zero on a single dropped frame is punishing and feels broken. Decaying visibly tells the user *"you had it, come back"* — which is also coaching.

**900 ms** is chosen as long enough to reject accidental poses, short enough that nobody's arms get tired, and long enough for the ring animation to read as an intentional charge-up rather than a glitch.

## Ambient brightness check

Every 500 ms, draw the video to a 32×32 offscreen canvas and compute mean luma:
```
Y = 0.2126 R + 0.7152 G + 0.0722 B      (0..255)
TOO_DARK when Y < 45 for 2 consecutive samples
```
Cheap (1 KB of pixels), and it converts the single most common real-world failure — an evening room — from silent failure into actionable coaching.

## Coaching state derivation

Evaluated every tick, **first match wins**. Displayed state changes are debounced to 1.5 s minimum so the HUD does not flicker between messages.

| Priority | State | Condition | Copy |
|---|---|---|---|
| 1 | `TOO_DARK` | `Y < 45` | *"A little more light? 💡"* |
| 2 | `NO_FACES` | 0 faces for 1.0 s | *"Come into the frame 👋"* |
| 3 | `ONE_FACE` | 1 face for 1.5 s, pre-latch | *"Someone's missing 💕"* |
| 4 | `NO_HANDS` | post-latch, 0 hands for 1.5 s | *"Show me your hands ✋"* |
| 5 | `HANDS_TOO_SMALL` | `S < 0.045` | *"Bring the heart closer 🤏"* |
| 6 | `ALMOST` | `closeness >= 0.65` | *"Almost! Fingers together 💗"* |
| 7 | `HOLDING` | `hold > 0` | *(ring fills; no text)* |
| 8 | `IDLE` | — | *"Make a heart — one hand each 💗"* |

The `ALMOST` state is worth more than the other seven combined. It is the only feedback that tells the user their gesture is *working*, and it converts random flailing into deliberate adjustment.

All coaching text is mirrored into an `aria-live="polite"` region.

## Debug mode (`?debug=1`)

Non-negotiable tooling — the gesture cannot be tuned blind:
- Landmark skeleton overlay on the mirrored preview
- Live numeric readout of `S`, C1–C7 pass/fail, `closeness`, `hold`, face count, luma
- Current FSM state and last 10 events
- Inference time (ms) and effective detection Hz
- **[ Force unlock ]** button
- Mercy level override

## Test fixtures

Detection cannot be unit-tested against live video. Record once, replay forever:

- **10–15 short clips** (5–10 s, 720p): daylight/two-hand heart · evening/two-hand heart · finger hearts · one person only · three people · a poster in frame · clasped hands (must reject) · high-five (must reject) · open palms (must reject) · hands too far · phone-holder pose.
- Per clip: a JSON of expected outcomes plus, for a handful of frames, the dumped landmark arrays.
- **Unit tests run against the dumped landmark JSON** — pure functions, milliseconds, deterministic. This makes threshold tuning a 10-second loop instead of a two-people-in-a-room loop, and it is the single highest-leverage piece of tooling in the project.

---

# Asset Strategy

## Sourcing decision

**v1's asset sources are rejected for hero 3D assets.** Sketchfab CC0 and Poly Pizza models carry unpredictable topology (50k–500k triangles), unpredictable style, embedded 2K–4K textures, and licence-attribution burdens. They cannot meet the budget and cannot meet the art direction.

**Hero 3D assets are authored, not downloaded.** The Kawaii + Neo Brutalism direction is *specifically* a low-poly style: chunky silhouettes, flat unlit colors, thick black outlines, zero surface detail. A tulip in this style is ~1,000 triangles with vertex colors and no texture at all. Authoring is both cheaper to render and more on-brand than anything sourced.

| Asset class | Source | Notes |
|---|---|---|
| Tulip, flower box, petals, leaves | **Authored** (Blender → glTF) | Flat vertex colors, no textures, no UVs needed |
| 2D Lite sequence | **LottieFiles** (CC0/free licence) or authored | Lite tier + reduced-motion tier |
| UI icons | **Lucide React**, ≤ 8 icons, individually imported | Tree-shaken |
| Decorative emoji/stickers | **OpenMoji** (CC BY-SA 4.0 — attribution required in a colophon) | Inline SVG, subset only |
| SFX | **Kenney** (CC0) | Whoosh, thud, pop, sparkle, page-turn, sting |
| Music | Licensed instrumental, ≤ 60 s loop | Confirm the licence before shipping |
| Fonts | Fredoka + Plus Jakarta Sans via `next/font` (self-hosted, Latin subset) | No Google Fonts network request at runtime |

All licences recorded in `ATTRIBUTIONS.md`, with a small colophon link from `RESTING`.

## Optimization pipeline

```
  Blender  (flat shade, vertex colors, no UVs, joined by material)
     |  glTF 2.0 export, +Y up, single scene, no cameras/lights
     v
  gltf-transform:
     dedup  ->  prune  ->  weld  ->  join  ->  simplify (ratio<=0.75)
     ->  meshopt        (preferred over Draco: no decoder wasm, faster)
     ->  (textures only if unavoidable) resize 512 -> toktx UASTC
     v
  Validate against budget  ->  FAIL THE BUILD if exceeded
     v
  /public/models/*.glb        Cache-Control: public, max-age=31536000, immutable
```

Same discipline for the vision assets:
```
  /public/vision/wasm/*.wasm          (@mediapipe/tasks-vision runtime)
  /public/vision/face_detector.task   (~230 KB)
  /public/vision/hand_landmarker.task (~7.5 MB)
```
**Self-hosted, never CDN.** A jsDelivr hiccup at the emotional peak of a one-shot gift is an unacceptable dependency, and self-hosting keeps `connect-src 'self'` intact.

## Load staging schedule

The largest asset in the project is the 7.5 MB hand model. The scene structure exists partly to hide it:

| Trigger | Prefetch started | Size | Cover time |
|---|---|---|---|
| `LANDING` mount | vision WASM runtime + `face_detector.task` | ~1.5 MB | user reads the landing |
| `START_TAPPED` | *(continues)* | — | pre-flight reading time |
| `PREFLIGHT_CONTINUE` | **`hand_landmarker.task`** | ~7.5 MB | permission prompt + face stage (~20 s) |
| `LOADING_DETECTION` | *(blocks on face model only)* | — | — |
| `SEEKING_FACES` enter | 3D chunk + `.glb` models | ~1.6 MB | face stage + gesture stage |
| `TOGETHER_CONFIRMED` | audio (music + SFX sprite) | ~950 KB | gesture stage |

**This is why the face detector and hand landmarker are loaded separately.** Blocking the camera stage on 7.5 MB would mean a 15-second stare at a loader on 4G. Blocking only on 230 KB means the camera appears in ~2 s and the hand model lands while they are getting into position. `TOGETHER_CONFIRMED` extends from 1.2 s up to 5 s if the hand model is still in flight, disguised as *"warming up the magic ✨"*.

## Budget enforcement

A build-time script checks every file against §Performance Budgets and **fails CI on violation**. Budgets that are not enforced are wishes.

---

# Performance Budgets

## Network

| Item | Budget | Notes |
|---|---|---|
| Initial JS (route entry, no CV, no 3D) | **≤ 140 KB gzip** | Scene 1 must be interactive fast |
| Vision runtime chunk (JS + WASM) | ≤ 1.3 MB transfer | self-hosted, immutable cache |
| `face_detector.task` | ≤ 260 KB | blocking |
| `hand_landmarker.task` | ≤ 8.0 MB | **non-blocking**, background |
| 3D chunk (three + R3F v9 + drei subset) | **≤ 450 KB gzip** | cherry-picked imports; no `drei` barrel import |
| All `.glb` models combined | **≤ 1.2 MB** | meshopt, vertex colors |
| Music | ≤ 900 KB | ~60 s loop, mono, 128 kbps AAC + Opus |
| SFX sprite sheet | ≤ 120 KB | 6 sounds, one file |
| Lottie (Lite sequence) | ≤ 150 KB | |
| Fonts | ≤ 90 KB | 2 families, Latin subset, woff2 |
| **Total transfer, full experience** | **≤ 13 MB** | of which 8 MB is background-loaded |

## Timing (measured on 4G, ~5 Mbps, mid-tier Android)

| Metric | Target | Hard limit |
|---|---|---|
| Scene 1 LCP | ≤ 1.8 s | 3.0 s |
| Scene 1 interactive | ≤ 2.2 s | 3.5 s |
| Camera preview visible after grant | ≤ 2.5 s | 5.0 s |
| Gesture stage ready (hand model loaded) | ≤ 25 s from first paint | 40 s |
| 3D sequence ready at unlock | must be **pre-loaded** | — |

**v1's "initial load < 3 seconds" is retained for Scene 1 only.** For the whole experience it is arithmetically impossible — 13 MB does not move in 3 s on cellular. The staging schedule is the honest answer: *the user is never waiting on something that has not already started downloading.*

## Rendering (Phase B)

| Item | Budget |
|---|---|
| FPS target | 60 (desktop, Tier 1 mobile) |
| **FPS floor** | **30 sustained** — below this the degradation ladder fires |
| `dpr` | `min(devicePixelRatio, 2)` desktop · `min(devicePixelRatio, 1.5)` mobile |
| Scene triangles (incl. outline hulls) | **≤ 45,000** |
| Draw calls | **≤ 40** |
| Tulip | ≤ 1,000 tris (≤ 2,000 with outline hull), instanced |
| Flower box | ≤ 2,500 tris |
| Tulip instances | ≤ 60 |
| Petal particles | **≤ 300**, one `InstancedMesh`, pool pre-allocated at mount |
| Textures | Prefer **none** (vertex colors). If required: ≤ 512×512, ≤ 4 total, KTX2 |
| Shadow maps | **0** |
| Post-processing passes | **0** |
| Lights | ≤ 2 (1 ambient, 1 directional) |
| Allocations inside `useFrame` | **0** |
| GPU memory | ≤ 120 MB |
| JS heap after unlock | ≤ 180 MB (Phase A resources must be released) |

## Detection (Phase A)

| Item | Budget |
|---|---|
| Detection rate | 15 Hz target, 10 Hz degraded |
| Inference per tick (both models) | ≤ 45 ms target, ≤ 60 ms before degrading |
| Main-thread headroom per frame | ≥ 40 ms of every 66 ms |
| React re-renders per second, detection scenes | **≤ 2** (HUD reads a ref; store writes only on transitions) |
| Zustand writes per session | ~8 |
| Camera-on duration | ≤ 120 s hard |

## Battery / thermal

| Item | Budget |
|---|---|
| Total experience duration to letter | ≤ 180 s |
| `RESTING` idle GPU | < 5% (`frameloop="demand"`) |
| Estimated battery cost, full run | ≤ 2% on a typical 2022+ phone |

---

# Accessibility

The experience structurally requires a camera and cannot be made universally operable. It **can** be made safe and non-trapping, and both are requirements, not aspirations.

## Reduced motion

`prefers-reduced-motion: reduce` sets a global `motionSafe = false`, honoured by every animated element. **Content is never removed — only motion is.**

| Element | Full | Reduced |
|---|---|---|
| Springs / overshoot | `stiffness 300, damping 12` | `ease-out`, no overshoot |
| Unlock camera shake | ≤ 350 ms, 8 px amplitude | **removed entirely** |
| Screen darken | animated | instant crossfade |
| Box fall | physics drop + impact punch | fade + gentle scale-in |
| Tulip eruption | radial explosion | staggered fade-in, 80 ms apart |
| Petals | 300, physics drift | **60**, slow linear fall, no rotation |
| Message reveal | scale overshoot 1.15 → 1.0 | opacity only |
| Envelope unfold | 3-beat 3D flip | crossfade |
| Ambient particles | continuous | static |
| Durations | baseline | ×0.6 |
| Parallax | on | off |

A visible **Motion: full / reduced** toggle also appears on the pre-flight screen, so people who never set the OS preference can still opt in.

## Motion safety and photosensitivity

- No full-screen luminance change greater than 10% at a rate above 3 Hz. **The "magical unlock effect" is a single 400 ms radial bloom, not a strobe.** This is specified, not left to interpretation.
- The camera shake is capped at 350 ms and 8 px, and is removed under reduced motion.
- No rapid red flashing anywhere in the palette (the palette contains no saturated red).

## Contrast requirements

Measured against WCAG 2.1 AA:

| Pair | Ratio | Verdict |
|---|---|---|
| `#111111` on `#FFF8E8` (cream) | **18.3:1** | Pass |
| `#111111` on `#FFFFFF` | **19.0:1** | Pass |
| `#111111` on `#FF8FAB` (primary pink) | **8.9:1** | Pass |
| `#111111` on `#FFE599` (tulip yellow) | ~15:1 | Pass |
| `#FF8FAB` on `#FFF8E8` | **2.03:1** | **FAIL** — never for text |
| `#FFE599` on `#FFF8E8` | **1.17:1** | **FAIL** — never for text |
| `#FFFFFF` on `#FF8FAB` | **2.15:1** | **FAIL** — no white text on primary pink |

**Rule, stated once and enforced:** `#111111` is the **only** approved text color in the entire application. Every brand color is a *surface or fill*, never a foreground. White-on-pink is explicitly prohibited despite being the instinctive kawaii choice.

This is not a compromise with the art direction — neo-brutalism is **built on** black text and thick black borders on saturated fills. The accessible choice and the stylistically correct choice are the same choice.

## Operability

- Every scene is advanceable by keyboard. Visible focus: 3 px solid `#111111`, 2 px offset.
- The **[ Open it anyway ]** escape hatch is in the DOM and focusable **from t=0** in the gesture stage, visually revealed at 45 s. Keyboard and screen-reader users are never trapped behind a gesture they cannot perform.
- Touch targets ≥ 48×48 CSS px with ≥ 8 px separation.
- Coaching state changes announce through `aria-live="polite"`, debounced to 1.5 s.
- The letter is real, selectable, screen-readable DOM text — never an image, never canvas.
- `<html lang>` set to the actual language of the letter (`id` if the copy is Indonesian).
- Semantic landmarks; the camera preview carries `aria-hidden="true"` with a text description of what it is showing.

## Audio controls

- Persistent mute toggle from Scene 1 onward, state in `localStorage` (`bloom_muted`).
- Music fades in over 800 ms; never starts at full volume.
- If the music has lyrics, the lyric text ships as visible optional text. Instrumental is preferred and recommended.
- All sound is decorative — no information is conveyed by audio alone.

---

# Security & Privacy

## Camera privacy notice

Shown on the **pre-flight screen**, before the permission prompt — placement matters as much as wording:

> **"Your camera stays on your phone."**
> *No photos. No video. No uploads. Nothing is saved anywhere. The magic all happens right here, on this screen. 🌷*

**The technical guarantee that makes this true, and how it is enforced:**

- Zero `fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon` calls after initial asset load.
- Enforced structurally by CSP `connect-src 'self'`.
- No third-party scripts. No analytics. No tag manager. No fonts from a CDN.
- The captured photo lives in an in-memory canvas and is written to disk **only** when the user taps *Save our photo*.
- The video stream is never recorded, never encoded, never persisted.

This is also the highest-leverage conversion copy in the product. It should be written and placed with the same care as the letter.

## Headers and policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';        /* MediaPipe needs wasm-unsafe-eval */
  style-src 'self' 'unsafe-inline';            /* or a nonce, if Next allows cleanly */
  img-src 'self' data: blob:;
  media-src 'self' blob:;
  font-src 'self';
  connect-src 'self';                          /* THE privacy guarantee, enforced */
  worker-src 'self' blob:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'none'

Permissions-Policy: camera=(self), microphone=(), geolocation=(),
                    interest-cohort=(), payment=()
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Robots-Tag: noindex, nofollow
```

## Robots and discoverability

- `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">`
- `robots.txt`: `User-agent: * / Disallow: /`
- `X-Robots-Tag` header (defence in depth — the meta tag alone is not honoured by every crawler)
- **No sitemap.**

## URL strategy

- Deploy the experience at a **random, unguessable path**: `bloom-delivery.vercel.app/d/7fq2m9x`.
- The **root path returns a neutral 404 or placeholder** — it must not reveal or link to the experience.
- **Link-preview control is mandatory and easily missed.** WhatsApp, Instagram, and iMessage generate preview cards from Open Graph tags. If those tags contain the recipient's name or the message, **the surprise is spoiled in the chat thread before the link is ever tapped.**

```
og:title       "A delivery is waiting 🌷"      <- teasing, never the message
og:description "But it only opens for two."
og:image       a generic kawaii flower-box illustration
               (NO recipient name, NO letter text, NO photo)
twitter:card   summary_large_image
```

## Letter payload protection

The letter text ships inside the JS bundle. Anyone with the URL can read it via View Source without ever making a heart.

- Store the letter **base64-encoded and XOR-obfuscated**, decoded only on the `LETTER_OPEN` transition.
- **This is explicitly not security.** It is a spoiler guard against casual View Source. It is documented as such so nobody later mistakes it for protection.
- Real secrecy would require a backend, which the project has correctly decided not to build. The URL secrecy above is the actual control.

## Input sanitization

The optional recipient name arrives as `?to=`:

```
input  = new URLSearchParams(location.search).get('to')
valid  = /^[\p{L}\p{M}\s'’-]{1,24}$/u
name   = (input && valid.test(input)) ? input : 'Someone Special'
```

- Rendered exclusively as a **text node**. Never `innerHTML`, never `dangerouslySetInnerHTML`.
- Unicode-aware (`\p{L}\p{M}`) so non-Latin names work.
- Length capped at 24 to prevent layout destruction.
- Five lines. **This is the entire job Zod was carrying, which is why Zod was removed.**

## Data at rest

Only `localStorage`, only these keys, all non-sensitive:

| Key | Value | Purpose |
|---|---|---|
| `bloom_unlocked` | `'1'` | route returning visitors to `RESTING` |
| `bloom_muted` | `'0' \| '1'` | audio preference |
| `bloom_motion` | `'full' \| 'reduced'` | motion preference override |
| `bloom_peeked` | `'1'` | solo-peek acknowledgement |

Every read is wrapped in `try/catch` — private mode, blocked site data, and thumbnail-capture contexts can all throw on access.

---

# MVP Scope

## Must Have — no launch without these

| Feature | Why |
|---|---|
| Boot capability routing (Full / Lite / Blocked) | Every downstream decision depends on it |
| Landing + audio unlock | The only reliable user gesture for the `AudioContext` |
| Pre-flight screen with privacy notice | Materially raises permission grant rate; buys 6 s of download |
| **In-app browser interstitial** | Otherwise the primary distribution channel silently fails |
| Camera acquisition with full error taxonomy | 6 distinct `getUserMedia` rejections, 6 distinct responses |
| Platform-specific permission-denial recovery | A generic retry button is a no-op on iOS |
| Two-face detection with the togetherness latch | The core mechanic |
| Coaching HUD (8 states, `aria-live`) | Converts a coin-flip into a reliable gate |
| G1 two-hand heart detection | The primary gesture |
| Smoothing + hysteresis + 900 ms hold | Without these the gate is unusable, not merely imperfect |
| **Three-stage mercy escalation + escape hatch** | The gift must always arrive |
| **Solo path** | The most likely first open |
| Explicit FSM with the `canUnlock` idempotency guard | Enforces "execute once" and kills double-fire races |
| Full teardown at `UNLOCKING` | Camera light off, memory freed, thermals reset |
| 3D delivery sequence within budget | The payoff |
| Message + letter reveal | The point of the entire project |
| `RESTING` scene | v1 had no ending |
| `localStorage` unlock persistence | One accidental refresh currently destroys everything |
| Replay + read-again | Second viewings are guaranteed to happen |
| Reduced-motion variants | Real harm; also cheap |
| Contrast rule enforcement | `#111` only for text |
| Privacy notice, CSP, robots, OG-tag control | Spoiler and exposure control |
| Recipient-name sanitization | 5 lines |
| Lite (2D) fallback path | Insurance for every capability failure |
| `?debug=1` overlay | Tuning is impossible without it |
| Landmark fixture tests | Makes tuning a 10-second loop |
| Error boundary + fatal screen with route to the letter | The no-dead-end invariant |
| WebGL context-loss handling | Common on mobile |

## Should Have — ship if the schedule holds

| Feature | Why it is not Must |
|---|---|
| G2 / G3 finger-heart variants | Meaningful reliability gain, but the mercy hatch already prevents dead ends |
| Music + SFX | Large emotional multiplier; the experience survives muted |
| Photo capture + local composite + download | High keepsake value; the gift lands without it |
| Envelope unfold animation | A crossfade reveals the same letter |
| Ambient brightness coaching | Nice diagnosis; darkness is already covered by mercy |
| Tripod Mode (landscape + both-hands) | Serves a real minority pose |
| Degradation ladder (full 4 rungs) | Two rungs (`dpr`, particle count) are Must; the rest is refinement |
| Colophon / attributions page | Required only if OpenMoji or attributed assets ship |

## Nice To Have — only with genuine slack

| Feature | Note |
|---|---|
| Confetti sting on `TOGETHER_CONFIRMED` | Lovely; ~2 hours |
| Idle "peek" animations on `RESTING` | Polish |
| Petal cursor/touch trail | Delightful, real GPU cost, first thing cut |
| Multiple letter pages | Only if the letter is long |
| Seasonal flower variants | Scope creep in disguise |

## Future — explicitly out of MVP

| Feature | Why deferred |
|---|---|
| Web Worker + `OffscreenCanvas` detection | Only if the device lab shows measured jank |
| Multi-recipient configuration / a builder UI | Requires a backend; different product |
| Video capture of the moment | `MediaRecorder` + compositing is a project of its own |
| Web Share API integration | Sharing a private letter is a product decision, not a feature |
| Pose detection for a full-body heart | Third model, third download, no |
| i18n framework | Ship one language; a second is a copy file, not a system |
| PWA / offline install | Marginal for a one-shot link |
| WebGPU renderer | Not portable enough in 2026 |

---

# Delivery Plan

Estimates assume **one experienced full-stack/frontend engineer**, working days.

Two tracks are given because the deadline for a gift is usually not negotiable.

## Phase 0 — Feasibility Spike (2–3 days) · **DO THIS FIRST**

**Goals** — prove the geometry before building anything on top of it.

**Deliverables**
- A throwaway page: camera + `HandLandmarker` + `FaceDetector`, landmark overlay, live numeric readout of `S`, C1–C7, face count.
- Recorded fixtures: 10–15 clips per §Detection Specification.
- A measurement report: hand palm-scale `S` at arm's length, on three real devices, in daylight and evening light.
- First-pass calibration of every threshold in §Detection Specification.

**Risks**
- `S < 0.045` at the intended distance → the two-hand heart is not viable as primary and G2 must be promoted. **This is exactly what the spike exists to discover.**
- MediaPipe GPU delegate fails on the target iPhone → CPU fallback, re-measure inference time.

**Exit criteria** — all must pass:
- [ ] `S >= 0.045` for both hands at selfie distance on all three devices
- [ ] G1 true-positive ≥ 80% over 20 attempts in good light
- [ ] G1 true-positive ≥ 60% over 20 attempts in evening light
- [ ] G1 false-positive = 0 over 20 attempts of clasped hands / high-five / open palms
- [ ] Combined inference ≤ 60 ms on the slowest device
- [ ] Face detection ≥ 90% with both people looking at the camera

**If Phase 0 fails, the detection strategy changes before Phase 1 begins.** That is a two-day cost instead of a three-week one.

## Phase 1 — Shell, FSM, Foundations (3 days)

**Goals** — the skeleton every other phase hangs on.

**Deliverables** — Next.js 15 + TS strict; **R3F v9 / React 19 compatibility verified and pinned**; design tokens with the contrast rule encoded; Fredoka + Plus Jakarta Sans via `next/font`; the complete FSM reducer + transition table + guards with illegal-transition assertions; the typed event bus; Zustand store; error boundary; `motionSafe` provider; `?debug=1` scaffold; bundle-budget CI check; all scenes present as placeholders wired to the FSM.

**Risks** — R3F/React 19 version conflict (mitigated by verifying on day 1); over-abstracting the FSM.

**Exit criteria**
- [ ] Every state reachable via debug controls; every illegal transition throws in dev
- [ ] `canUnlock` proven idempotent by test (10 concurrent `HOLD_COMPLETE` events → one transition)
- [ ] Reduced-motion toggle demonstrably affects a test animation
- [ ] Bundle budget check fails the build when deliberately exceeded

## Phase 2 — Camera, Permissions, Environment (4 days)

**Goals** — get to a reliable live preview on real phones, and handle every way that fails.

**Deliverables** — boot capability routing; in-app-browser interstitial (Android `intent://`, iOS copy-link + illustrated instructions); `getUserMedia` with the full error taxonomy; three platform-specific denial-recovery screens; pre-flight screen with the privacy notice; video element with `playsInline muted autoPlay` + mirror; track lifecycle handling (`onmute`/`onended`/`visibilitychange`); teardown utility with an assertion that the camera light is off; HTTPS tunnel dev workflow.

**Risks** — iOS denial is unrecoverable in-page (design constraint, not a bug); in-app browsers behave inconsistently across app versions.

**Exit criteria**
- [ ] Live preview on a real iPhone and a real Android, over a tunnel and over a Vercel preview
- [ ] All six `getUserMedia` errors produce distinct, correct screens (forced via debug)
- [ ] Interstitial verified in WhatsApp, Instagram, and one more in-app browser
- [ ] Teardown verified: camera indicator light off, tracks `ended`, no leaked loop

## Phase 3 — Face Stage + Coaching (3 days)

**Deliverables** — self-hosted vision assets; split face/hand model loading with real progress; 15 Hz detection loop with adaptive cadence; face gate with N-of-M and the togetherness latch; the 8-state coaching HUD with `aria-live`; luma brightness check; solo path with `SOLO_PROMPT` and the peek-alone branch; ref-based HUD with a re-render counter proving ≤ 2 renders/second.

**Risks** — model download UX on slow networks (mitigated by staging); background loading of the hand model competing with the face stage.

**Exit criteria**
- [ ] Two faces reliably latch within 3 s in normal light on all lab devices
- [ ] Coaching state matches ground truth for every fixture clip
- [ ] Re-render counter shows ≤ 2/second during detection
- [ ] Solo path reachable and both branches correct
- [ ] Camera preview visible ≤ 2.5 s after grant on 4G

## Phase 4 — Gesture Stage + Tuning + Mercy (5–8 days) · **HIGHEST RISK**

**Deliverables** — G1 implementation exactly per spec; smoothing, hysteresis, hold timer with grace and decay; progress ring UI; G2 and G3; the three-stage mercy escalation with pause-on-hidden; escape hatch (DOM-present from t=0, revealed at 45 s); landmark fixture unit tests; full `?debug=1` readout; **threshold calibration against fixtures, then against real people.**

**Risks** — the wide estimate is honest: this is the only phase whose duration depends on empirical tuning. Two people's hands defeating MediaPipe's assumptions. Real-world lighting. False positives found late.

**Exit criteria**
- [ ] G1 true-positive ≥ 85% within 20 s, over 20 attempts by 3 different pairs
- [ ] False-positive = 0 across all rejection fixtures
- [ ] Mercy escalation verified at all four levels, including pause-on-background
- [ ] Escape hatch reachable by keyboard at t=0
- [ ] Fixture test suite green and running in CI

**Contingency:** if true-positive stays below 70% after 8 days, promote G2 to primary, re-coach to the finger heart, and move mercy level 1 to t=10 s. **Take this decision at day 8 and do not let it slide** — the gate is not the gift.

## Phase 5 — Unlock, Teardown, Lite Path (3 days)

**Deliverables** — `UNLOCKING` with the full teardown sequence and frame capture; darken + shake + single-bloom flash (reduced-motion twin); "DELIVERY UNLOCKED" card; **the complete Lite 2D sequence**, wired to every failure route; `SKIP_TO_LETTER` from every failure state.

**Risks** — teardown races with in-flight inference (mitigated: cancel the loop before closing tasks); Lite getting deprioritised, which would leave every fallback path broken.

**Exit criteria**
- [ ] Camera indicator light off within 500 ms of unlock, verified visually on hardware
- [ ] JS heap drops measurably after teardown (Chrome DevTools)
- [ ] Every failure state reaches the letter via Lite
- [ ] `canUnlock` prevents a second `UNLOCKING` even when `HOLD_COMPLETE` and `MERCY_UNLOCK` fire in the same tick

## Phase 6 — 3D Delivery + Bloom (6–8 days)

**Deliverables** — authored low-poly tulip, box, petal assets through the `gltf-transform` pipeline; R3F scene with inverted-hull outlines; box fall / land / open choreography; instanced tulip field; instanced petal pool (pre-allocated); faked bloom (additive sprites + CSS gradient); degradation ladder; `webglcontextlost` handling; `frameloop="demand"` idle.

**Risks** — modelling time is easy to underestimate if you are not fluent in Blender (consider commissioning); the temptation to add postprocessing.

**Exit criteria**
- [ ] ≥ 30 fps sustained on the slowest lab device; ≥ 55 fps on Tier 1
- [ ] Triangle, draw-call, and particle budgets all met (measured, not estimated)
- [ ] Zero allocations in `useFrame` (verified by an allocation profile)
- [ ] Degradation ladder fires correctly under artificial throttling
- [ ] Reduced-motion variant complete for every beat

## Phase 7 — Message, Letter, Resting, Replay (3 days)

**Deliverables** — message reveal; envelope unfold (+ crossfade twin); letter as real selectable DOM text; obfuscated payload decode; `RESTING` with three actions; `localStorage` persistence + returning-visitor routing; replay and read-again transitions; photo composite and local download.

**Risks** — letter typography on a 375 px screen; photo composite orientation and mirroring bugs.

**Exit criteria**
- [ ] Letter readable at 375 px and at 200% zoom without horizontal scroll
- [ ] Letter is selectable text and announced correctly by VoiceOver
- [ ] Returning visit routes to `RESTING`; replay never re-requests the camera
- [ ] Saved photo is correctly oriented and un-mirrored

## Phase 8 — Audio (2 days)

**Deliverables** — `AudioContext` unlock on the Scene-1 tap; Howler with the SFX sprite sheet; music with an 800 ms fade-in; persistent mute; visibility-change duck/resume; ringer-switch hint copy.

**Risks** — iOS audio is historically the buggiest surface in any web experience; budget the full two days on device.

**Exit criteria**
- [ ] Music plays on a real iPhone after the full ~45 s gap from the Start tap
- [ ] Backgrounding and returning restores audio correctly
- [ ] Mute persists across reload
- [ ] Ringer-switch-off behaviour is understood and explained by the UI

## Phase 9 — Hardening, Device Lab, Rehearsal (4 days)

**Deliverables** — device lab pass (older iPhone, mid-range Android, flagship, desktop); **night-time test**; in-app-browser matrix; 4G throttled test; security headers verified in production; OG preview verified in a real chat app; Playwright smoke test with `--use-file-for-fake-video-capture`; full accessibility pass (VoiceOver, keyboard, reduced motion, contrast audit); **a complete end-to-end rehearsal on the recipient's actual phone model, at the actual time of day, with the actual link**; a one-page runbook for what to do if it breaks live.

**Risks** — finding a Phase-4-level problem here. This is why Phase 0 exists.

**Exit criteria**
- [ ] Green on all four lab devices, including the night-light test
- [ ] Link preview in WhatsApp shows the teaser, never the message
- [ ] Lighthouse: performance ≥ 85 mobile, accessibility ≥ 95
- [ ] Full run completes in ≤ 180 s
- [ ] Rehearsal completed by two people who have never seen it, with no verbal help

## Schedule summary

| Track | Scope | Days | Calendar (solo) |
|---|---|---|---|
| **Full** | All phases, 3D delivery, audio, photo capture | 31–39 | **7–8 weeks** |
| **Compressed** | Phases 0–5, 7, 9. Lite 2D as the *primary* sequence; audio reduced to 3 SFX; no photo capture; G2 promoted to primary gesture | 17–21 | **4 weeks** |

The Compressed track is a genuine product, not a degraded one: it keeps the mechanic, the mercy design, the letter, the art direction, and every fallback. It trades only the 3D dimension. **Decide which track you are on before Phase 1**, and if there is a fixed date, start on Compressed and upgrade with slack rather than descoping under pressure.

---

# Final Architecture Verdict

### 1. Is the original concept still viable?

**Yes — and it is stronger than it was.** The idea that a gift refuses to open for one person is genuinely good, and nothing in the engineering analysis threatened it. What threatened it was the *implementation* of that idea: a simultaneous four-condition gate, on a handheld phone, with no escape.

Two changes made it viable: the **togetherness latch** (prove two faces once, remember it) and **one hand each** (which fits the actual physical pose and is more intimate). Both were forced by engineering constraints and both improved the product. That is usually the sign that the constraints were real.

### 2. What must change?

Ranked by consequence:

1. **A mercy path must exist.** No exceptions. The single most important line in this document is that the gift always arrives.
2. **The gesture must be one hand from each person, with the two-face requirement latched rather than continuous.** This is the change that makes the concept physically possible.
3. **Camera and 3D must never run simultaneously.** Everything else about performance follows from this.
4. **`@mediapipe/tasks-vision`, self-hosted.** Not the deprecated legacy Solutions, not a CDN.
5. **A real FSM with a synchronous `canUnlock` latch.** Zustand booleans will produce double-fires.
6. **The in-app browser interstitial.** Your distribution channel is broken without it.
7. **A formal gesture spec with square-corrected coordinates and palm-scale normalization.** "Detect heart gesture" is not a requirement.
8. **Authored low-poly assets under a hard budget**, not downloaded ones.
9. **The solo path, persistence, replay, and a resting scene.** v1 had no ending and no memory.
10. **Reduced motion, the `#111`-only text rule, OG-tag control, and `connect-src 'self'`.** All cheap; all real.

### 3. What must stay?

- **The core mechanic.** Untouched.
- **Cute Kawaii + Neo Brutalism.** Untouched — and now the cheapest thing to render.
- **Portrait, mobile-first, arm's-length selfie.** The landscape recommendation was wrong.
- **3D flowers.** Budgeted, not cut.
- **Bouncy, overshooting, juicy motion.** With a reduced-motion twin, not a reduction.
- **Frontend-only, no backend, no analytics, no telemetry.** Including the refusal of the error beacon — the privacy promise is worth more.
- **The letter.** It is the entire point and it is the cheapest thing in the document. Spend the most care on it.

### 4. What is the highest-risk component?

**The heart gesture detector — specifically, whether hands are physically large enough in frame at the pose people naturally adopt.**

Everything else in this project is bounded engineering with known solutions. Only this one has an outcome that no amount of code quality can guarantee, because it depends on optics, human posture, and a model's tolerance. It is also the only component whose failure was, in v1, unrecoverable.

It carries three independent risks that compound: hand size in frame, ambient light, and false positives from adjacent poses. It is why Phase 0 exists, why the mercy escalation exists, why G2 exists, and why the escape hatch is in the DOM from t=0.

**Second-highest:** the in-app browser problem — lower technical difficulty, but it fails *before* any of your code runs and it fails silently.

### 5. What should be prototyped first?

**Phase 0, and nothing else. Do it this week, before writing a line of production code.**

A throwaway page: camera, `HandLandmarker`, landmark overlay, live readout of `S` and C1–C7. Then stand with someone in the actual pose, in the actual room, at the actual time of evening, on the actual phone. Measure.

The single number that governs this project is **`S` — the palm scale in frame-width units at arm's length.**

- If `S ≥ 0.045`: build exactly what this document specifies.
- If `S < 0.045`: promote G2 (one-hand finger heart) to primary, re-coach the gesture, and move the first mercy step to t=10 s.

That is a two-day answer to a question that would otherwise be discovered in week four, with a Phase-6 3D scene already built on top of it.

### 6. What can be postponed?

**Safely postponed, in order of confidence:**

- Web Worker detection — only if the device lab proves it is needed
- Photo capture and local composite
- Music and full SFX (ship with 3 sounds, add the rest)
- The envelope unfold (a crossfade reveals the same words)
- Tripod Mode
- Degradation ladder rungs 3 and 4
- Ambient particles at rest, cursor trails, idle animations
- The full 3D sequence itself, via the Compressed track — the Lite 2D sequence is a complete experience

**Cannot be postponed, no matter the schedule pressure:**

- The mercy path and the escape hatch
- The teardown at unlock
- The `canUnlock` idempotency guard
- The in-app browser interstitial
- The permission-denial recovery screens
- Reduced motion
- The Lite fallback path
- `?debug=1` and the landmark fixture tests

Those last two look like developer conveniences. They are not — they are what makes Phase 4 finish on time, and Phase 4 is the phase that decides whether this ships.

---

## Appendix A — Open decisions for the author

| # | Decision | Needed by | Default if unanswered |
|---|---|---|---|
| 1 | Full track (7–8 weeks) or Compressed (4 weeks)? | Before Phase 1 | Compressed, upgrade with slack |
| 2 | Letter language, and therefore `<html lang>` | Phase 7 | Match the letter copy |
| 3 | Recipient name: hardcoded or `?to=`? | Phase 1 | Hardcoded (simpler, no sanitization surface) |
| 4 | Is there a fixed date? (birthday, anniversary) | **Now** | Assume yes; plan Compressed |
| 5 | Can you model in Blender, or should the 3D assets be commissioned? | Before Phase 6 | Commission, or take the Compressed track |
| 6 | Recipient's exact phone model | Before Phase 0 | Buy/borrow the closest match for the lab |
| 7 | Music track and its licence | Phase 8 | Instrumental, licence confirmed before ship |

## Appendix B — Changes from v1, indexed

| v1 statement | v2 disposition |
|---|---|
| "Detect exactly two faces" | → `>= 2`, latched once, not continuous |
| "Two hands visible" | → 2 hands, one per person, `numHands: 2` |
| "Heart gesture detected" | → formal G1/G2/G3 spec with landmark math |
| "Sequence must execute once. No retriggering." | → kept as the `canUnlock` guard; replay explicitly added |
| "Freeze detection" | → full teardown, with assertions |
| "MediaPipe Hands / Face Detection" | → `@mediapipe/tasks-vision`, self-hosted |
| "Zod" | → removed |
| "Initial load < 3 seconds" | → Scene 1 only; staged loading schedule for the rest |
| "60 FPS target" | → 60 target, **30 floor**, 4-rung degradation ladder |
| "Particles animate continuously" | → ≤ 300 pooled instances, tapering to a demand-driven idle |
| "Sketchfab / Poly Pizza" | → authored low-poly; those sources dropped for hero assets |
| "No analytics in MVP" | → kept, strengthened to `connect-src 'self'`; local diagnostics instead |
| "If denied: show friendly retry state" | → three platform-specific recovery screens |
| Phase 8 "Optimization" | → renamed Hardening; budgets enforced from Phase 1 |
| *(absent)* | → mercy escalation, solo path, resting scene, persistence, replay, photo capture, Lite tier, in-app interstitial, reduced motion, contrast rule, CSP, OG control, FSM spec, fixture tests, debug mode, Phase 0 |
