# DOCUMENT 3 — DETECTION ALGORITHM SPECIFICATION

**Project:** Bloom Delivery
**Doc version:** 2.0 — rewritten against PRD v2
**Source of truth:** [`PRD-V2.md`](./PRD-V2.md) §Detection Strategy, §Detection Specification
**Scope:** everything between a camera frame and a `HOLD_COMPLETE` event.
**Related:** [`01-SYSTEM-DESIGN.md`](./01-SYSTEM-DESIGN.md) · [`02-FSM-SPEC.md`](./02-FSM-SPEC.md) · [`04-UIUX-SCREEN-SPEC.md`](./04-UIUX-SCREEN-SPEC.md)

**Calibration status.** All thresholds below are **starting values, to be calibrated in Phase 0 against recorded fixtures.** The *structure* is fixed; the *numbers* are tuned. Any number changed during calibration must be changed in `detection.config` and nowhere else.

---

## 1. Detection Goals

### 1.1 Functional requirements

| ID | Requirement |
|---|---|
| **DG-1** | Prove **once** that two people are present, then remember it for the session (`togetherConfirmed` latch). |
| **DG-2** | While the latch holds, require only **≥ 1 face** as a liveness check. |
| **DG-3** | Detect a heart formed from **one hand of each person** (G1), and — from mercy level 1 — the one-hand finger heart (G2) and the mirrored pair (G3). |
| **DG-4** | Require the accepted gesture to be sustained for **900 ms** with grace and decay. |
| **DG-5** | Emit exactly one unlock per session, enforced by a synchronous `canUnlock` latch. |
| **DG-6** | Produce a coaching signal every tick that tells the user *what to change*, not merely that something is wrong. |
| **DG-7** | Never transmit, encode, or persist any frame or landmark. |
| **DG-8** | Never be the reason the gift fails to arrive. Detection is a doorway, not a feature. |

### 1.2 Why the togetherness latch, and not continuous two-face detection

This is the decision that makes the concept work, and it deserves to be stated in the detection spec because it looks like a weakening and is not.

**Two people forming a heart together instinctively turn toward each other.** That is the whole emotional point of the gesture — and it is precisely what breaks a frontal face detector. BlazeFace short-range degrades sharply past roughly ±30–45° of yaw. A requirement that two faces *and* the heart be true simultaneously means **the gesture the product wants people to perform is the gesture that prevents the product from working.**

Splitting them in time resolves the contradiction completely and costs nothing emotionally:

- `SEEKING_FACES` asks them to **look at the camera**. Natural, easy, high success rate. This proves togetherness.
- `SEEKING_GESTURE` asks them to **make a heart**. They can turn, lean, laugh, look at each other. Only ≥ 1 face is needed to confirm someone is still there.

Togetherness is **established, then trusted.** This is also how a human would judge it.

### 1.3 Quality targets (Phase 0 / Phase 4 exit criteria)

| Metric | Target | Where enforced |
|---|---|---|
| `S` (palm scale) at selfie distance, both hands, 3 devices | **≥ 0.045** | Phase 0 exit — **the single number that governs this project** |
| G1 true-positive, good light, 20 attempts | ≥ 80% (Phase 0) → **≥ 85% within 20 s across 3 pairs** (Phase 4) | Phase 0 / Phase 4 exit |
| G1 true-positive, evening light, 20 attempts | ≥ 60% | Phase 0 exit |
| G1 false-positive on clasped hands / high-five / open palms | **0 / 20** | Phase 0 and Phase 4 exit |
| Face latch, both looking at camera | ≥ 90% within 3 s | Phase 0 / Phase 3 exit |
| Combined inference, slowest lab device | **≤ 60 ms** | Phase 0 exit |
| React re-renders during detection | **≤ 2 / s** | Phase 3 exit |

**The asymmetry that governs tuning.** A false negative costs seconds and is fully covered by the mercy ladder. A false positive at mercy level 0 unlocks a gift that was not earned. Tune toward rejecting at level 0; the ladder buys back recall at level 1. Above level 1, the asymmetry inverts — **recall matters more than precision**, because by then the escape hatch is the alternative and a slightly early unlock is strictly better than a user giving up.

---

## 2. Coordinate Space and Normalization

### 2.1 Square correction (mandatory, non-optional)

MediaPipe returns landmarks normalized independently per axis: `x ∈ [0,1]` relative to width, `y ∈ [0,1]` relative to height. **In a 9:16 frame these units are not isotropic** — a vertical distance of 0.1 is 1.78× longer in pixels than a horizontal one.

Every landmark is converted **once, on ingest**:

```
x' = x
y' = y * (videoHeight / videoWidth)
```

All distances in this document are Euclidean in this square-corrected space, **in units of frame width**.

> Skipping this step makes every threshold in this document wrong by the aspect ratio. It is the most commonly skipped step in MediaPipe gesture work, and it is the reason gesture code "works on the laptop and not on the phone."

### 2.2 Mirroring

- **Display** is mirrored: `transform: scaleX(-1)` on the `<video>`.
- **Inference runs on the raw, unmirrored frame.**
- The overlay canvas applies the **same** mirror transform as the video.

