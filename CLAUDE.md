# Uma Racer — working notes for Claude

A personal, never-distributed Uma Musume–inspired racing game (Race, Farm, Train), played on the owner's iPhone as a
Home Screen web app. Generation 2 is live since 2026-10-15, on uma-rpg's pixel-art Hub; since T147 (D367) its shell,
Hub and primitives are uma-kit's, the app both Uma games share.

## Start here

- `README.md`: status, how to run and verify, the documentation map. Then `AGENTS.md`, the shared guide for every
  agent, including delegated ChatGPT tasks (branch + PR, no pushes to `main`), with the shared workflows. This file adds
  Claude's production notes.
- `docs/tasks/README.md` is the current plan: what shipped, what's open (T144's step 10, the sibling packets in
  `docs/handoff/` with phase 5 as SE1, and phase 9; phases 4, 7, 8 and the pixel-art question are archived, D370) and
  the next free numbers (M035, T148, D371; **D362 is reserved for T144's release record**). A task spec is deleted once its work merges (D104), so that folder only holds work still ahead.
- **The docs are the source of truth:** [the manual](docs/game/README.md) (`docs/game/`) describes the game as it runs.
  Every screen, route and sheet is [11's menu tree](docs/game/11-hub-and-places.md#the-menu-tree-at-a-glance); the code
  by folder, the checks and the deploy are [the architecture](docs/game/architecture.md). Read the relevant page before
  changing a system, and rewrite it in the same commit as the code. A later phase's part sits under "Not built yet
  (phase N)".
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
  folder locally, and in the private GCS bucket in production, served only through the authenticated API.
- **Claude manages infra and deploys end to end** (the owner handed this over on 2026-09-15). Commit and push to `main` in
  conventional-commit style. Every push to `main` verifies and deploys, except a push that changes only `docs/**` or
  Markdown files, which runs nothing (`paths-ignore`).
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
| `packages/domain` | Pure game rules, one subpath export per area (`@racer/domain/save`, `/state`, `/tiers`, `/items`, `/work`, `/farm`, `/training`, `/economy`, `/check-in`, `/planner`, `/sim`, `/builds`, `/hub`) beside the core. Vitest |
| `packages/race` | Deterministic race engine (seeded, 15 Hz ticks, timeline + playback sampling). Vitest |
| `apps/api` | NestJS 11: `AuthGuard` (Firebase token + `ALLOWED_EMAIL`), `/api/save`, `/api/sync` (generation 2, protocol 2), `/api/legacy/purge` (until T144's step 10), `/api/content/*`, `/api/health` |
| `apps/web` | React 19 + Vite 7 + Tailwind 4 + Motion (`m.*` under `LazyMotion strict`) + PWA on uma-kit 0.2.0 (theme in light and dark, shell, Hub map on Phaser 4, primitives and icons): `src/app` (routes, session, the `G2Game` port, the kit's setup `kit.ts` and art `art.ts`), `hub` (the racer's adapters to the kit's shell and map), `places`, `save` (Dexie `uma-racer-g2`, one sync lane), `ui` (the racer's own pieces), `content`; PixiJS 8 only for the race scene (`scenes/race`) until phase 8; dev-only seeds at `/dev/seeds/*` (`src/dev`) |
| `scripts/sim` | Headless balance runs (`pnpm sim:balance`, `sim:turns`, `sim:builds`, `sim:careers`, `sim:loop`) |
| `scripts/data`, `scripts/assets` | Content pipeline (GameTora → private data packs and WebP icon atlases) |
| `docs/handoff` | Packets for ChatGPT sessions and the master prompt |

## Commands

```bash
NODE_AUTH_TOKEN=$(gh auth token) pnpm install   # @luismlorenzana/* (uma-art, uma-kit) come from GitHub Packages
pnpm dev            # web :5173 (proxies /api) + api :8080, auth disabled, save apps/api/.data/save-g2.json, DEV_OPERATIONS=true
pnpm lint           # type-check every package
pnpm test           # domain + race + api + web tests
pnpm test:ci        # the same, one package at a time, as CI runs them
pnpm build          # production builds (web includes the PWA service worker and the 180 KB startup check)
pnpm docs:update    # regenerate the live blocks in docs/game/ (the manual generated from code)
pnpm sim:balance    # race balance table; sim:builds, sim:careers and sim:loop check the rework's builds and pacing
pnpm data:import    # GameTora datasets → private, gitignored content packs
pnpm assets:import  # image sources → private WebP atlases; run after data:import
                    # chibis/stands/race faces: add `-- --source dir:~/Documents/uma-content` (owner's copy)
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
- **Private content in a worktree:** symlink the primary checkout's `content/` (and `scripts/data/.cache` before
  `pnpm data:import`). Never commit the links, and stage explicit paths instead of `git add -A`.
- **Verify UI changes at 390×844** in the browser preview, on the synthetic seeds:
  `/dev/seeds/<route>?seed=busy | fresh | quiet | gate | promote | tired | spent | stopped`, `&at=HH:MM` for the clock,
  `&canvas` so a screenshot captures the Hub (WebGL doesn't), `?save=device` for the device save. Dev builds expose
  `window.__hub` (the Hub's scene: `scene`, `game`, `paused`) and `window.__raceScene` (`seek`, `skipToEnd`), since the
  preview pane throttles animation frames. Check light and dark (the pane's color scheme, or Account's Appearance).
  Console 500s right after start are Vite's proxy racing the API's boot.

## Production operations

| Thing | Value |
|---|---|
| Site | https://uma-racer.web.app (Firebase Hosting, classic, not App Hosting) |
| API | Cloud Run `racer-api` (us-central1), `https://racer-api-tmzkhylhfq-uc.a.run.app`; `/api/health` (not `/healthz`, which Cloud Run's front end reserves) |
| GCP project | `uma-racer` (number 1026964321499), plus a private bucket `uma-racer-content` |
| Deploy | `.github/workflows/deploy.yml`, keyless WIF. Repo variables: GCP_PROJECT_ID, WIF_PROVIDER, CONTENT_BUCKET, ALLOWED_EMAIL, DEPLOY_ENABLED |
| Live on 2026-10-16 | `3d7f0d2` as racer-api-00194 (uma-kit 0.2.0: the docked bar and a full-screen app on iOS 26, D369), content `9ba4cdd37cca`, uma-art 2.7.0 |

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
  new code. The complete [release runbook](docs/technical/infrastructure.md#release-runbook) has the commands and the
  rollback (`git revert`, never a reset; the `pre-split` tag marks the old game).
- The installed PWA prompts **Update ready — Restart** and defers restart across gameplay commits. Tell the owner to
  restart only after the deploy is verified. Account (Town Hall, or the trainer button) shows the deployed **App build**
  and private **Content**.
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
- **Reading production data is read-only and keeps no copy:** the scoped `gcloud auth print-access-token` against
  Firestore's REST API. Generation 2's save is `saves/{uid}/{kind}/{id}`; `players/` is empty since the purge
  (`saves/{uid}/meta/purge`: 30 collections, 3,676 documents). Sync health is `gcloud logging read` on `racer-api`.
- **T144's step 10 is Claude's,** once the owner confirms in chat that the new account is theirs: remove
  `POST /api/legacy/purge` and the boot's purge call with their tests, deploy and verify (the route then answers 404),
  delete M034's and T144's specs, mark phase 3 completed in the task plan, and write D362. The first-boot wipe and the
  redirects stay until phase 4 or 5 (D365).
- Never type credentials into sign-in pages. Sign-in checks stop at Google's account chooser.

## Art from ChatGPT

New pixel art comes from ChatGPT sessions (the owner's choice on 2026-10-15). Claude writes a packet in
`docs/handoff/tasks/` (Why, Context, Do, Done when, Deliver; the master prompt starts a session), ChatGPT draws it in
uma-platform's `scripts/pixel-art` and publishes a `@luismlorenzana/uma-art` release, and Claude then:
1. pins the release exactly in `apps/web` (dependency) and `packages/domain` (dev dependency);
2. empties `AWAITING_ART` of the frames it drew, so the registry's frames test stays strict;
3. updates [11](docs/game/11-hub-and-places.md) §10, the architecture's art section and a decision;
4. deletes the packet and logs it in the handoff README.

The next packets are the Expedition world map and its region crests (phase 9), and a calibration packet only if the
owner chooses a pixel-art interface.

## Conventions

- **Mobile first** (390×844 portrait). Thumb-zone actions, 44 pt targets, safe-area padding (`pt-safe`/`pb-safe`, the
  bar's `mb-bar-safe`), and the kit's frame fixed to the screen (`AppFrame`), never `h-dvh`.
- **Light and dark:** draw in the theme's tokens; text on `bg-accent` is `text-accent-ink`, a surface that stays dark is
  `bg-stage` or `bg-scrim` (never `bg-ink`), and no `bg-white`, `text-black` or raw hex
  ([visual system](docs/design/visual-system.md#dark-mode)).
- **Performance budgets** (`docs/research/game-web-tech.md`): main JS ≤ 180 KB gzip (149.76 KB on 2026-10-16), so
  keep Phaser, PixiJS and Firebase lazy. Phaser is uma-kit's, for the Hub's map only (its lazy scene chunk), PixiJS for
  the race scene only; no uma-racer module imports either outside `scenes/race`. Animate only transform/opacity. Use
  delta-time for every animation.
- Use Motion's `m.*` components, never `motion.*`: `LazyMotion strict` throws on `motion.*`. Continuous HUD values use
  CSS transitions, not springs.
- Game state is the one Zustand store (`useSave`, with selectors) over Dexie, read by the shell and places only through
  the `G2Game` port and changed only by operations through it. TanStack Query is only for network data.
- The race engine never uses `Math.random`: everything goes through the seeded RNG in the input.
- Before pushing a change that moves files or imports, run the architecture's hand checks (reach, "nothing old
  remains", the canvas imports) and the docs link check.
