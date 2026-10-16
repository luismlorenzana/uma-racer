# Uma Racer — working notes for Claude

A personal, never-distributed Uma Musume–inspired racing RPG, played on the owner's iPhone as a Home Screen web app.

## Start here

- `AGENTS.md` is the shared guide for all agents, including delegated ChatGPT tasks (branch + PR, no pushes to `main`). This file adds Claude-specific production notes.
- `docs/tasks/README.md` is the current plan. A task spec is deleted once its work merges (D104), so that folder only ever
  holds work that is still ahead.

- `README.md` → documentation map. **The docs are the source of truth:** [the manual](docs/game/README.md) (`docs/game/`)
  describes the game as it runs, generation 2. Read the relevant page before changing a system, and rewrite it in the
  same commit as the code. A later phase's part sits under "Not built yet (phase N)".
- `docs/decisions.md` is append-only: to reverse a decision, add a new entry that supersedes it.
- `docs/open-questions.md` holds anything that needs the owner. The owner prefers **no open questions**: decide with a
  recommendation when a sensible default exists, and log it.
- The manual's numbers are the rules' own: its live blocks are rendered from the code (`pnpm docs:update`), and
  `packages/domain/src/domain.test.ts` and each area's tests pin them. Change page, test and decision together.

## Ground rules

- **Original-game content never goes in git or on a public host**: data packs and images live in the gitignored `content/`
  folder locally, and in the private GCS bucket in production, served only through the authenticated API.
- **Claude manages infra and deploys end to end** (the owner handed this over on 2026-09-15). Commit and push to `main` in
  conventional-commit style; every push to `main` verifies and deploys.
- The architecture and deploy pipeline are reused from the sibling repo `../uma-planner`. Check how it solves something before inventing a new pattern.

## Layout

| Path | What |
|---|---|
| `packages/domain` | Pure game rules, one subpath export per area (`@racer/domain/save`, `/state`, `/tiers`, `/items`, `/work`, `/farm`, `/training`, `/economy`, `/check-in`, `/planner`, `/sim`, `/builds`, `/hub`) beside the core. Vitest |
| `packages/race` | Deterministic race engine (seeded, 15 Hz ticks, timeline + playback sampling). Vitest |
| `apps/api` | NestJS 11: `AuthGuard` (Firebase token + `ALLOWED_EMAIL`), `/api/save`, `/api/sync` (generation 2, protocol 2), `/api/legacy/purge` (one release), `/api/content/*` |
| `apps/web` | React 19 + Vite 7 + Tailwind 4 + Motion (`m.*` under `LazyMotion strict`) + PWA: `src/app` (routes, session), `hub` (shell), `places`, `save` (Dexie `uma-racer-g2`, one sync lane), `ui`; Phaser 4 for the Hub's town map (`hub/scene`, uma-rpg's port); PixiJS 8 only for the race scene (`scenes/race`) until phase 8; dev-only seeds at `/dev/seeds/*` (`src/dev`) |
| `scripts/sim` | Headless balance runs (`pnpm sim:balance`, `sim:turns`, `sim:builds`, `sim:careers`, `sim:loop`) |
| `scripts/data`, `scripts/assets` | Content pipeline (GameTora → private data packs and WebP icon atlases) |

## Commands

```bash
NODE_AUTH_TOKEN=$(gh auth token) pnpm install   # @luismlorenzana/* (uma-platform) come from GitHub Packages
pnpm dev            # web :5173 (proxies /api) + api :8080, auth disabled, local save .data/save-g2.json, DEV_OPERATIONS=true
pnpm lint           # type-check every package
pnpm test           # domain + race + api + web tests (test:ci: one suite at a time, as CI runs them)
pnpm build          # production builds (web includes the PWA service worker and the 180 KB startup check)
pnpm docs:update    # regenerate the live blocks in docs/game/ (the manual generated from code)
pnpm sim:balance    # race balance table; sim:builds, sim:careers and sim:loop check the rework's builds and pacing
pnpm data:import    # GameTora datasets → private, gitignored content packs
pnpm assets:import  # T001 image sources → private WebP atlases; run after data:import
                    # T059 chibis/stands/race faces: add `-- --source dir:~/Documents/uma-content` (owner's copy)
```

## Production operations

| Thing | Value |
|---|---|
| Site | https://uma-racer.web.app (Firebase Hosting, classic, not App Hosting) |
| API | Cloud Run `racer-api` (us-central1), `/api/health` (not `/healthz`, which Cloud Run's front end reserves) |
| GCP project | `uma-racer` (number 1026964321499), plus a private bucket `uma-racer-content` |
| Deploy | `.github/workflows/deploy.yml`, keyless WIF. Repo variables: GCP_PROJECT_ID, WIF_PROVIDER, CONTENT_BUCKET, ALLOWED_EMAIL, DEPLOY_ENABLED |

- **Local gcloud has two accounts, and the active one is the owner's work account. Never change it.** Scope every uma-racer
  command with environment variables only:

  ```bash
  CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer gcloud run services describe racer-api --region=us-central1
  ```

  Never run `gcloud config set …`.
- Watch deploys with `gh run watch <id> -R luismlorenzana/uma-racer --exit-status`. Then verify: `/api/health` returns 200,
  `/api/save` returns 401 without a token, and the Hosting shell is `no-cache`.
- The installed PWA prompts **Update ready — Restart** and defers restart across gameplay commits. Account (Town Hall,
  or the trainer button) shows the deployed **App build** and private **Content**; follow the complete
  [release runbook](docs/technical/infrastructure.md#release-runbook).
- **`content/overrides/flair.json` is Claude's to author and keep current** (D107): it maps race-series legs and the ten
  main venues, and without it every race-set title and Grand Tour is unearnable. It is private and gitignored; re-run the
  import after editing it.
- Publish content-addressed files before the manifest by using the verified command. Run both importers first; the publisher
  scopes every gcloud child process to the owner's default uma-racer configuration without changing the active account:

  ```bash
  pnpm data:import
  pnpm assets:import
  pnpm content:publish -- --dry-run
  pnpm content:publish
  ```

  Old hashed objects are retained. Never delete the currently published manifest's files or use cache/save deletion as recovery.
- Never type credentials into sign-in pages. Sign-in checks stop at Google's account chooser.

## Conventions

- **Mobile first** (390×844 portrait). Thumb-zone actions, 44 pt targets, safe-area padding (`pt-safe`/`pb-safe`), `h-dvh`.
- **Performance budgets** (`docs/research/game-web-tech.md`): main JS ≤ 180 KB gzip, so keep PixiJS and Firebase lazy.
  PixiJS is for the race scene only; nothing else imports it. Animate only transform/opacity. Use delta-time for every
  animation.
- Use Motion's `m.*` components, never `motion.*`: `LazyMotion strict` throws on `motion.*`. Continuous HUD values use CSS transitions, not springs.
- Game state is the one Zustand store (`useSave`, with selectors) over Dexie, changed only by operations through the game
  port. TanStack Query is only for network data.
- The race engine never uses `Math.random`: everything goes through the seeded RNG in the input.
- Verify UI changes in the browser preview at mobile size (`uma-racer-dev` in `.claude/launch.json`); `/dev/seeds/`
  serves the game on synthetic accounts (`?seed=`, `?at=`). Dev builds expose `window.__raceScene` (`seek`,
  `skipToEnd`) and `window.__hub`, since the preview pane throttles animation frames; add `?canvas` to draw the Hub
  with Phaser's Canvas renderer so screenshots capture it. The shared `uma-racer-dev` preview runs in the main
  checkout, so from a worktree start Vite on your own port instead.