One conversion, one place. A mismatch here is the classic overlay bug where landmarks appear on the wrong side of the body.

### 2.3 Landmark reference

```
0      wrist
1-4    thumb   (4 = tip, 3 = IP, 2 = MCP)
5-8    index   (5 = MCP, 6 = PIP, 7 = DIP, 8 = tip)
9-12   middle  (9 = MCP, 10 = PIP, 12 = tip)
13-16  ring    (13 = MCP, 14 = PIP, 16 = tip)
17-20  pinky   (17 = MCP, 18 = PIP, 20 = tip)
```

### 2.4 Palm scale — the universal normalizer

> `S(h) = dist(h[0], h[9])`   — wrist to middle-finger MCP

Scale-invariant, rotation-stable, and unaffected by finger pose (the MCP joints do not move relative to the wrist). **Every threshold in this document is expressed as a multiple of `S`.** Never raw pixels, never raw normalized units.

`S` is also the project's single most important measured quantity: Phase 0 exists primarily to establish whether `S ≥ 0.045` at the pose people actually adopt (§4.4).

### 2.5 Handedness is ignored entirely

MediaPipe's `Left`/`Right` classification is unreliable when the two hands belong to **different people**, and it flips under wrist rotation. **No geometry in this document uses it.** This is what lets one specification cover a two-person half-heart and a one-person two-hand heart identically — the detector does not need to know, and must not care, which hands belong to whom.

---

## 3. Face Detection

### 3.1 Model

| Property | Value |
|---|---|
| Package | `@mediapipe/tasks-vision` → `FaceDetector` |
| Model | BlazeFace **short-range** (`face_detector.task`, ~230 KB) |
| Location | **Self-hosted** at `/public/vision/face_detector.task`. Never a CDN. |
| `runningMode` | `VIDEO` |
| `minDetectionConfidence` | **0.50** — Tier 2 or mercy level ≥ 1: **0.40** |
| `minSuppressionThreshold` | **0.30** |
| Delegate | `GPU`, falling back to `CPU` on init failure |
| Rejected alternative | `FaceLandmarker` (478 points) — many times the cost for information nothing here uses. This gate is a **count**, not an identity system. |

### 3.2 Validity filter

```
faceValid(d) := d.categories[0].score >= 0.50
            AND d.boundingBox.width   >= 0.10      (frame-width units)
```

**The `width >= 0.10` gate is the size rule.** It rejects small background faces — people walking past, faces in a photo on the wall, a face on a TV across the room. There is deliberately **no maximum size gate**: a single face filling the frame is not a failure mode here, because the gate needs `>= 2` and one huge face simply does not satisfy it.

### 3.3 Face count rules

| Stage | Rule |
|---|---|
| `SEEKING_FACES` | `facesPresent := count(faceValid) >= 2` — **not `== 2`** |
| Latch | `FACES_ACQUIRED` when `facesPresent` is true in **≥ 8 of the last 10 ticks** (~0.67 s at 15 Hz) |
| Solo | `SOLO_TIMEOUT` when `count(faceValid) == 1` **continuously for 15 s** |
| `SEEKING_GESTURE` | `liveness := count(faceValid) >= 1` in **≥ 5 of the last 10 ticks** |
| Face inference dropped for performance | `liveness` is **assumed true** — the latch already established presence |

**Why `>= 2` and not `== 2`.** A poster, a TV, a mirror, or a passer-by adding a third face must not *close* the gate. Requiring exactly two turns a benign environmental accident into an unexplainable failure, in a room the user cannot easily change. The `width >= 0.10` filter already removes the small-background-face case, which is the majority of spurious detections.

### 3.4 Frame rate

| Stage | Rate |
|---|---|
| `SEEKING_FACES` | 15 Hz (every tick) |
| `SEEKING_GESTURE` | 15 Hz alongside the hand model — **unless** combined inference exceeds 110 ms, in which case **face detection is dropped entirely** for the remainder of the gesture stage |
| Everywhere else | off |

Dropping face detection under load is safe precisely because of the latch. Presence has already been proven; liveness is a courtesy check, not a gate.

### 3.5 Tracking and smoothing

**There is none, and that is deliberate.**

- No IoU association, no track IDs, no birth/death counters, no bounding-box EMA.
- The face stage produces exactly one number per tick: a count. Stabilisation is handled entirely by the **N-of-M ring buffer** (8 of 10 for the latch, 5 of 10 for liveness).
- Track identity would only be needed to bind specific hands to specific faces. **The latch design removes that need**, and with it several hundred lines of the most bug-prone code in a system like this.

---

## 4. Hand Detection

### 4.1 Model

| Property | Value |
|---|---|
| Package | `@mediapipe/tasks-vision` → `HandLandmarker` |
| Model | `hand_landmarker.task`, ~7.5 MB |
| Location | **Self-hosted** at `/public/vision/hand_landmarker.task` |
| `runningMode` | `VIDEO` |
| `numHands` | **2** — not 4. See §4.4. |
| `minHandDetectionConfidence` | **0.50** — mercy level ≥ 1: **0.40** |
| `minHandPresenceConfidence` | **0.50** |
| `minTrackingConfidence` | **0.50** |
| Delegate | `GPU`, falling back to `CPU` on init failure |
| Output used | 21 normalized landmarks per hand. World landmarks are **not** used. Handedness is **not** used. |

