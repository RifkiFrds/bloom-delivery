# RUNBOOK — Bloom Delivery

One page. Everything needed to send this, and everything that must be measured
on hardware before it is sent.

---

## 1. Before anything else

| # | Task | Why |
|---|---|---|
| 1 | **Write the letter.** `src/content/letter.ts` → `LETTER_PLAIN`. Set `LETTER_LANG` to the language you actually wrote in. | It is the point of the project and the cheapest thing in it. A screen reader will pronounce Indonesian with an English voice if `lang` is wrong. |
| 2 | **Set the recipient's name.** Either hardcode it in `content/copy.ts`'s usage, or pass `?to=Name`. | `?to=` is Unicode-aware, capped at 24 characters, rendered as a text node. |
| 3 | **Choose the URL slug.** Deploy at `/d/<something-unguessable>`. | URL secrecy is the actual access control. The root path is a neutral placeholder and links nowhere. |
| 4 | **Supply the audio** (optional). `public/audio/sfx-sprite.{webm,m4a,mp3}` and `music.{webm,m4a,mp3}`. Offsets are fixed in `src/audio/sprite.ts`; SFX must be one sprite file. | Without them the experience runs SILENT, which is a supported outcome — all sound is decorative. Confirm the music licence before shipping. |

---

## 2. Local development

```bash
pnpm install
pnpm vision:fetch          # self-hosted MediaPipe runtime + models (~7.7 MB)
pnpm dev:https             # HTTPS — getUserMedia needs a secure context
```

**`pnpm dev` (plain http) cannot access the camera from a phone.** Use
`dev:https` and accept the self-signed certificate, or a tunnel. Phases 2–4 are
almost entirely camera testing, and without this every test is a deploy cycle.

`?debug=1` turns on the detection HUD: every condition, its measured value, its
current threshold, the inference p50/p95, the React re-render counter, and
force-unlock / mercy-level controls. **The gesture cannot be tuned blind.**

---

## 3. The gates

```bash
pnpm build                 # required before pnpm budgets — see below
pnpm verify                # typecheck + lint + unit tests + budgets
pnpm e2e                   # Playwright, both motion modes
```

`pnpm budgets` measures the JavaScript budgets from `.next`. It refuses to
measure a development build, because a dev build's unminified chunks would
report a 1.7 MB entry and fail a build that is fine — **a false alarm teaches
people to ignore the gate.** Always `pnpm build` first.

---

## 4. What is still unmeasured — read this before sending

Doc 05 §12: *"a criterion measured in the simulator is not measured."* The
following are hardware-only facts and none of them have been established.

| Criterion | How to measure |
|---|---|
| **G1 true-positive ≥ 85%**, false-positive = 0 | §5 below. **The single largest open risk.** |
| Camera indicator light off within 500 ms of unlock | Physical observation. No software check substitutes. |
| JS heap drops after teardown | Chrome DevTools heap snapshot, immediately before and 2 s after `UNLOCKING`. |
| Inference ≤ 60 ms p95 | `?debug=1` HUD, slowest device, **evening light**. |
| ≥ 30 fps on the slowest device, ≥ 55 Tier 1 | The `Degrader` writes each rung to the diagnostic log. |
| Zero allocations in `useFrame` | DevTools → Memory → Allocation sampling during the sequence; assert a flat line. |
| Camera preview ≤ 2.5 s after grant on 4G | Throttled network, real phone. |
| Music plays on a real iPhone after the ~45 s gap | Device only. iOS audio is the buggiest surface in any web experience. |
| In-app browsers | Send the real production link through WhatsApp, Instagram DM, and whichever app will actually be used, and open it. |
| OG preview | Send the real link to yourself and look at the card. It must show the teaser, never the name. |
| Full run ≤ 180 s | Stopwatch, twice, on the slowest device. |
| VoiceOver pass | Real device, real screen reader. |

---

## 5. Closing the detection measurement — the three-step task

The geometry is unit-tested. The *rates* are not, and cannot be without real
hands. This is a half-day with a second person, not a project:

```bash
# 1 — record the 15 clips from docs/03-DETECTION-ALGORITHM.md §10.3,
#     in daylight AND in an actual evening room with the lights you'd have on.

# 2 — replay each through the spike, press E, save the JSON:
pnpm spike                 # then drop exports into tests/fixtures/recorded/

# 3 — index and measure:
pnpm fixtures
pnpm test
```

`tests/recorded.test.ts` then reports the true-positive rate, the
false-positive rate, and whether evening light is represented. Until the clips
exist it appears in every test run as a **skipped test named "NOT MEASURED"**,
so the gap is visible rather than silent.

**The day-8 contingency is pre-decided.** If G1 true-positive is below 70%,
promote G2 to primary: change `GESTURE_PRIMARY` and `MERCY.thresholdsMs[1]`
(20 s → 10 s) in `src/detection/config.ts`, and swap the coaching diagram. Take
that decision on the day and do not let it slide. **The gate is not the gift.**

---

## 6. Deploying

```bash
pnpm build && pnpm budgets    # both must be green
```

- Deploy to Vercel. The middleware sets a per-request CSP nonce, so every route
  renders dynamically. That is intended.
- Verify the response headers in production: `Content-Security-Policy` with a
  `nonce-`, `Permissions-Policy: camera=(self)`, `Referrer-Policy: no-referrer`,
  `X-Robots-Tag: noindex, nofollow`.
- `connect-src 'self'` is the line that makes *"your camera stays on your
  phone"* true. **If anything is ever added that needs a third-party origin,
  that sentence stops being true and the privacy copy must change with it.**

---

## 7. On the day

1. Rehearse the whole thing end to end on the recipient's phone model, at the
   actual time of day, with the actual link.
2. Have two people who have never seen it run it **with no verbal help**. If
   they need a hint, the coaching copy is wrong, not the people.
3. Send the link. Do not paste it into a group chat first to "check the
   preview" — the card is a teaser, but the link is the surprise.

---

## 8. If it breaks in front of her

- Every failure screen has **[ Just show me the flowers ]**. It always works.
- The escape hatch appears at 45 s and becomes the primary action at 90 s. It
  never fires itself; it is always a tap.
- `FATAL_ERROR` shows a copyable diagnostic. Nothing is ever sent anywhere —
  she screenshots it.
- **The gift always arrives.** The gesture only decides how magical the arrival
  feels.
