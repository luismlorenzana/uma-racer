# AGENTS.md — guide for AI coding agents (ChatGPT/Codex, Claude, others)

Uma Racer is a **personal, never-distributed** racing RPG inspired by *Umamusume: Pretty Derby*, played on the owner's
iPhone as a Home Screen web app. This file tells any agent how to work in this repo. `CLAUDE.md` holds extra notes for
the Claude session that runs production; when the two differ, **this file governs how delegated agents work**.

## Read before changing anything

1. `README.md` — status, how to run and verify, layout, and documentation map.
2. `docs/tasks/README.md` — the current plan: what shipped, what's open and next, and the next free M, T and D numbers.
3. The manual's page for the system you're touching (`docs/game/*`, starting at `docs/game/README.md`), and the design
   notes in `docs/design/*` (overview, UX, visual system, racing, badges, careers, lineage). **The docs are the source
   of truth.** Code follows docs. Every screen, route and sheet is in `docs/game/11-hub-and-places.md`'s menu tree.
4. `docs/decisions.md` — what's decided (append-only log). `docs/open-questions.md` — what needs the owner.
5. `docs/game/architecture.md` — how the pieces fit together, and the checks a change must pass.
6. Your task spec or handoff packet, if you were given one (`docs/tasks/*`, `docs/handoff/tasks/*`).

## Hard rules

- **Original-game content never goes in git.** GameTora or other extracted data and images, generated packs, and caches
  live only in the gitignored root `/content/` and `scripts/*/.cache/`. **Test fixtures must be small and synthetic** (invented
  values in the right shape), never copied from real datasets.
- **Don't push to `main`.** Pushes to `main` deploy to production (all but docs-only ones, below). Work on a branch
  named `feat/…`, `fix/…`, or `docs/…`, and open a pull request to `main`. CI (lint, test, build) must pass.
- **Don't touch production infrastructure** unless your task says so: `.github/workflows/`, `infra/`, `firebase.json`,
  `apps/web/.env.production`, `apps/api/Dockerfile`. No cloud credentials are needed or allowed for normal work.
