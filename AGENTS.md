# AGENTS.md — guide for AI coding agents (ChatGPT/Codex, Claude, others)

Uma Racer is a **personal, never-distributed** racing game inspired by *Umamusume: Pretty Derby*, played on the owner's
iPhone as a Home Screen web app: generation 3, a clock-free game of mini-game careers (URA Finale, released as M036,
D388). This file tells any agent how to work in this repo. `CLAUDE.md` holds extra notes for
the Claude session that runs production; when the two differ, **this file governs how delegated agents work**.

## Read before changing anything

1. `README.md` — status, how to run and verify, layout, and documentation map.
2. `docs/tasks/README.md` — the current plan: what shipped, what's open and next, and the next free M, T and D numbers.
3. The manual's page for the system you're touching (`docs/game/*`, starting at `docs/game/README.md`), and the design
   notes in `docs/design/*` (overview, UX, visual system, racing, careers) and
   [the drawing board v3](docs/research/drawing-board/README.md). **The docs are the source of truth.** Code follows
   docs. Every screen, route and sheet is in `docs/game/11-hub-and-places.md`'s menu tree.
4. `docs/decisions.md` — what's decided (append-only log). `docs/open-questions.md` — what needs the owner.
5. `docs/game/architecture.md` — how the pieces fit together, and the checks a change must pass.
6. Your task spec or packet, if you were given one: a release's parts in `docs/tasks/*`, art packets in
   `docs/handoff/tasks/*`.
7. `docs/change-protocol.md` — one game or both: a change to anything uma-kit draws (frame, bars, menu, side panel,
   sheets, Hub map, theme) goes through uma-platform as a "Both apps:" request and a kit release, never a fork here.

## Hard rules

- **Original-game content never goes in git.** GameTora or other extracted data and images, generated packs, and caches
  live only in the gitignored root `/content/` and `scripts/*/.cache/`. **Test fixtures must be small and synthetic** (invented
  values in the right shape), never copied from real datasets. **Real card values** live in the private pack only:
  never in git, a test or a doc (v3 §6).
