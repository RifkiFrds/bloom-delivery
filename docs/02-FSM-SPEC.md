# DOCUMENT 2 — FINITE STATE MACHINE SPECIFICATION

**Project:** Bloom Delivery
**Doc version:** 2.0 — rewritten against PRD v2
**Source of truth:** [`PRD-V2.md`](./PRD-V2.md) §State Machine Specification
**Machine:** hand-rolled pure reducer + frozen transition table, hosted in Zustand. **No XState.**
**Initial state:** `BOOT`
**Related:** [`01-SYSTEM-DESIGN.md`](./01-SYSTEM-DESIGN.md) · [`03-DETECTION-ALGORITHM.md`](./03-DETECTION-ALGORITHM.md) · [`04-UIUX-SCREEN-SPEC.md`](./04-UIUX-SCREEN-SPEC.md)

**Why hand-rolled.** 21 states, no parallel regions, no history nodes, no actors, no invoked services. A frozen transition table plus a pure reducer is ~150 lines with zero new dependencies, and the project's own engineering standard is *"avoid unnecessary dependencies."*

**The two rules that make this machine correct:**

1. **Any `(state, event)` pair not in the transition table is illegal.** In development the reducer **throws**; in production it appends to the diagnostic buffer and returns state unchanged. This is how PRD v1's *"sequence must execute once, no retriggering"* is actually enforced.
2. **`canUnlock` sets `hasUnlocked = true` synchronously, inside the reducer, before any effect runs.** This is the single most important guard in the app and it is what kills every double-fire race.

---

## 0. State-name mapping

The original engineering request named 15 states. PRD v2 supersedes that list with 21. Nothing requested was dropped — several were split, because splitting them is what makes the recovery paths expressible.

| Requested name | PRD v2 state(s) | Note |
|---|---|---|
| `LANDING` | `LANDING` | plus `BOOT` upstream |
| `PREFLIGHT` | `PREFLIGHT` | |
| `REQUEST_PERMISSION` | `REQUESTING_CAMERA` | |
| `CAMERA_INITIALIZING` | `LOADING_DETECTION` | renamed: the wait is model loading, not camera init |
| `WAITING_FOR_FACES` | `SEEKING_FACES` (+ `SOLO_PROMPT`, `TOGETHER_CONFIRMED`) | split: solo branch and the latch beat are distinct |
| `WAITING_FOR_GESTURE` | `SEEKING_GESTURE` | |
| `GESTURE_HOLDING` | `GESTURE_HOLDING` | |
| `DELIVERY_UNLOCKED` | `UNLOCKING` | renamed: it is a teardown, not a celebration |
| `FLOWER_SEQUENCE` | `DELIVERY` + `BLOOM` | split: two beats with different budgets |
| `MESSAGE_REVEAL` | `MESSAGE` | |
| `LETTER_CLOSED` | `LETTER_CLOSED` | |
| `LETTER_OPEN` | `LETTER_OPEN` | |
| `REPLAY` | `RESTING` + `REPLAY_TAPPED` transition | replay is an action from a hub state, not a state |
| `ERROR` | `CAMERA_DENIED`, `CAMERA_ERROR`, `FATAL_ERROR` | split: three genuinely different recoveries |
| `FALLBACK` | `BLOCKED_ENVIRONMENT` + `renderTier='lite'` routing | Lite is a tier, not a state |
| *(new)* | `CAMERA_INTERRUPTED` | transient recovery, resumes to the previous state |

---

## 1. State Diagram

```
   ┌──────┐ ENV_BLOCKED  ┌──────────────────────┐ SKIP_TO_LETTER
   │ BOOT │─────────────▶│ BLOCKED_ENVIRONMENT  │───────────────┐
   └──┬───┘              └──────────────────────┘               │
      │ BOOT_OK                                                 │
      │  ├─[localStorage bloom_unlocked]──────────────▶ RESTING │
      │  ├─[!canRenderFull] renderTier='lite' ──┐               │
      │  └─────────────────────────────────────┐│               │
      ▼                                        ▼▼               │
  ┌─────────┐ START_TAPPED  ┌───────────┐ PREFLIGHT_CONTINUE    │
  │ LANDING │──────────────▶│ PREFLIGHT │──────────────┐        │
  └─────────┘  unlock audio └───────────┘  prefetch    │        │
                             hand model               ▼        │
                                        ┌────────────────────┐ │
                                        │ REQUESTING_CAMERA  │ │
                                        └──┬────────┬────────┘ │
                     PERMISSION_GRANTED    │        │ PERMISSION_DENIED
                                           ▼        ▼          │
                            ┌──────────────────┐  ┌───────────────┐
                            │ LOADING_DETECTION│  │ CAMERA_DENIED │
                            └──┬────────┬──────┘  └───────┬───────┘
                  MODELS_READY │        │ MODELS_FAILED   │ RETRY_CAMERA
                               │        ▼                 └──▶ REQUESTING_CAMERA
                               │   ┌──────────────┐
                               │   │ CAMERA_ERROR │──SKIP_TO_LETTER──┐
                               │   └──────────────┘                  │
   ┌───────────────────────────▼──────────────────────────────────┐  │
   │  PHASE A — THE GATE                              (camera on) │  │
   │                                                              │  │
   │   ┌──────────────┐  SOLO_TIMEOUT   ┌─────────────┐           │  │
   │   │ SEEKING_FACES│────────────────▶│ SOLO_PROMPT │           │  │
   │   │              │◀────────────────│             │           │  │
   │   └──────┬───────┘ WAIT_FOR_PARTNER└──────┬──────┘           │  │
   │          │ FACES_ACQUIRED                 │ PEEK_ALONE       │  │
   │          │  ▼ latch togetherConfirmed     │ [canUnlock]      │  │
   │   ┌──────────────────────┐                │                  │  │
   │   │ TOGETHER_CONFIRMED   │◀───────────────┘ FACES_ACQUIRED   │  │
   │   │ 1.2 s (→5 s if model │                                   │  │
   │   │  still loading)      │                                   │  │
   │   └──────┬───────────────┘                                   │  │
   │          │ SEQUENCE_STEP_DONE [canSeekGesture]               │  │
   │          ▼                                                   │  │
   │   ┌──────────────────┐  GESTURE_ENTER  ┌──────────────────┐  │  │
   │   │ SEEKING_GESTURE  │────────────────▶│ GESTURE_HOLDING  │  │  │
   │   │  MERCY_TICK ↺    │◀────────────────│  ring filling    │  │  │
   │   └────────┬─────────┘  GESTURE_EXIT   └────────┬─────────┘  │  │
   │            │ MERCY_UNLOCK [canUnlock]           │ HOLD_COMPLETE│ │
   │            │                                    │ [canUnlock]  │ │
   │   ┌────────▼──────────────┐                     │            │  │
   │   │ CAMERA_INTERRUPTED    │◀─TRACK_MUTED/ENDED──┤            │  │
   │   │ mercy timers PAUSED   │──TRACK_RECOVERED───▶│(previous)  │  │
   │   └───────────────────────┘                     │            │  │
   └─────────────────────────────────────────────────┼────────────┘  │
                                                     ▼               │
                            ╔════════════════════════════════════╗   │
                            ║ UNLOCKING   (TEARDOWN BOUNDARY)    ║◀──┘
                            ║ capture frame · cancel rAF ·       ║
                            ║ stop tracks · close tasks · assert ║
                            ╚═══════════════┬════════════════════╝
                                            │ SEQUENCE_STEP_DONE
   ┌────────────────────────────────────────▼─────────────────────┐
   │  PHASE B — THE GIFT                             (WebGL on)   │
   │  ┌──────────┐    ┌───────┐    ┌─────────┐                    │
   │  │ DELIVERY │───▶│ BLOOM │───▶│ MESSAGE │                    │
   │  └──────────┘    └───┬───┘    └────┬────┘                    │
   │                      │ [peekedAlone]     │                   │
   │                      └──────────────┐    ▼                   │
   │                                     │  ┌───────────────┐     │
   │                                     │  │ LETTER_CLOSED │     │
   │                                     │  └───────┬───────┘     │
   │                                     │          │ LETTER_OPEN_TAPPED
   │                                     │          ▼             │
   │                                     │  ┌─────────────┐       │
   │                                     │  │ LETTER_OPEN │       │
   │                                     │  └──────┬──────┘       │
   │                                     ▼         ▼              │
   │                                  ┌──────────────────┐        │
   │                                  │     RESTING      │        │
   │                                  │  Read again ─────┼──▶ LETTER_OPEN
   │                                  │  Replay ─────────┼──▶ UNLOCKING
   │                                  │  Save photo ─────┼──▶ self
   │                                  └──────────────────┘        │
   └──────────────────────────────────────────────────────────────┘

   ── Global ──────────────────────────────────────────────────────
   any ─FATAL──▶ FATAL_ERROR ─SKIP_TO_LETTER──▶ LETTER_OPEN (Lite)
   any ─CONTEXT_LOST [restore fails]──▶ self, renderTier='lite', remount
   any ─VISIBILITY_HIDDEN / VISIBILITY_VISIBLE──▶ self (pause/resume)
```