### 4.2 Loading strategy

The hand model is ~30× the size of the face model and is the largest asset in the project. It is therefore:

- Prefetched at `PREFLIGHT_CONTINUE`, covered by the permission prompt and the entire face stage (~20 s).
- **Never blocking** on `LOADING_DETECTION`, which waits only on the 230 KB face model.
- Gated by `canSeekGesture = togetherConfirmed && handModelReady`, so the gesture stage cannot begin without it. `TOGETHER_CONFIRMED` extends from 1.2 s up to 5 s if it is still in flight, disguised as *"warming up the magic ✨"*.

### 4.3 Frame filtering

Only one filter, applied per gesture variant as condition C1:

| Variant | Size gate |
|---|---|
| G1 (two hands) | `S(A) >= 0.045 AND S(B) >= 0.045` |
| G2 (one hand) | `S(h) >= 0.040` |

Hands smaller than this produce landmark estimates too noisy for the distance ratios to mean anything. When this gate fails and hands are present, the coaching state becomes `HANDS_TOO_SMALL` → *"Bring the heart closer 🤏"* — a directly actionable instruction, which is the point.

There is no separate off-frame filter, no depth-spread filter, and no landmark-bounds sanity filter. Each was considered and rejected as unearned complexity: a partially-occluded hand fails the geometric conditions on its own, and the N-of-M buffer absorbs the transient.

### 4.4 Why one hand each — the decision that makes the project physically possible

In the actual pose — **arm's-length selfie, portrait, one person holding the phone** — the phone-holder has exactly **one free hand.**

Requiring both hands from both people means either:

- **(a)** four hands in frame, which requires `numHands: 4`, roughly doubles inference cost, and breaks MediaPipe's handedness classifier when hands belong to different people; or
- **(b)** a propped phone at ~1.5 m, at which distance hands fall well below the size at which 21-landmark tracking is reliable.

One hand each solves all of it:

- `numHands: 2` — the configuration MediaPipe is actually tuned for.
- Both people keep a free hand.
- Hands stay close to the camera, so they are **large in frame** — the single strongest predictor of landmark accuracy.
- **It is emotionally better.** A person making a heart with their own two hands is performing alone; two people making half a heart each are collaborating. They have to reach toward each other and physically meet. The constraint improved the concept.

### 4.5 Smoothing

**Raw landmarks are not filtered.** No One Euro filter, no Kalman filter, no per-landmark EMA.

MediaPipe's `VIDEO` running mode already applies internal temporal tracking. A second filter on top costs latency and buys nothing at 15 Hz. Stabilisation happens at two deliberately separate places, and nowhere else:

| Mechanism | Applied to | Purpose |
|---|---|---|
| **N-of-M ring buffer** — `true` in ≥ 5 of the last 7 ticks (~0.47 s) | the **final** accepted boolean | Absorbs single-frame dropouts from motion blur and momentary occlusion |
| **EMA, `α = 0.4`** | the continuous `closeness` scalar | Smooths the *"almost there"* UI only |

**The N-of-M buffer is applied to the final boolean, never to individual conditions.** Smoothing each condition separately lets a hand satisfy C2 in one frame and C5 in another and appear to satisfy both, which is a false positive constructed out of thin air.

**`closeness` must never gate a transition.** A smoothed scalar crossing a threshold reintroduces exactly the lag the N-of-M buffer exists to avoid.

---

## 5. Gesture Selection

### 5.1 The three variants

| Id | Name | Hands | Status |
|---|---|---|---|
| **G1** | Two-hand heart, formed by **two people's single hands** | 2 | **PRIMARY** — the coached gesture, accepted at all mercy levels |
| **G2** | One-hand Korean finger heart | 1 | Accepted from mercy level ≥ 1; always in Tripod Mode |
| **G3** | Mirrored finger hearts — both people make G2 independently | 2 | Accepted from mercy level ≥ 1 |

### 5.2 Traditional heart vs. Korean finger heart — the evaluation

| Criterion | Traditional heart (G1) | Korean finger heart (G2) |
|---|---|---|
| **Landmark reliability** | Good, *provided the hands do not interlock*. The one-hand-each form has the two hands **meeting at their edges**, not overlapping — mutual occlusion is minimal. (A one-person two-hand heart, where hands genuinely interlace, is 2–4× worse; the project does not use that form.) | Excellent — a single isolated hand is the model's best case. Self-occlusion of thumb over index is present but well-represented in training. |
| **Geometric separability** | **Strong, and the discriminators are cheap.** C5 (wrist aperture) and C6 (mirrored palm angle) are two scalars that between them eliminate clasped hands, prayer hands, handshakes, high-fives and parallel palms. There is no common two-hand pose that satisfies both. | **Weaker.** Thumb-tip-near-index-tip with the other fingers curled is the *same* landmark signature as an **OK sign** and as a **pinch**. Those are not exotic poses. |
| **False-positive rate** | Low. This is G1's decisive advantage. | **Higher, and known.** The OK sign and a pinch both satisfy G2. |
| **Physical feasibility** | ✓ One hand each; the phone-holder keeps a hand free. Hands stay close to the lens and therefore large in frame. | ✓ Also one hand; strictly easier. |
| **Detection difficulty** | Moderate — seven conditions across two hands. | **Easiest** — four conditions on one hand. |
| **UX / emotional value** | **Higher.** It requires the two people to *reach toward each other and meet*. It is a better photograph, a better memory, and a better use of two people. It is legibly a two-person act. | Lower. One person can perform it alone while the other stands there. Culturally fluent and photogenic, but not collaborative. |
| **Coachability** | Universally understood; a single diagram communicates it. | Also well understood in the target demographic. |
| **Performance** | `numHands: 2`, ~45 ms combined. | `numHands: 2` still (the model is configured once), so **no performance advantage in practice**. |

