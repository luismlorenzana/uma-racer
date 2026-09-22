# Uma Racer

A personal, never-distributed, mobile-style game inspired by *Umamusume: Pretty Derby*.
Umas are permanent RPG characters. They level up by winning races, train through scenario "eras" with
SSR support cards, build skills and lineage through constellations, and collect a lot of badges and flair,
while the stable itself grows into a collection.

> **Status:** playable and deployed. The private content pipeline, real 25-Uma launch Stable, deterministic race engine,
> collection and badge pillars, and local-first cloud-synced save are live. The 2026-09-20 training redirection is also
> live: save v6 holds one constellation per Uma per scenario, Spark Match raises Training Level, Bond Recall raises a
> card's scenario-specific bond, and stats, skills and aptitudes are derived from the active constellation.
>
> Current planned work is tracked in [Tasks](docs/tasks/README.md): the remaining owner playability pass,
> [scenario identity](docs/tasks/M015-scenario-identity.md), the [Paddock visual rollout](docs/tasks/M009-look-and-feel.md),
> [Race Select browsing](docs/tasks/M010-collection-depth.md), and
> [game feel/device readiness](docs/tasks/M011-game-feel-and-device.md).

## Ground rules

- **Personal use only.** Never published, shared, or deployed publicly.
- **Assets and game data stay local.** Images, icons, and data extracted from the original game stay out of
  version control and any public host.
- **Docs first.** Design decisions are recorded here before they are built, so every work session, human or AI,
  can pick up where the last one stopped.

## Run locally

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm dev            # web http://localhost:5173 (also on the LAN for the iPhone) + api :8080
```

Saved-Uma Training: **Home or Stable → Uma profile → Training → Spark Match or configure the constellation/card set**.
Progression racing: **Start the active scenario → Race → pick a content race, Uma, and strategy → Start race**.
Scenario progression: **Reach a gate level → unlock the next scenario → rebuild its Training Level, card set and constellation**.
Lineage: **At Training Levels 9–10, fill the six lineage nodes with distinct owned Uma templates**.
Scenario goals: **Home or Profile Journey → choose a target race → win its rule during the active tier → preserve the result on advancement**.

## Verification

```bash
pnpm lint           # type-check all packages
pnpm test           # domain rules, race engine, API sync, save persistence and web view models
pnpm build          # production builds, including the PWA service worker
pnpm sim:balance    # headless race balance table
pnpm sim:balance -- --final  # multi-thousand-race Milestone 3 matrix
pnpm data:import    # GameTora datasets → private, gitignored content packs
pnpm assets:import  # image sources in those packs → private WebP atlases
```

## Repository layout

```text
apps/web        React 19 + Vite 7 + Tailwind 4 + Motion + PixiJS 8 — mobile-first PWA
apps/api        NestJS 11 on Cloud Run — auth guard, save sync, private content
packages/domain game rules as pure, tested formulas
packages/race   deterministic race engine
scripts/        balance sims; private data and WebP atlas pipelines
infra/          GCP bootstrap + GitHub Actions docs
docs/           design, technical, research
```

## Documentation map

### Design

| Doc | What it covers |
|---|---|
| [Overview](docs/design/00-overview.md) | Vision, pillars, core loops, glossary, differences from the original game |
| [Uma Progression](docs/design/uma-progression.md) | Permanent Uma Level, per-scenario training state, derived stats, unlocking the next scenario |
| [Scenarios](docs/design/scenarios.md) | Scenarios as career runs: cap profiles, constellation shapes, buffs, eras |
| [Scenario Goals](docs/design/scenario-goals.md) | Per-Uma targets based on aptitude and real-horse identity |
| [Training](docs/design/training.md) | Uma Level vs. Training Level, derived stats, tickets. The entry point to the two below |
| [Constellations](docs/design/constellations.md) | The per-scenario skill tree: node kinds, stat budget and its invariance rule, skills, lineage |
| [Minigames](docs/design/minigames.md) | Spark Match raises Training Levels; Bond Recall raises card bond |
| [Support Cards](docs/design/support-cards.md) | SSR-only cards, per-scenario six-card sets, era gating, tilt, bond |
| [Skills & Lineage](docs/design/skills-and-inheritance.md) | Skills from nodes, SP as the only limit, six lineage slots and aptitude upgrades |
| [Racing](docs/design/racing.md) | Race loop, catalog, Race Form difficulty, baseline enemy Umas, straight-track view |
| [Collection](docs/design/collection.md) | Starter sets, coupons and shards, albums, trainer achievements |
| [Economy](docs/design/economy.md) | Training Tickets as the one currency, costs, coupons and shards, pacing |
| [Badges & Achievements](docs/design/badges.md) | Badge taxonomy, tiers, titles, the Badge page (pins, classification, filters) |

### Technical

| Doc | What it covers |
|---|---|
| [Architecture](docs/technical/architecture.md) | What's reused from uma-planner, monorepo layout, local-first state, simulation, content, auth, data model |
| [Infrastructure](docs/technical/infrastructure.md) | GCP services at about $0, CI/CD, one-time bootstrap, content privacy, environments |
| [GCP Setup Guide](docs/technical/gcp-setup-guide.md) | Click-by-click Firebase and Google Cloud setup for the owner |
| [Visual System "Paddock"](docs/design/visual-system.md) | Surfaces, colour, type, shape, components, icons, art treatment, motion, density |
| [UX & Visual Design](docs/design/ux.md) | Mobile-first iPhone UX, navigation, screen inventory, feedback catalog, visual style |

### Research and tracking

| Doc | What it covers |
|---|---|
| [Race Mechanics Research](docs/research/race-mechanics.md) | Community-documented formulas from the original race simulation |
| [Game UI Reference](docs/research/game-ui-reference.md) | What Umamusume and HoYoverse interfaces do, why the old skin failed, and album browsing patterns |
| [Game-like Web Tech](docs/research/game-web-tech.md) | Rendering, frame rate, animation, PWA on iOS, performance playbook |
| [Race Engine R1 Findings](docs/research/race-engine-r1-findings.md) | First balance measurements of the race engine |
| [Race Engine R2.5 Findings](docs/research/race-engine-r2.5-findings.md) | Basic-skill coverage, recovery comparison, and the pre-pack balance baseline |
| [Race Engine R3 Findings](docs/research/race-engine-r3-findings.md) | Pack formulas, explicit approximations, launch-unique coverage, and balance results |
| [Milestone 3 Balance Closure](docs/research/race-engine-r3-final-balance.md) | Final strategy/player/recovery matrix and remaining calibration caveat |
| [Historical Support Deck Balance](docs/research/support-deck-balance.md) | Pre-D120 training-turn measurements retained as research history |
| [Data Backlog](docs/research/data-backlog.md) | Game data to gather (Umas, cards, skills, races) |
| [Decisions Log](docs/decisions.md) | What has been decided, and when |
| [Tasks](docs/tasks/README.md) | The current milestone plan and its delegable task specs (see [AGENTS.md](AGENTS.md)) |
| [Open Questions](docs/open-questions.md) | Currently none. New questions land here before they're resolved |