- **Don't push to `main`.** Pushes to `main` deploy to production (all but docs-only ones, below). Work on a branch
  from `main` named `feat/…`, `fix/…`, or `docs/…` (a release's parts: `feat/t16x-…`), and open a pull request to
  `main`. CI (lint, test, build) must pass. M036's integration branch, `restart/g3`, is retired: nothing branches from
  it.
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
`@luismlorenzana/*` packages (uma-platform's art, the shared app kit, the master data and the server kit: `uma-art`,
`uma-kit`, `uma-data` and `uma-server`, from GitHub Packages; `.npmrc` reads it from `NODE_AUTH_TOKEN`). With the
GitHub CLI: `gh auth refresh -s read:packages` once.

    NODE_AUTH_TOKEN=$(gh auth token) pnpm install --frozen-lockfile
    pnpm lint           # type-check every package (tsc --noEmit)
    pnpm test           # vitest: domain rules, race engine, API, web; then sim:careers and sim:stages on invented content
    pnpm test:ci        # the same suites one package at a time, as CI runs them
    pnpm build          # production builds (web includes the PWA service worker and the 180 KB startup check)
    pnpm docs:update    # regenerate the live blocks in docs/game/ after changing what they list
    pnpm dev            # web :5173 (proxies /api) + api :8080, auth disabled, save apps/api/.data/save-g3.json, dev operations on
    pnpm sim:decks      # the tree's bands with an empty, median and strong deck (-- --synthetic for invented cards)
    pnpm sim:stages     # each mini-game's bots: grade bands and play length (-- --synthetic)
    pnpm sim:careers    # every Uma's URA Finale career at grade A: first-try win rates and pacing (-- --synthetic)
    pnpm sim:balance    # headless race strategy balance table
    pnpm overlays:import   # Racer-only authored overlays against the platform master
    pnpm overlays:publish -- --dry-run # verify before publishing overlays
    pnpm master:parity     # private migration oracle, aggregates only in git

There are no dev seeds or preview milestones since the restart (D380, D381): verify with tests. Run `pnpm lint && pnpm test:ci && pnpm build`
before opening a PR. CI runs the same.

## Layout

| Path | What | Notes |
|---|---|---|
| `packages/domain` | Pure game rules and shared types | No I/O, no clock. Everything unit-tested. One subpath export per area (`@racer/domain/account`, `/build`, `/career`, `/stages` with its games `yard` and `furlong`, `/save`, `/master`, `/tiers`, `/hub`) beside the core (race catalogue and skills, rivals, cards, the career generator) |
| `packages/race` | Deterministic race engine | Seeded RNG only, never `Math.random`. One-second turns, a timeline at 15 samples a second; a CommonJS build for the API |
| `apps/api` | NestJS 11 API for Cloud Run | `AuthGuard` (Firebase token + allowlist), `/api/save` and `/api/sync` (generation 3, protocol 3; Firestore `g3/{uid}`), `/api/master/*`, `/api/content/*`, `/api/health` |
| `apps/web` | React 19 + Vite 7 + Tailwind 4 + Motion PWA on `@luismlorenzana/uma-kit` (the theme in light and dark, the shell, the Hub map on Phaser 4, the primitives, icons and album); PixiJS 8 for the race scene only (`src/scenes/race`) | Mobile-first (390×844 portrait). `src/app` (routes, session, the `RacerGame` port, the kit's setup), `hub` (the racer's adapters to the kit's shell and map), `places` (`stable`, `card-library`, `career`, `account`, `training-yard`, `furlong-hand`), `stages` (the stage host and the two games' views), `race`, `save` (Dexie `uma-racer-g3`), `ui` (the racer's own pieces), `content` |
| `scripts/sim` | Balance simulations: `sim:decks`, `sim:stages`, `sim:careers`, `sim:balance` | The private pack when present, invented content with `--synthetic`; aggregates only |
| `scripts/overlays` | Racer-only private overlays and master parity; no master importer | Output goes to gitignored `/content/` |
| `docs/` | The manual (`game/`), design, the drawing board (`research/drawing-board/`), tasks and their packets, technical, research, art handoff packets; the archived plans (`rework/`, `rearchitecture/`) and generation 2's manual (`archive/`) | |

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
- **No dev seeds and no preview milestone** (D380, D381). Slices ship to production and the owner tests live. Verify a
  screen with component tests at 390×844 (Testing Library) and the checks above.
- **`pnpm dev`** runs the local API with `DEV_OPERATIONS=true` (so Account's dev section can run `dev-grant`), auth off,
  and its save at `apps/api/.data/save-g3.json`; `apps/api/.env` comes from `.env.example`.
- **Private content in a worktree.** The importers and the local API read the gitignored `content/` at the repo root.
  Master data/art comes from sibling `uma-platform/content/release` (`MASTER_DIR`); link only the owner's authored
  `content/overrides` into the worktree before `pnpm overlays:import`. Never commit links; stage explicit paths, since a link
  shows up beside your changes.
- **Docs-only pushes don't deploy.** The workflow ignores pushes that change only `docs/**` or Markdown files; any
  other push to `main` verifies and deploys production.
- **The shell, Hub and primitives are uma-kit's** ([architecture](docs/game/architecture.md#uma-kit)). Pass what is
  this game's in as props (`hub/RacerShell.tsx`, `hub/HubPage.tsx`, `hub/PlacePeek.tsx`, `places/PlacePageHeader.tsx`);
  never copy or fork a kit component. A missing option is a change to uma-platform's `packages/kit`, released there
  with a changeset (ask the owner, who routes it to the uma-rpg or a uma-platform session); try it locally with
  `pnpm link` or a `file:` override and never commit that. What the kit draws carries `data-kit` attributes for tests.
- **Packets for later releases live in `docs/tasks/`:** a milestone spec and one self-contained packet per part (Why,
  Context, Do, Done when, Deliver), each part on its own `feat/t16x-…` branch from `main` with a pull request into
  `main`. The roadmap is [v3 §7](docs/research/drawing-board/README.md#7-the-roadmap).
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
  - Keep the startup bundle ≤ 180 KB gzip, so Phaser, PixiJS and Firebase stay lazy-loaded. Phaser only in a stage's
    scene (`stages/*/scene`), lazy, beside uma-kit's Hub map; PixiJS only in the race scene.
  - No clock in the game: no timers, durations or daily resets in the rules; `Date.now` and timers belong to the sync
    lane, the UI and the scenes.
  - Game state lives in one Zustand store (`useSave`, read with selectors) over Dexie, and changes only by operations
    through the game port. TanStack Query is only for network data.
  - Use 44 pt touch targets and safe-area padding (`pt-safe`/`pb-safe`).
  - Draw in the theme's tokens so light and dark both work: `text-accent-ink` on the gold `bg-accent`, `bg-stage` or
    `bg-scrim` for a surface that stays dark, no `bg-white`, `text-black` or raw hex
    ([visual system](docs/design/visual-system.md#dark-mode)). Check a screen in both modes.
- **API:**
  - Every route except `/api/health` sits behind `AuthGuard`.
  - Validate untrusted bodies with explicit parsers (the save's are `@racer/domain/save`'s, which
    `apps/api/src/save/save.controller.ts` runs).
- **Tests:** Vitest, co-located `*.test.ts`. No network in tests.
- **Commits:** Conventional Commits (`feat(scope): …`, `fix(scope): …`, `docs(scope): …`). The body explains *why*.

## Pull requests

Include: what changed and why, how you verified it (commands and results), any doc and decision updates, and anything
you couldn't verify (for example "GameTora unreachable from my sandbox; importer verified with fixtures only").
