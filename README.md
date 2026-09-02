# Bloom Delivery

A camera-based gesture unlock that hands off to a gift-reveal sequence and a
letter. Two people make a heart together; the flowers arrive.

**The gift always arrives.** The gesture decides how magical the arrival feels —
never whether it happens. Three-stage mercy escalation plus an escape hatch that
is in the DOM and keyboard-focusable from t=0.

## Requirements

- Node.js >= 20.11
- pnpm

## Getting started

```bash
pnpm install
pnpm vision:fetch   # self-hosted MediaPipe runtime + models (~7.7 MB)
pnpm dev:https      # HTTPS — getUserMedia needs a secure context
```

Then open `https://<your-lan-ip>:3000/d/anything` on a phone on the same
network. `?debug=1` turns on the detection HUD.

**Plain `pnpm dev` cannot access a phone's camera.** `getUserMedia` requires a
secure context.

## Scripts

| Command                       | Description                                                 |
| ----------------------------- | ----------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:https` | Dev server (use `:https` for camera work)                   |
| `pnpm build` / `pnpm start`   | Production build / serve                                    |
| `pnpm verify`                 | `typecheck` + `lint` + `test` + `budgets`                   |
| `pnpm test`                   | Unit tests (Vitest)                                         |
| `pnpm e2e`                    | End-to-end (Playwright, full and reduced motion)            |
| `pnpm budgets`                | Asset **and** JavaScript budgets. Needs `pnpm build` first. |
| `pnpm fixtures`               | Index recorded landmark clips into the detection suite      |
| `pnpm spike`                  | The Phase 0 measurement rig                                 |

## Architecture in five sentences

**Two disjoint runtime phases.** Camera + MediaPipe (A) and WebGL (B) never
coexist; the `UNLOCKING` teardown is the boundary.

**The detection loop never calls `setState`.** It writes one ref at 15 Hz; the
HUD reads it in its own `rAF`. Zustand sees roughly eight writes per session.

**The reducer is pure and total.** Any `(state, event)` pair not in the frozen
transition table is illegal; `canUnlock` sets `hasUnlocked` synchronously inside
the reducer, which is what makes the sequence execute exactly once.

**Zero network egress after asset load**, enforced by CSP `connect-src 'self'` —
that is what makes _"your camera stays on your phone"_ true rather than
aspirational.

**`#111111` is the only text colour.** Every brand colour is a surface. The
accessible choice and the neo-brutalist choice are the same choice, and
`tests/tokens.test.ts` fails the build on a violation.

## Where things live

```
src/machine/     the FSM — no React, no Zustand, no Three, no Motion
src/detection/   camera, MediaPipe, the pure gesture geometry — same rule
src/scenes/      one component per FSM state
src/scene3d/     Phase B — reachable only through scenes/Scene3D.tsx
src/lite/        the parallel 2D implementation of Phase B
src/content/     letter.ts (the point of the project) and copy.ts
```

Boundaries are ESLint rules, not conventions. Importing React into `machine/`
fails `pnpm lint`.

## Documentation

- **[README.id.md](./README.id.md)** — panduan menjalankan (Bahasa Indonesia).
- **[docs/RUNBOOK.md](./docs/RUNBOOK.md)** — how to send it, and what is still
  unmeasured. Read this before deploying.
- [docs/](./docs/README.md) — the five specifications this is built against.
