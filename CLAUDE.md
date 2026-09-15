# Uma Racer — working notes for Claude

A personal, never-distributed Uma Musume–inspired racing RPG, played on the owner's iPhone as a Home Screen web app.

## Start here

- `README.md` → documentation map. **The design docs are the source of truth.** Read the relevant doc before changing a system.
- `docs/decisions.md` is append-only: to reverse a decision, add a new entry that supersedes it.
- `docs/open-questions.md` holds anything that needs the owner. The owner prefers **no open questions**: decide with a
  recommendation when a sensible default exists, and log it.
- Numbers in the design docs are tuning drafts. `packages/domain/src/domain.test.ts` pins them. Change doc and test together.

## Ground rules

- **Original-game content never goes in git or on a public host**: data packs and images live in the gitignored `content/`
  folder locally, and in the private GCS bucket in production, served only through the authenticated API.
- **Don't create remotes, GCP resources, or commits** unless the owner asks. Bootstrap steps are owner actions (`infra/github-actions/README.md`).
- The architecture and deploy pipeline are reused from the sibling repo `../uma-planner`. Check how it solves something before inventing a new pattern.

## Layout

| Path | What |
|---|---|
| `packages/domain` | Pure game rules (caps, Race Form, economy, cards, opponents). Vitest |
| `packages/race` | Deterministic race engine (seeded, 15 Hz ticks, timeline + playback sampling). Vitest |
| `apps/api` | NestJS 11: `AuthGuard` (Firebase token + `ALLOWED_EMAIL`), `/api/save`, `/api/sync`, `/api/content/*` |
| `apps/web` | React 19 + Vite 7 + Tailwind 4 + Motion (`m.*` under `LazyMotion strict`) + PixiJS 8 scenes + PWA |
| `scripts/sim` | Headless balance runs (`pnpm sim:balance`) |
| `scripts/data`, `scripts/assets` | Content pipeline (GameTora → private packs), not built yet |

## Commands

```bash
pnpm install
pnpm dev            # web :5173 (proxies /api) + api :8080, auth disabled, local JSON save
pnpm lint           # type-check every package
pnpm test           # domain + race + api tests
pnpm build          # production builds (web includes the PWA service worker)
pnpm sim:balance    # race balance table
```

## Conventions

- **Mobile first** (390×844 portrait). Thumb-zone actions, 44 pt targets, safe-area padding (`pt-safe`/`pb-safe`), `h-dvh`.
- **Performance budgets** (`docs/research/game-web-tech.md`): main JS ≤ 180 KB gzip, so keep PixiJS and Firebase lazy.
  Animate only transform/opacity. Use delta-time for every animation.
- Use Motion's `m.*` components, never `motion.*`: `LazyMotion strict` throws on `motion.*`. Continuous HUD values use CSS transitions, not springs.
- Game state goes in Zustand with selectors, persisted to Dexie. TanStack Query is only for network data.
- The race engine never uses `Math.random`: everything goes through the seeded RNG in the input.
- Verify UI changes in the browser preview at mobile size (`uma-racer-dev` in `.claude/launch.json`). Dev builds expose
  `window.__raceScene` (`seek`, `skipToEnd`), since the preview pane throttles animation frames.
