# DOCUMENT 4 — UI/UX SCREEN SPECIFICATION

**Project:** Bloom Delivery
**Doc version:** 2.0 — rewritten against PRD v2
**Source of truth:** [`PRD-V2.md`](./PRD-V2.md) §Core Experience, §Accessibility, §Mobile Strategy
**Art direction:** Cute Kawaii + Neo Brutalism.
**Related:** [`01-SYSTEM-DESIGN.md`](./01-SYSTEM-DESIGN.md) · [`02-FSM-SPEC.md`](./02-FSM-SPEC.md) · [`03-DETECTION-ALGORITHM.md`](./03-DETECTION-ALGORITHM.md)

**The synthesis.** Kawaii supplies the *forms* — round, chunky, expressive, faces on inanimate objects. Neo-brutalism supplies the *treatment* — thick black outlines, hard offset shadows, flat saturated fills, zero blur. It should feel like a Nintendo item-get screen and a Sanrio sticker pack collaborated on a love letter. It must never feel like a product, a brand campaign, or a landing page.

**No dark theme, in any state, including every error screen.** The brightness is a product requirement.

---

## 0. Screen-name mapping

| Requested screen | PRD v2 scene / state | Section |
|---|---|---|
| Landing | Scene 1 · `LANDING` | B.2 |
| Preflight | Scene 2 · `PREFLIGHT` | B.3 |
| Permission Request | Scene 3 · `REQUESTING_CAMERA` | B.4 |
| Camera Setup | Scene 4 · `LOADING_DETECTION` | B.5 |
| Waiting For Faces | Scene 5 · `SEEKING_FACES` | B.6 |
| *(new)* | `SOLO_PROMPT` | B.7 |
| *(new)* | Scene 6 · `TOGETHER_CONFIRMED` | B.8 |
| Waiting For Gesture | Scene 7 · `SEEKING_GESTURE` | B.9 |
| Gesture Holding | Scene 7 · `GESTURE_HOLDING` | B.10 |
| Unlock Sequence | Scene 8 · `UNLOCKING` | B.11 |
| Flower Delivery | Scenes 9–10 · `DELIVERY`, `BLOOM` | B.12 |
| Message Reveal | Scene 11 · `MESSAGE` | B.13 |
| Open Letter | Scene 12 · `LETTER_CLOSED` → `LETTER_OPEN` | B.14 |
| Replay | Scene 13 · `RESTING` | B.15 |
| Error | `CAMERA_DENIED`, `CAMERA_ERROR`, `CAMERA_INTERRUPTED`, `FATAL_ERROR` | B.16–B.18 |
| Fallback | `BLOCKED_ENVIRONMENT` + the Lite tier | B.1, B.19 |

---

## A. Design System

### A.1 Color tokens

| Token | Hex | Role |
|---|---|---|
| `--pink` | `#FF8FAB` | Primary brand · primary buttons · active ring |
| `--pink-light` | `#FFD6E0` | Secondary surfaces · ring track · chips |
| `--cream` | `#FFF8E8` | App background |
| `--yellow` | `#FFE599` | Tulip accent · highlights · unlock stamp |
| `--green` | `#B7E4C7` | Leaves · success · confirmation |
| `--white` | `#FFFFFF` | Cards · letter paper |
| `--ink` | `#111111` | **All text. All borders. All shadows.** |

Derived, for states only (never introduce new hues):

| Token | Value | Role |
|---|---|---|
| `--pink-press` | `#FF6F92` | Pressed primary |
| `--peach` | `#FFC2A8` | Soft failure surface — **never red** |
| `--dim` | `rgba(17,17,17,0.35)` | The unlock darken |

### A.2 The contrast rule — stated once, enforced everywhere

| Pair | Ratio | Verdict |
|---|---|---|
| `#111111` on `#FFF8E8` | **18.3:1** | Pass |
| `#111111` on `#FFFFFF` | **19.0:1** | Pass |
| `#111111` on `#FF8FAB` | **8.9:1** | Pass |
| `#111111` on `#FFE599` | ~15:1 | Pass |
| `#FF8FAB` on `#FFF8E8` | **2.03:1** | **FAIL — never for text** |
| `#FFE599` on `#FFF8E8` | **1.17:1** | **FAIL — never for text** |
| `#FFFFFF` on `#FF8FAB` | **2.15:1** | **FAIL — no white text on pink** |

> **`#111111` is the only approved text color in the entire application.**
> Every brand color is a surface or a fill, never a foreground.

White-on-pink is explicitly prohibited despite being the instinctive kawaii choice. This is **not** a compromise with the art direction: neo-brutalism is *built on* black text and thick black borders over saturated fills. **The accessible choice and the stylistically correct choice are the same choice.** A CI check on the token pair table enforces it.

### A.3 Spacing, radius, borders, shadows

**Spacing** (4 px base): `0 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96`
Gutters: 20 px mobile · 32 px tablet · 48 px desktop.

**Radius**

| Token | Value | Use |
|---|---|---|
| `--r-sm` | 12 px | chips, badges |
| `--r-md` | 20 px | buttons, banners |
| `--r-lg` | 28 px | cards, camera frame |
| `--r-xl` | 40 px | modals, hero panels |
| `--r-full` | 9999 px | pills, ring |

Nothing uses a radius below 12 px. Sharpness is carried by the borders, not the corners.

**Borders and shadows — the neo-brutalist core**

| Token | Value |
|---|---|
| `--border` | `3px solid #111111` (2 px under 40 px tall) |
| `--shadow-sm` | `2px 2px 0 #111111` |
| `--shadow-md` | `4px 4px 0 #111111` |
| `--shadow-lg` | `6px 6px 0 #111111` |
| `--shadow-xl` | `8px 8px 0 #111111` |
| `--shadow-press` | `1px 1px 0 #111111` |

> **Zero blur radius. Zero spread. Always pure black. Always offset down-right.**

One blurred shadow anywhere breaks the entire visual language. Elevation is offset distance and nothing else.

**Press behaviour, universal:** on press, translate `+3px, +3px` and swap to `--shadow-press`. The element squashes into the page. This single interaction is the tactile signature of the whole product.

**Note for Phase B:** `box-shadow` must **never be animated** over the R3F canvas — it forces full-screen recomposites on mobile Safari. Press states over the canvas animate `transform` only, with the shadow swapped in a single non-animated step.

### A.4 Typography

Loaded via **`next/font`**, self-hosted, Latin subset. No Google Fonts network request at runtime — that would also break `connect-src 'self'`.

| Role | Family | Weight | Size | Line height |
|---|---|---|---|---|
| Display | **Fredoka** | 600 | `clamp(2.25rem, 9vw, 4rem)` | 1.05 |
| H1 | Fredoka | 600 | `clamp(1.75rem, 6.5vw, 2.75rem)` | 1.15 |
| H2 | Fredoka | 500 | `clamp(1.375rem, 5vw, 1.875rem)` | 1.2 |
| Body L | **Plus Jakarta Sans** | 500 | `clamp(1.0625rem, 4vw, 1.25rem)` | 1.55 |
| Body | Plus Jakarta Sans | 400 | `1rem` | 1.6 |
| Caption | Plus Jakarta Sans | 500 | `0.875rem` | 1.45 |
| Button | Fredoka | 500 | `1.0625rem` | 1 |
| Diagnostic | `ui-monospace` | 400 | `0.75rem` | 1.4 |

Total font budget **≤ 90 KB**. Fallbacks (`Baloo 2`, `Nunito`, system) are metric-adjusted so the swap causes no layout shift.

### A.5 Button system