### 5.3 Final recommendation

> **G1 — the two-hand heart formed by one hand from each person — is the primary and coached gesture.**
> **G2 and G3 are accepted silently from mercy level 1 (t = 20 s).**

**Why G1 is primary, in priority order:**

1. **It is a materially better gate.** C5 and C6 give G1 a false-positive profile that G2 cannot match. G2's collision with the OK sign and the pinch is not a tuning problem; those poses genuinely produce the same landmark configuration.
2. **It is the better moment.** The gesture is the ceremony. Two people reaching toward each other and meeting is worth more than two people independently performing next to each other. When the detection quality and the emotional quality point the same way, that is the answer.
3. **G2 costs nothing to add later.** It is four conditions on one hand, and G3 is free once G2 exists. Accepting them from t=20 s captures the reliability benefit *exactly when it is needed* — after strictness has had its chance — without diluting the intended moment.
4. **Coach the ideal, accept the alternatives silently.** The user is never shown the softening. They see one instruction and, if they struggle, warmer help. They never see the system lower its standards, which would read as pity.

**The accepted risk, stated plainly.** An OK sign or a pinch can satisfy G2 from t=20 s. The consequence is a slightly early unlock for two people who are already together, holding a pose for 900 ms, after the two-face latch has already closed. **This is a benign failure.** Tightening G2 further would cost more true positives than it saves.

### 5.4 The Phase 0 contingency — the one thing that could reverse this

The entire recommendation rests on a single unmeasured quantity: **`S`, the palm scale in frame-width units at arm's length.**

```
 Phase 0 measures S on three real devices, in daylight and evening light,
 in the actual pose.

   S >= 0.045   →  Build exactly what this document specifies. G1 primary.

   S <  0.045   →  PROMOTE G2 TO PRIMARY.
                   Re-coach to the finger heart.
                   Move mercy level 1 to t = 10 s.
                   G1 becomes an accepted alternative rather than the target.
```

A second, later contingency at **Phase 4 day 8**: if G1 true-positive is still below 70%, promote G2 to primary and move mercy level 1 to t=10 s. **Take that decision on day 8 and do not let it slide.** The gate is not the gift.

This is why Phase 0 exists. It is a two-day answer to a question that would otherwise be discovered in week four, with a Phase-6 3D scene already built on top of it.

---

## 6. Gesture Mathematics

### 6.1 Common helpers

```
S(h)          = dist(h[0], h[9])                        palm scale
curled(h,f)   = dist(h[TIP_f], h[0]) < dist(h[PIP_f], h[0])
palmDir(h)    = normalize(h[9] - h[0])
midY(p, q)    = (p.y + q.y) / 2
M             = mercy multiplier: 1.00 at level 0, 1.25 at level >= 1
```

**`curled` explained.** A finger is curled when its tip is *closer to the wrist* than its own PIP joint. This is a comparison of two distances with no threshold at all — it is scale-free, rotation-free, and needs no calibration. It is the cheapest reliable curl test available and it is what rejects open palms and splayed fingers across every variant.

**`M` explained.** Distance thresholds are *multiplied* by `M`, so they grow more permissive. The one aperture threshold that is a *lower bound* (C5) is **divided** by `M`, so it also grows more permissive. Getting this direction wrong makes mercy level 1 stricter than level 0 — a subtle, high-consequence bug worth an explicit unit test.

### 6.2 G1 — two-hand heart (PRIMARY)

Requires exactly two detected hands, `A` and `B`, **in any ownership arrangement**. Let `S̄ = (S(A) + S(B)) / 2`.

| # | Condition | Formula | Rejects |
|---|---|---|---|
| **C1** | Hands large enough | `S(A) >= 0.045 AND S(B) >= 0.045` | too-far hands / unreliable landmarks |
| **C2** | Thumb junction | `dist(A[4], B[4]) <= 0.55 · S̄ · M` | hands not meeting at the base |
| **C3** | Index junction | `dist(A[8], B[8]) <= 0.70 · S̄ · M` | open shape / no top vertex |
| **C4** | Vertical order | `midY(A[4],B[4]) > midY(A[8],B[8])` *(y grows downward)* | inverted or accidental shapes |
| **C5** | Aperture | `dist(A[0], B[0]) >= 0.80 · S̄ / M` | **clasped hands, prayer hands, handshake** |
| **C6** | Mirrored posture | `50° <= angle(palmDir(A), palmDir(B)) <= 170°` | **high-five, parallel palms, both hands waving** |
| **C7** | Fingers curled | `curled(h, middle) AND curled(h, ring) AND curled(h, pinky)` for **both** hands | **open palms, splayed fingers** |

