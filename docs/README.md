# Bloom Delivery — Engineering Specifications

Authoritative implementation reference, derived from [`PRD-V2.md`](./PRD-V2.md).
No implementation code — architecture and specifications only.

| # | Document | Discipline | Covers |
|---|---|---|---|
| 1 | [01-SYSTEM-DESIGN.md](./01-SYSTEM-DESIGN.md) | Principal Architect | System overview, the two-phase runtime, layered architecture, detection pipeline, rendering ownership, state architecture, asset staging, performance budgets, failure architecture |
| 2 | [02-FSM-SPEC.md](./02-FSM-SPEC.md) | Staff Frontend | 21 states with entry/exit/timers/events, full event catalogue, guards, the complete transition table, recovery flows, persistence |
| 3 | [03-DETECTION-ALGORITHM.md](./03-DETECTION-ALGORITHM.md) | Computer Vision | Coordinate space, face gate, hand model, G1/G2/G3 selection and mathematics, hold timer, hysteresis, false-positive analysis, low light, debug mode, performance constraints |
| 4 | [04-UIUX-SCREEN-SPEC.md](./04-UIUX-SCREEN-SPEC.md) | Product Designer / UX Architect | Design system, 19 screens and states, motion system, audio system, responsive rules, accessibility |
| 5 | [05-IMPLEMENTATION-PLAN.md](./05-IMPLEMENTATION-PLAN.md) | Tech Lead | Track strategy, repository structure, import rules, day-0 setup, task-level breakdown per phase with definition of done, critical path, verification plan, risk register, open decisions, go/no-go |

**Precedence:** `PRD-V2.md` > these five documents. Where they touch, PRD v2 wins. These documents fix *how the code is arranged* so PRD v2's numbers are achievable and enforceable; they never soften a PRD v2 constraint.

---

## The ten decisions everything else descends from

1. **The gift must always arrive.** The gesture determines how magical the arrival feels — never whether it happens. Three-stage mercy escalation plus an escape hatch that is in the DOM and keyboard-focusable from t=0.
2. **Two disjoint runtime phases.** Camera + MediaPipe (Phase A) and WebGL (Phase B) **never** coexist. The `UNLOCKING` teardown is the boundary. This removes the four-system contention problem, the thermal risk, and the need for a Web Worker in MVP.
3. **The togetherness latch.** Prove `count(faceValid) >= 2` **once**, then remember it. During the gesture stage only `>= 1` face is needed as liveness. People turn toward each other to make a heart, which is exactly what breaks a frontal face detector — splitting the two requirements in time resolves the contradiction at no emotional cost.
4. **One hand from each person.** `numHands: 2`, not 4. The phone-holder has exactly one free hand, and hands close to the lens are large in frame — the strongest predictor of landmark accuracy. It is also more intimate: they have to reach for each other.
5. **G1 primary, G2/G3 accepted silently from t=20 s.** Coach the ideal; accept the alternatives without ever showing the softening.
6. **The detection loop never calls `setState`.** It writes one ref at 15 Hz; the HUD reads it in its own `rAF`. Zustand sees ~8 writes per session. ≤ 2 React re-renders/second during detection.
7. **`canUnlock` sets `hasUnlocked` synchronously inside the reducer.** This is what enforces "execute once" and kills every double-fire race. Any `(state, event)` pair not in the transition table is illegal.
8. **Zero network egress after initial asset load**, enforced by CSP `connect-src 'self'`. Self-hosted models, self-hosted fonts, no analytics, no error beacon — a copyable local diagnostic instead.
9. **`#111111` is the only text color.** Every brand color is a surface. The accessible choice and the neo-brutalist choice are the same choice.
10. **Budgets that are not enforced are wishes.** A build-time script checks every asset against §Performance Budgets and fails CI on violation.

---

## The single number that governs this project

**`S` — palm scale in frame-width units, at arm's length: `S = dist(landmark 0, landmark 9)`.**

```
 S >= 0.045  →  Build exactly what these documents specify. G1 primary.
 S <  0.045  →  Promote G2 (one-hand finger heart) to primary,
                re-coach the gesture, move mercy level 1 to t = 10 s.
```

**Measure it in Phase 0, before writing a line of production code.** It is a two-day answer to a question that would otherwise be discovered in week four with a Phase-6 3D scene already built on top of it. A second checkpoint exists at Phase 4 day 8: if G1 true-positive is still below 70%, promote G2 and do not let the decision slide.

---

## Constant registry — one home per class of value

| Class | Home | Documents |
|---|---|---|
| Detection thresholds, cadence, mercy timings | `detection.config` | Doc 3 |
| Transition table, guards, event types | `machine/` | Doc 2 |
| Colors, spacing, radius, shadows, type | Tailwind theme + CSS custom properties | Doc 4 §A |
| Durations, easings, springs | `motion.tokens` | Doc 4 §C |
| Asset budgets | the CI budget script | Doc 1 §8.2 |

Ad-hoc values at call sites are review-blocking defects.

---

## Build order and governing sections

| Phase | Deliverable | Governing sections |
|---|---|---|
| **0** | **Feasibility spike — do this first** | Doc 3 §5.4, §6, §10.3 |
| 1 | Shell, FSM, foundations | Doc 2 (all) · Doc 1 §3, §6 · Doc 4 §A |
| 2 | Camera, permissions, environment | Doc 1 §9 · Doc 2 §2.5–2.7 · Doc 4 §B.1, B.4, B.16–B.17 |
| 3 | Face stage + coaching | Doc 3 §2–§3, §9 · Doc 2 §2.8–2.11 · Doc 4 §B.5–B.8 |
| 4 | **Gesture stage + tuning + mercy — highest risk** | Doc 3 §4–§8, §10 · Doc 2 §2.12–2.13, §6.2 · Doc 4 §B.9–B.10 |
| 5 | Unlock, teardown, Lite path | Doc 1 §2.1 · Doc 2 §2.15 · Doc 4 §B.11, B.19 |
| 6 | 3D delivery + bloom | Doc 1 §5, §8.4, §8.6 · Doc 4 §B.12 |
| 7 | Message, letter, resting, replay | Doc 2 §2.18–2.21, §6.5 · Doc 4 §B.13–B.15 |
| 8 | Audio | Doc 4 §D |
| 9 | Hardening, device lab, rehearsal | Doc 1 §8 · Doc 3 §11 · Doc 4 §E–§F |

**Build early, out of order:** the landmark **fixture test suite** (Doc 3 §10.3). It turns threshold tuning from a two-people-in-a-room loop into a ten-second loop, and Phase 4 is the phase that decides whether this ships.

---

## Cannot be postponed, no matter the schedule pressure

- The mercy path and the escape hatch
- The teardown at `UNLOCKING`
- The `canUnlock` idempotency guard
- The in-app browser interstitial
- The platform-specific permission-denial screens
- Reduced motion
- The Lite fallback path
- `?debug=1` and the landmark fixture tests

The last two look like developer conveniences. They are not — they are what makes Phase 4 finish on time.

---

## Document changelog

**v2.0** — Rewritten against `PRD-V2.md`. The v1.0 set was written against `../PRD.MD` (the v1 creative brief) and contradicted PRD v2 on the gesture choice, the face gate, hold duration, detection cadence, smoothing strategy, worker architecture, and the state list. All four documents were replaced, not patched.
