# Uma Racer

A personal, never-distributed, mobile-style game inspired by *Umamusume: Pretty Derby*.
Umas are permanent RPG characters. They level up by winning races, train through scenario "eras" with
SSR support cards, learn skills and inherit from their parents, and collect a lot of badges and flair,
while the stable itself grows into a collection.

> **Status:** playable and deployed. Milestones 1–6 are complete: the private content pipeline, a typed local-first save
> with the real 25-Uma launch Stable, the Train → Race loop, race depth (compiled skills, course geometry, position
> keeping, lanes, staged starts, photo finishes), Card and Uma albums with decks, coupons and shards, save v3 with frozen
> lineage, pink sparks, Scenario Start and deterministic goals, and the full badge pillar with per-Uma flair, Prestige,
> showcases, and Trainer achievements.
>
> The 2026-09 training redirection is now the source of truth: Training Levels open a per-scenario constellation, cards
> earn per-scenario stars, and races use the resulting derived build. Races run on
> [turn-based engine v7](docs/design/racing.md#engine-v7-the-originals-physics-and-field). Training Levels come from
> [Spark Match — Rival Circuit](docs/design/minigames.md#spark-match--rival-circuit), a three-wave continuous-drag puzzle
> battle, and cards earn their stars in [Friendship Training](docs/design/minigames.md#friendship-training--card-stars);
> both share one [Minigame kit](docs/design/minigame-kit.md). The Paddock visual system and original icon set have
> landed. What comes next is in [Tasks](docs/tasks/README.md).

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

Saved-Uma Training: **Home or Stable → Uma profile → Train → Spark Match or Constellation**.
Progression racing: **Start a scenario → configure/train as desired → Race → pick a content race, Uma, and strategy**.
Scenario Start: **Acquire an Uma or reach a non-final gate → start the new per-scenario constellation and career at TL1**.
Scenario goals: **Home or Profile Journey → choose a target race → win its rule during the active tier → preserve the result on promotion**.

## Verification

```bash
pnpm lint           # type-check all packages
pnpm test           # domain rules, race engine, API sync, save persistence and web view models
pnpm build          # production builds, including the PWA service worker
pnpm sim:balance    # headless race balance table
pnpm sim:spark      # synthetic Spark Rival Circuit balance matrix and regression gate
pnpm sim:spark -- --full  # 1,000 fixed seeds for all 14 tiers × TL1–9
pnpm sim:farm       # synthetic Farm plot, crop-row and outfit-level progression gate
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
| [Training](docs/design/training.md) | Uma Level vs. Training Level, derived stats, tickets. The entry point to the two below |
| [Constellations](docs/design/constellations.md) | The per-scenario skill tree: node kinds, stat budget and its invariance rule, skills, lineage |
| [Minigames](docs/design/minigames.md) | Spark Rival Circuit raises Training Levels; the card minigame earns a card's stars |
| [Minigame kit](docs/design/minigame-kit.md) | What every minigame shares: the run contract, determinism, engine home, screen layout, look, guide and reusable pieces |
| [Stable Farm](docs/design/farm.md) | Complete one-to-six-plot account loop: persistent outfit workers, scenario crops, synced harvests, global Items and constellation Produce consumption |
| [Global Uma RPG — first draft](docs/design/uma-rpg.md) | Proposed account-wide turn-based campaign: outfit class tiers/promotions, locked style-classes, elemental skill trees, five-person parties, PriConne character teams, chapter maps and scenario Inspiration tokens; not implemented |
| [Support Cards](docs/design/support-cards.md) | SSR-only cards, per-scenario six-card sets, era gating, tilt, stars |
| [Skills & Lineage](docs/design/skills-and-inheritance.md) | Skills from nodes, SP as the only limit, six lineage slots and aptitude upgrades |
| [Racing](docs/design/racing.md) | Race loop, catalog, grade handicap, generated rivals, straight-track view |
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
| [Spark Rival Circuit Research](docs/research/spark-rival-circuit.md) | Puzzle-battle adaptation, strategy advantage, deterministic touch architecture, and rejected scope |
| [World Expeditions Research](docs/research/world-expeditions.md) | International Dirt and Turf specialist race pools, a unified eight-win completion rule, and source risks |
| [Farming Game Research](docs/research/farming-games.md) | Popular farming loops compared against Stable Farm's plots, workers, offline clock, crop progression and inventory |
| [Uma RPG Research](docs/research/uma-rpg.md) | Persona/Fire Emblem/Octopath comparisons, actual A-aptitude overlap and playable PriConne character-team/content direction |
| [Race Engine R1 Findings](docs/research/race-engine-r1-findings.md) | First balance measurements of the race engine |
| [Race Engine R2.5 Findings](docs/research/race-engine-r2.5-findings.md) | Basic-skill coverage, recovery comparison, and the pre-pack balance baseline |
| [Race Engine R3 Findings](docs/research/race-engine-r3-findings.md) | Pack formulas, explicit approximations, launch-unique coverage, and balance results |
| [Milestone 3 Balance Closure](docs/research/race-engine-r3-final-balance.md) | Final strategy/player/recovery matrix and remaining calibration caveat |
| [Support Deck Balance Follow-up](docs/research/support-deck-balance.md) | Weak/mid/mature deck Training results and the T008 G1 follow-up |
| [Data Backlog](docs/research/data-backlog.md) | Game data to gather (Umas, cards, skills, races) |
| [Decisions Log](docs/decisions.md) | What has been decided, and when |
| [Tasks](docs/tasks/README.md) | The current milestone plan and its delegable task specs (see [AGENTS.md](AGENTS.md)) |
| [Open Questions](docs/open-questions.md) | Owner/device checks; the proposed RPG's answered rules now live in its design draft |