| Variant | Fill | Border | Shadow |
|---|---|---|---|
| Primary | `--pink` | `--border` | `--shadow-lg` |
| Secondary | `--white` | `--border` | `--shadow-md` |
| Tertiary | transparent | none | none (underline on hover) |
| Success | `--green` | `--border` | `--shadow-md` |
| Gift *(the escape hatch)* | `--yellow` | `--border` | `--shadow-lg` |

| Size | Height | Padding X | Min hit area |
|---|---|---|---|
| sm | 48 px | 20 px | **48 × 48** |
| md | 56 px | 24 px | 56 × 56 |
| lg | 64 px | 32 px | 64 × 64 |
| xl | 72 px | 40 px | 72 × 72 |

**Touch targets are ≥ 48 × 48 CSS px with ≥ 8 px separation** — PRD v2 raises this above the usual 44, and neo-brutalist chunk makes it easy.

States: rest → hover *(only under `@media (hover:hover) and (pointer:fine)`)* → press (squash) → **focus-visible: 3 px solid `#111111`, 2 px offset, in addition to the border** → disabled (60% opacity, no shadow, `aria-disabled`).

Every primary CTA carries a 1.5 s idle breathing loop (`scale 1 → 1.03`). Disabled when `motionSafe` is false.

### A.6 Card system

| Card | Fill | Shadow | Radius | Padding |
|---|---|---|---|---|
| Surface | `--white` | `--shadow-lg` | `--r-lg` | 24 px |
| Coaching HUD | `--cream` | `--shadow-md` | `--r-lg` | 16/20 px |
| Camera frame | transparent | `--shadow-lg` | `--r-lg` | — (3 px border only) |
| Modal / interstitial | `--white` | `--shadow-xl` | `--r-xl` | 32 px |
| Letter paper | `--white` | `--shadow-xl` | `--r-lg` | 28/40 px |

### A.7 Illustration and 3D style

- **Line:** uniform 3 px black outline, round caps, no weight variation.
- **Fill:** flat brand colors. No gradients except one soft radial in the page background.
- **Shading:** one flat shadow shape per object at 12% black, hard-edged.
- **Faces:** dot eyes, small blush ovals at 30% `--pink`. The box and the envelope get eyes at key beats — this is the primary carrier of the kawaii tone.
- **Texture:** one global grain overlay at 3%, `mix-blend-mode: multiply`.
- **3D must match, and this is the highest-risk art-direction item:** `MeshBasicMaterial` / `MeshToonMaterial`, **vertex colors, no textures**, plus an **inverted-hull outline** (`BackSide`, scale 1.03, flat `#111111`). The outline *is* the neo-brutalist look and costs one extra draw call. Without it the 3D scene reads as belonging to a different product.
- **Assets are authored, not downloaded.** A tulip in this style is ~1,000 triangles with vertex colors and no UVs. Sourced models carry unpredictable topology and cannot meet either the budget or the style.
- OpenMoji stickers require **CC BY-SA 4.0 attribution** in a colophon linked from `RESTING`.

---

## B. Screen Specifications

Common shell: `--cream` background with a soft radial `--pink-light` glow at 30% top-center, plus the grain overlay. Content column capped at 480 px, centered, 20 px gutters, `env(safe-area-inset-*)` padding. Persistent mute toggle top-right from Scene 1 onward.

---

### B.1 Scene 0 — Boot / Blocked Environment

**Purpose.** `BOOT` renders **nothing** and exits in < 100 ms. `BLOCKED_ENVIRONMENT` is what the user sees when routing fails.

#### In-app browser interstitial — the highest-severity mobile screen

This link will arrive over WhatsApp, Instagram DM, or LINE. **The gift can fail before the camera prompt ever appears.** This screen is shown *before* any permission request.

```
 ┌─────────────────────────────────────┐
 │        🌐  (browser character)      │
 │                                     │
 │   Pssst — open this in your real    │  H1
 │   browser 🌷                        │
 │                                     │
 │   This delivery needs your camera,  │  Body L
 │   and it can't reach it from here.  │
 │                                     │
 │   [ Open in Safari ]                │  Primary lg
 │   [ Copy link ]                     │  Secondary md
 │                                     │
 │   ┌───────────────────────────────┐ │
 │   │  Tap  •••  at the top right   │ │  iOS only:
 │   │  →  Open in Safari            │ │  illustrated, showing
 │   │  [illustration of that menu]  │ │  the REAL menu position
 │   └───────────────────────────────┘ │  for THIS app
 │                                     │
 │   [ Just show me the flowers ]      │  Tertiary, small
 └─────────────────────────────────────┘
```

| Platform | Behaviour |
|---|---|
| **Android** | **[ Open in Chrome ]** uses an `intent://` URL, which reliably escapes most WebViews. |
| **iOS** | **There is no programmatic escape.** The button copies the link and the card shows a labelled illustration of the `•••` → *Open in Safari* position for that specific app. |

> **Do not ship a button that pretends to work.** An iOS button labelled "Open in Safari" that silently does nothing is worse than no button. Be honest in the copy.

**Other blocked reasons.** Insecure context / no `mediaDevices`: a blocked screen showing the correct URL. Both variants always carry **[ Just show me the flowers ]** → Lite.

**Accessibility.** Copy-link uses `navigator.clipboard.writeText` with an `execCommand` fallback and a "Copied ✓" toast announced politely. Escape link is the last tab stop but always focusable.

---

### B.2 Scene 1 — Landing

**Purpose.** Hook, audio unlock, and the start of the load pipeline.

```
 [safe top]                              [🔊]  ← mute toggle
 ┌─────────────────────────────────┐
 │   gift box with eyes, floating   │  ~38vh, petals drifting behind
 └─────────────────────────────────┘
 "Bloom Delivery"                       Display
 "A special delivery is waiting"        Body L
 ┌─────────────────────────────────┐
 │           Start          ✨      │  Primary xl
 └─────────────────────────────────┘
 "Sound on for the full effect 🔊"      Caption
 "Works best with two people 💕"        Caption
 [safe bottom]
```

**Components.** `HeroBox` · `Wordmark` · `Subtitle` · `StartButton` · `MuteToggle` · `AmbientPetals` (CSS only).

**Animations.** Hero: scale 0.7 → 1, y +40 → 0, `spring.bouncy`, 80 ms delay; then a 3.4 s float loop ±10 px with a ±3° out-of-phase rotation. Wordmark: per-word y +24 → 0, 60 ms stagger. CTA: `spring.pop` in, then breathing.

**Copy.** Title `Bloom Delivery` · Subtitle `A special delivery is waiting` · CTA `Start` · `Sound on for the full effect 🔊` · `Works best with two people 💕`

**The critical interaction.** The Start click handler must, **synchronously**:

1. `new AudioContext()` → `ctx.resume()` → play a one-sample silent buffer *(the iOS unlock ritual)*
2. emit `START_TAPPED`

This is the **only reliable user gesture in the entire flow**, and music begins roughly 45 seconds later. The context is kept alive for the whole session and never recreated. Getting this wrong produces a silent climax that is very hard to diagnose later.

**The ringer-switch line is load-bearing copy.** Web Audio in Safari respects the physical mute switch and this cannot be worked around. Saying so converts a silent experience from a bug into an understood condition.

**Mobile.** `100dvh` with a `100vh` fallback. Under 640 px height the hero drops to 24vh and the captions collapse to one line.

**Accessibility.** `<h1>` is the wordmark. Hero is `aria-hidden`. Start is the first tab stop after the mute toggle. Reduced motion: one 200 ms fade, no float, no breathing, no petals.