---

## 2. States

Notation: **E** entry · **X** exit · **T** timers armed on entry.

---

### 2.1 `BOOT`

| | |
|---|---|
| **Purpose** | Decide Full / Lite / Blocked / Returning before any UI commits. |
| **Entry** | E1 probe `window.isSecureContext` · E2 probe `navigator.mediaDevices?.getUserMedia` · E3 probe WebGL2 context creation · E4 UA in-app-browser substring match · E5 read the four localStorage keys inside `try/catch` · E6 read `prefers-reduced-motion` → `motionSafe` (overridden by `bloom_motion`) · E7 parse and sanitize `?to=` · E8 set `renderTier` |
| **Exit** | X1 none — `BOOT` renders nothing |
| **Timers** | none. Must exit within ~100 ms. |
| **Events** | `BOOT_OK`, `ENV_BLOCKED`, `FATAL` |
| **Transitions** | `BOOT_OK` [`bloom_unlocked === '1'`] → `RESTING` · `BOOT_OK` [`!canRenderFull`] → `LANDING` with `renderTier='lite'` · `BOOT_OK` → `LANDING` · `ENV_BLOCKED` → `BLOCKED_ENVIRONMENT` |
| **Invariant** | No UI paints during `BOOT`. No permission is requested. `navigator.permissions.query` is **never** called — it is unsupported in Safari and no path may depend on it. |

---

### 2.2 `BLOCKED_ENVIRONMENT`

| | |
|---|---|
| **Purpose** | In-app browser, insecure context, or absent `mediaDevices`. Terminal-with-escape. |
| **Entry** | E1 render the interstitial matched to the reason · E2 for in-app browsers, prepare the platform-correct escape: Android `intent://`; iOS **copy link + illustrated `•••` → Open in Safari** for that specific app · E3 render **[ Just show me the flowers ]** |
| **Exit** | X1 none |
| **Timers** | none |
| **Events** | `SKIP_TO_LETTER`, `FATAL` |
| **Transitions** | `SKIP_TO_LETTER` → `DELIVERY` with `renderTier='lite'` |
| **Rule** | **Do not ship a button that pretends to work.** On iOS there is no programmatic escape from a WebView; the copy must say so and the illustration must show the real menu position. |

---

### 2.3 `LANDING`

| | |
|---|---|
| **Purpose** | Hook, audio unlock, and the start of the load pipeline. |
| **Entry** | E1 render the wordmark, subtitle, **Start**, and the persistent mute toggle · E2 begin prefetch of the vision WASM runtime + `face_detector.task` (~1.5 MB) · E3 if `bloom_unlocked`, this state is not reached (BOOT routes to `RESTING`) |
| **Exit** | **X1 — the critical one.** Synchronously inside the Start click handler: create `AudioContext`, `ctx.resume()`, play a one-sample silent buffer. This is the only reliable user gesture in the entire flow and music begins ~45 s later. The context is then **kept alive for the whole session and never recreated.** |
| **Timers** | none |
| **Events** | `START_TAPPED`, `MUTE_TOGGLED`, `FATAL` |
| **Transitions** | `START_TAPPED` → `PREFLIGHT` |
| **Copy note** | Shows *"Sound on for the full effect 🔊"* — Web Audio in Safari respects the physical ringer switch and this cannot be worked around. Explaining it converts a silent experience from a bug into an understood condition. |

---

### 2.4 `PREFLIGHT`

