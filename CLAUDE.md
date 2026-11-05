# Uma Racer — working notes for Claude

A personal, never-distributed Uma Musume–inspired racing game (Race, Careers, Mini-games), played on the owner's iPhone
as a Home Screen web app. Generation 3 is live since M036's release (D388): a clock-free game of URA Finale careers,
each season a mini-game stage (Training Yard or Furlong Hand), resources spent by hand in a tree priced from the real
support-card numbers, and races on the engine. Its shell, Hub and primitives are uma-kit's, the app both Uma games
share (T147, D367).

## Start here

- `README.md`: status, how to run and verify, the documentation map. Then `AGENTS.md`, the shared guide for every
  agent, including delegated ChatGPT tasks (branch + PR, no pushes to `main`), with the shared workflows. This file adds
  Claude's production notes.
- **The restart (D380, 2026-11-04):** the old game is retired. The design is
  [the drawing board v3](docs/research/drawing-board/README.md): a clock-free game of mini-game careers and
  hand-allocated trees on the real card numbers. Its first release, M036 (URA Finale), shipped straight to production
  with a full wipe (D388); the manual describes it.
- `docs/tasks/README.md` is the current plan: M036 released (D388), releases 2–5 on the roadmap, and the next free
  numbers (M037, T160, D389). A task spec is deleted once its work merges (D104), so that folder only holds work still
  ahead.