---

### B.3 Scene 2 — Pre-flight

**Purpose.** Deliver the privacy promise **before** the prompt, set the two-person expectation, and buy ~6 s of download time. **This screen is not decoration** — it materially raises the permission grant rate, and because Safari does not expose permission state, it is the *only* pre-prompt intervention available.

```
 [safe top]                              [🔊]
 "Before we start ✨"                    H1
 ┌─────────────────────────────────┐
 │  🌷                             │
 │  Your camera stays on your      │   H2
 │  phone.                         │
 │                                 │
 │  No photos. No video. No        │   Body L
 │  uploads. Nothing is saved      │
 │  anywhere. The magic all        │
 │  happens right here, on this    │
 │  screen. 🌷                     │
 └─────────────────────────────────┘
 "This one needs two people."           Body
 "Takes about a minute. Bring someone."  Body
 ┌─────────────────────────────────┐
 │        I'm ready                │   Primary lg
 └─────────────────────────────────┘
 Motion:  [ full ] [ reduced ]           Segmented toggle
 [safe bottom]
```

**Components.** `PrivacyCard` (the hero element of this screen) · `ExpectationCopy` · `ContinueButton` · `MotionToggle`.

**Animations.** Privacy card enters with `spring.bouncy` scale 0.9 → 1. The 🌷 wiggles once on land. Copy staggers at 100 ms.

**The motion toggle is required here, not in a settings menu.** People who never set the OS preference can still opt in, and this is the last screen before the motion-heavy portion begins. Selection persists to `bloom_motion`.

**Interaction.** `I'm ready` → `PREFLIGHT_CONTINUE`, which **starts the 7.5 MB hand-model prefetch**. That download is then covered by the permission prompt and the whole face stage.

**Error behaviour.** None reachable. If prefetches are slow, nothing here blocks.

**Accessibility.** Privacy copy is real text, not an image. Motion toggle is a radio group with a visible label. Reduced motion: no wiggle, no stagger.

---

### B.4 Scene 3 — Permission

**Purpose.** Trigger the native prompt from an unambiguous gesture. Spinner-free.

```
 ┌─────────────────────────────────┐
 │      📷 camera character         │  waving, --pink-light fill
 └─────────────────────────────────┘
 "Ready when you are 💛"                H1
 "Tap Allow so we can see your hearts"  Body L
 ┌─────────────────────────────────┐
 │      Allow camera               │  Primary xl
 └─────────────────────────────────┘
 [ Just show me the flowers ]           Tertiary
```

**Constraints requested:** `{ video: { facingMode:'user', width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30,max:30} }, audio: false }`

- **720p, not 1080p** — halves decode cost, and MediaPipe downsamples internally anyway.
- **`audio: false`** — requesting audio triggers a scarier two-device prompt and adds a second permission to lose.

**Interaction.** `getUserMedia` is called **synchronously inside the click handler.** Any `await` before the call breaks iOS Safari's user-activation requirement. While the promise is pending, the character's eyes widen and hold — an alive state rather than a spinner.

**Mobile.** The native prompt overlays the top on Android Chrome and the center on iOS, so the CTA sits in the lower third and is never covered by the thing it just triggered.

**Accessibility.** CTA is the first focusable element. Escape link always present. SR on entry: "Camera permission needed. Nothing is recorded, uploaded, or saved."

---

### B.5 Scene 4 — Warming up

**Purpose.** Cover model loading with a delightful screen showing **real** progress.

**Shared camera stage** (Scenes 4–7):

```
 ┌───────────────────────────────────────┐
 │ [safe top]                     [🔊]   │
 │  ┌─────────────────────────────────┐  │
 │  │                                 │  │  MIRRORED PREVIEW
 │  │   camera preview, scaleX(-1)    │  │  3px border, --r-lg
 │  │   object-fit: cover             │  │  --shadow-lg
 │  │   letterboxed with --cream      │  │  overlay canvas on top
 │  │                                 │  │
 │  └─────────────────────────────────┘  │
 │  ┌─────────────────────────────────┐  │
 │  │   coaching HUD  (single line)   │  │  --cream card, bottom
 │  └─────────────────────────────────┘  │
 │  [ escape hatch — DOM from t=0 ]      │  hidden until 45 s
 │ [safe bottom]                         │
 └───────────────────────────────────────┘
```

The preview is **always mirrored**; inference runs on the raw frame; the overlay canvas applies the **same** mirror.

**Scene 4 specifics.** A translucent kawaii loader sits over the fading-in preview with a **real percentage** driven by the face-model download. Copy: `Warming up the magic ✨`. Three bouncing dots at 400 ms, 80 ms stagger.

**Budget.** Camera preview visible **≤ 2.5 s** after grant on 4G. It blocks on 230 KB, never on 7.5 MB.

**Video element:** `playsInline muted autoPlay` — **all three required.** Without `playsInline`, iOS Safari takes the video fullscreen and the entire UI disappears.

**Error.** 30 s model timeout → `MODELS_FAILED` → `CAMERA_ERROR` with *"The magic is being shy."*

**Accessibility.** `<video>` is `aria-hidden="true"` with a sibling text description of what it is showing. Loader is `role="progressbar"` with a real `aria-valuenow`.

---

### B.6 Scene 5 — Find each other

**Purpose.** Prove togetherness. Once.

**Components.** `CameraStage` · `FramingGuide` (two rounded reticles at 32% / 68% width, 42% height) · `PersonChips` (two chunky chips, filling as faces register) · `CoachingHUD` · `EscapeHatch` (present, hidden).

**Reticles are targets, not trackers.** They do not follow faces. A reticle fills when a valid face overlaps it. This is far more legible than boxes chasing heads, and it doubles as framing guidance — which is the actual job, since the gate needs both people looking at the lens.

**Coaching states on this screen** (from the priority table, §B.9):

| Condition | Copy |
|---|---|
| `Y < 45` | *"A little more light? 💡"* |
| 0 faces for 1.0 s | *"Come into the frame 👋"* |
| 1 face for 1.5 s | *"Someone's missing 💕"* |
| ≥ 2 faces, latching | *(chips fill; reticles snap green)* |
| default | *"Stand together 💕"* |

**Animations.** Reticles pulse gently while empty; snap solid with a 240 ms `spring.pop` and a corner-dot burst when matched. Chips fill with a 320 ms liquid rise.

**Gate.** `count(faceValid) >= 2` — **not `== 2`** — in ≥ 8 of the last 10 ticks. A third face from a poster or a passer-by does **not** close the gate.

**Mobile.** Reticles move to 30%/70% below 380 px. Landscape → Tripod Mode framing (§E.3).

**Accessibility.** Coaching text mirrors into `aria-live="polite"`, **debounced to 1.5 s minimum** so the HUD does not flood a screen reader. Chips announce "1 of 2 people detected."

---

### B.7 `SOLO_PROMPT` — Someone's missing

**Purpose.** Turn the single most likely failure — she opens the link on a bus, alone — from a broken website into **anticipation**. This screen is worth more than its size suggests.

```
 ┌───────────────────────────────────────┐
 │        camera preview, dimmed 40%     │
 │  ┌─────────────────────────────────┐  │
 │  │   🌷                            │  │
 │  │   Someone's missing             │  │  H2
 │  │   This one only opens for two.  │  │  Body L
 │  │                                 │  │
 │  │   [ I'll go get them ]          │  │  Primary lg
 │  │   [ Peek alone ]                │  │  Secondary md
 │  └─────────────────────────────────┘  │
 └───────────────────────────────────────┘
```