| | |
|---|---|
| **Purpose** | Deliver the privacy promise before the prompt, set the two-person expectation, and buy ~6 s of download time. **This screen is not decoration** — it materially raises the permission grant rate, and it is the only pre-prompt intervention available because Safari does not expose permission state. |
| **Entry** | E1 render the privacy notice (§6.4) · E2 render *"Takes about a minute. Bring someone."* · E3 render the **Motion: full / reduced** toggle · E4 the vision runtime + face model continue downloading |
| **Exit** | X1 **begin prefetch of `hand_landmarker.task` (~7.5 MB)** — this is the moment that hides the largest asset in the project behind the permission prompt and the face stage |
| **Timers** | none — user-paced |
| **Events** | `PREFLIGHT_CONTINUE`, `MUTE_TOGGLED`, `FATAL` |
| **Transitions** | `PREFLIGHT_CONTINUE` → `REQUESTING_CAMERA` |

---

### 2.5 `REQUESTING_CAMERA`

| | |
|---|---|
| **Purpose** | Obtain the stream. Spinner-free; shows a reassuring illustration. |
| **Entry** | E1 call `getUserMedia` **synchronously inside the click handler** — any `await` before the call breaks iOS Safari's user-activation requirement · E2 constraints: `{video:{facingMode:'user', width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30,max:30}}, audio:false}` |
| **Exit** | X1 on success attach the stream to `<video playsInline muted autoPlay>` and bind `onmute` / `onended` track listeners · X2 arm the **120 s absolute camera timer** |
| **Timers** | none (the browser owns the prompt) |
| **Events** | `PERMISSION_GRANTED`, `PERMISSION_DENIED`, `CAMERA_FAILED`, `FATAL` |
| **Transitions** | `PERMISSION_GRANTED` → `LOADING_DETECTION` · `PERMISSION_DENIED` → `CAMERA_DENIED` · `CAMERA_FAILED` [`isTerminalCameraError`] → `CAMERA_ERROR` offering Lite · `CAMERA_FAILED` → `CAMERA_ERROR` offering retry |
| **Why `audio:false` matters** | Requesting audio triggers a scarier two-device prompt and adds a second permission to lose. |

---

### 2.6 `CAMERA_DENIED`

| | |
|---|---|
| **Purpose** | Recover a denied permission — differently on every platform, because the platforms genuinely differ. |
| **Entry** | E1 select the platform-specific screen: **iOS Safari** — a second `getUserMedia` throws `NotAllowedError` immediately with no prompt, so retry is impossible in-page; show illustrated **AA → Website Settings → Camera → Allow → [ Reload ]**. **Android Chrome** — lock-icon instructions plus a genuine **[ Try again ]**. **Desktop** — address-bar camera-icon illustration plus **[ Try again ]**. · E2 render **[ Just show me the flowers ]** on all three |
| **Exit** | X1 none |
| **Timers** | none |
| **Events** | `RETRY_CAMERA`, `SKIP_TO_LETTER`, `FATAL` |
| **Transitions** | `RETRY_CAMERA` → `REQUESTING_CAMERA` (on iOS the button is a reload instead) · `SKIP_TO_LETTER` [`canUnlock`] → `UNLOCKING` with `renderTier='lite'` |
| **Rule** | **Never a bare retry button.** On iOS it silently no-ops, which is worse than no button at all. |

---

### 2.7 `CAMERA_ERROR`

| | |
|---|---|
| **Purpose** | Hold the five non-denial `getUserMedia` failures plus model-load failure, each with its own copy. |
| **Entry** | E1 select copy by `err.name`: `NotFoundError` → *"No camera? No problem."* (straight to Lite); `NotReadableError` → *"Something else is using your camera — close it and tap below."* (retry is genuine); `OverconstrainedError` / `SecurityError` → terminal, Lite; `AbortError` → retry; `MODELS_FAILED` → *"The magic is being shy."* · E2 always render **[ Skip to the delivery ]** |
| **Exit** | X1 release any partially-acquired stream |
| **Timers** | none |
| **Events** | `RETRY_CAMERA`, `SKIP_TO_LETTER`, `FATAL` |
| **Transitions** | `RETRY_CAMERA` [`!isTerminalCameraError`] → `REQUESTING_CAMERA` · `SKIP_TO_LETTER` [`canUnlock`] → `UNLOCKING` with `renderTier='lite'` |

---

### 2.8 `LOADING_DETECTION`

| | |
|---|---|
| **Purpose** | A delightful load screen with **real** progress. Blocks on 230 KB, not on 7.5 MB. |
| **Entry** | E1 fade the mirrored camera preview in behind a translucent kawaii loader · E2 instantiate `FaceDetector` from `/public/vision/`, `runningMode: VIDEO`, GPU delegate with CPU fallback on init failure · E3 report **real** download percentage · E4 `hand_landmarker.task` continues in the background, unblocking |
| **Exit** | X1 start the 15 Hz `requestAnimationFrame` loop · X2 begin prefetch of the 3D chunk + `.glb` models |
| **Timers** | `modelTimeout` **30 s** → `MODELS_FAILED` |
| **Events** | `MODELS_READY`, `MODELS_FAILED`, `TRACK_MUTED`, `TRACK_ENDED`, `VISIBILITY_*`, `FATAL` |
| **Transitions** | `MODELS_READY` → `SEEKING_FACES` · `MODELS_FAILED` → `CAMERA_ERROR` |
| **Budget** | Camera preview visible ≤ 2.5 s after grant on 4G. |

---

### 2.9 `SEEKING_FACES`

| | |
|---|---|
| **Purpose** | Prove togetherness. Once. |
| **Entry** | E1 detection mode = face only · E2 render the mirrored preview, chunky outlined frame, and the coaching HUD · E3 coaching default: *"Stand together 💕"* · E4 arm the solo timer · E5 the escape hatch is **rendered into the DOM and keyboard-focusable**, visually hidden (it belongs to the gesture stage but must exist from the moment the camera is live for keyboard users) |
| **Exit** | X1 on `FACES_ACQUIRED`, **latch `togetherConfirmed = true` permanently for the session** |
| **Timers** | `soloTimer` **15 s** of continuous `count(faceValid) === 1` → `SOLO_TIMEOUT` · `cameraCap` 120 s absolute (armed at acquisition) |
| **Events** | `FACES_ACQUIRED`, `SOLO_TIMEOUT`, `TRACK_MUTED`, `TRACK_ENDED`, `VISIBILITY_*`, `FATAL` |
| **Transitions** | `FACES_ACQUIRED` → `TOGETHER_CONFIRMED` (+ prefetch audio) · `SOLO_TIMEOUT` → `SOLO_PROMPT` · `TRACK_MUTED`/`TRACK_ENDED` → `CAMERA_INTERRUPTED` |
| **Gate** | `count(faceValid) >= 2` — **not `== 2`** — true in ≥ 8 of the last 10 ticks (~0.67 s at 15 Hz). See Doc 3 §3. |