```
G1 := C1 ∧ C2 ∧ C3 ∧ C4 ∧ C5 ∧ C6 ∧ C7 ∧ liveness
```

**C5 and C6 are the false-positive workhorses.** C2 and C3 alone are satisfied by any two hands brought together — clasped, praying, shaking, high-fiving. C5 demands that the *wrists stay apart* while the *fingertips meet*, which is the defining topology of a heart and of almost nothing else. C6 demands that the palms face each other rather than the same direction, which removes the entire parallel-palm family. Together they are what separate a heart from every other two-hands-together pose, and they are the two conditions to protect during calibration.

**C4 explained.** In screen space `y` grows downward, so `midY(thumbs) > midY(indices)` means **the thumb junction is below the index junction** — the point of the heart is at the bottom, the lobes at the top. An upside-down or sideways coincidence fails.

### 6.3 G2 — one-hand finger heart (mercy ≥ 1, always in Tripod Mode)

Single hand `h`:

| # | Condition | Formula |
|---|---|---|
| **C1** | Hand large enough | `S(h) >= 0.040` |
| **C2** | Thumb–index contact | `dist(h[4], h[8]) <= 0.35 · S(h) · M` |
| **C3** | Index bent | `dist(h[8], h[0]) < dist(h[6], h[0])` |
| **C4** | Other fingers curled | `curled(h, middle) ∧ curled(h, ring) ∧ curled(h, pinky)` |

```
G2 := C1 ∧ C2 ∧ C3 ∧ C4 ∧ liveness
```

**C3** is `curled` applied to the index finger by hand — the index tip must be closer to the wrist than the index PIP. It rejects a straight index finger touching an extended thumb.

**Known false positives, accepted:** the **OK sign** and a **pinch** satisfy all four conditions. Documented in §8 with the reasoning for accepting them.

### 6.4 G3 — mirrored finger hearts (mercy ≥ 1)

Two hands, each independently satisfying G2, with:

```
dist(A[0], B[0]) >= 0.60
```

The wrist separation requirement distinguishes two people each making a finger heart from one person holding both hands together. Emotionally this is the "one each" version of G2, and it is free to implement once G2 exists.

### 6.5 `closeness` — the *"almost there"* signal

```
closeness = clamp01( mean over C2..C7 of ( 1 - (measured / threshold) ) )
```

Then smoothed with **EMA `α = 0.4`**.

| Property | Value |
|---|---|
| Range | 0 (nowhere near) → 1 (comfortably satisfying every condition) |
| Consumers | The coaching HUD only — the `ALMOST` state fires at `closeness >= 0.65` |
| **Gating** | **Never.** `closeness` must not appear in any transition condition. |

**Why this matters more than it looks.** `ALMOST` is the only feedback that tells the user their gesture is *working*, and it is what converts random flailing into deliberate adjustment. In terms of measured completion rate it is worth more than the other seven coaching states combined.

### 6.6 There is no scalar confidence score gating the unlock

The gate is a **boolean conjunction of geometric conditions**, stabilised by N-of-M, held for 900 ms. There is deliberately no weighted-sum confidence value in the decision path.

A weighted score lets a strongly-satisfied condition compensate for a violated one — which is exactly how a high-five with unusually curled fingers, or a clasped pair of hands at an odd angle, sneaks through. Hard conjunctions cannot be gamed that way, they are trivially explainable in the debug HUD ("C5 failed"), and they make the coaching derivation possible at all.

`closeness` exists to give the *user* a continuous signal. The *machine* uses booleans.

### 6.7 Acceptance policy over time

| Mercy level | Active elapsed in gesture stage | Accepted | `M` | Hand confidence |
|---|---|---|---|---|
| 0 | 0–20 s | G1 | 1.00 | 0.50 |
| 1 | 20–45 s | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 |
| 2 | 45–90 s | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 (+ hatch visible) |
| 3 | 90 s+ | G1 ∨ G2 ∨ G3 | 1.25 | 0.40 (+ hatch primary) |

Mercy timers **pause** on `VISIBILITY_HIDDEN` and `CAMERA_INTERRUPTED`. A phone call must not cost the user their patience budget.

Changing `minHandDetectionConfidence` at level 1 requires no model re-instantiation — it is an option update on the existing `HandLandmarker`.

---

## 7. Hold Validation and Hysteresis

### 7.1 Hysteresis

Every distance-based condition uses asymmetric enter/exit thresholds:

```
enter:  metric <= T
exit:   metric >  T * 1.30
```

Without this, a metric hovering at the boundary produces `GESTURE_ENTER`/`GESTURE_EXIT` chatter several times per second — a flickering progress ring and an unusable hold timer. The **1.30** factor is a starting value; tune in Phase 0.

