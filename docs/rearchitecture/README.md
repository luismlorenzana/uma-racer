# uma-racer re-architecture

> **Revised 2026-10-13 by the game rework (D326–D336).** The owner's feature docs have arrived as
> [`docs/rework/`](../rework/README.md): Race, Farm, Train, three tiers and World Expeditions. They delete the Uma
> Puzzles, Constellation Level, Friendship Training, card stars and tokens too. They replace this plan's Hub place list
> ([04](04-hub.md)) and Farm rules ([05](05-farm.md)), and reorder the phases so the rework's rules are built and
> simulated before the wipe. The changes to every page and decision here are listed in
> [rework/13](../rework/13-removals-and-plan-changes.md). Where the two disagree, the rework wins.

> **Status: phases 1 and 2 built 2026-10-14 (D337, D340–D350); phase 3, the cutover, built 2026-10-15 (D352–D361) and
> shipping with T144 ([tasks](../tasks/README.md)).** The game as it runs is [the manual](../game/README.md). The order of work is
> [08](08-phases.md)'s revised table.
>
> **First written 2026-10-12 (D321–D325).** This folder describes how uma-racer is rebuilt
> on uma-platform's shared foundation, with the RPG removed and every player's data started over. It is uma-platform
> roadmap **Phase 3** made concrete. The owner's own documents on new features and rebalancing come next and plug in
> where this plan marks them; until they land, the game's rules stay as they are today except where a page here says
> otherwise.

## Why

uma-racer grew for four weeks as one repo that held three games. Today, at D320 on `main`:

- **The RPG lives inside it** (about 13,400 lines across code, docs, saves and private content), even though
  uma-rpg is now its own game (uma-platform P2–P4).
- **Its master data pipeline is a drifted copy** of uma-platform's (`scripts/data`, `scripts/assets`), so every new
  Uma release has to be imported twice.
- **The save carries every past shape it ever had:** 33 save migrations, 34 Dexie versions, 47 local tables, three
  sync lanes and four one-time cutover or preservation machines (Inspiration advance, Puzzle preservation, Spark
  retirement, Farm archive). Each new feature has to reason about all of them.
- **The API carries about 17,800 lines of generated copies of the domain package,** because its Docker build can't see
  the workspace.
- **The Home screen is a scrolling list of cards**, while the other games have a pixel-art Hub of places.
- **Three canvas scenes run on PixiJS 8,** while uma-platform standardised on Phaser 4 (P14) and its art pipeline.
- **The 180 KB startup budget is written down but never checked.**

The owner chose a clean break: remove the RPG with no half-measures, wipe all player data and start over with 20
Uma Tickets. That removes the reason most of the accumulated machinery exists, so the rebuild can be simple.

## The end state in one paragraph

uma-racer becomes a racing game with a Farm and Uma Puzzles, built like uma-rpg:
- **Master data and Uma art** come from uma-platform's release through `@luismlorenzana/uma-data`.
- **Original pixel art** comes from `@luismlorenzana/uma-art`.
- **Login, content loading, the canvas scene host, idle timers and a few UI primitives** come from the shared kit
  extracted into uma-platform.
- **The web app opens on a Phaser 4 Hub** of places across three pages: Town, Farm and Training. The Farm is a
  pixel-art scene over the same production rules it has today. The race plays back on Phaser too.
- **The save is generation 2:** a new local database, a new Firestore root and a new sync protocol, with no
  migrations behind it, and every account starts with 20 Uma Tickets.
- **The API imports the domain package directly.** CI enforces the startup budget, and a live game manual
  (`docs/game/`, as in uma-rpg D92) is generated from the code.

## Pages

