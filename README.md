# Uma Racer

A personal, never-distributed, mobile-style game inspired by *Umamusume: Pretty Derby*.
Umas are permanent RPG characters. They level up by winning races, train through scenario "eras" with
SSR support cards, learn skills and inherit from their parents, and collect a lot of badges and flair,
while the stable itself grows into a collection.

> **Status:** playable and deployed. Today's game holds the racer, the Global Uma RPG and Uma Puzzles: the private
> content pipeline, a local-first cloud-synced save, the deterministic race engine, careers, constellations trained
> through Uma Puzzles' Constellation Level, Friendship Training's card stars, the Stable Kitchen Farm, and the badge
> and collection pillars.
>
> **In progress: the rework.** The owner's [game rework](docs/rework/README.md) (D326–D336, D338) turns Uma Racer into
> Race, Farm, Train, and the [re-architecture](docs/rearchitecture/README.md) (D321–D325) rebuilds the code on
> uma-platform underneath it. Phase 1 (a sound base) landed on 2026-10-14 (D337); phase 2 builds the rework's rules
> ([tasks](docs/tasks/README.md)). Phase 3 wipes every save once and starts the new game. [The manual](docs/game/README.md)
> describes the code as it runs today.

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
pnpm dev            # web http://localhost:5173 (also on the LAN for the iPhone) + api :8080
```

Global Puzzle training: **Home → Uma Puzzles → enroll five owned outfits → Parties → Chapters → URA Finale**.
Saved-Uma Training: **Home or Stable → Uma profile → Train → Constellation / Inspiration / Extra stats**.
Progression racing: **Start a scenario → configure/train as desired → Race → pick a content race, Uma, and strategy**.
Scenario Start: **Acquire an Uma or reach a non-final gate → start the new per-scenario constellation and career at CL1**.
Scenario goals: **Home or Profile Journey → choose a target race → win its rule during the active tier → preserve the result on promotion**.
Global RPG: **Home → Uma RPG → enroll five owned outfits → save a party → Chapters → URA Finale**. The real URA
chapter and portraits are published privately; owner gameplay/device acceptance follows deployment (D257).

## Verification

```bash
pnpm lint           # type-check all packages
pnpm test           # domain rules, race engine, API sync, save persistence and web view models
pnpm build          # production builds, including the PWA service worker
pnpm sim:balance    # headless race balance table
pnpm sim:spark      # synthetic Spark Rival Circuit balance matrix and regression gate
pnpm sim:spark -- --full  # 1,000 fixed seeds for all 14 tiers × TL1–9
pnpm sim:farm       # current Farm production/check-in/material envelope
pnpm sim:farm:legacy # frozen v1/v2 plot/crop progression regression
pnpm sim:rpg:campaign # class party (Brawler, two Mages, Cleric, Summoner) through generated chapters (D282)
pnpm sim:puzzles    # 888 invented battles + exhaustive campaign/economy; --combat / --economy filters
pnpm data:rpg:validate # offline private RPG cast pack integrity and art pins (T097)
pnpm sim:balance -- --final  # multi-thousand-race Milestone 3 matrix
pnpm sim:cards -- 300        # synthetic deck, Training, hint, Race Bonus, and G1 follow-up
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
| [Scenario Careers](docs/design/scenario-goals.md) | Each scenario's career per Uma: a G3, two G2s, then a G1 set, gating her levels |
| [Training](docs/design/training.md) | Uma Level vs. Constellation Level, derived stats, tickets. The entry point to the two below |
| [Constellations](docs/design/constellations.md) | The per-scenario skill tree: node kinds, stat budget and its invariance rule, skills, lineage |
| [Minigames](docs/design/minigames.md) | Friendship earns global card stars; retired Spark rules remain for history |
| [Minigame kit](docs/design/minigame-kit.md) | What every minigame shares: the run contract, determinism, engine home, screen layout, look, guide and reusable pieces |
| [Stable Farm](docs/design/farm.md) | Current Farm entry and archived v1/v2 rules for legacy stock/jobs/history |
| [Farm production/cooking](docs/design/farm-kitchen-rework.md) | Complete M031/T118–T124: five open six-station districts, independent outfit levels, symmetric scenario foods, raw → processed → meals and canonical shared-block Extra maps; explicit archived one-time preparation. [Release evidence](docs/research/farm-kitchen-release-acceptance.md) separates production checks from pending owner iPhone acceptance |
| [Global Uma RPG](docs/design/uma-rpg.md) | Account-wide campaign: one generated chapter per scenario on a launch pad, a replayable top-to-bottom map, five-Uma parties of four classes, Octopath-style break battles against PriConne teams, carried MP and camps, and EXP plus scenario Inspiration tokens from every win (D260–D282) |
| [RPG classes and skill trees](docs/design/uma-rpg-classes.md) | Brawler, Mage, Cleric and Summoner: turns and hands, multi-part hits and weaknesses, every authored tree, node and number, Cleric blessings, summons and the balance check (D277–D282) |
| [Uma Puzzles](docs/design/uma-puzzles.md) | Free global party campaign, replay-backed battles, scenario/style materials, debt/exchange and shared CL spending; protected preservation and private owner-export art (D287–D292) |
| [Support Cards](docs/design/support-cards.md) | SSR-only cards, per-scenario six-card sets, era gating, tilt, stars |
| [Skills & Lineage](docs/design/skills-and-inheritance.md) | Skills from nodes, SP as the only limit, six lineage slots and aptitude upgrades |
| [Racing](docs/design/racing.md) | Race loop, catalog, grade handicap, generated rivals, straight-track view |
| [Collection](docs/design/collection.md) | Starter sets, coupons and shards, albums, trainer achievements |
| [Economy](docs/design/economy.md) | Training Tickets as the one currency, costs, coupons and shards, pacing |
| [Badges & Achievements](docs/design/badges.md) | Badge taxonomy, tiers, titles, the Badge page (pins, classification, filters) |

