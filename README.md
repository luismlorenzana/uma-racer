# Uma Racer

A personal, never-distributed, mobile-style game inspired by *Umamusume: Pretty Derby*: **Race, Farm, Train**. Each
Uma climbs a tier of five scenarios, racing her career while the roster works the Farm on timers. The Farm's dishes pay
for Training Hub sessions that unlock her build one piece at a time, and races pay Prize Money that buys Speed Tickets.
Badges, titles and flair keep the stable's history.

> **Status, 2026-10-16: generation 2 is live on the owner's iPhone.** The game rework (D326–D338) is the game: its
> rules were built in phase 2 (D340–D351), and phase 3's cutover (M034, D352–D361) built the new game, its save and its
> screens and deleted every retired system (the RPG, Uma Puzzles, the minigames, Constellation Level, card stars,
> tokens, Training Tickets and the old Farm). T144 released it on 2026-10-15 and wiped every old save once. The same
> day the Home screen became uma-rpg's pixel-art Hub on a Phaser canvas (phase 6, ahead of phase 5: T145, D363), with
> the racer's own uma-art 2.7.0 (D364). On 2026-10-16 the shell, Hub and primitives moved to uma-kit, the app both Uma
> games share, which brought dark mode (T147, D367). What's open and next is [the task plan](docs/tasks/README.md);
> [the manual](docs/game/README.md) describes the code as it runs.

**A fresh session starts here:** this page (status, how to run and verify, the map), then [AGENTS.md](AGENTS.md) (how
to work, the shared workflows) and, for Claude, CLAUDE.md (production); [docs/tasks/README.md](docs/tasks/README.md)
for the state of the plan; [the manual](docs/game/README.md) for the game, with
[11 · Hub and places](docs/game/11-hub-and-places.md) for every screen and route and
[the architecture](docs/game/architecture.md) for the code.

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

The local API keeps its save in `apps/api/.data/save-g2.json` and reads the private content from the gitignored
`content/` overlay folder and sibling `uma-platform/content/release` master release (`MASTER_DIR` overrides it).
Racer no longer imports GameTora or images. A new account opens the Stable's Locked tab with 20 Uma Tickets: unlock Umas there, then send them
to the Farm's sites, the Pantry and the Kitchen, spend dishes on Training Hub sessions, and race from the raised
**Race** button. Every place is also in the ☰ menu. In dev builds, `/dev/seeds/` opens the game on synthetic accounts
(`?seed=busy | fresh | quiet | gate | promote | tired | spent | stopped`, `&at=HH:MM`) without touching the device
save ([architecture](docs/game/architecture.md#dev-seeds)). From a git worktree, run the preview on your own port
([AGENTS.md](AGENTS.md#workflows)).

## Verification

```bash
pnpm lint           # type-check all packages
pnpm test           # domain rules, race engine, API, save and web view models
pnpm test:ci        # the same suites one package at a time, as CI runs them
pnpm build          # production builds, including the PWA service worker and the 180 KB startup check
pnpm docs:update    # regenerate the live blocks in docs/game/ (and the plan's operations list) after a rule change
pnpm sim:balance    # headless race balance table (-- --final for the full matrix)
pnpm sim:turns      # engine v9's balance targets on generated G1 fields
pnpm sim:builds     # the stamina ladder and G1 grid on full-layer builds at every scenario
pnpm sim:careers    # every career of the private pack on full-layer builds
pnpm sim:loop       # the whole economy from a fresh account, and the pacing checks
pnpm overlays:import   # validate and build only Racer-authored private overlays
pnpm overlays:publish -- --dry-run  # verify the overlay before publishing it
pnpm master:parity     # private migration proof; never commits source rows
```

The checks CI enforces, and the ones run by hand (reach, "nothing old remains", links), are
[the architecture's](docs/game/architecture.md#budgets-and-checks).

## Repository layout

```text
apps/web        React 19 + Vite 7 + Tailwind 4 + Motion — mobile-first PWA on uma-kit (shell, Hub map on Phaser 4, theme); PixiJS 8 for the race
apps/api        NestJS 11 on Cloud Run — auth guard, the generation-2 save and sync, private content
packages/domain game rules as pure, tested functions, with subpath exports per area
packages/race   deterministic race engine
scripts/        balance sims; Racer-only private overlays; the startup size check
infra/          GCP bootstrap + GitHub Actions docs
docs/           the manual, design, plans, tasks, technical, research, handoff packets
.github/        the verify-and-deploy workflow
```

## Documentation map

### The manual: the game as it runs

| Doc | What it covers |
|---|---|
| [Manual](docs/game/README.md) | The game in one paragraph, the shared numbers, the glossary, the "Not built yet" rule and how the pages stay true. Lists are generated from the code (D337) |
| [Architecture](docs/game/architecture.md) | The repo, the domain's areas and exports, the web app by folder, the dev seeds and hooks, the save and sync v2, routes, the API, private content, the art, the race, the budgets and checks, CI and deploy |
| [01 · Game loop](docs/game/01-game-loop.md) | The loop step by step, one Uma's scenario, the roster in rotation, a week of play |
| [02 · Check-ins](docs/game/02-check-ins-and-notifications.md) | Collect all, Repeat, queues, the check-in summary, the planner, offline time, plain words |
| [03 · Uma progression](docs/game/03-uma-progression.md) | Racing Level, careers, advancing a scenario, one build per tier |
| [04 · Tiers and promotion](docs/game/04-tiers-and-promotion.md) | Three tiers, promotion, Uma Tickets and Shards, tier scaling, buffs |
| [05 · Training Hub](docs/game/05-training-hub.md) | Observatory, Lineage Hall, Gym and Dojo; constellations, Inspiration and Extra Stats |
| [06 · Cards and bonds](docs/game/06-cards-and-bonds.md) | Every SSR open, bonds per Uma, card sets and presets, card focus, the Card Library |
| [07 · Farm](docs/game/07-farm.md) | Sites, Pantry and Kitchen, Farm Level, jobs and queues, upgrades |
| [08 · Items and recipes](docs/game/08-item-catalogue-and-recipes.md) | The catalogue, recipes and dish destinations |
| [09 · Racing rewards and the Exchange](docs/game/09-racing-rewards-and-exchange.md) | Racing EXP, Prize Money, the Daily Purse, featured races, the Exchange, selling |
| [11 · Hub and places](docs/game/11-hub-and-places.md) | The menu tree at a glance, the shell, the four pages and every place, routes, queries and redirects, the art |
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
| [Tasks](docs/tasks/README.md) | **The current plan:** what shipped, what's open and next, the next free numbers, and the specs of work still ahead (see [AGENTS.md](AGENTS.md)) |
| [Change protocol](docs/change-protocol.md) | One game or both: where to ask for a change, and how a "Both apps:" kit change runs (uma-platform P50; the same text in all three repos) |
| [Handoff](docs/handoff/README.md) | Packets for ChatGPT (the Hub's art so far, A01–A02, done), and the master prompt to start a session |

### Technical

| Doc | What it covers |
|---|---|
| [Infrastructure](docs/technical/infrastructure.md) | GCP services at about $0, CI/CD, content privacy, environments, the release runbook as run on 2026-10-15, rollback |
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