---

### 2.10 `SOLO_PROMPT`

| | |
|---|---|
| **Purpose** | Turn the single most likely failure — she opens the link on a bus, alone — from a broken website into anticipation. |
| **Entry** | E1 render *"Someone's missing 🌷 This one only opens for two."* · E2 two actions: **[ I'll go get them ]** and **[ Peek alone ]** · E3 detection continues running underneath |
| **Exit** | X1 on `PEEK_ALONE`, set `peekedAlone = true` and persist `bloom_peeked` |
| **Timers** | none |
| **Events** | `WAIT_FOR_PARTNER`, `PEEK_ALONE`, `FACES_ACQUIRED`, `TRACK_*`, `VISIBILITY_*`, `FATAL` |
| **Transitions** | `WAIT_FOR_PARTNER` → `SEEKING_FACES` (reset the solo timer) · `PEEK_ALONE` [`canUnlock`] → `UNLOCKING` · `FACES_ACQUIRED` → `TOGETHER_CONFIRMED` (the partner arriving always wins) |
| **Peek semantics** | The box falls and opens, tulips bloom — but `MESSAGE` and the letter stay sealed behind a warm hold: *"The rest is for when you're together 💌"*. When they later return and unlock properly, the full sequence plays with an extra line: *"There you are. Now the real one."* |

---

### 2.11 `TOGETHER_CONFIRMED`

| | |
|---|---|
| **Purpose** | A 1.2 s reward beat — and the load buffer that guarantees the hand model is ready. Both purposes are deliberate. |
| **Entry** | E1 confetti pop + sound sting · E2 copy: *"There you are! 💕"* · E3 begin prefetch of audio (music + SFX sprite, ~950 KB) · E4 if `hand_landmarker.task` is still in flight, extend the beat and swap the copy to *"warming up the magic ✨"* |
| **Exit** | X1 enable the hand model in the detection loop · X2 `gestureStageEnteredAt = now`; `mercyLevel = 0` |
| **Timers** | `beat` **1.2 s**, extending to a maximum of **5 s** while `!handModelReady` |
| **Events** | `SEQUENCE_STEP_DONE`, `HAND_MODEL_READY`, `TRACK_*`, `VISIBILITY_*`, `FATAL` |
| **Transitions** | `SEQUENCE_STEP_DONE` [`canSeekGesture`] → `SEEKING_GESTURE` |
| **Guard** | `canSeekGesture = togetherConfirmed && handModelReady`. **Never enter the gesture stage without the model** — a gesture stage that cannot see hands is indistinguishable from a broken product. |

---

### 2.12 `SEEKING_GESTURE`

| | |
|---|---|
| **Purpose** | The gate, plus the mercy escalation that guarantees it is never a wall. |
| **Entry** | E1 detection mode = face + hands · E2 copy: *"Now make a heart — one hand each 💗"* with a small animated diagram · E3 render the progress ring around the frame (empty) · E4 start the mercy timers · E5 reveal nothing yet — the escape hatch stays visually hidden but focusable |
| **Exit** | X1 none (the ring persists into `GESTURE_HOLDING`) |
| **Timers** | `mercy1` **20 s** · `mercy2` **45 s** · `mercy3` **90 s** — all measured in *active* time, **paused** on `VISIBILITY_HIDDEN` and `CAMERA_INTERRUPTED`. A phone call must not cost the user their patience budget. · `cameraCap` 120 s absolute |
| **Events** | `GESTURE_ENTER`, `MERCY_TICK`, `MERCY_UNLOCK`, `TRACK_MUTED`, `TRACK_ENDED`, `VISIBILITY_*`, `FATAL` |
| **Transitions** | `GESTURE_ENTER` → `GESTURE_HOLDING` · `MERCY_TICK` [`mercyReached(n)`] → **self**, `mercyLevel = n`, relax thresholds, reveal the hatch · `MERCY_UNLOCK` [`canUnlock`] → `UNLOCKING` · `TRACK_*` → `CAMERA_INTERRUPTED` |
| **Mercy behaviour** | Level 0 (0–20 s): G1 only, `M = 1.00`, hand confidence 0.50. Level 1 (20–45 s): G1 ∨ G2 ∨ G3, `M = 1.25`, confidence 0.40. Level 2 (45–90 s): same, **hatch visible** as a gift. Level 3 (90 s+): same, **hatch primary**. Detection keeps running at every level — if the heart lands, it still wins. |
| **Critical** | The escape hatch **never fires itself.** An auto-unlock reads as a bug and steals the agency that makes the unlock feel earned. |

---

### 2.13 `GESTURE_HOLDING`

| | |
|---|---|
| **Purpose** | Convert detection into a deliberate act, and provide the charge-up beat. |
| **Entry** | E1 the hold timer begins accumulating · E2 the ring fills from `ref.holdProgress = hold / 900`, read by the HUD in its own `rAF` · E3 rising SFX; haptic taps at 33% and 66% where supported |
| **Exit** | X1 on exit-by-loss, the ring **decays** rather than resetting · X2 on completion, stop the charge sound |
| **Timers** | none as such — the hold accumulator *is* the timer (900 ms cap, 200 ms grace, −dt×2 decay) |
| **Events** | `GESTURE_EXIT`, `HOLD_COMPLETE`, `MERCY_TICK`, `MERCY_UNLOCK`, `TRACK_*`, `VISIBILITY_*`, `FATAL` |
| **Transitions** | `HOLD_COMPLETE` [`canUnlock`] → `UNLOCKING`, **setting `hasUnlocked` synchronously** · `GESTURE_EXIT` → `SEEKING_GESTURE` · `MERCY_UNLOCK` [`canUnlock`] → `UNLOCKING` |
| **Why decay, not reset** | A hard reset to zero on one dropped frame is punishing and feels broken. Visible decay says *"you had it, come back"* — which is itself coaching. |

---

### 2.14 `CAMERA_INTERRUPTED`

| | |
|---|---|
| **Purpose** | Absorb a phone call, an app switch, or a revoked track without losing progress or patience. |
| **Entry** | E1 pause the detection loop · E2 **pause the mercy timers** · E3 render *"Camera paused — tap to bring it back."* · E4 on `TRACK_ENDED`, attempt automatic re-acquisition **once** |
| **Exit** | X1 resume the loop and the timers from exactly where they stopped |
| **Timers** | none |
| **Events** | `TRACK_RECOVERED`, `MERCY_UNLOCK`, `SKIP_TO_LETTER`, `FATAL` |
| **Transitions** | `TRACK_RECOVERED` → **the previous state** (stored in context) · `MERCY_UNLOCK` [`canUnlock`] → `UNLOCKING` · second re-acquisition failure → the escape hatch remains the way forward |

---

### 2.15 `UNLOCKING`

| | |
|---|---|
| **Purpose** | The teardown boundary and the transaction beat. ~2.2 s. **Non-interruptible.** |
| **Entry (ordered — the order is not negotiable)** | E1 **capture the last camera frame** into an offscreen canvas → `capturedFrame` (used later by *Save our photo*) · E2 **`cancelAnimationFrame(detectionLoop)`** — before closing tasks, or an in-flight `detectForVideo` resolves against a closed task and throws · E3 `stream.getTracks().forEach(t => t.stop())` · E4 `faceDetector.close()`; `handLandmarker.close()` · E5 **assert** every `track.readyState === 'ended'`; the camera indicator light must go out · E6 darken the screen ~35% · E7 **one** shake, ≤ 350 ms, ≤ 8 px amplitude · E8 **a single 400 ms radial bloom — not a strobe** · E9 slam in **DELIVERY UNLOCKED** with a hard drop shadow · E10 mount the R3F canvas (or the Lite stage) behind the darken layer and render one hidden frame to compile shaders |
| **Exit** | X1 hand the clock to the SequenceDirector · X2 `music.play()` with an 800 ms fade-in |
| **Timers** | `unlockBeat` ~2.2 s → `SEQUENCE_STEP_DONE` |
| **Events** | `SEQUENCE_STEP_DONE`, `CONTEXT_LOST`, `FATAL` |
| **Transitions** | `SEQUENCE_STEP_DONE` → `DELIVERY` |
| **Reached from** | `GESTURE_HOLDING` (`HOLD_COMPLETE`) · `SEEKING_GESTURE`/`GESTURE_HOLDING`/`CAMERA_INTERRUPTED` (`MERCY_UNLOCK`) · `SOLO_PROMPT` (`PEEK_ALONE`) · `CAMERA_DENIED`/`CAMERA_ERROR`/`BLOCKED_ENVIRONMENT` (`SKIP_TO_LETTER`) · `RESTING` (`REPLAY_TAPPED`, with `skipCameraStage = true`) |
| **Invariant** | Every one of those six entry paths passes through `canUnlock`. Camera and detection are dead afterwards for the remainder of the session. |
| **Photosensitivity** | The "magical unlock effect" is **one** 400 ms radial bloom. No full-screen luminance change greater than 10% at a rate above 3 Hz, anywhere in the app. This is specified, not left to interpretation. |

---

### 2.16 `DELIVERY`

| | |
|---|---|
| **Purpose** | The box. ~9 s. |
| **Entry** | E1 `SequenceDirector.play('delivery')`; `frameloop="always"` · E2 a black sky-hole opens; a chunky wrapped box tumbles down · E3 it lands with a screen-punch and a dust ring, sits for a beat, then bursts · E4 tulips erupt outward · E5 music is already playing (started at `UNLOCKING` exit) |
| **Exit** | X1 none |
| **Timers** | `beat` ~9 s → `SEQUENCE_STEP_DONE`; hard cap 12 s guards a stalled director |
| **Events** | `SEQUENCE_STEP_DONE`, `CONTEXT_LOST`, `DEGRADE_TO_LITE`, `VISIBILITY_*`, `FATAL` |
| **Transitions** | `SEQUENCE_STEP_DONE` → `BLOOM` |

---

### 2.17 `BLOOM`

| | |
|---|---|
| **Purpose** | The field. ~8 s. Music peak. |
| **Entry** | E1 tulips grow across the lower frame · E2 petals drift · E3 particles taper from the burst rate to a gentle ambient rate |
| **Exit** | X1 `frameloop="demand"` once the scene settles |
| **Timers** | `beat` ~8 s → `SEQUENCE_STEP_DONE` |
| **Events** | `SEQUENCE_STEP_DONE`, `CONTEXT_LOST`, `DEGRADE_TO_LITE`, `VISIBILITY_*`, `FATAL` |
| **Transitions** | `SEQUENCE_STEP_DONE` [`peekedAlone`] → `RESTING` with the *"The rest is for when you're together 💌"* hold · `SEQUENCE_STEP_DONE` → `MESSAGE` |

---

### 2.18 `MESSAGE`

| | |
|---|---|
| **Purpose** | Name the recipient. ~4 s. |
| **Entry** | E1 render *"For {recipientName} 🌷"* with a scale overshoot 1.15 → 1.0 · E2 hold |
| **Exit** | X1 shrink the headline to a persistent position above the letter |
| **Timers** | `beat` ~4 s → `SEQUENCE_STEP_DONE` |
| **Events** | `SEQUENCE_STEP_DONE`, `FATAL` |
| **Transitions** | `SEQUENCE_STEP_DONE` → `LETTER_CLOSED` |
| **Name handling** | `recipientName` was sanitized in `BOOT` (§6.3) and is rendered **exclusively as a text node**. Never `innerHTML`, never `dangerouslySetInnerHTML`. |

---

### 2.19 `LETTER_CLOSED`

| | |
|---|---|
| **Purpose** | One last small moment of anticipation. |
| **Entry** | E1 envelope drops in and settles with a bounce · E2 idle float + wax-seal shimmer · E3 render the chunky **Open Letter** button and focus it · E4 the letter payload is **not** decoded yet |
| **Exit** | X1 stop the idle float |
| **Timers** | none — indefinite |
| **Events** | `LETTER_OPEN_TAPPED`, `MUTE_TOGGLED`, `FATAL` |
| **Transitions** | `LETTER_OPEN_TAPPED` → `LETTER_OPEN` |

---

### 2.20 `LETTER_OPEN`

| | |
|---|---|
| **Purpose** | The point of the entire project. |
| **Entry** | E1 **decode the letter payload on this transition** (base64 + XOR de-obfuscation, §6.5) · E2 envelope flap peels · E3 the paper unfolds in three beats · E4 the message reads in, paragraph by paragraph · E5 move focus into the letter region (`role="article"`, `tabIndex={-1}`) · E6 the letter is **real, selectable, screen-readable DOM text** — never an image, never canvas |
| **Exit** | X1 persist `bloom_unlocked = '1'` |
| **Timers** | `settle` → `SEQUENCE_STEP_DONE` once the reveal completes and the user has had a beat |
| **Events** | `SEQUENCE_STEP_DONE`, `MUTE_TOGGLED`, `FATAL` |
| **Transitions** | `SEQUENCE_STEP_DONE` → `RESTING` (persisting the unlock flag) |
| **Content rule** | The letter lives in **one obvious config module**. It is the cheapest thing in the project and deserves the most care. |

---

### 2.21 `RESTING`

| | |
|---|---|
| **Purpose** | An ending, a memory, and a second viewing. v1 had none of these. |
| **Entry** | E1 everything settles into a low-cost idle; **`frameloop="demand"`**, invalidate only on interaction, < 5% GPU · E2 three chunky buttons: **Read again · Replay the moment · Save our photo** · E3 a small colophon link if OpenMoji or other attributed assets shipped · E4 if `peekedAlone`, show the *"The rest is for when you're together 💌"* hold instead of the letter actions |
| **Exit** | X1 none |
| **Timers** | none — indefinite |
| **Events** | `READ_AGAIN_TAPPED`, `REPLAY_TAPPED`, `SAVE_PHOTO_TAPPED`, `MUTE_TOGGLED`, `FATAL` |
| **Transitions** | `READ_AGAIN_TAPPED` → `LETTER_OPEN` · `REPLAY_TAPPED` → `UNLOCKING` with `skipCameraStage = true` · `SAVE_PHOTO_TAPPED` → **self**, composite and download locally |
| **Replay invariant** | **The camera is never re-requested after the first unlock.** Replay re-enters `UNLOCKING`, whose teardown steps become no-ops when `skipCameraStage` is true, and the show replays from the box drop. |
| **Photo** | Composited fully locally from `capturedFrame` + a flower overlay + *"For {name} 🌷"*. Nothing is uploaded. It must be correctly oriented and **un-mirrored** — the preview was mirrored for display, the saved photo must not be. |

---

### 2.22 `FATAL_ERROR`

| | |
|---|---|
| **Purpose** | The last line of the no-dead-end invariant. |
| **Entry** | E1 the error boundary caught something · E2 build the diagnostic string: device, OS, browser, WebGL support, last state, last 10 events, error message · E3 render it as **copyable text** with a copy button · E4 render **[ Take me to the letter ]** prominently |
| **Exit** | X1 none |
| **Timers** | none |
| **Events** | `SKIP_TO_LETTER` |
| **Transitions** | `SKIP_TO_LETTER` → `LETTER_OPEN` with `renderTier = 'lite'` |
| **Why copyable, not sent** | This is the agreed substitute for the rejected error beacon. Any network egress would put an asterisk on *"your camera never leaves this phone"*, and that asterisk costs more than the telemetry is worth. If it breaks, she screenshots it. |

---

## 3. Events

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

### 3.1 Event payloads and sources

| Event | Payload | Source | Notes |
|---|---|---|---|
| `BOOT_OK` | `{tier, motionSafe, recipientName, priorUnlock}` | CapabilityProbe | — |
| `ENV_BLOCKED` | `{reason: 'inapp' \| 'insecure' \| 'nomedia', app?}` | CapabilityProbe | — |
| `START_TAPPED` | — | UI | **must** carry the audio unlock synchronously |
| `PERMISSION_GRANTED` | `{stream}` handle | CameraService | |
| `CAMERA_FAILED` | `{name}` — one of six `DOMException` names | CameraService | drives copy selection |
| `TRACK_MUTED` / `TRACK_ENDED` | — | track listeners | |
| `MODELS_READY` | — | AssetLoader | face model only |
| `HAND_MODEL_READY` | — | AssetLoader | releases `canSeekGesture` |
| `FACES_ACQUIRED` | — | detection | edge-triggered, once |
| `SOLO_TIMEOUT` | — | detection | 1 face continuous 15 s |
| `GESTURE_ENTER` / `GESTURE_EXIT` | `{variant: 'G1'\|'G2'\|'G3'}` | detection | N-of-M boolean edges |
| `HOLD_COMPLETE` | — | detection | fires once; `canUnlock`-guarded |
| `MERCY_TICK` | `{level: 1\|2\|3}` | active-time timer | paused when hidden/interrupted |
| `SEQUENCE_STEP_DONE` | — | SequenceDirector | one per Phase B beat |
| `CONTEXT_LOST` | `{restored: boolean}` | `webglcontextlost` | |
| `DEGRADE_TO_LITE` | — | Degrader | median < 20 fps for 3 s |
| `VISIBILITY_*` | — | `visibilitychange` | |
| `FATAL` | `{diagnostic}` | error boundary | |

### 3.2 What is **not** an event

`holdProgress`, `closeness`, `coachingState`, `faceCount`, `handCount`, `luma`, `fps`, and every debug metric are written to the **detection ref at 15 Hz** and never enter the machine. Routing any of them through the FSM would multiply store writes by ~100× and violate the ≤ 2 re-renders/second budget.

---

## 4. Guards

| Guard | Definition | Purpose |
|---|---|---|
| **`canUnlock`** | `!ctx.hasUnlocked && (state === 'SEEKING_GESTURE' \|\| state === 'GESTURE_HOLDING' \|\| state === 'SOLO_PROMPT' \|\| state === 'CAMERA_INTERRUPTED' \|\| state === 'CAMERA_DENIED' \|\| state === 'CAMERA_ERROR' \|\| state === 'BLOCKED_ENVIRONMENT' \|\| state === 'RESTING')` — and it **sets `hasUnlocked = true` synchronously, inside the reducer, before any effect runs** | **The single most important guard in the app.** Kills every double-fire race: `HOLD_COMPLETE` and `MERCY_UNLOCK` in the same tick, a double-tap on the hatch, a detection edge racing a user tap. |
| `canSeekGesture` | `ctx.togetherConfirmed && handModelReady` | Never enter the gesture stage without the model. |
| `canRenderFull` | `renderTier === 'full' && webgl2Available` | Routes to Lite. |
| `isReplay` | `ctx.hasUnlocked && ctx.skipCameraStage` | Replay bypasses all camera states and all teardown steps. |
| `mercyReached(n)` | `activeElapsed(gestureStageEnteredAt) >= [20,45,90][n] * 1000` | Escalation. **Paused** while `VISIBILITY_HIDDEN` or `CAMERA_INTERRUPTED`. |
| `isTerminalCameraError` | `err.name ∈ {NotFoundError, SecurityError, OverconstrainedError}` | Terminal errors go to Lite, **not** into a retry loop. |
| `hasPriorUnlock` | `localStorage.bloom_unlocked === '1'` (inside `try/catch`) | `BOOT → RESTING`. |
| `peekedAlone` | `ctx.peekedAlone` | `BLOOM → RESTING` instead of `MESSAGE`. |

**Guard purity.** Guards are pure, synchronous, and read only `MachineContext`, the event payload, and cached capability results. A guard that reads the detection ref, performs I/O, or touches the DOM is a defect. `canUnlock` is the sole exception to purity — it mutates the latch — and that mutation is exactly why it works.

**Note on `canUnlock`'s state list.** It deliberately includes the failure states. `SKIP_TO_LETTER` from `CAMERA_DENIED` routes through `UNLOCKING` so that the Lite path shares one teardown-and-transition implementation with the camera path. There is one road to the gift.

---

## 5. Transition Table

**Any `(state, event)` pair not in this table is illegal.** Dev: throw. Prod: log to the diagnostic buffer, return state unchanged.

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| `BOOT` | `BOOT_OK` | `hasPriorUnlock` | `RESTING` | restore ctx |
| `BOOT` | `BOOT_OK` | `!canRenderFull` | `LANDING` | `renderTier='lite'` |
| `BOOT` | `BOOT_OK` | — | `LANDING` | — |
| `BOOT` | `ENV_BLOCKED` | — | `BLOCKED_ENVIRONMENT` | — |
| `BLOCKED_ENVIRONMENT` | `SKIP_TO_LETTER` | `canUnlock` | `UNLOCKING` | Lite sequence |
| `LANDING` | `START_TAPPED` | — | `PREFLIGHT` | **unlock AudioContext**; prefetch runtime + face model |
| `PREFLIGHT` | `PREFLIGHT_CONTINUE` | — | `REQUESTING_CAMERA` | **prefetch hand model** |
| `REQUESTING_CAMERA` | `PERMISSION_GRANTED` | — | `LOADING_DETECTION` | attach stream; bind track listeners; arm 120 s cap |
| `REQUESTING_CAMERA` | `PERMISSION_DENIED` | — | `CAMERA_DENIED` | — |
| `REQUESTING_CAMERA` | `CAMERA_FAILED` | `isTerminalCameraError` | `CAMERA_ERROR` | offer Lite |
| `REQUESTING_CAMERA` | `CAMERA_FAILED` | — | `CAMERA_ERROR` | offer retry |
| `CAMERA_DENIED` | `RETRY_CAMERA` | — | `REQUESTING_CAMERA` | *(iOS: reload instead)* |
| `CAMERA_DENIED` · `CAMERA_ERROR` | `SKIP_TO_LETTER` | `canUnlock` | `UNLOCKING` | Lite path |
| `CAMERA_ERROR` | `RETRY_CAMERA` | `!isTerminalCameraError` | `REQUESTING_CAMERA` | — |
| `LOADING_DETECTION` | `MODELS_READY` | — | `SEEKING_FACES` | start 15 Hz loop; prefetch 3D chunk |
| `LOADING_DETECTION` | `MODELS_FAILED` | — | `CAMERA_ERROR` | offer Lite |
| `SEEKING_FACES` | `FACES_ACQUIRED` | — | `TOGETHER_CONFIRMED` | **latch `togetherConfirmed`**; prefetch audio |
| `SEEKING_FACES` | `SOLO_TIMEOUT` | — | `SOLO_PROMPT` | — |
| `SOLO_PROMPT` | `WAIT_FOR_PARTNER` | — | `SEEKING_FACES` | reset solo timer |
| `SOLO_PROMPT` | `PEEK_ALONE` | `canUnlock` | `UNLOCKING` | `peekedAlone = true`; persist `bloom_peeked` |
| `SOLO_PROMPT` | `FACES_ACQUIRED` | — | `TOGETHER_CONFIRMED` | latch |
| `TOGETHER_CONFIRMED` | `HAND_MODEL_READY` | — | *self* | may end the beat early |
| `TOGETHER_CONFIRMED` | `SEQUENCE_STEP_DONE` | `canSeekGesture` | `SEEKING_GESTURE` | enable hand model; `gestureStageEnteredAt = now` |
| `SEEKING_GESTURE` | `GESTURE_ENTER` | — | `GESTURE_HOLDING` | start ring |
| `GESTURE_HOLDING` | `GESTURE_EXIT` | — | `SEEKING_GESTURE` | decay ring |
| `GESTURE_HOLDING` | `HOLD_COMPLETE` | `canUnlock` | `UNLOCKING` | **set `hasUnlocked` synchronously** |
| `SEEKING_GESTURE` | `MERCY_TICK` | `mercyReached(n)` | *self* | `mercyLevel = n`; relax thresholds; reveal hatch |
| `SEEKING_GESTURE` · `GESTURE_HOLDING` | `MERCY_UNLOCK` | `canUnlock` | `UNLOCKING` | — |
| `SEEKING_FACES` · `SOLO_PROMPT` · `TOGETHER_CONFIRMED` · `SEEKING_GESTURE` · `GESTURE_HOLDING` · `LOADING_DETECTION` | `TRACK_MUTED` · `TRACK_ENDED` | — | `CAMERA_INTERRUPTED` | pause loop + mercy timers; store previous state |
| `CAMERA_INTERRUPTED` | `TRACK_RECOVERED` | — | *previous* | resume loop + timers |
| `CAMERA_INTERRUPTED` | `MERCY_UNLOCK` · `SKIP_TO_LETTER` | `canUnlock` | `UNLOCKING` | — |
| `UNLOCKING` | *(entry)* | — | — | **TEARDOWN: capture frame → cancel rAF → `track.stop()` all → `.close()` both tasks → assert camera off** |
| `UNLOCKING` | `SEQUENCE_STEP_DONE` | — | `DELIVERY` | mount R3F canvas; `music.play()` fade 800 ms |
| `DELIVERY` | `SEQUENCE_STEP_DONE` | — | `BLOOM` | — |
| `BLOOM` | `SEQUENCE_STEP_DONE` | `peekedAlone` | `RESTING` | show the "for when you're together" hold |
| `BLOOM` | `SEQUENCE_STEP_DONE` | — | `MESSAGE` | — |
| `MESSAGE` | `SEQUENCE_STEP_DONE` | — | `LETTER_CLOSED` | — |
| `LETTER_CLOSED` | `LETTER_OPEN_TAPPED` | — | `LETTER_OPEN` | **decode letter payload** |
| `LETTER_OPEN` | `SEQUENCE_STEP_DONE` | — | `RESTING` | **persist `bloom_unlocked = '1'`** |
| `RESTING` | `REPLAY_TAPPED` | — | `UNLOCKING` | `skipCameraStage = true` |
| `RESTING` | `READ_AGAIN_TAPPED` | — | `LETTER_OPEN` | — |
| `RESTING` | `SAVE_PHOTO_TAPPED` | — | *self* | composite + download locally |
| *any* | `CONTEXT_LOST` | restore fails | *self* | `renderTier='lite'`, remount |
| *any* | `DEGRADE_TO_LITE` | — | *self* | unmount R3F, continue in 2D at the current beat |
| *any* | `FATAL` | — | `FATAL_ERROR` | build diagnostic string |
| `FATAL_ERROR` | `SKIP_TO_LETTER` | — | `LETTER_OPEN` | Lite |
| *any* | `VISIBILITY_HIDDEN` | — | *self* | pause loop, mercy timers, audio (`ctx.suspend()`) |
| *any* | `VISIBILITY_VISIBLE` | — | *self* | `ctx.resume()`, resume loop + timers |
| *any* | `MUTE_TOGGLED` | — | *self* | toggle both buses; persist `bloom_muted` |

---

## 6. Recovery Flows & Persistence

### 6.1 Permission recovery

```
PERMISSION_DENIED → CAMERA_DENIED
   │
   ├─ iOS Safari
   │    A second getUserMedia throws NotAllowedError IMMEDIATELY, no prompt.
   │    Retry is impossible in-page. Therefore: NO retry button.
   │    Screen: illustrated  AA → Website Settings → Camera → Allow
   │            primary action = [ Reload ]
   │
   ├─ Android Chrome
   │    Recoverable via the lock/tune icon; a re-prompt sometimes works.
   │    Screen: illustrated lock-icon steps + genuine [ Try again ]
   │
   └─ Desktop
        Recoverable via the address-bar camera icon.
        Screen: icon-location illustration + [ Try again ]

 Every one of the three also carries [ Just show me the flowers ] → Lite.

 There is NO permissions.query() polling anywhere. Safari does not support it,
 and an architecture that depends on knowing permission state in advance is
 broken on the platform that matters most here.
```

### 6.2 Gesture failure recovery — the mercy ladder

| Active elapsed | Accepted | `M` | Hand conf. | Escape hatch | Copy |
|---|---|---|---|---|---|
| 0–20 s | G1 | 1.00 | 0.50 | DOM-present, focusable, visually hidden | *"Make a heart — one hand each 💗"* · diagnostic coaching |
| 20–45 s | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 | same | *"So close! Bring your fingers together 🤏"* |
| 45–90 s | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 | **visible**, styled as a gift | *"The flowers are getting impatient 🌷"* → **[ Let them out ]** |
| 90 s+ | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 | **primary CTA** | *"Honestly? You two are close enough. 💕"* → **[ Open it anyway ]** |

- Timers measure **active** time and pause on `VISIBILITY_HIDDEN` and `CAMERA_INTERRUPTED`.
- Detection continues at every level. If the heart lands at t=100 s, it still wins.
- **Camera hard-off at 120 s** regardless of state, for battery, thermal and privacy hygiene. The escape hatch remains.
- The hatch is **in the DOM and keyboard-focusable from t=0.** Keyboard and screen-reader users are never trapped behind a gesture they cannot perform.

### 6.3 Input sanitization — the five lines that replaced Zod

```
input = new URLSearchParams(location.search).get('to')
valid = /^[\p{L}\p{M}\s'’-]{1,24}$/u
name  = (input && valid.test(input)) ? input : 'Someone Special'
```

- Unicode-aware (`\p{L}\p{M}`) so non-Latin names work.
- Capped at 24 characters to prevent layout destruction.
- Rendered exclusively as a **text node**.
- Zod was ~14 KB gzip to do exactly this. It was removed.

### 6.4 Privacy notice — placement is part of the spec

Shown on `PREFLIGHT`, **before** the permission prompt:

> **"Your camera stays on your phone."**
> *No photos. No video. No uploads. Nothing is saved anywhere. The magic all happens right here, on this screen. 🌷*

The technical guarantee that makes it true: zero `fetch` / `XHR` / `WebSocket` / `sendBeacon` after initial asset load, enforced structurally by **CSP `connect-src 'self'`**; no third-party scripts; no CDN fonts; the captured photo lives in an in-memory canvas and reaches disk only on *Save our photo*.

This is also the highest-leverage conversion copy in the product. It should be written with the same care as the letter.

### 6.5 Letter payload

Stored **base64-encoded and XOR-obfuscated**, decoded only on the `LETTER_OPEN` transition. **This is explicitly not security** — it is a spoiler guard against casual View Source, and it must be documented as such so nobody later mistakes it for protection. The actual control is URL secrecy: deploy at an unguessable path (`/d/7fq2m9x`), root returns a neutral 404, and Open Graph tags carry a teaser only.

### 6.6 Persistence

| Key | Value | Written at | Read at |
|---|---|---|---|
| `bloom_unlocked` | `'1'` | `LETTER_OPEN → RESTING` | `BOOT` |
| `bloom_muted` | `'0' \| '1'` | `MUTE_TOGGLED` | `BOOT` |
| `bloom_motion` | `'full' \| 'reduced'` | motion toggle on `PREFLIGHT` | `BOOT` |
| `bloom_peeked` | `'1'` | `SOLO_PROMPT` on `PEEK_ALONE` | `BOOT` |

- **Every read and write is wrapped in `try/catch`.** Private mode, blocked site data, and thumbnail-capture contexts can all throw on access. Storage being unavailable must degrade to an in-memory shim, never crash.
- No PII, no frames, no landmarks, no scores, no timestamps of detection events.
- The unlock flag is **not** a security boundary. There is nothing to protect; the letter is ceremonial, not secret.

### 6.7 Session behaviour

- **Reload mid-flow:** restarts at `BOOT` → `LANDING`. Mercy progress is not restored; the ladder starts again. This is acceptable — a reload is rare and the ladder is fast.
- **Reload after unlock:** `BOOT` → `RESTING` directly, with a small **[ Do it all again ]** to replay the ceremony from the box drop. The camera is never re-requested.
- **Replay:** `RESTING → UNLOCKING` with `skipCameraStage`; teardown steps are no-ops; the show replays.
- **New tab:** `localStorage` persists, so a returning visitor lands on `RESTING`.