Note the layering: hysteresis operates on the individual conditions, and the N-of-M buffer operates on the final boolean. They solve different problems — hysteresis handles a metric *sitting* on a threshold, N-of-M handles a frame being *dropped*. Both are required.

### 7.2 Hold timer

```
on tick, dt = time since last tick:

  if gesturePresent:
      hold = min(hold + dt, 900)
      graceRemaining = 200
  else:
      if graceRemaining > 0:  graceRemaining -= dt          # no penalty yet
      else:                   hold = max(hold - dt * 2, 0)   # decay, don't reset

  ringProgress = hold / 900
  emit HOLD_COMPLETE when hold >= 900        (once; guarded by canUnlock)
```

| Constant | Value | Rationale |
|---|---|---|
| `HOLD_MS` | **900** | Long enough to reject accidental poses, short enough that nobody's arms get tired, and long enough for the ring animation to read as an intentional charge-up rather than a glitch. |
| `GRACE_MS` | **200** | One or two dropped ticks at 15 Hz cost nothing. |
| Decay rate | **2× dt** | Falls back roughly twice as fast as it fills. |

**The grace and the decay are deliberate UX, not leniency.** A hard reset to zero on a single dropped frame is punishing and feels broken. Visible decay says *"you had it, come back"* — which is itself a form of coaching, and the only coaching that operates on a sub-second timescale.

Using measured `dt` rather than a tick count makes the hold **wall-clock accurate at any cadence**, so a Tier 2 device running at 10 Hz still requires 900 ms of real holding rather than 1.5 s. A tick-count implementation would make the gesture 50% longer on exactly the devices whose users are least patient.

### 7.3 Rejection conditions

The hold decays (it does not hard-abort) whenever `gesturePresent` goes false for longer than the grace window. The only hard interruptions are FSM-level:

| Condition | Result |
|---|---|
| `TRACK_MUTED` / `TRACK_ENDED` | → `CAMERA_INTERRUPTED`; loop paused, hold frozen |
| `VISIBILITY_HIDDEN` | loop paused, hold frozen, mercy timers paused |
| `MERCY_UNLOCK` tapped | → `UNLOCKING`; the hold becomes irrelevant |
| 120 s camera cap | camera off; the escape hatch is the way forward |

There is no "you moved too much" rejection and no stability/drift test. The 900 ms hold plus N-of-M is sufficient, and a drift test would punish the natural small adjustments people make while getting a pose right.

---

## 8. False Positive Prevention

### 8.1 What each condition is actually for

| Threat | Rejected by | Notes |
|---|---|---|
| **Open palms / splayed fingers** | C7 (`curled` on middle, ring, pinky, both hands) | The cheapest and broadest rejector in the set |
| **High five** | C6 (palm angle) + C7 | Palms parallel and fingers extended — fails twice |
| **Both hands waving** | C6 | Parallel palm directions |
| **Clasped hands** | C5 (wrist aperture) | Wrists come together; a heart's wrists stay apart |
| **Prayer hands** | C5 + C6 | Wrists together *and* palms parallel |
| **Handshake** | C5 + C6 | |
| **Interlaced fingers** | C5 + C7 | |
| **Upside-down / sideways coincidence** | C4 (vertical order) | |
| **Hands too far from camera** | C1 (`S >= 0.045`) | Also produces actionable coaching |
| **Partial / occluded hand** | The geometric conditions fail on their own | N-of-M absorbs the transient |
| **Background people's hands** | C1 size gate | A hand across the room is far below `S = 0.045` |
| **Single-frame coincidence** | N-of-M (5 of 7) | ~0.47 s of agreement required |
| **Metric sitting on a threshold** | Hysteresis (×1.30 exit) | |
| **Momentary accidental pose** | 900 ms hold | |
| **Double-fire on unlock** | `canUnlock` synchronous latch | Not a detection defence, but the same class of bug |
| **Poster / TV / mirror adding a face** | `>= 2` (not `== 2`) + `boundingBox.width >= 0.10` | **Not fully eliminated. Accepted.** |
| **OK sign (G2 only)** | *Nothing.* | **Accepted false positive, from mercy level 1** |
| **Pinch (G2 only)** | *Nothing.* | **Accepted false positive, from mercy level 1** |

### 8.2 The accepted risks, and why accepting them is correct

**G2's collision with the OK sign and the pinch.** From t=20 s, an OK sign held for 900 ms will unlock. The full context of that event is: the two-face latch has already closed, so two people are together; they have been trying for twenty seconds; and they held a deliberate hand pose for nearly a second. **This is a benign failure.** The alternative — tightening C2 or adding an index-curvature condition — costs more true positives among people making a genuine, slightly loose finger heart than it saves in false unlocks.

**A third face from a poster, a TV, or a mirror.** Mitigated by `>= 2` rather than `== 2` (so a third face cannot *close* the gate) and by the 0.10 width gate (which removes small background faces). A large, well-lit poster face at close range can still count toward the latch. **Accepted.** The consequence is that one person standing next to a poster could latch `togetherConfirmed` — and then still has to form a two-hand heart, alone, with one hand holding the phone, which is the physical impossibility this whole design is built around. The residual exposure is one person, a poster, and a G2 finger heart after t=20 s. That is a person who is trying very hard to open their own gift.