### The rework and the rebuild

| Doc | What it covers |
|---|---|
| [Game manual](docs/game/README.md) | The game as it runs today: architecture, scenarios, racing. Lists are generated from the code (D337) |
| [Game rework](docs/rework/README.md) | What Uma Racer becomes (D326–D336, D338): tiers, the Training Hub, cards and bonds, the Farm, items and recipes, Prize Money and the Exchange, World Expeditions, the Hub, pacing |
| [Re-architecture plan](docs/rearchitecture/README.md) | How the code is rebuilt (D321–D325): target architecture, uma-platform and shared packages, Phaser, the RPG's removal, the data wipe, and [the phases](docs/rearchitecture/08-phases.md) |

### Technical

| Doc | What it covers |
|---|---|
| [Architecture](docs/technical/architecture.md) | What's reused from uma-planner, monorepo layout, local-first state, simulation, content, auth, data model |
| [Farm production/cooking implementation](docs/technical/farm-kitchen-implementation.md) | Pure layer/[balance](docs/research/farm-kitchen-balance.md), atomic sync/Dexie32/[verification](docs/research/farm-kitchen-sync.md), dormant archive/reset/[rehearsal](docs/research/farm-kitchen-cutover-rehearsal.md), real host/[recovery tests](docs/research/farm-kitchen-host.md), phone screens/canonical race joins/[proof](docs/research/farm-kitchen-phone-proof/README.md); T124 owns release |
| [RPG implementation](docs/technical/uma-rpg-implementation.md) | Local-first RPG rows and sync, the device fight journal, the generated campaign and the cast-only private pack |
| [Uma Puzzles implementation contract](docs/technical/uma-puzzles-implementation.md) | Verified private content, atomic replay/repair/takeover, protected preservation, [release/owner checks](docs/research/uma-puzzles-release-acceptance.md) and [owner-export art acceptance](docs/research/puzzle-art-release-acceptance.md) |
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
| [Spark Rival Circuit Research](docs/research/spark-rival-circuit.md) | Puzzle-battle adaptation, strategy advantage, deterministic touch architecture, and rejected scope |
| [World Expeditions Research](docs/research/world-expeditions.md) | International Dirt and Turf specialist race pools, a unified eight-win completion rule, and source risks |
| [Farming Game Research](docs/research/farming-games.md) | Popular farming loops compared against Stable Farm's plots, workers, offline clock, crop progression and inventory |
| [Farm and Cooking Research](docs/research/farm-kitchen-games.md) | Primary-source production/cookbook comparisons, recommended mechanics and the draft's full-map ingredient arithmetic |
| [Uma RPG Research](docs/research/uma-rpg.md) | Persona/Fire Emblem/Octopath comparisons, actual A-aptitude overlap and playable PriConne character-team/content direction |
| [Race Mechanics Review](docs/research/race-mechanics-review.md) | Engine v7 against the original: target vs current speed, each phase, five departures with evidence, and what every stat buys |
| [Race Engine R1 Findings](docs/research/race-engine-r1-findings.md) | First balance measurements of the race engine |
| [Race Engine R2.5 Findings](docs/research/race-engine-r2.5-findings.md) | Basic-skill coverage, recovery comparison, and the pre-pack balance baseline |
| [Race Engine R3 Findings](docs/research/race-engine-r3-findings.md) | Pack formulas, explicit approximations, launch-unique coverage, and balance results |
| [Milestone 3 Balance Closure](docs/research/race-engine-r3-final-balance.md) | Final strategy/player/recovery matrix and remaining calibration caveat |
| [Support Deck Balance Follow-up](docs/research/support-deck-balance.md) | Weak/mid/mature deck Training results and the T008 G1 follow-up |
| [Data Backlog](docs/research/data-backlog.md) | Game data to gather (Umas, cards, skills, races) |
| [Decisions Log](docs/decisions.md) | What has been decided, and when |
| [Tasks](docs/tasks/README.md) | The current milestone plan and its delegable task specs (see [AGENTS.md](AGENTS.md)) |
| [Open Questions](docs/open-questions.md) | Owner/device checks; the proposed RPG's answered rules now live in its design draft |
