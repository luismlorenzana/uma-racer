# Uma Racer

A personal, never-distributed, mobile-style game inspired by *Umamusume: Pretty Derby*.
Umas are permanent RPG characters. They level up by winning races, train through scenario "eras" with
SSR support cards, learn skills and inherit from their parents, and collect a lot of badges and flair,
while the stable itself grows into a collection.

> **Status:** pre-production. The app and API deploy, the deterministic race preview runs, and Milestone 1's private data,
> WebP atlas, and authenticated/offline content pipelines are built. Next: publish a generated private content version,
> then build the first playable Stable → Training → Race loop.

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

Race engine preview: **Race tab → pick a race → Start race**.

## Verification

```bash
pnpm lint           # type-check all packages
pnpm test           # domain rules, race engine, API sync
pnpm build          # production builds, including the PWA service worker
pnpm sim:balance    # headless race balance table
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
| [Uma Progression](docs/design/uma-progression.md) | Permanent levels, EXP, caps, gate levels, promotion |
| [Scenarios](docs/design/scenarios.md) | Scenarios as 10-level tiers, release timeline, eras, caps |
| [Scenario Goals](docs/design/scenario-goals.md) | Per-Uma targets based on aptitude and real-horse identity |
| [Training](docs/design/training.md) | Uma Level vs. Training Level, caps, daily training tickets, gain formulas, skill hints |
| [Support Cards](docs/design/support-cards.md) | SSR-only cards, era equip gating, usage-based leveling, limit breaks |
| [Skills & Inheritance](docs/design/skills-and-inheritance.md) | SP cap, skill library and loadout, parents and inherited skills |
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
| [UX & Visual Design](docs/design/ux.md) | Mobile-first iPhone UX, navigation, screen inventory, feedback catalog, visual style |

### Research and tracking

| Doc | What it covers |
|---|---|
| [Race Mechanics Research](docs/research/race-mechanics.md) | Community-documented formulas from the original race simulation |
| [Game-like Web Tech](docs/research/game-web-tech.md) | Rendering, frame rate, animation, PWA on iOS, performance playbook |
| [Race Engine R1 Findings](docs/research/race-engine-r1-findings.md) | First balance measurements of the race engine |
| [Data Backlog](docs/research/data-backlog.md) | Game data to gather (Umas, cards, skills, races) |
| [Decisions Log](docs/decisions.md) | What has been decided, and when |
| [Tasks](docs/tasks/) | Delegable task specs (see [AGENTS.md](AGENTS.md)) |
| [Open Questions](docs/open-questions.md) | Currently none. New questions land here before they're resolved |
