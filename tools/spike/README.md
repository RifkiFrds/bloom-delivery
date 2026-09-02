# Phase 0 — Feasibility Spike

**THROWAWAY.** Never imported by `src/`. Its purpose is to answer one question
before any production code is written:

> **Is `S = dist(landmark 0, landmark 9)` ≥ 0.045 at the pose two people
> actually adopt with a phone at arm's length?**

`S >= 0.045` → build G1 (two-hand heart) as primary, exactly as Doc 03 specifies.
`S <  0.045` → promote G2 (one-hand finger heart) to primary, re-coach the
gesture, move mercy level 1 to t = 10 s.

That is a **one-day documentation change now, or a three-week rework in Phase 4.**

---

## Setup

From the repository root, once:

```bash
pnpm install --dir tools/spike
node scripts/fetch-vision-assets.mjs      # ~7.7 MB of models + WASM runtime
```

Then:

```bash
cd tools/spike
pnpm dev
```

The server binds on **HTTPS, port 5180, all interfaces**. It prints a LAN URL
such as `https://192.168.1.20:5180`.

**HTTPS is not optional** — `getUserMedia` requires a secure context, so a phone
cannot use `http://<laptop-ip>`. The certificate is self-signed: the phone will
warn once, and you must tap through it ("Advanced" → "Proceed").

Laptop and phone must be on the same network.

---

## The controls

| Control                | Purpose                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Start camera**       | Acquires 720p, loads the face model (blocking), starts the 15 Hz loop, then loads the hand model in the background                     |
| **Stop / teardown**    | Cancels the loop **first**, then stops tracks and closes both tasks — the exact order Phase 5 will use. Watch the camera light go out. |
| **device label**       | Written into the exported report. Set it before measuring.                                                                             |
| **daylight / evening** | Tags every trial. TP rates are reported separately per lighting.                                                                       |
| **mercy**              | `auto` follows the 20/45/90 s ladder. Force a level to test G2/G3 acceptance without waiting.                                          |
| **file picker**        | Replays a recorded clip through the identical pipeline — repeatable tuning with no second person needed                                |

| Key          | Action                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| <kbd>P</kbd> | Trial **passed** — the heart was made and it unlocked                   |
| <kbd>F</kbd> | Trial **failed** — the heart was made and it did not                    |
| <kbd>R</kbd> | Rejection pose **correctly rejected**                                   |
| <kbd>X</kbd> | Rejection pose **falsely accepted** ← the number that must stay at zero |
| <kbd>E</kbd> | Export the last 300 ticks of landmarks as a fixture JSON                |
| <kbd>M</kbd> | Export the measurement report JSON                                      |

---

## The protocol

Run this on **three devices**: the oldest iPhone you can borrow, a mid-range
Android, and one flagship or desktop. Doc 05 §12: _a criterion measured in the
simulator is not measured._

### Step 1 — `S` at the real pose (the gate)

1. Set the device label. Set lighting to `daylight`.
2. **Start camera.** Stand as two people naturally would: arm's length, portrait,
   one person holding the phone.
3. Both people raise one hand and form a heart together. Hold it.
4. Watch the `S` line in the HUD and the `MEASUREMENT` block.
5. Move naturally through the range you would actually use — a little closer, a
   little further, a little to the side. Collect **at least 500 samples**.
6. Press <kbd>M</kbd>.

The report's `palmScale.p5` is the number that decides. **Use p5, not the
median** — the gate has to work in the fifth-percentile case, not the typical
one.

### Step 2 — True-positive rate

For each lighting condition, **20 attempts**:

1. Set the lighting selector correctly.
2. Break the pose completely between attempts. Form the heart. Give it up to
   20 seconds.
3. Press <kbd>P</kbd> if it unlocked, <kbd>F</kbd> if it did not.

Targets: **≥ 80% daylight, ≥ 60% evening.**

Run the evening set **in an actual evening room with the lights you would
actually have on.** Do not simulate it by dimming a monitor.

### Step 3 — False-positive rate

**20 attempts each**, mercy forced to `0`:

- Clasped hands
- High five (both palms toward the camera)
- Open palms, fingers splayed
- Prayer hands
- A handshake

Press <kbd>R</kbd> when correctly rejected, <kbd>X</kbd> when falsely accepted.

Target: **zero false accepts.** Any `X` is a blocking failure — note which
condition let it through (the HUD shows `FAIL@Cn` for the near-misses) and
tighten that threshold in `src/config.ts`.

### Step 4 — Inference budget

Read `perf p95` from the HUD on the **slowest** device, in **evening** light
(low light forces the models to work harder).

Target: **p95 ≤ 60 ms.** Above that, the loop self-degrades to 10 Hz; above
110 ms it drops face detection.

Also record which delegate each model got. If either says `CPU`, note the device
— the GPU-delegate fallback path has then been exercised for real, which is a
Phase 0 goal.

### Step 5 — Face latch

Ten times: both people look at the camera from out of frame. Time to
`FACES_ACQUIRED` is recorded automatically and reported as
`latch withinTargetRate`.

Target: **≥ 90% within 3 s.**

### Step 6 — Fixtures

Record **15 clips**, 5–10 s each at 720p, using the phone's own camera app.
Then for each clip: load it with the file picker, let it play through, and press
<kbd>E</kbd> to dump the landmarks.

| #   | Clip                                        | Expectation                            |
| --- | ------------------------------------------- | -------------------------------------- |
| 1   | Daylight, two-hand heart                    | `accept-G1`                            |
| 2   | Evening light, two-hand heart               | `accept-G1`                            |
| 3   | Finger heart, one hand                      | `accept-G2-mercy1`                     |
| 4   | Mirrored finger hearts                      | `accept-G3-mercy1`                     |
| 5   | One person only                             | `no-latch`                             |
| 6   | Three people                                | `latch` (`>= 2`, not `== 2`)           |
| 7   | A poster in frame with one person           | `documents-accepted-risk`              |
| 8   | Clasped hands                               | `reject-C5`                            |
| 9   | High five                                   | `reject-C6`                            |
| 10  | Open palms                                  | `reject-C7`                            |
| 11  | Hands too far                               | `reject-C1`                            |
| 12  | Phone-holder pose, heart with the free hand | `accept-G1`                            |
| 13  | Very dark room                              | `too-dark`                             |
| 14  | Heart with one hand briefly leaving frame   | `hold-decays-not-resets`               |
| 15  | OK sign                                     | `documents-accepted-G2-false-positive` |

These JSON files become Phase 4's unit-test suite. Doc 03 §10.3: _this is what
turns threshold tuning from a two-people-in-a-room loop into a ten-second loop,
and it is the single highest-leverage piece of tooling in the project._

---

## Exit criteria

Copy this into the Phase 0 sign-off:

- [ ] `S` p5 ≥ 0.045 for both hands, on **all three** devices
- [ ] G1 true-positive ≥ 80% over 20 attempts, good light
- [ ] G1 true-positive ≥ 60% over 20 attempts, evening light
- [ ] G1 false-positive = 0 over 20 attempts each of clasped / high-five / open palms
- [ ] Combined inference p95 ≤ 60 ms on the slowest device
- [ ] Face latch ≥ 90% within 3 s with both people looking at the camera
- [ ] 15 fixture clips recorded with landmark dumps and expectations
- [ ] Measurement report exported per device

**If any of the first four fail, the detection strategy changes before Phase 1
work continues.** That decision is cheap now and expensive later.

---

## What this spike deliberately does not have

No product UI, no animation, no flowers, no letter, no state machine, no styling
beyond what makes the numbers readable. Phase 0 validates feasibility and
nothing else.
