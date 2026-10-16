# Uma Racer

A personal, never-distributed, mobile-style game inspired by *Umamusume: Pretty Derby*: **Race, Farm, Train**. Each
Uma climbs a tier of five scenarios, racing her career while the roster works the Farm on timers. The Farm's dishes pay
for Training Hub sessions that unlock her build one piece at a time, and races pay Prize Money that buys Speed Tickets.
Badges, titles and flair keep the stable's history.

> **Status: generation 2.** The game rework (D326–D338) is the game: its rules were built in phase 2 (D340–D351) and
> the new game, its save and its screens in phase 3, the cutover (M034, D352–D361), which deleted every retired system
> (the RPG, Uma Puzzles, the minigames, Constellation Level, card stars, tokens, Training Tickets and the old Farm).
> The cutover ships to the owner's iPhone with T144, which wipes every save once ([tasks](docs/tasks/README.md)).
> [The manual](docs/game/README.md) describes the code as it runs.

## Ground rules

- **Personal use only.** Never published, shared, or deployed publicly.
- **Assets and game data stay local.** Images, icons, and data extracted from the original game stay out of
  version control and any public host.
- **Docs first.** Design decisions are recorded here before they are built, so every work session, human or AI,
  can pick up where the last one stopped.

## Run locally

```bash
NODE_AUTH_TOKEN=$(gh auth token) pnpm install   # @luismlorenzana/* come from GitHub Packages (read:packages)
cp apps/api/.env.example apps/api/.env
pnpm dev            # web http://localhost:5173 (also on the LAN for the iPhone) + api :8080, auth off, dev operations on
```