**Very low light.** Partially mitigated by the luma check and coaching. The mercy ladder is the real answer. **Accepted.**

### 8.3 The layered defence

```
 Layer 1  Model confidence      0.50 (0.40 at mercy ≥ 1)
 Layer 2  Size gate             C1 — is this hand close enough to trust?
 Layer 3  Geometry              C2–C7 — is this shape a heart?
 Layer 4  Liveness              ≥ 1 face — is someone still there?
 Layer 5  Hysteresis            ×1.30 exit — is it stable, not on a boundary?
 Layer 6  N-of-M                5 of 7 — is it sustained, not a single frame?
 Layer 7  Hold                  900 ms — is it deliberate?
 Layer 8  canUnlock             synchronous latch — can it happen twice? No.
```

---

## 9. Low Light Strategy

### 9.1 Brightness measurement

Every **500 ms**, draw the video to a **32 × 32** offscreen canvas and compute mean luma:

```
Y = 0.2126 R + 0.7152 G + 0.0722 B          (0..255)

TOO_DARK  when Y < 45 for 2 consecutive samples
```

1,024 pixels is ~1 KB of `getImageData` — the cost is negligible, and the GPU performs the box filter for free during `drawImage`.

### 9.2 Response

`TOO_DARK` is **priority 1** in the coaching table — it pre-empts every other message, because no other coaching can help while the frame is too dark to analyse.

> *"A little more light? 💡"*

It is **non-blocking**: detection continues running. Darkness degrades landmark quality rather than eliminating it, and a user in a dim room may still succeed. The mercy ladder is the real answer to persistent darkness, and it is already running.

### 9.3 What this is worth

This is the cheapest high-value diagnostic in the project. An evening room is the single most common real-world failure condition, and without this check it presents as *"the heart doesn't work"* — unexplainable and unfixable from the user's side. With it, it becomes a one-line instruction the user can act on in two seconds.

### 9.4 Deliberately not implemented

- No `applyConstraints` exposure/brightness manipulation — poorly supported, silently failing, and unpredictable across devices.
- No frame-rate reduction to lengthen exposure — the camera stack already auto-exposes, and 30 fps is already the cap.
- No screen-as-fill-light mode — real value, but it is scope beyond PRD v2's Should-Have list. Revisit only with genuine slack.

---

## 10. Debug Mode

Activated by `?debug=1`. **Non-negotiable tooling — the gesture cannot be tuned blind.** Excluded from the production bundle by a build-time flag.

### 10.1 Required surface

| Element | Detail |
|---|---|
| **Landmark skeleton overlay** | Drawn on the 2D overlay canvas over the mirrored preview, applying the **same** `scaleX(-1)` transform as the video. A mismatch here is the classic debug bug. |
| **Live numeric readout** | `S(A)`, `S(B)`, every condition C1–C7 as pass/fail with its measured value and its current threshold, `closeness`, `hold`, face count, luma `Y` |
| **FSM state** | Current state plus the **last 10 events** |
| **Performance** | Inference time in ms and effective detection Hz; the React re-render counter |
| **[ Force unlock ]** | Emits `MERCY_UNLOCK` |
| **Mercy level override** | Jump directly to level 0/1/2/3 without waiting 90 seconds |

### 10.2 Suggested HUD layout

```
 FSM   SEEKING_GESTURE   mercy 1   t 24.6s
 perf  inference 41ms  ·  13.8 Hz  ·  renders 1.2/s
 luma  Y 78   band OK
 faces 2 (latched)   liveness ✓
 ──────────────────────────────────────────────
 HAND A  S 0.061      HAND B  S 0.058     S̄ 0.060
 G1
   C1 size        ✓   0.058 >= 0.045
   C2 thumb junc  ✓   0.021 <= 0.041   (0.55·S̄·M)
   C3 index junc  ✗   0.067 >  0.053   (0.70·S̄·M)
   C4 vert order  ✓
   C5 aperture    ✓   0.074 >= 0.038   (0.80·S̄/M)
   C6 palm angle  ✓   112°  ∈ [50,170]
   C7 curled      ✓   A:mrp  B:mrp
 G2(A) ✗ C2   G2(B) ✗ C2   G3 ✗
 ──────────────────────────────────────────────
 closeness 0.71   ALMOST
 hold 0ms / 900    grace 200
 N-of-M  ●●○●●○○   (2 of last 7)
 ──────────────────────────────────────────────
 [force unlock]  [mercy 0|1|2|3]
```

### 10.3 Test fixtures — the highest-leverage tooling in the project

Detection cannot be unit-tested against live video. **Record once, replay forever.**

**Clips: 10–15, each 5–10 s at 720p.**

