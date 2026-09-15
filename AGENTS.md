# AGENTS.md — guide for AI coding agents (ChatGPT/Codex, Claude, others)

Uma Racer is a **personal, never-distributed** racing RPG inspired by *Umamusume: Pretty Derby*, played on the owner's
iPhone as a Home Screen web app. This file tells any agent how to work in this repo. `CLAUDE.md` holds extra notes for
the Claude session that runs production; when the two differ, **this file governs how delegated agents work**.

## Read before changing anything

1. `README.md` — status, layout, and documentation map.
2. The design doc for the system you're touching (`docs/design/*`). **The docs are the source of truth.** Code follows docs.
3. `docs/decisions.md` — what's decided (append-only log). `docs/open-questions.md` — what needs the owner.
4. `docs/technical/architecture.md` — how the pieces fit together.
5. Your task spec, if you were given one (`docs/tasks/*`).

## Hard rules

- **Original-game content never goes in git.** GameTora or other extracted data and images, generated packs, and caches
  live only in the gitignored root `/content/` and `scripts/*/.cache/`. **Test fixtures must be small and synthetic** (invented
  values in the right shape), never copied from real datasets.
- **Don't push to `main`.** Pushes to `main` deploy to production. Work on a branch named `feat/…`, `fix/…`, or `docs/…`, and
  open a pull request to `main`. CI (lint, test, build) must pass.
- **Don't touch production infrastructure** unless your task says so: `.github/workflows/`, `infra/`, `firebase.json`,
  `apps/web/.env.production`, `apps/api/Dockerfile`. No cloud credentials are needed or allowed for normal work.
- **Don't change design numbers** (caps, costs, curves, coefficients) without updating the matching design doc, the pinning
  test in `packages/domain/src/domain.test.ts`, and adding a `docs/decisions.md` entry. Never edit old decision rows; append new ones.
- **Don't add dependencies casually.** Prefer what's already in the workspace. If you add one, justify it in the PR.
- **Never commit secrets.** (Firebase *web* config in `apps/web/.env.production` is public by design, and is still off-limits for edits.)

## Setup and commands

Requirements: Node 22+, pnpm 10 (`corepack enable`).

    pnpm install --frozen-lockfile
    pnpm lint           # type-check every package (tsc --noEmit)
    pnpm test           # vitest: domain rules, race engine, API
    pnpm build          # production builds (web includes the PWA service worker)
    pnpm dev            # web :5173 (proxies /api) + api :8080, auth disabled, local JSON save
    pnpm sim:balance    # headless race balance table
    pnpm data:import    # GameTora datasets → private, gitignored content packs
    pnpm assets:import  # pack T001 image sources → private WebP atlases (run data import first)

Run `pnpm lint && pnpm test && pnpm build` before opening a PR. CI runs the same.

## Layout

| Path | What | Notes |
|---|---|---|
| `packages/domain` | Pure game rules and shared types | No I/O. Everything unit-tested |
| `packages/race` | Deterministic race engine | Seeded RNG only, never `Math.random`. 15 Hz ticks, timeline output |
| `apps/api` | NestJS 11 API for Cloud Run | `AuthGuard` (Firebase token + allowlist), `/api/save`, `/api/sync`, `/api/content/*`, `/api/health` |
| `apps/web` | React 19 + Vite 7 + Tailwind 4 + Motion + PixiJS 8 PWA | Mobile-first (390×844 portrait) |
| `scripts/sim` | Balance simulations | |
| `scripts/data`, `scripts/assets` | Content pipeline (GameTora → private packs) | Output goes to gitignored `/content/` |
| `docs/` | Design, technical, research, tasks | |

## Code conventions

- TypeScript strict with `noUncheckedIndexedAccess`. No `any` without a comment explaining why.
- Match the surrounding code: small modules, pure functions where possible, a short header comment linking the design doc a module implements.
- **Web:**
  - Use Motion's `m.*` components (the app runs `LazyMotion strict`; `motion.*` throws).
  - Animate only transform and opacity, with delta-time based motion.
  - Keep the startup bundle ≤ 180 KB gzip, so PixiJS and Firebase stay lazy-loaded.
  - Game state lives in Zustand (with selectors) persisted to Dexie. TanStack Query is only for network data.
  - Use 44 pt touch targets and safe-area padding (`pt-safe`/`pb-safe`).
- **API:**
  - Every route except `/api/health` sits behind `AuthGuard`.
  - Validate untrusted bodies with explicit parsers (see `apps/api/src/save/save.types.ts`).
- **Tests:** Vitest, co-located `*.test.ts`. No network in tests.
- **Commits:** Conventional Commits (`feat(scope): …`, `fix(scope): …`, `docs(scope): …`). The body explains *why*.

## Pull requests

Include: what changed and why, how you verified it (commands and results), any doc and decision updates, and anything
you couldn't verify (for example "GameTora unreachable from my sandbox; importer verified with fixtures only").