| Page | What it covers |
|---|---|
| [01 · Target architecture](01-target-architecture.md) | The repo after the rebuild: packages, apps, modules, what is kept, ported, rewritten or deleted, state, sync, API, budgets, tests, docs |
| [02 · uma-platform and packages](02-platform-and-packages.md) | Switching to platform master data and art, the adapter, what leaves the racer's pipelines, the shared kit to extract and how it ships |
| [03 · Rendering and textures](03-rendering-and-textures.md) | Phaser 4 everywhere a canvas is needed, the scene host, texture sources and loading, pixel-art rules, memory on iPhone, the race scene port |
| [04 · Hub rework](04-hub.md) | The Home list becomes a Hub of places on three pixel-art pages: registry, pages, places, routes, art, what moves where |
| [05 · Farm mechanics](05-farm.md) | The Farm as built (M031), what changes under the new architecture, the shared idle model, the Farm scene, what the owner's feature docs decide |
| [06 · RPG decommission](06-rpg-decommission.md) | Every file, table, collection, route, pack and doc to delete, every coupling to edit, the Inspiration token gap and how it's filled |
| [07 · Data wipe and reset](07-data-reset.md) | Save generation 2: where every byte of player data lives today and how each is wiped, the new account's 20 Uma Tickets, stale-device protection, verification |
| [08 · Phases and pull requests](08-phases.md) | The order of work as pull-request-sized steps, each with its exit check, risks and rollback |

## Decisions this plan makes

Logged in [decisions.md](../decisions.md) as D321–D325. Each page explains its own.

| # | Decision |
|---|---|
| D321 | **Rebuild on a clean skeleton, port the rules.** The pure rules (race engine, race skills, constellations, cards, scenario careers, badges, Farm production, Puzzles battles) are kept or ported. The save, persistence, sync, runtime and Home layers are rewritten for generation 2. Retired systems are deleted: Spark Rival Circuit, the v1/v2 Farm, every cutover, preservation and advance machine, and every migration |
| D322 | **The RPG is deleted completely**: code, API routes, save kinds, local tables, private packs, bucket files, sims, docs and proofs. Inspiration tokens, which only the RPG paid, come from **career goal wins** instead, and the token Convert screen moves to the Items screen |
| D323 | **Save generation 2 with a full wipe.** New IndexedDB database, new Firestore root, sync protocol v2. The old database, collections, caches and local keys are deleted, not migrated. **A new account starts with 20 Uma Tickets and no Umas**, plus today's starter cards and Card Coupons. Owner gifts and dev grants are gone |
| D324 | **Phaser 4 is the canvas engine** for the Hub, the Farm and the race. PixiJS stays only inside the Uma Puzzles chunk until the owner's feature docs decide the Puzzles' future, then it is ported or leaves with them |
| D325 | **uma-platform owns master data, art and the shared kit.** The racer's GameTora pipelines are deleted; only racer overlays stay private here. The API builds against the workspace domain package and loses its generated copies. The 180 KB startup budget becomes a CI check |

## What stays the owner's call

The plan keeps today's rules unless a page says otherwise. These are for the owner's feature and rebalancing docs:

- **New features and rebalancing:** racing, training, cards, the Farm's content and pacing.
- **Uma Puzzles' future.** They are today's Constellation Level loop, so this plan keeps them. Phase 3 of the
  platform roadmap once moved them to uma-puzzle; that waits on the owner.
- **The Hub's final place list and names.** [04](04-hub.md) proposes one that covers every current screen.
- **Inspiration token amounts.** [06](06-rpg-decommission.md) sizes them so one Uma's full career in a scenario covers
  her six slots and twelve golds (D250).

## Read first

- uma-platform: [`docs/architecture.md`](https://github.com/luismlorenzana/uma-platform/blob/main/docs/architecture.md),
  [`roadmap.md`](https://github.com/luismlorenzana/uma-platform/blob/main/docs/roadmap.md) (Phase 3) and
  [`decisions.md`](https://github.com/luismlorenzana/uma-platform/blob/main/docs/decisions.md) (P1–P39).
- uma-rpg, the reference build of the shared stack: `docs/game/architecture.md` (repo, packages, save, deploy),
  `docs/game/sections.md` (the Hub) and `docs/decisions.md` (D92 live docs, H16 lazy domain and the JS budget guard).
- Here: [the manual's architecture page](../game/architecture.md), generation 2 as built. The old app's pages (its
  local-first design, the Stable Kitchen Farm and the minigame kit) were deleted with the cutover (T143) and are
  readable at the `pre-split` tag.