| # | Clip | Expected |
|---|---|---|
| 1 | Daylight, two-hand heart | G1 accept |
| 2 | Evening light, two-hand heart | G1 accept |
| 3 | Finger heart, one hand | G2 accept at mercy ≥ 1, reject at level 0 |
| 4 | Mirrored finger hearts | G3 accept at mercy ≥ 1 |
| 5 | One person only | latch never closes; `SOLO_TIMEOUT` at 15 s |
| 6 | Three people | latch **closes** (`>= 2`) |
| 7 | A poster in frame with one person | documents the accepted risk |
| 8 | Clasped hands | **reject** (C5) |
| 9 | High five | **reject** (C6, C7) |
| 10 | Open palms | **reject** (C7) |
| 11 | Hands too far | **reject** (C1) → `HANDS_TOO_SMALL` |
| 12 | Phone-holder pose, heart with the free hand | the real-world case |
| 13 | Very dark room | `TOO_DARK` |
| 14 | Heart with one hand briefly leaving frame | hold **decays**, does not reset |
| 15 | OK sign | documents the accepted G2 false positive |

**Per clip:** a JSON of expected outcomes, plus, for a handful of frames, the **dumped landmark arrays**.

**Unit tests run against the dumped landmark JSON.** The metrics are pure functions, so the tests are deterministic and run in milliseconds. This makes threshold tuning a **10-second loop instead of a two-people-in-a-room loop**, and it is the single highest-leverage piece of tooling in the project. Build it in Phase 0, before it is needed.

---

## 11. Performance Constraints

### 11.1 Cadence

| Constant | Value |
|---|---|
| Target rate | **15 Hz** — 66 ms interval |
| Driver | **one `requestAnimationFrame` loop with a time accumulator** |
| Degraded rate | 10 Hz (100 ms) when the last inference exceeded **60 ms** |
| Face drop | face detection removed from the gesture stage when inference exceeds **110 ms** |
| Timestamp | **one** `performance.now()` per tick, reused by both detectors |
| Cancellation | on `VISIBILITY_HIDDEN` and at teardown. Never leaked. |

**Why not `setInterval`.** It drifts, and it does not pause with the tab — which on mobile means a backgrounded page keeps a neural network warm and the camera hot. The rAF-plus-accumulator pattern gives a stable cadence *and* free lifecycle correctness.

**Why timestamps must be monotonically increasing across both detectors.** MediaPipe's `VIDEO` running mode throws if a timestamp is not greater than the previous one it saw. Sharing one timestamp per tick between `FaceDetector` and `HandLandmarker` is both correct and the only arrangement that does not require two counters.

### 11.2 Inference budget

| Item | Budget |
|---|---|
| Both models, one tick | **≤ 45 ms target**, ≤ 60 ms before degrading to 10 Hz |
| Above 110 ms | drop face detection during the gesture stage |
| Main-thread headroom | **≥ 40 ms of every 66 ms frame** |
| Metrics + smoothing + hold (pure functions) | ≤ 2 ms |
| React re-renders during detection | **≤ 2 per second** |
| Zustand writes per session | ~8 |

### 11.3 Worker architecture — deliberately not used in MVP

**Detection runs on the main thread.**

This is a reversal of the usual advice, and it is correct here for one reason: **under PRD v2's architecture, detection and 3D never overlap.** During Phase A there is no WebGL, no Three.js, and no particle system — only DOM, CSS transforms, and one small 2D overlay canvas. Detection runs at a deliberate 15 Hz, leaving roughly 50 ms of every 66 ms frame free.

The costs of moving it into a Worker are real and immediate:

- `Worker` + `OffscreenCanvas` + GPU-delegate interop is genuinely fiddly on iOS Safari.
- Frames must be transferred as `ImageBitmap`, and a missed `close()` leaks ~1 MB per frame — a class of bug that does not exist at all in the main-thread design.
- It would cost days of the schedule at the exact point where the schedule is tightest.

**Worker migration is a documented Phase 9 optimisation, triggered only by measured jank on the device lab.** Not by principle, and not by anticipation.

The rule that makes the main-thread design viable is not the Worker's absence — it is **B4**: the detection loop writes one ref at 15 Hz and never calls `setState`. That single discipline is worth more than a Worker would be.

### 11.4 Memory

| Pool | Limit |
|---|---|
| Vision runtime + both models, resident | ~9 MB of model data plus the WASM heap |
| Per-tick allocations in the detection path | **0** — metrics are pure functions over preallocated scratch objects; no object literals, no array literals, no closures in the hot path |
| Ring buffers | fixed-size, preallocated (7 booleans for N-of-M, 10 for the face buffers) |
| JS heap after unlock | **≤ 180 MB** — Phase A resources **must** be released by the `UNLOCKING` teardown |

**The teardown is the memory strategy.** Both MediaPipe tasks are `close()`d and every track `stop()`ped before the 3D scene allocates. A measurable heap drop after teardown is a Phase 5 exit criterion, verified in Chrome DevTools — not assumed.

### 11.5 Tier behaviour

| Tier | Detection |
|---|---|
| **1 — Full** | 15 Hz, both models, GPU delegate |
| **2 — Degraded** | 10 Hz from the start; mercy thresholds begin relaxed; `minDetectionConfidence` 0.40. iOS 15.0–16.3 lacks WASM SIMD, making inference roughly 3× slower — supported, not blocked, because the recipient's phone is not a variable we control. |
| **3 — Lite** | Detection skipped entirely. **[ Open your delivery ]** → 2D sequence → full letter. |
| **0 — Blocked** | In-app browser interstitial before any prompt; escapes to Tier 3. |