- **Don't change design numbers** (caps, costs, curves, coefficients) without updating the matching manual page (run
  `pnpm docs:update` for its live blocks), the pinning test (`packages/domain/src/domain.test.ts` or the area's own), and
  adding a `docs/decisions.md` entry. Never edit old decision rows; append new ones.
- **Don't add dependencies casually.** Prefer what's already in the workspace. If you add one, justify it in the PR.
- **Finish a task by deleting its spec.** When your work merges, the design docs must carry the resulting rules and your
  task spec is removed in the same PR (D104). Git history keeps it. Never reuse a task number.
- **Never commit secrets.** (Firebase *web* config in `apps/web/.env.production` is public by design, and is still off-limits for edits.)

## Setup and commands

Requirements: Node 22+, pnpm 10 (`corepack enable`), and a GitHub token that can read the owner's private
`@luismlorenzana/*` packages (uma-platform's master data and art, from GitHub Packages; `.npmrc` reads it from
`NODE_AUTH_TOKEN`). With the GitHub CLI: `gh auth refresh -s read:packages` once.

    NODE_AUTH_TOKEN=$(gh auth token) pnpm install --frozen-lockfile
    pnpm lint           # type-check every package (tsc --noEmit)
    pnpm test           # vitest: domain rules, race engine, API, web
    pnpm test:ci        # the same suites one package at a time, as CI runs them
    pnpm build          # production builds (web includes the PWA service worker and the 180 KB startup check)
    pnpm docs:update    # regenerate the live blocks in docs/game/ after changing what they list
    pnpm dev            # web :5173 (proxies /api) + api :8080, auth disabled, save apps/api/.data/save-g2.json, dev operations on
    pnpm sim:balance    # headless race balance table; also sim:turns, sim:builds, sim:careers and sim:loop
    pnpm data:import    # GameTora datasets → private, gitignored content packs
    pnpm assets:import  # pack image sources → private WebP atlases (run data import first)

In dev builds, `/dev/seeds/` opens the game on synthetic accounts. Run `pnpm lint && pnpm test:ci && pnpm build`
before opening a PR. CI runs the same.

## Layout

| Path | What | Notes |
|---|---|---|
| `packages/domain` | Pure game rules and shared types | No I/O. Everything unit-tested. One subpath export per area (`@racer/domain/save`, `/state`, `/tiers`, `/training`, `/farm` …) |
| `packages/race` | Deterministic race engine | Seeded RNG only, never `Math.random`. One-second turns, a timeline at 15 samples a second |
| `apps/api` | NestJS 11 API for Cloud Run | `AuthGuard` (Firebase token + allowlist), `/api/save`, `/api/sync`, `/api/legacy/purge` (one release), `/api/content/*`, `/api/health` |
| `apps/web` | React 19 + Vite 7 + Tailwind 4 + Motion PWA; Phaser 4 for the Hub's map (`src/hub/scene`), PixiJS 8 for the race scene only (`src/scenes/race`) | Mobile-first (390×844 portrait). `src/app` (routes, session, port), `hub` (shell and canvas), `places`, `save`, `ui`, `content`, dev-only `dev` |
| `scripts/sim` | Balance simulations | |
| `scripts/data`, `scripts/assets` | Content pipeline (GameTora → private packs) | Output goes to gitignored `/content/` |
| `docs/` | The manual (`game/`), design, plans (`rework/`, `rearchitecture/`), tasks, technical, research, handoff packets | |

## Workflows

- **Work in your own git worktree,** never in the primary checkout `~/workspace/uma-racer`: it may sit on another
  branch (on 2026-10-16, an old `docs/current-design-consistency`), and other sessions work beside you. Create one from
  `origin/main` (`git worktree add -b <branch> <path> origin/main`), run the install there, and push your branch.
- **Preview from a worktree on your own port.** The shared preview configurations in `.claude/launch.json`
  (`uma-racer-dev`, `uma-racer-web`) start in the primary checkout, so they show its code, not yours. Run Vite from
  your worktree instead: `pnpm --filter @racer/web exec vite --port <port> --strictPort`. It proxies `/api` to 8080;
  for your own API, build the domain (`pnpm --filter @racer/domain build`), start it with
  `PORT=<api-port> pnpm --filter @racer/api start:dev`, and give Vite `API_PROXY_TARGET=http://localhost:<api-port>`.
  Check who owns a port (`lsof -iTCP:<port> -sTCP:LISTEN`) before trusting what it serves.
- **Synthetic accounts for every screen** (dev builds): `/dev/seeds/<route>?seed=busy | fresh | quiet | gate | promote |
  tired | spent | stopped`, `&at=HH:MM` to move the seed's clock, `&canvas` to draw the Hub with Phaser's Canvas
  renderer so a screenshot captures it, and `?save=device` for the device save instead of a seed. `window.__hub` drives
  the Hub's scene and `window.__raceScene` the race (`seek`, `skipToEnd`), since a preview pane throttles animation
  frames ([architecture](docs/game/architecture.md#dev-seeds)).
- **`pnpm dev`** runs the local API with `DEV_OPERATIONS=true` (so Account's dev section can run `dev-grant`), auth off,
  and its save at `apps/api/.data/save-g2.json`; `apps/api/.env` comes from `.env.example`.
- **Private content in a worktree.** The importers and the local API read the gitignored `content/` at the repo root.
  If you have the owner's copy, symlink it from the primary checkout (and `scripts/data/.cache` before `pnpm
  data:import`), never commit the links, and stage explicit paths rather than `git add -A`, since an untracked link
  shows up beside your changes.
- **Docs-only pushes don't deploy.** The workflow ignores pushes that change only `docs/**` or Markdown files; any
  other push to `main` verifies and deploys production.
- **Original pixel art goes through a handoff packet.** A ChatGPT session takes a packet from `docs/handoff/`, draws in
  uma-platform's `scripts/pixel-art` and publishes a `@luismlorenzana/uma-art` release; Claude then pins that release
  here and updates `docs/game/11-hub-and-places.md` §10. The racer draws no sprites of its own.
- **Keep the docs true in the same change.** Rewrite the manual page with the code, run `pnpm docs:update` for its live
  blocks, append a decision for anything decided, and delete a task spec or packet when its work merges (D104).

## Code conventions

- TypeScript strict with `noUncheckedIndexedAccess`. No `any` without a comment explaining why.
- Match the surrounding code: small modules, pure functions where possible, a short header comment linking the design doc a module implements.
- **Web:**
  - Use Motion's `m.*` components (the app runs `LazyMotion strict`; `motion.*` throws).
  - Animate only transform and opacity, with delta-time based motion.
  - Keep the startup bundle ≤ 180 KB gzip, so PixiJS and Firebase stay lazy-loaded.
  - Game state lives in one Zustand store (`useSave`, read with selectors) over Dexie, and changes only by operations
    through the game port. TanStack Query is only for network data.
  - Use 44 pt touch targets and safe-area padding (`pt-safe`/`pb-safe`).
- **API:**
  - Every route except `/api/health` sits behind `AuthGuard`.
  - Validate untrusted bodies with explicit parsers (the save's are `@racer/domain/save`'s, which
    `apps/api/src/save/save.controller.ts` runs).
- **Tests:** Vitest, co-located `*.test.ts`. No network in tests.
- **Commits:** Conventional Commits (`feat(scope): …`, `fix(scope): …`, `docs(scope): …`). The body explains *why*.

## Pull requests

Include: what changed and why, how you verified it (commands and results), any doc and decision updates, and anything
you couldn't verify (for example "GameTora unreachable from my sandbox; importer verified with fixtures only").
