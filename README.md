# Uma Racer

A personal, never-distributed, mobile-style game inspired by *Umamusume: Pretty Derby*: **a racing game with
mini-game careers and no clock**. You unlock Umas and SSR support cards with tickets and run each Uma's career through
a scenario: twelve seasons, each a 3–7 minute mini-game stage that pays resources, an upgrade spent by hand in her tree
(priced with the original's training formula and the real numbers of the cards you post to it), and her objectives
raced on the race engine, then the scenario's finale. Nothing runs on timers, and nothing limits how much you play.

> **Status, 2026-11-05: generation 3 is live on the owner's iPhone.** The restart (D380) retired generation 2 and its
> game. M036, URA Finale, is its first release (D388): Uma and Card Tickets, the Stable and the Card Library, URA
> Finale careers for every Uma with **Training Yard** and **Furlong Hand**, the tree, the deck, bonds and skills, the
> URA Finals, and the Hub's two pages, Town Hall and Career. It shipped with a full wipe of generation 2, on the
> server and the phone. What comes next is [the task plan](docs/tasks/README.md) and
> [v3's roadmap](docs/research/drawing-board/README.md#7-the-roadmap); [the manual](docs/game/README.md) describes the
> code as it runs.

**A fresh session starts here:** this page (status, how to run and verify, the map), then [AGENTS.md](AGENTS.md) (how
to work, the shared workflows) and, for Claude, CLAUDE.md (production); [docs/tasks/README.md](docs/tasks/README.md)
for the state of the plan; [the manual](docs/game/README.md) for the game, with
[11 · Hub and places](docs/game/11-hub-and-places.md) for every screen and route and
[the architecture](docs/game/architecture.md) for the code.

## Ground rules

- **Personal use only.** Never published, shared, or deployed publicly.
- **Assets and game data stay local.** Images, icons, and data extracted from the original game, real card values
  included, stay out of version control and any public host.
- **Docs first.** Design decisions are recorded here before they are built, so every work session, human or AI,
  can pick up where the last one stopped.

## Run locally

```bash
NODE_AUTH_TOKEN=$(gh auth token) pnpm install   # @luismlorenzana/* come from GitHub Packages (read:packages)
cp apps/api/.env.example apps/api/.env
pnpm dev            # web http://localhost:5173 (also on the LAN for the iPhone) + api :8080, auth off, dev operations on
```

The local API keeps its save in `apps/api/.data/save-g3.json` and reads the private content from the gitignored
`content/` overlay folder and sibling `uma-platform/content/release` master release (`MASTER_DIR` overrides it).
A new account has 20 Uma Tickets and 24 Card Tickets: unlock Umas in the Stable and cards in the Card Library (the
account bar's ticket chips open their Locked tabs), then start an Uma's career from her profile or the Careers place
and play its seasons. Every place is also in the ☰ menu. In dev builds, Account's dev section grants more tickets
(`dev-grant`). There are no dev seeds (D381). From a git worktree, run the preview on your own port
([AGENTS.md](AGENTS.md#workflows)).

## Verification

```bash
pnpm lint           # type-check all packages
pnpm test           # domain rules, race engine, API, save and web; then sim:careers and sim:stages on invented content
pnpm test:ci        # the same suites one package at a time, as CI runs them
pnpm build          # production builds, including the PWA service worker and the 180 KB startup check
pnpm docs:update    # regenerate the live blocks in docs/game/ after a rule change
pnpm sim:decks      # the tree's bands with an empty, median and strong deck (-- --synthetic for invented cards)
pnpm sim:stages     # each mini-game's bots: grade bands and play length
pnpm sim:careers    # every Uma's URA Finale career at grade A: first-try win rates and pacing
pnpm sim:balance    # headless race strategy balance table (-- --final for the full matrix)
pnpm overlays:import   # validate and build only Racer-authored private overlays
pnpm overlays:publish -- --dry-run  # verify the overlay before publishing it
pnpm master:parity     # private migration proof; never commits source rows
```

The sims read the private pack when it is present locally and print aggregates only. The checks CI enforces, and the
ones run by hand (reach, "nothing old remains", no clock in the rules, links), are
[the architecture's](docs/game/architecture.md#budgets-and-checks).

## Repository layout

```text
apps/web        React 19 + Vite 7 + Tailwind 4 + Motion — mobile-first PWA on uma-kit (shell, Hub map on Phaser 4, theme); the two games' views; PixiJS 8 for the race
apps/api        NestJS 11 on Cloud Run — auth guard, generation 3's save and sync (Firestore g3/{uid}), the master and content proxies
packages/domain game rules as pure, tested functions, with subpath exports per area (account, build, career, stages, save, master, tiers, hub)
packages/race   deterministic race engine
scripts/        balance sims; Racer-only private overlays; the startup size check
infra/          GCP bootstrap + GitHub Actions docs
docs/           the manual, design, the drawing board, tasks, technical, research, handoff packets, archives
.github/        the verify-and-deploy workflow
```

## Documentation map

### The manual: the game as it runs

| Doc | What it covers |
|---|---|
| [Manual](docs/game/README.md) | The game in one page, every page, and how the pages stay true. Lists are generated from the code (D337) |
| [01 · Game loop](docs/game/01-game-loop.md) | Careers, seasons and the loop; playing again; what a career is worth |
| [02 · Unlocks](docs/game/02-unlocks.md) | Uma and Card Tickets, the Stable, the Card Library, a card's page, eras |
| [03 · Careers](docs/game/03-careers.md) | Starting one, the calendar, objectives, seasons, races, the URA Finals, rewards |
| [04 · Tiers and scenarios](docs/game/04-tiers-and-scenarios.md) | The tier map, caps, card eras, careers and rivals by scenario |
| [05 · The build](docs/game/05-the-build.md) | The wallet, the deck and posting, the tree and the session formula, skills, the racing build |
| [06 · Cards and bonds](docs/game/06-cards-and-bonds.md) | Owned cards at full level, their real effects, bond tracks, card power |
| [07 · Stages](docs/game/07-stages.md) | The mini-game framework: grades, pay, settling, replays, resume, `sim:stages` |
| [08 · Training Yard](docs/game/08-training-yard.md) | The merge game |
| [09 · Furlong Hand](docs/game/09-furlong-hand.md) | The card race |
| [11 · Hub and places](docs/game/11-hub-and-places.md) | The menu tree at a glance, the shell, the two pages and every place, the career screens, routes, the art |
| [12 · Pacing](docs/game/12-pacing.md) | The pay table, the targets and `sim:careers` |
| [Racing](docs/game/racing.md), [Scenarios](docs/game/scenarios.md) | Rival handicaps, strength by season and the roll; the fifteen scenarios and which page owns each rule |
| [Architecture](docs/game/architecture.md) | The repo, the domain's areas and exports, the sims, the web app by folder, the save and sync, the API, private content, the art, the race, the budgets and checks, CI and deploy |

### Design

| Doc | What it covers |
|---|---|
| [The drawing board v3](docs/research/drawing-board/README.md) | **The design of the game** (D380): its shape, the mini-games, the build on the real cards, what stays and goes, the engineering rules and the roadmap, with its research pages |
| [Overview](docs/design/00-overview.md) | Vision, pillars, the loop, differences from the original game |
| [UX](docs/design/ux.md) | The shell and navigation, screens, sheets, feedback and plain words, albums, accessibility |
| [Visual System "Paddock"](docs/design/visual-system.md) | Surfaces, colour, type, shape, components, icons, art treatment, motion, density |
| [Racing](docs/design/racing.md) | The race engine's design: catalogue, grade handicap, generated rivals, the race view |
| [Scenario Careers](docs/design/scenario-goals.md) | The career generator: her profile, the objectives' grades and how they're chosen |
| [Skills & Lineage](docs/design/skills-and-inheritance.md) | Archived (D380): generation 2's skills and lineage |

### Plans

| Doc | What it covers |
|---|---|
| [Tasks](docs/tasks/README.md) | **The current plan:** the releases, what shipped, the next free numbers, and the specs of work still ahead (see [AGENTS.md](AGENTS.md)) |
| [Change protocol](docs/change-protocol.md) | One game or both: where to ask for a change, and how a "Both apps:" kit change runs (uma-platform P50; the same text in all three repos) |
| [Handoff](docs/handoff/README.md) | Art packets for ChatGPT, and the master prompt to start a session |
| [Game rework](docs/rework/README.md), [Re-architecture plan](docs/rearchitecture/README.md) | Archived (D380): generation 2's game design and the code plan it ran on |
| [Generation 2's manual](docs/archive/g2-manual/) | Archived (D380): the retired game's pages, kept as history |

### Technical

| Doc | What it covers |
|---|---|
| [Infrastructure](docs/technical/infrastructure.md) | GCP services at about $0, CI/CD, content privacy, environments, the release runbook, rollback |
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