**Trigger.** Exactly one valid face detected continuously for **15 s** in `SEEKING_FACES`.

**Interactions.**
- **[ I'll go get them ]** → `WAIT_FOR_PARTNER` → back to `SEEKING_FACES`, solo timer reset. Detection never stopped.
- **[ Peek alone ]** → `PEEK_ALONE` → `UNLOCKING`, `peekedAlone = true`, persisted to `bloom_peeked`.
- **A partner arriving always wins.** `FACES_ACQUIRED` fires from underneath this screen and goes straight to `TOGETHER_CONFIRMED`, no tap needed.

**Peek semantics.** The box falls and opens, tulips bloom — but `MESSAGE` and the letter stay sealed behind a warm hold on `RESTING`: *"The rest is for when you're together 💌"*. When they later return and unlock properly, the full sequence plays with an extra line: **"There you are. Now the real one."**

**Tone rule.** This screen must read as an invitation, never as a refusal. No lock icons, no "denied", no greyed-out imagery.

---

### B.8 Scene 6 — There you are!

**Purpose.** A 1.2 s reward beat — and the load buffer that guarantees the hand model is ready. Both purposes are deliberate and neither is disclosed.

```
 ┌───────────────────────────────────────┐
 │      camera preview, full brightness  │
 │                                       │
 │            ✨ 🎉 ✨                   │  confetti pop
 │        There you are! 💕              │  Display, spring.pop
 │            ✨    ✨                   │
 │                                       │
 └───────────────────────────────────────┘
```

**Animations.** Confetti burst from centre, ~24 chunky outlined shapes, `spring.pop`, gravity-free, fading over 700 ms. Headline scale 0 → 1.15 → 1. Both person chips do a synchronised bounce. Sound sting.

**Duration.** 1.2 s, **extending up to 5 s** while `!handModelReady`, with the copy swapping to *"Warming up the magic ✨"* and the confetti settling into a gentle idle sparkle. The user reads a celebration; the system is finishing a 7.5 MB download.

**Accessibility.** `aria-live="polite"`: "Two people detected." Reduced motion: no confetti; the headline fades in at scale 1.

---

### B.9 Scene 7a — Make a heart (`SEEKING_GESTURE`)

**Purpose.** The gate — and the mercy escalation that guarantees it is never a wall.

```
 ┌───────────────────────────────────────┐
 │ [safe top]                     [🔊]   │
 │  ┌─────────────────────────────────┐  │
 │  │  camera preview + progress ring │  │  ring traces the frame
 │  │  around the frame edge          │  │  border, empty here
 │  │                                 │  │
 │  │              ┌────┐             │  │  animated diagram:
 │  │              │ 🫱🫲│             │  │  two hands, one from
 │  │              └────┘             │  │  each side, meeting
 │  └─────────────────────────────────┘  │
 │  ┌─────────────────────────────────┐  │
 │  │  Now make a heart —             │  │  coaching HUD
 │  │  one hand each 💗               │  │
 │  └─────────────────────────────────┘  │
 │  [ Let them out ]                     │  hatch — hidden < 45 s
 │ [safe bottom]                         │
 └───────────────────────────────────────┘
```

**Components.** `CameraStage` · `FrameProgressRing` (traces the camera frame's own border rather than a separate circle — it makes the whole preview the charging object) · `GestureDiagram` (small looping animation, ~1.4 s) · `CoachingHUD` · `EscapeHatch`.

#### Coaching state derivation — first match wins, 1.5 s minimum dwell

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

> **`ALMOST` is worth more than the other seven combined.** It is the only feedback that tells the user their gesture is *working*, and it converts random flailing into deliberate adjustment. Give it the strongest visual treatment of any coaching state: the HUD card gains a `--yellow` fill and a small pulse.

#### Mercy escalation

| Time | Hatch | Copy |
|---|---|---|
| 0–20 s | DOM-present, focusable, visually hidden | diagnostic coaching per the table above |
| 20–45 s | same | *"So close! Bring your fingers together 🤏"* — warmer, more specific |
| 45–90 s | **visible**, styled as a gift (`--yellow`, wrapped-present icon) | *"The flowers are getting impatient 🌷"* → **[ Let them out ]** |
| 90 s+ | **primary CTA**; the diagram shrinks, the hatch grows | *"Honestly? You two are close enough. 💕"* → **[ Open it anyway ]** |

The hatch is **never** styled as a failure or a skip. It is a gift being handed over early. No "skip", no "give up", no lock icon, no greyed treatment. And **it never fires itself** — an auto-unlock reads as a bug and steals the agency that makes the unlock feel earned.

**Detection keeps running at every level.** If the heart lands at t = 100 s, it still wins, and the sequence is identical.

**120 s camera cap.** The camera goes hard-off regardless of state, for battery, thermal and privacy hygiene. The screen becomes the hatch plus *"Let's give your camera a rest 🌷"*, and the hatch remains fully functional.

**Accessibility.** **The escape hatch is in the DOM and keyboard-focusable from t=0**, visually revealed at 45 s. Keyboard and screen-reader users are never trapped behind a gesture they cannot perform. Coaching mirrors to `aria-live="polite"` at a 1.5 s debounce.

---

### B.10 Scene 7b — Holding (`GESTURE_HOLDING`)

**Purpose.** The charge-up. 900 ms.

**The ring.** The camera frame's own 3 px border becomes a progress track; a `--pink` → `--yellow` stroke fills it clockwise from the top. Driven directly from `ref.holdProgress = hold / 900`, read by the HUD inside its own `rAF` with a ~60 ms lerp.

> It must **not** be a Framer Motion spring. A spring lags the real state and can finish filling after the unlock has already fired, which reads as the ring being decorative.

**Beats.**

| Progress | Behaviour |
|---|---|
| 0 → 1 | Ring fills; the whole preview scales imperceptibly (1.0 → 1.015); a warm glow builds at the frame edge |
| 0.33, 0.66 | Haptic tap where `navigator.vibrate` exists |
| rising | `sfx.charge` playback rate mapped `0.9 → 1.6` |
| **on loss** | Ring **decays** (2× fill rate) after a 200 ms grace, desaturating. Soft descending "boop". No shake, no red, no message change beyond the coaching table. |
| on complete | Ring flashes white, the preview punches to 1.05 and dissolves into `UNLOCKING` |

**Why decay and not reset.** A hard reset on one dropped frame is punishing and feels broken. Visible decay says *"you had it, come back"* — the only coaching that operates on a sub-second timescale.

**Accessibility.** Ring is `role="progressbar"` with `aria-valuenow` throttled to 10% increments — per-tick updates would flood a screen reader. Reduced motion: ring fills as a plain stroke, no glow, no scale, no haptic-linked pulse.

---

### B.11 Scene 8 — Unlock

**Purpose.** The teardown boundary, disguised as the transaction beat. **~2.2 s. Non-interruptible.**

| t (ms) | Beat |
|---|---|
| 0 | **Capture the last camera frame** to an offscreen canvas (this becomes *Save our photo*) |
| 0 | `cancelAnimationFrame(detectionLoop)` — **before** closing tasks |
| 0 | `stream.getTracks().forEach(t => t.stop())` · `faceDetector.close()` · `handLandmarker.close()` |
| 0 | **Assert** every `track.readyState === 'ended'`. **The camera indicator light goes out here** — a visible trust signal, and a Phase 5 exit criterion verified on hardware. |
| 0–300 | Screen darkens ~35%; the frozen frame desaturates |
| 150–500 | **One** shake — **≤ 350 ms, ≤ 8 px amplitude**, stepped |
| 300 | `sfx.unlock` |
| 400–800 | **A single 400 ms radial bloom.** Not a strobe. |
| 700 | **DELIVERY UNLOCKED** slams in — `--yellow` fill, `--border`, `--shadow-xl`, scale 0 → 1.25 → 1, rotate −8° → 2° |
| 800 | `music.play()` with an **800 ms fade-in** |
| 900 | R3F canvas (or the Lite stage) mounts behind the darken layer; one hidden frame renders to compile shaders |
| 1600–2200 | Cross-dissolve to the 3D stage |

**Photosensitivity — specified, not left to interpretation.** No full-screen luminance change greater than 10% at a rate above 3 Hz. The "magical unlock effect" is **one** radial bloom. The shake is capped at 350 ms and 8 px. Both are removed entirely under reduced motion.

**Copy.** `DELIVERY UNLOCKED`

**Interactions.** None. Not skippable — it is short enough not to need it, and interruptibility here would undercut both the payoff and the teardown.

**Replay.** Entered from `RESTING` with `skipCameraStage = true`, all teardown steps become no-ops and the beat plays identically from the darken onward.

**Accessibility.** `aria-live="assertive"`: "Delivery unlocked!" **Reduced motion: no shake, no bloom, no flash.** Replaced by an instant crossfade to the dimmed field, with the stamp fading in at scale 1.

---

### B.12 Scenes 9–10 — Delivery and Bloom

**Purpose.** The payoff. ~9 s + ~8 s.

```
 ┌───────────────────────────────────────┐
 │  [🔊]                                 │
 │            ▓▓▓▓▓▓▓                    │  black sky-hole opens
 │            ╔═════╗                    │
 │            ║ 🎁  ║   ← tumbling       │
 │            ╚═════╝                    │
 │                                       │
 │   🌷  🌷    🌷      🌷    🌷  🌷      │  tulip field
 │  ─────────────────────────────────    │  ground decal
 └───────────────────────────────────────┘
```

**Scene 9 — `DELIVERY` (~9 s).** A black sky-hole opens. A chunky wrapped box tumbles down. It **lands with a screen-punch and a dust ring**, sits for a beat, then bursts. Tulips erupt outward.

| Beat | Detail |
|---|---|
| Sky-hole | Radial black shape scales open, 400 ms, `ease-back` |
| Fall | ~1.4 s, accelerating, box rotating −12° → 0° |
| **Impact** | Box squashes to `(1.18, 0.78, 1.18)` over 90 ms, over-rebounds to `(0.94, 1.09, 0.94)`, settles with `spring.bouncy`. Dust ring expands and fades, 180 ms. Screen-punch: ≤ 250 ms, ≤ 6 px. `sfx.thud` |
| Beat | 600 ms of stillness — the box gets eyes for 500 ms |
| Burst | Lid blows off; petals launch from the pool in a 70° cone; `sfx.pop` + `sfx.whoosh`; music swells |

**Scene 10 — `BLOOM` (~8 s).** Tulips grow across the lower frame in a radial wave from the box (stem `scaleY` 0 → 1, `spring.pop`, 45 ms stagger by distance; heads unfurl 180 ms after their own stem). Petals drift. Particles taper from the burst rate to a gentle ambient rate. `frameloop` drops to `demand` once settled.

**Budgets (hard).** ≤ 45,000 triangles including outline hulls · ≤ 40 draw calls · ≤ 60 tulip instances in **one** `InstancedMesh` · ≤ 300 petals in **one** pre-allocated pool · **0** shadow maps · **0** post-processing passes · ≤ 2 lights · **0 allocations inside `useFrame`**.

**"Bloom" is faked** with additive sprites plus a CSS radial gradient overlay. A real post-processing pass costs 30–50% of the mobile frame budget and buys almost nothing at this art style.

**Degradation ladder** (rolling 2 s median FPS, one-way, never climbs back): < 45 → `dpr` 1.0 · < 34 → petals 150, **outline pass off** · < 26 → tulips 24, petals 60, freeze drift · < 20 for 3 s → **`DEGRADE_TO_LITE`**, unmount the canvas, continue in 2D from the current beat.

**The Lite twin.** Every beat above exists as a Lottie + CSS implementation with the same structure and timing. It is a parallel implementation, not a stub, and the letter is identical in both.

**Interactions.** None. No skip button — the sequence is the gift, it is ~17 s, and a skip affordance during it would be the only element on screen competing with the payoff.

**Accessibility.** The stage is `aria-hidden`. One polite announcement at entry: "A gift box falls from the sky, opens, and tulips bloom across the screen." **Reduced motion:** box **fades in already landed**; no impact punch; tulips fade in staggered at 80 ms with no overshoot; petals reduced to **60**, slow linear fall, no rotation; ambient particles static; all durations ×0.6.

---

### B.13 Scene 11 — Message

**Purpose.** Name the recipient. ~4 s.

```
 ┌───────────────────────────────────────┐
 │        (bloomed scene, 55% dim)       │
 │                                       │
 │           For Alya 🌷                 │  Display, --ink
 │                                       │  scale overshoot 1.15 → 1.0
 └───────────────────────────────────────┘
```

**Animation.** Scale overshoot **1.15 → 1.0** with `spring.pop`; the name lands 120 ms after "For". `sfx.sparkle`. The bloomed scene continues its idle sway behind.

**Copy.** `For {recipientName} 🌷` — default `For Someone Special 🌷`.

**Name handling.** Sanitized in `BOOT` by a five-line Unicode-aware regex, capped at 24 characters, rendered **exclusively as a text node**. Never `innerHTML`, never `dangerouslySetInnerHTML`.

**Mobile.** `clamp(2rem, 11vw, 3.5rem)`, wrapping to two lines with the name on its own line for names over 10 characters. Never truncates — long names shrink.

**Accessibility.** `<h2>`, announced once politely. Reduced motion: **opacity only**, no overshoot.

---

### B.14 Scene 12 — Letter

Covers `LETTER_CLOSED` and `LETTER_OPEN`.

**Closed.**

```
 ┌───────────────────────────────────────┐
 │  For Alya 🌷                   [🔊]   │  shrunken headline
 │        (bloomed scene, 35% dim)       │
 │         ┌───────────────────┐         │
 │         │  ✉  envelope      │         │  --border, --shadow-xl
 │         │     wax seal      │         │  idle float ±4px
 │         └───────────────────┘         │
 │        [  Open Letter  💌  ]          │  Primary xl
 └───────────────────────────────────────┘
```

**Open — three beats, ~1.5 s total.**

| ms | Beat |
|---|---|
| 0–60 | Wax seal pops off with a small rotation and falls out of frame. `sfx.pop` |
| 60–580 | **Flap peels** — `transform-style: preserve-3d`, `transform-origin: top`, rotate 165°, `spring.gentle` |
| 300–900 | Paper slides up out of the envelope, `scale 0.92 → 1`. `sfx.page` |
| 700–1180 | Paper **unfolds** in two stages, `scaleY 0.55 → 1`, with a fold-line highlight sweeping down |
| 900+ | Message paragraphs fade and rise in, 120 ms stagger. `sfx.chime` on the first |

**The payload is decoded on this transition** — base64 + XOR de-obfuscation. Not before. This is a **spoiler guard against casual View Source, explicitly not security**, and it must be documented as such in the code so nobody later mistakes it for protection.

**Content rules.**
- The letter is **real, selectable, screen-readable DOM text.** Never an image. Never canvas.
- It lives in **one obvious config module**. It is the cheapest thing in the project and deserves the most care.
- `<html lang>` matches the letter's actual language (`id` if the copy is Indonesian).

**Mobile.** Paper is `min(92vw, 440px)`, `max-height: 62dvh` with internal scroll and `overscroll-behavior: contain`. Must be **readable at 375 px and at 200% zoom with no horizontal scroll** — a Phase 7 exit criterion. A cream fade at the card's bottom edge signals scrollability.

**Accessibility.** `role="article"`, `aria-labelledby` the shrunken headline. On open, focus moves into the letter (`tabIndex={-1}`) and it is announced politely. Verified with VoiceOver in Phase 7. Reduced motion: **crossfade** to the open letter; no 3D flap, no unfold; paragraphs appear together.

---

### B.15 Scene 13 — Resting

**Purpose.** An ending, a memory, and a second viewing. v1 had none of these.

```
 ┌───────────────────────────────────────┐
 │  For Alya 🌷                   [🔊]   │
 │     (bloomed scene, idle, demand)     │
 │                                       │
 │        [ Read again      📖 ]         │  Secondary lg
 │        [ Replay the moment ↺ ]        │  Secondary lg
 │        [ Save our photo   📷 ]        │  Secondary lg
 │                                       │
 │        made with 🌷 · credits         │  Tertiary caption
 └───────────────────────────────────────┘
```

**Idle cost.** `frameloop="demand"`, invalidating only on interaction. **< 5% GPU** — a hard budget, because this state is indefinite and a phone left on this screen must not get warm.

**Actions.**

| Button | Result |
|---|---|
| **Read again** | → `LETTER_OPEN` |
| **Replay the moment** | → `UNLOCKING` with `skipCameraStage = true`. **The camera is never re-requested.** |
| **Save our photo** | Composites locally and downloads a PNG: the captured unlock frame + a flower overlay + *"For Alya 🌷"*. **Nothing is uploaded.** |

**Photo correctness.** The preview was mirrored for display; **the saved photo must be un-mirrored and correctly oriented.** This is a Phase 7 exit criterion because it is easy to get wrong and embarrassing to ship wrong.

**Peek-alone variant.** If `peekedAlone`, the letter actions are replaced by a warm hold: *"The rest is for when you're together 💌"* plus **[ Try again with them ]** (a full reload). When they return and unlock properly, `MESSAGE` gains the extra line **"There you are. Now the real one."**

**Returning visitors.** `bloom_unlocked === '1'` routes `BOOT → RESTING` directly, with a small **[ Do it all again ]** to replay from the box drop.

**Colophon.** Required if OpenMoji (CC BY-SA 4.0) or other attributed assets shipped. Links to `ATTRIBUTIONS.md`.

**Accessibility.** Three real `<button>`s in a logical tab order. Reduced motion: no idle drift at all.

---

### B.16 `CAMERA_DENIED` — platform-specific recovery

**There is no generic version of this screen.** A generic retry button is a **no-op on iOS**, which is worse than no button.

| Platform | Screen |
|---|---|
| **iOS Safari** | A second `getUserMedia` throws `NotAllowedError` **immediately, with no prompt**. Retry is impossible in-page. → Illustrated steps: **AA** in the address bar → *Website Settings* → *Camera* → *Allow*. Primary action: **[ Reload ]**. **No "Try again" button.** |
| **Android Chrome** | Recoverable via the lock/tune icon; a re-prompt sometimes works. → Illustrated lock-icon steps + a genuine **[ Try again ]**. |
| **Desktop** | Recoverable via the address-bar camera icon. → Icon-location illustration + **[ Try again ]**. |

```
 ┌─────────────────────────────────┐
 │      😊  (sheepish character)   │  --peach fill, NEVER red
 │  We can't see yet               │  H1
 │  Your browser is keeping the    │  Body L
 │  camera to itself 💛            │
 │  ┌───────────────────────────┐  │
 │  │ 1  Tap AA in the address  │  │  illustrated, per-platform
 │  │ 2  Website Settings       │  │
 │  │ 3  Camera → Allow         │  │
 │  └───────────────────────────┘  │
 │  [ Reload ]                     │  Primary
 │  [ Just show me the flowers ]   │  Secondary
 └─────────────────────────────────┘
```

**Every one of the three variants carries [ Just show me the flowers ]** → Lite.

**Accessibility.** `role="alert"` on the headline group, announced once. Focus moves to the primary action. Contrast on `--peach` is 11.2:1.

---

### B.17 `CAMERA_ERROR` — five failures, five copies

| `err.name` | Headline | Body | Primary |
|---|---|---|---|
| `NotFoundError` | *No camera? No problem.* | *Let's skip straight to the good part 🌷* | **[ Open your delivery ]** (Lite) |
| `NotReadableError` | *Camera's busy!* | *Something else is using it — close that app and tap below 📸* | **[ Try again ]** |
| `OverconstrainedError` | *That camera's a bit unusual* | *Let's do this the easy way 🌷* | **[ Open your delivery ]** (Lite) |
| `AbortError` | *That didn't quite start* | *Let's give it another go 🫶* | **[ Try again ]** |
| `MODELS_FAILED` | *The magic is being shy* | *The flowers are having trouble loading ✨* | **[ Try again ]** + **[ Skip to the delivery ]** |

All five carry **[ Skip to the delivery ]**. Retry is only offered where retry genuinely works (`!isTerminalCameraError`).

---

### B.18 `CAMERA_INTERRUPTED` and `FATAL_ERROR`

**`CAMERA_INTERRUPTED`** — a phone call, an app switch, a revoked track.

```
 ┌─────────────────────────────────┐
 │   ⏸  Camera paused              │  H2
 │   Tap to bring it back          │  Body
 │   [ Resume ]                    │  Primary lg
 └─────────────────────────────────┘
```

**Mercy timers are paused.** A phone call must not cost the user their patience budget. On `TRACK_ENDED`, re-acquisition is attempted **automatically once** before this screen is shown at all. On recovery, the machine returns to **exactly the previous state** with progress intact.

**`FATAL_ERROR`** — the last line of the no-dead-end invariant.

```
 ┌─────────────────────────────────┐
 │   🌷  Something wobbled          │  H1
 │   But your letter is safe 💌    │  Body L
 │   [ Take me to the letter ]     │  Primary xl
 │   ┌───────────────────────────┐ │
 │   │ iPhone14,3 · iOS 17.2 ·   │ │  monospace, selectable
 │   │ Safari · webgl2:yes ·     │ │
 │   │ state:BLOOM · TypeError…  │ │
 │   └───────────────────────────┘ │
 │   [ Copy diagnostic ]           │  Tertiary
 └─────────────────────────────────┘
```

**Why copyable and not sent.** This is the agreed substitute for the rejected error beacon. Any network egress would put an asterisk on *"your camera never leaves this phone"*, and that asterisk costs more than the telemetry is worth. If it breaks, she screenshots it.

---

### B.19 The Lite tier

**Lite is not a screen — it is a parallel implementation of Phase B**, reached from: no WebGL2 · no camera hardware · Firefox mobile · model failure · permission denial · in-app browser refusal · `DEGRADE_TO_LITE` · `FATAL_ERROR`.

| Property | Rule |
|---|---|
| Entry | **[ Open your delivery ]** — one tap, no gesture, no camera |
| Sequence | Lottie + CSS, same beat structure and timing as Scenes 9–11, ≤ 150 KB |
| Letter | **Identical.** Not reduced, not summarised. |
| Labelling | **None.** No "lite mode" badge, no watermark, no apology. |
| Resting | Same three actions, minus **Save our photo** when there is no captured frame |

**Schedule warning.** Lite is the thing most likely to be deprioritised, and deprioritising it leaves *every* fallback path broken. It is a Phase 5 deliverable with its own exit criterion: *every failure state reaches the letter via Lite.*

---

## C. Motion System

### C.1 Duration tokens

| Token | ms | Use |
|---|---|---|
| `d-instant` | 80 | press feedback |
| `d-fast` | 120 | hover, small swaps |
| `d-quick` | 180 | icon changes, chip fills |
| `d-base` | 240 | standard entrance/exit |
| `d-slow` | 320 | card entrance, HUD swap |
| `d-slower` | 480 | screen transitions, ring decay |
| `d-scene` | 720 | major scene changes |
| `d-beat` | 1200 | choreographed narrative beats |

**Under reduced motion, every duration is multiplied by 0.6.**

### C.2 Easing tokens

| Token | Curve | Use |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | default |
| `ease-entrance` | `cubic-bezier(0.16, 1, 0.3, 1)` | arriving |
| `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | leaving |
| `ease-back` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | playful overshoot |
| `ease-sine` | `cubic-bezier(0.37, 0, 0.63, 1)` | idle loops, floats |
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | **the reduced-motion substitute for every spring** |

### C.3 Spring tokens

PRD v2 names `stiffness 300, damping 12` as the reference bouncy spring. The family is derived from it:

| Token | stiffness | damping | mass | Character | Use |
|---|---|---|---|---|---|
| `spring.bouncy` | **300** | **12** | 1 | The PRD reference — clear, cartoony bounce | Hero entrance, box settle, envelope drop, confetti |
| `spring.pop` | 420 | 20 | 0.8 | Snappy with a visible pop | Badges, chips, stamps, tulip growth, message reveal |
| `spring.gentle` | 200 | 26 | 1 | Soft settle, minimal overshoot | Cards, HUD swaps, ring decay, letter flap |
| `spring.snappy` | 500 | 34 | 0.9 | Fast, near-critical | Toggles, small state changes |

**Ad-hoc stiffness/damping values are a review-blocking defect.** Every spring in the codebase references one of these four.

### C.4 Overshoot rules — the "juice"

1. **Everything that enters, overshoots** — minimum 8% scale overshoot on first appearance. Exception: body copy longer than one line, where overshoot reads as jitter.
2. **Everything that impacts, squashes** — deform on the anti-axis, `(1.18, 0.78)` in, rebound `(0.94, 1.09)`, settle. Volume approximately preserved, which is what makes it read as physical.
3. **Anticipation before big moves** — pull back 4–6% opposite the motion for 80 ms. Applied to the box drop, the envelope open, and the unlock stamp.
4. **Secondary motion is required.** Nothing moves alone. When the box lands, the dust ring, the ground shadow and the screen all react.
5. **Stagger everything countable** — 40–120 ms between siblings. Never simultaneous.
6. **No linear easing anywhere** except: the progress ring fill (it must map truthfully to real progress), audio fades, and position along an idle sine path.
7. **Idle is never fully static** — amplitude ≤ 4% of element size, period ≥ 1.6 s, so it never competes with intentional motion. Except on `RESTING`, where the GPU budget wins.

### C.5 Reduced-motion variants

Set by `prefers-reduced-motion: reduce` **or** the Pre-flight toggle → `motionSafe = false`, honoured by every animated element through one root `MotionConfig`.

> **Content is never removed — only motion is.**

| Element | Full | Reduced |
|---|---|---|
| Springs / overshoot | `spring.bouncy` (300/12) | `ease-out`, **no overshoot** |
| Unlock camera shake | ≤ 350 ms, 8 px | **removed entirely** |
| Unlock radial bloom | 400 ms | **removed entirely** |
| Screen darken | animated | instant crossfade |
| Box fall | physics drop + impact punch | fade + gentle scale-in, already landed |
| Tulip eruption | radial explosion | staggered fade-in, 80 ms apart |
| Petals | 300, physics drift | **60**, slow linear fall, **no rotation** |
| Message reveal | scale overshoot 1.15 → 1.0 | **opacity only** |
| Envelope unfold | 3-beat 3D flip | crossfade |
| Confetti (Scene 6) | burst | removed; headline fades |
| Ambient particles | continuous | static |
| Parallax | on | **off** |
| CTA breathing | on | off |
| Durations | baseline | **× 0.6** |

**Retained under reduced motion:** the gesture diagram loop (it is instructional content, not decoration — removing it makes the core interaction unlearnable), the progress ring fill (it conveys state), and **all audio**. Reduced motion is not reduced sound.

### C.6 Photosensitivity — a hard safety rule

- **No full-screen luminance change greater than 10% at a rate above 3 Hz**, anywhere, in any mode.
- The unlock effect is **one** 400 ms radial bloom. Not a strobe.
- The camera shake is capped at **350 ms and 8 px** and removed under reduced motion.
- **The palette contains no saturated red**, which removes the highest-risk flash colour by construction.

---

## D. Audio System

### D.1 Architecture

Howler, **`html5: false`** (Web Audio, required for playback-rate manipulation and low latency), `preload: false` until the staging schedule calls for it.

```
 Scene 1 "Start" tap   ← the ONLY reliable user gesture in the flow
    ├─ new AudioContext() → ctx.resume()
    ├─ play a one-sample silent buffer      [the iOS unlock ritual]
    └─ Howler initialised
 Scene 5 enter  → prefetch the SFX sprite sheet
 Scene 6 enter  → prefetch the music track
 Scene 9 enter  → music.play(), fade in 800 ms
 visibilitychange → hidden : Howler.volume(0) + ctx.suspend()
                  → visible: ctx.resume(), restore volume
 Mute toggle: persistent, every scene, localStorage 'bloom_muted'
```

**The context is created once and kept alive for the whole session.** The last user gesture before music starts is ~45 s earlier. This is the difference between a silent climax and a working one, and it is not recoverable later.

### D.2 Sound effects — one sprite sheet, six sounds, ≤ 120 KB

| Id | Trigger | Character |
|---|---|---|
| `sfx.pop` | button press · seal pop · lid burst | short bright pop |
| `sfx.sting` | `TOGETHER_CONFIRMED` confetti | 2-note rising bell |
| `sfx.charge` | `GESTURE_HOLDING`, **looped**, playback rate mapped `0.9 → 1.6` from `holdProgress` | rising sustained tone |
| `sfx.thud` | box impact · unlock | deep soft thud |
| `sfx.whoosh` | burst · sky-hole | airy sweep |
| `sfx.page` | letter slide + chime | paper + warm bell |

Six sounds in **one file** with a timing map. Sixteen separate requests for 20 KB files is pure overhead, and sprite playback removes per-sound decode latency. Format: Opus in WebM with an AAC/M4A fallback for older Safari.

### D.3 Music

- One instrumental loop, **≤ 60 s, ≤ 900 KB**, mono, 128 kbps AAC + Opus.
- Starts at `UNLOCKING` exit with an **800 ms fade-in**. Never starts at full volume — users may be in public.
- Swells during `burst`, settles through `BLOOM`, holds under the letter.
- Authored so `loop: true` has no audible seam.
- **Confirm the licence before shipping.** If the track has lyrics, the lyric text ships as visible optional text; instrumental is preferred and recommended.

### D.4 Mute

- One toggle, fixed top-right, present from Scene 1 onward. Mutes **both** buses — never separate music/SFX controls, which is a settings panel this product should not have.
- Persisted to `bloom_muted`, restored at `BOOT`.
- A real `<button>` with `aria-pressed` and the label `Mute sound` / `Unmute sound`.
- Muting during `sfx.charge` fades it over 100 ms rather than cutting.

### D.5 Constraints and fallback

| Restriction | Handling |
|---|---|
| Autoplay needs a gesture | Context unlocked on the Scene-1 tap |
| The gesture is ~45 s before music | Context kept alive, never recreated |
| iOS suspends on backgrounding | `ctx.resume()` on every return |
| **iOS physical ringer switch mutes Web Audio** | **Unfixable.** Scene 1 shows *"Sound on for the full effect 🔊"* so a silent run is understood, not experienced as a bug. |
| Audio assets fail to load | Silent run; mute control shows unavailable; no error surfaced |

> **All sound is decorative. No information is conveyed by audio alone.** Every beat must read correctly with sound off.

---

## E. Responsive Rules

### E.1 Breakpoints

| Name | Range | Layout |
|---|---|---|
| `mobile` | 0 – 599 px | Single column, 20 px gutters, full-bleed camera stage, bottom-anchored actions |
| `tablet` | 600 – 1023 px | Single column capped at 560 px, 32 px gutters |
| `desktop` | 1024 px+ | Content capped at 640 px; camera stage capped at 720 × 540 in a decorative bordered frame |

**Minimum supported width: 375 px.** Every component is authored at 375 px and scaled up.

### E.2 Viewport units

| Unit | Where |
|---|---|
| `100dvh` | all full-height containers |
| `100vh` | **fallback only**, inside `@supports not (height: 100dvh)` |
| `lvh` | background layers and the 3D canvas, so no cream gap appears when the toolbar collapses |
| `svh` | bottom-pinned CTAs, so they never hide behind browser chrome on first paint |

Mobile Safari's collapsing toolbar will otherwise shift a full-screen camera layout **mid-experience**. The camera stage also subscribes to `visualViewport` resize, because Android Chrome's URL-bar collapse fires no standard resize event.

### E.3 Orientation

| Orientation | Behaviour |
|---|---|
| **Portrait (primary)** | Canonical for every scene. |
| **Landscape phone** | **Tripod Mode.** Framing guides move to 26% / 74%; the coaching HUD docks into the right third; **G2 is accepted at all mercy levels**, because a propped phone frees both hands and the finger heart is the natural pose. A one-time hint explains this. |
| **Landscape tablet/desktop** | Treated as desktop. |
| **Rotation mid-flow** | Layout reflows. **The stream is never reacquired** — reacquiring on rotate costs 1–2 s and can lose the permission on some Android builds. Only the aspect-correction constant is recomputed. |

**Why portrait is primary, restated.** The actual pose is an arm's-length selfie — the universal instinctive posture for two people and a phone. In that pose two heads fill portrait's horizontal middle comfortably, and portrait's surplus **vertical** space is exactly where a raised heart goes. Landscape would push the pair apart, shrink the hands, and break the one-handed grip.

### E.4 Safe areas

- `viewport-fit=cover` in the meta viewport; `env(safe-area-inset-*)` padding on **all fixed UI**.
- **Nothing interactive** sits inside the insets. Neo-brutalist chunky buttons under the home indicator is a real and very likely bug.
- The camera preview letterboxes with `--cream` rather than cropping — a face partially hidden by a notch is a detection failure the user cannot diagnose.

### E.5 Other rules

- Touch targets **≥ 48 × 48 CSS px with ≥ 8 px separation**, enforced with a padded pseudo-element rather than by inflating visual size.
- All text uses `clamp()`; no per-breakpoint font-size overrides.
- Hover states only under `@media (hover:hover) and (pointer:fine)`. Sticky hover on touch is a defect.
- **No horizontal page scroll at any width.** Wide content scrolls inside its own container.
- Prefer `100%` over `100dvw` to avoid scrollbar-width overflow on desktop.

---

## F. Accessibility

The experience **structurally requires a camera** and cannot be made universally operable. It **can** be made safe and non-trapping, and both are requirements, not aspirations.

**Target:** Lighthouse accessibility ≥ 95; WCAG 2.1 AA on everything that is not the camera gate itself.

### F.1 Contrast

Fully specified in §A.2. The enforceable rule: **`#111111` is the only text color in the application.** A CI check on the token pair table fails the build on violation.

Coaching copy over the camera preview always sits inside an opaque `--cream` card. Text over live video can never guarantee contrast and must never be attempted.

### F.2 Focus

- **3 px solid `#111111`, 2 px offset**, on every focusable element, **in addition to** its own border.
- `:focus-visible` only.
- Never `outline: none` without a replacement; containers that clip use an inset ring.
- **Focus management on every scene change:** focus moves explicitly to the new scene's primary heading (`tabIndex={-1}`) or primary action. Focus is never left on an unmounted node.
- No positive `tabIndex` anywhere.

### F.3 Operability

- **Every scene is advanceable by keyboard.**
- **The escape hatch is in the DOM and keyboard-focusable from t=0** in the gesture stage, visually revealed at 45 s. This is the provision that satisfies WCAG 2.5.4 (motion actuation) and, more importantly, means keyboard and screen-reader users are never trapped behind a gesture they cannot perform.
- The Lite path is reachable from **every** failure screen with one tap.
- `Escape` closes any modal and returns focus to the invoking element. No keyboard traps.

### F.4 Screen reader strategy

**Two live regions, always present:**

| Region | Politeness | Carries |
|---|---|---|
| `#sr-status` | `polite` | coaching states, load progress, scene descriptions |
| `#sr-alert` | `assertive` | unlock confirmation, errors, permission outcomes |

**Throttling — mandatory.** Coaching state changes are **debounced to 1.5 s minimum** and identical text is not re-announced. An unthrottled live region driven by a 15 Hz detection loop is unusable.

| Scene | Announcement |
|---|---|
| Landing | `<h1>` only |
| Pre-flight | "Camera stays on your phone. Nothing is recorded, uploaded, or saved." |
| Warming up | "Starting camera." + real progress |
| Find each other | "Waiting for two people." → "One person detected." → "Two people detected." |
| Solo prompt | "Someone's missing. This only opens for two. You can wait, or peek alone." |
| Make a heart | the coaching state, debounced |
| Holding | "Holding, 50 percent." (10% steps) |
| Unlock | **assertive** "Delivery unlocked!" |
| Delivery / Bloom | once: "A gift box falls from the sky, opens, and tulips bloom across the screen." |
| Message | "For Alya." |
| Letter | focus moves in; the full text is real DOM text |
| Resting | "Read again. Replay the moment. Save our photo." |

**Semantics.** The `<video>` is `aria-hidden="true"` **with a text description of what it is showing** nearby. The R3F canvas is `aria-hidden="true"`. `<main>` wraps the experience; the letter is `role="article"`. Decorative emoji inside copy are wrapped in `aria-hidden` spans so they are not read mid-sentence.

### F.5 Motion and audio safety

- Reduced motion: §C.5. Content is never removed, only motion.
- Photosensitivity: §C.6. No luminance change > 10% above 3 Hz; one radial bloom; no saturated red in the palette.
- Audio: all sound is decorative; mute persists; music fades in over 800 ms.

### F.6 Documented exceptions

| Exception | Justification | Mitigation |
|---|---|---|
| The camera preview has no text alternative | A live feed of the user has no meaningful static description | Every state derived from it is announced as text; the experience is completable without ever seeing it |
| The core interaction requires vision and hands | The product premise is a physical co-present act | The escape hatch is DOM-present and keyboard-focusable from t=0, and the Lite path delivers an identical letter |
| The 3D sequence is decorative | It carries no information not repeated elsewhere | `aria-hidden` + one descriptive announcement + a full 2D twin |
