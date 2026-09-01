# Bloom Delivery

A Next.js 15 + React 19 web experience: a camera-based gesture unlock (MediaPipe face + hand detection) that hands off to a WebGL gift-reveal scene.

## Requirements

- Node.js >= 20.11
- pnpm

## Getting started

```bash
pnpm install
pnpm vision:fetch   # downloads the self-hosted MediaPipe runtime + models
pnpm dev            # or: pnpm dev:https  (camera access needs a secure context)
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm verify` | `typecheck` + `lint` + `test` |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm e2e` | End-to-end tests (Playwright) |
| `pnpm budgets` | Check assets against the performance budgets |

## Documentation

Full engineering specifications live in [`docs/`](./docs/README.md) — system design, FSM spec, detection algorithm, UI/UX screen spec, and the implementation plan.