A new account opens the Stable's Locked tab with 20 Uma Tickets: unlock Umas there, then send them to the Farm's sites,
the Pantry and the Kitchen, spend dishes on Training Hub sessions, and race from the raised **RACE** button. Every place
is also in the ☰ menu. In dev builds, `/dev/seeds/` opens the game on synthetic accounts (`?seed=busy | fresh | quiet |
gate | promote | tired | spent | stopped`) without touching the device save ([architecture](docs/game/architecture.md#dev-seeds)).

## Verification

```bash
pnpm lint           # type-check all packages
pnpm test           # domain rules, race engine, API, save and web view models (test:ci runs them one at a time)
pnpm build          # production builds, including the PWA service worker and the 180 KB startup check
pnpm docs:update    # regenerate the live blocks in docs/game/ (and the plan's operations list) after a rule change
pnpm sim:balance    # headless race balance table (-- --final for the full matrix)
pnpm sim:turns      # engine v9's balance targets on generated G1 fields
pnpm sim:builds     # the stamina ladder and G1 grid on full-layer builds at every scenario
pnpm sim:careers    # every career of the private pack on full-layer builds
pnpm sim:loop       # the whole economy from a fresh account, and the pacing checks
pnpm data:import    # GameTora datasets → private, gitignored content packs
pnpm assets:import  # image sources in those packs → private WebP atlases
pnpm content:publish -- --dry-run   # check the private content before publishing it
```

## Repository layout

```text
apps/web        React 19 + Vite 7 + Tailwind 4 + Motion — mobile-first PWA; PixiJS 8 for the race scene only
apps/api        NestJS 11 on Cloud Run — auth guard, the generation-2 save and sync, private content
packages/domain game rules as pure, tested functions, with subpath exports per area
packages/race   deterministic race engine
scripts/        balance sims; private data and WebP atlas pipelines
infra/          GCP bootstrap + GitHub Actions docs
docs/           the manual, design, plans, technical, research, tasks
```

## Documentation map

### The manual: the game as it runs

| Doc | What it covers |
|---|---|
| [Manual](docs/game/README.md) | The game in one paragraph, the shared numbers, the glossary, the "Not built yet" rule and how the pages stay true. Lists are generated from the code (D337) |
| [Architecture](docs/game/architecture.md) | The repo, the domain's areas and exports, the web app, the save and sync v2, routes, the API, private content, the race, budgets, deploy |
| [01 · Game loop](docs/game/01-game-loop.md) | The loop step by step, one Uma's scenario, the roster in rotation, a week of play |
| [02 · Check-ins](docs/game/02-check-ins-and-notifications.md) | Collect all, Repeat, queues, the check-in summary, the planner, offline time, plain words |
| [03 · Uma progression](docs/game/03-uma-progression.md) | Racing Level, careers, advancing a scenario, one build per tier |
| [04 · Tiers and promotion](docs/game/04-tiers-and-promotion.md) | Three tiers, promotion, Uma Tickets and Shards, tier scaling, buffs |
| [05 · Training Hub](docs/game/05-training-hub.md) | Observatory, Lineage Hall, Gym and Dojo; constellations, Inspiration and Extra Stats |
| [06 · Cards and bonds](docs/game/06-cards-and-bonds.md) | Every SSR open, bonds per Uma, card sets and presets, card focus, the Card Library |
| [07 · Farm](docs/game/07-farm.md) | Sites, Pantry and Kitchen, Farm Level, jobs and queues, upgrades |
| [08 · Items and recipes](docs/game/08-item-catalogue-and-recipes.md) | The catalogue, recipes and dish destinations |
| [09 · Racing rewards and the Exchange](docs/game/09-racing-rewards-and-exchange.md) | Racing EXP, Prize Money, the Daily Purse, featured races, the Exchange, selling |
| [11 · Hub and places](docs/game/11-hub-and-places.md) | The four pages, every place, routes and redirects, art |
| [12 · Economy and pacing](docs/game/12-economy-and-pacing.md) | Currencies, the pacing target, the time model, the loop simulation |
| [Racing](docs/game/racing.md), [Scenarios](docs/game/scenarios.md) | What a finish pays, handicaps and rivals; the scenario ladder and which page owns each rule |

### Design

| Doc | What it covers |
|---|---|
| [Overview](docs/design/00-overview.md) | Vision, pillars, the core loop, differences from the original game |
| [UX](docs/design/ux.md) | The shell and navigation, screens, sheets, feedback and plain words, albums, accessibility |
| [Visual System "Paddock"](docs/design/visual-system.md) | Surfaces, colour, type, shape, components, icons, art treatment, motion, density |
| [Racing](docs/design/racing.md) | The race engine's design: catalogue, grade handicap, generated rivals, the race view |
| [Scenario Careers](docs/design/scenario-goals.md) | Each scenario's career per Uma: a G3, two G2s, then a G1 set, and its holds |
| [Skills & Lineage](docs/design/skills-and-inheritance.md) | Skills from nodes, SP as the only limit, lineage slots and aptitude upgrades |
| [Badges & Achievements](docs/design/badges.md) | Badge taxonomy, tiers, titles, Trainer achievements, the Trophy Hall |

### Plans

| Doc | What it covers |
|---|---|
| [Game rework](docs/rework/README.md) | Where each rework page lives now, World Expeditions (phase 9, not built), and [the plan](docs/rework/13-removals-and-plan-changes.md): what left, the generation-2 save, the revised phases |
| [Re-architecture plan](docs/rearchitecture/README.md) | How the code is rebuilt (D321–D325): target architecture, uma-platform and shared packages, Phaser, the data wipe, and [the phases](docs/rearchitecture/08-phases.md) |
| [Tasks](docs/tasks/README.md) | The current milestone plan and its delegable task specs (see [AGENTS.md](AGENTS.md)) |
| [Handoff](docs/handoff/README.md) | Packets for ChatGPT, starting with the Hub's art, and the master prompt to start a session |

### Technical

| Doc | What it covers |
|---|---|
| [Infrastructure](docs/technical/infrastructure.md) | GCP services at about $0, CI/CD, content privacy, environments, the release runbook |
| [GCP Setup Guide](docs/technical/gcp-setup-guide.md) | Click-by-click Firebase and Google Cloud setup for the owner |

### Research and tracking

| Doc | What it covers |
|---|---|
| [Race Mechanics Research](docs/research/race-mechanics.md) | Community-documented formulas from the original race simulation |
| [Race Mechanics Review](docs/research/race-mechanics-review.md) | The engine against the original: target vs current speed, each phase, departures with evidence |
| [Race Engine Findings](docs/research/race-engine-v7-findings.md) | Engine balance measurements, with [R1](docs/research/race-engine-r1-findings.md), [R2.5](docs/research/race-engine-r2.5-findings.md), [R3](docs/research/race-engine-r3-findings.md), [the Milestone 3 closure](docs/research/race-engine-r3-final-balance.md) and [v5](docs/research/race-engine-v5-findings.md) before it |
| [Support Deck Balance](docs/research/support-deck-balance.md) | Weak, mid and mature decks against the G1 follow-up (pre-rework measurements) |
| [World Expeditions Research](docs/research/world-expeditions.md) | International Dirt and Turf race pools, the eight-win completion rule, and source risks |
| [Farming Game Research](docs/research/farming-games.md) | Popular farming loops compared |
| [Game UI Reference](docs/research/game-ui-reference.md) | What Umamusume and HoYoverse interfaces do, and album browsing patterns |
| [Game-like Web Tech](docs/research/game-web-tech.md) | Rendering, frame rate, animation, PWA on iOS, performance playbook |
| [Data Backlog](docs/research/data-backlog.md) | Game data to gather (Umas, cards, skills, races) |
| [Decisions Log](docs/decisions.md) | What has been decided, and when |
| [Open Questions](docs/open-questions.md) | Owner actions and anything that needs the owner |