- **The docs are the source of truth:** [the manual](docs/game/README.md) (`docs/game/`) describes the game as it runs.
  Every screen, route and sheet is [11's menu tree](docs/game/11-hub-and-places.md#the-menu-tree-at-a-glance); the code
  by folder, the checks and the deploy are [the architecture](docs/game/architecture.md). Read the relevant page before
  changing a system, and rewrite it in the same commit as the code. What a later release adds sits under a page's
  "Not built yet".
- **One game or both:** [docs/change-protocol.md](docs/change-protocol.md). Changes to anything uma-kit draws (frame,
  bars, menu, side panel, sheets, Hub map, theme) go through uma-platform as a "Both apps:" request and a kit release,
  never a fork here.
- `docs/decisions.md` is append-only: to reverse a decision, add a new entry that supersedes it.
- `docs/open-questions.md` holds anything that needs the owner. The owner prefers **no open questions**: decide with a
  recommendation when a sensible default exists, and log it.
- The manual's numbers are the rules' own: its live blocks are rendered from the code (`pnpm docs:update`), and
  `packages/domain/src/domain.test.ts` and each area's tests pin them. Change page, test and decision together.

## Ground rules

- **Original-game content never goes in git or on a public host**: data packs and images live in the gitignored `content/`
  folder and uma-platform's private release locally, and in private GCS buckets in production, served only through the
  authenticated API.
- **Claude manages infra and deploys end to end** (the owner handed this over on 2026-09-15). Commit and push to `main` in
  conventional-commit style. Every push to `main` verifies and deploys, except a push that changes only `docs/**` or
  Markdown files, which runs nothing (`paths-ignore`).
- **Branches:** `restart/g3` is retired after M036's release. Later releases branch `feat/t16x-*` from `main`, each with
  a pull request into `main` that CI (lint, test, build) must pass.
- **A multi-part request:** one commit per part, one push and one deploy at the end, after the whole batch works.
- The architecture and deploy pipeline are reused from the sibling repo `../uma-planner`, and the Hub from `../uma-rpg`.
  Check how they solve something before inventing a new pattern.
- **The shell, Hub and primitives are `@luismlorenzana/uma-kit`** (uma-platform `packages/kit`, P48), pinned exactly.
  Pass what is uma-racer's in as props through the adapters (`hub/RacerShell.tsx`, `hub/HubPage.tsx`,
  `hub/PlacePeek.tsx`, `places/PlacePageHeader.tsx`); never fork a kit component. A kit change is made and released in
  uma-platform (a changeset, by the uma-rpg session or a uma-platform session), then pinned here; try one with
  `pnpm link` or a `file:` override, never committed. CI reads the package only while its Manage Actions access grants
  uma-racer Read ([architecture](docs/game/architecture.md#uma-kit)).

## Layout

| Path | What |
|---|---|
| `packages/domain` | Pure game rules, one subpath export per area (`@racer/domain/account`, `/build`, `/career`, `/stages` with its games `yard` and `furlong`, `/save`, `/master`, `/tiers`, `/hub`) beside the core (the race catalogue and skills, rivals, cards, the career generator). Vitest |
| `packages/race` | Deterministic race engine (seeded, one-second turns, a 15 Hz timeline + playback sampling), with a CommonJS build for the API's races. Vitest |
| `apps/api` | NestJS 11: uma-server's `AuthGuard` on every route (`@luismlorenzana/uma-server/auth`: Firebase token + `ALLOWED_EMAIL`, 401 or 403), `/api/save` and `/api/sync` (generation 3, protocol 3; Firestore `g3/{uid}`), `/api/master/*`, `/api/content/*`, `/api/health`; operations, stage replays and races re-run on the domain and `@racer/race` |
| `apps/web` | React 19 + Vite 7 + Tailwind 4 + Motion (`m.*` under `LazyMotion strict`) + PWA on uma-kit 0.9.1 (theme, shell, Hub map on Phaser 4, primitives, places and auth frames, the album and picker): `src/app` (routes, session, the `RacerGame` port, kit setup and art providers), `hub` (racer shell/map adapters), `places` (`stable`, `card-library`, `career`, `account`, `training-yard`, `furlong-hand`), `stages` (the stage host and the two games' views), `race` and `scenes/race` (the run; PixiJS 8 only there), `save` (Dexie `uma-racer-g3` with the stage journal, the generation-2 wipe on first boot, one sync lane), `ui` (racer-only pieces), `content` |
| `scripts/sim` | Headless balance runs (`pnpm sim:decks`, `sim:stages`, `sim:careers`, `sim:balance`) |
| `scripts/overlays` | Racer-only private overlays; master data/art comes from uma-platform (SE1) |
| `docs/tasks` | The plan, and the packets for later releases |
| `docs/handoff` | Art packets for ChatGPT sessions and the master prompt |

## Commands

```bash
NODE_AUTH_TOKEN=$(gh auth token) pnpm install   # @luismlorenzana/* (uma-art, uma-kit, uma-data, uma-server) come from GitHub Packages
pnpm dev            # web :5173 (proxies /api) + api :8080, auth disabled, save apps/api/.data/save-g3.json, DEV_OPERATIONS=true
pnpm lint           # type-check every package
pnpm test           # domain + race + api + web tests, then sim:careers and sim:stages on invented content
pnpm test:ci        # the same, one package at a time, as CI runs them
pnpm build          # production builds (web includes the PWA service worker and the 180 KB startup check)
pnpm docs:update    # regenerate the live blocks in docs/game/ (the manual generated from code)
pnpm sim:decks      # the tree's bands with an empty, median and strong deck (the private pack when present)
pnpm sim:stages     # each mini-game's bots: grade bands and play length
pnpm sim:careers    # every Uma's URA Finale career at grade A: first-try win rates and pacing
pnpm sim:balance    # race strategy balance table
pnpm overlays:import   # validate and build private Racer-authored overlays
pnpm overlays:publish -- --dry-run # verify before publishing overlays
pnpm master:parity     # private migration proof, aggregates only in git
```

## Working from a worktree

- **Always work in a git worktree** under `.claude/worktrees/`, made fresh from `origin/main` for each piece of work.
  The primary checkout `~/workspace/uma-racer` may sit on another branch (on 2026-10-16, an old
  `docs/current-design-consistency`); never switch it or edit it from a session. Scratchpad worktrees under `/tmp` lose
  untouched files to macOS's nightly cleanup, so don't keep work there.
- **The preview runs in the primary checkout.** `.claude/launch.json`'s `uma-racer-dev` and `uma-racer-web` start
  there, so they serve its code, not the worktree's. Run Vite from the worktree on its own port instead:
  `pnpm --filter @racer/web exec vite --port <port> --strictPort` (with `API_PROXY_TARGET=http://localhost:<api-port>`
  for the worktree's own API, started by `PORT=<api-port> pnpm --filter @racer/api start:dev` after
  `pnpm --filter @racer/domain build`). Check `lsof -iTCP:<port> -sTCP:LISTEN` and the PID's cwd before trusting a
  preview, and never kill another agent's server.
- **Private content in a worktree:** link the primary checkout's `content/overrides` before `pnpm overlays:import`.
  Master defaults to sibling `uma-platform/content/release` (`MASTER_DIR` overrides it). Never commit links.
- **No dev preview, ever (the owner, D380).** Slices ship straight to production and the owner tests live. Claude still
  verifies every push: tests (component tests at 390×844 in light and dark), lint, the build and the sims before it,
  and the deploy smoke checks after. There are no dev seeds (D381).

## Production operations

| Thing | Value |
|---|---|
| Site | https://uma-racer.web.app (Firebase Hosting, classic, not App Hosting) |
| API | Cloud Run `racer-api` (us-central1), `https://racer-api-tmzkhylhfq-uc.a.run.app`; `/api/health` (not `/healthz`, which Cloud Run's front end reserves) |
| GCP project | `uma-racer` (number 1026964321499), plus a private bucket `uma-racer-content` |
| Deploy | `.github/workflows/deploy.yml`, keyless WIF. Repo variables: GCP_PROJECT_ID, WIF_PROVIDER, CONTENT_BUCKET, ALLOWED_EMAIL, DEPLOY_ENABLED |
| Live on 2026-11-05 | `1f4b481` as racer-api-00205-gfj: **M036, generation 3** (D388), [deployment green](https://github.com/luismlorenzana/uma-racer/actions/runs/42051491305). Image tagged with the SHA, health 200, save 401 without auth, Hosting no-cache, live chunks carry `uma-racer-g3` and Furlong Hand. Generation 2's `saves/` deleted (635 documents, no backup); `g3/` holds only what the owner creates. uma-kit 0.9.1; uma-art 2.10.0; startup 151.87 KB gzip |

- **Local gcloud has two accounts, and the active one is the owner's work account. Never change it.** Scope every uma-racer
  command with environment variables only:

  ```bash
  CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer gcloud run services describe racer-api --region=us-central1
  ```

  Never run `gcloud config set …`.
- **Watch a deploy without piping the watch**, then read its conclusion:
  `gh run watch <id> -R luismlorenzana/uma-racer --exit-status > /dev/null 2>&1; echo "exit=$?"` and
  `gh run view <id> -R luismlorenzana/uma-racer --json conclusion,headSha,jobs`. The race engine test's known timeout
  on a slow runner gets one `gh run rerun <id> --failed`.
- **Verify on the Cloud Run URL,** not web.app (Hosting answers `/api/*` with the app shell): `/api/health` 200,
  `/api/save` 401, and the Hosting shell `no-cache`. Those pass on the previous release too, so say "deployed" only
  after the new revision's image ends in the commit SHA and a live chunk (listed in `sw.js`) holds a string from the
  new code. The complete [release runbook](docs/technical/infrastructure.md#release-runbook) has the commands and how a
  release is reverted (`git revert`, never a reset).
- **No rollback path for the old game (D380).** The `pre-split` tag and generation 2's last state (`c592ccd`) are
  history only: generation 2's saves are gone from the server and the phones.
- The installed PWA prompts **Update ready — Restart** and defers restart across gameplay commits. Tell the owner to
  restart only after the deploy is verified. Account (Town Hall, or the trainer button) shows the deployed **App build**
  and private **Content**.
- **`content/overrides/flair.json` is Claude's to author and keep current** (D107): it maps race-series legs and the ten
  main venues, and without it the career generator has no race sets for an Uma's Main G1s. It is private and
  gitignored; re-run the import after editing it.
- Build only authored overlays, then publish their immutable file before the index. Master imports belong to
  uma-platform. Scoped cloud commands never change the active account/configuration:

  ```bash
  pnpm overlays:import
  pnpm overlays:publish -- --dry-run
  pnpm overlays:publish
  ```

  Never delete active source files or use cache/save deletion as recovery. SE1's exact retired-master cleanup completed after deployed-source verification on 2026-10-21 (D379); see the release runbook. Never rerun a new inventory to delete unrelated objects.
- **Reading production data is read-only and keeps no copy:** the scoped `gcloud auth print-access-token` against
  Firestore's REST API. Generation 3's save is `g3/{uid}/{kind}/{id}` (D381). Generation 2's `saves/` was deleted at
  the release (T159), with no backup. Sync health is `gcloud logging read` on `racer-api`.
- Never type credentials into sign-in pages. Sign-in checks stop at Google's account chooser.

## Art from ChatGPT

New pixel art comes from ChatGPT sessions (the owner's choice on 2026-10-15). Claude writes a packet in
`docs/handoff/tasks/` (Why, Context, Do, Done when, Deliver; the master prompt starts a session), ChatGPT draws it in
uma-platform's `scripts/pixel-art` and publishes a `@luismlorenzana/uma-art` release, and Claude then:
1. pins the release exactly in `apps/web` (dependency) and `packages/domain` (dev dependency);
2. empties `AWAITING_ART` of the frames it drew, so the registry's frames test stays strict;
3. updates [11](docs/game/11-hub-and-places.md) §10, the architecture's art section and a decision;
4. deletes the packet and logs it in the handoff README.

uma-art 2.10.0 is pinned (D378). No art packet is open: the Card Ticket mark (`currency/card-ticket`) is the kit's
cards icon until a release draws one ([11](docs/game/11-hub-and-places.md) §10.3).

## Conventions

- **Mobile first** (390×844 portrait). Thumb-zone actions, 44 pt targets, safe-area padding (`pt-safe`/`pb-safe`, the
  bar's `mb-bar-safe`), and the kit's frame fixed to the screen (`AppFrame`), never `h-dvh`.
- **Light and dark:** draw in the theme's tokens; text on `bg-accent` is `text-accent-ink`, a surface that stays dark is
  `bg-stage` or `bg-scrim` (never `bg-ink`), and no `bg-white`, `text-black` or raw hex
  ([visual system](docs/design/visual-system.md#dark-mode)).
- **No clock in the game (D380):** no timers, durations, regen, daily resets or check-ins in the rules. `Date.now` and
  timers belong to the sync lane, the UI and the scenes only.
- **Real card values live in the private pack only,** never in git, tests or docs (v3 §6, superseding D54, D90, D125
  and D132): tests, fixtures and `--synthetic` sims use invented cards, and the sims print aggregates only.
- **Performance budgets** (`docs/research/game-web-tech.md`): main JS ≤ 180 KB gzip (151.86 KB at T158), so keep
  Phaser, PixiJS and Firebase lazy. **Phaser only in a stage's scene (`stages/*/scene`), lazy,** beside uma-kit's own
  lazy Hub map chunk; **PixiJS only in the race scene** (`scenes/race`). Today no uma-racer module imports Phaser: both
  built games are DOM. Animate only transform/opacity. Use delta-time for every animation.
- Use Motion's `m.*` components, never `motion.*`: `LazyMotion strict` throws on `motion.*`. Continuous HUD values use
  CSS transitions, not springs.
- Game state is the one Zustand store (`useSave`, with selectors) over Dexie, read by the shell and places only through
  the `RacerGame` port and changed only by operations through it. TanStack Query is only for network data.
- The race engine and the stages never use `Math.random`: everything goes through the seeded RNG in the input.
- Before pushing a change that moves files or imports, run the architecture's hand checks (reach, "nothing old
  remains", no clock in the rules, the canvas imports) and the docs link check.
