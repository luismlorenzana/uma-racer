# 08 · Phases and pull requests

The order of work. Each phase ends with a deployable `main` and an exit check. Each step is a pull request
(delegated agents) or a commit series on `main` (Claude), per AGENTS.md. Shared changes happen in a uma-platform
session first, and the racer then pins the released version.

## Overview

> **Revised 2026-10-13 by the game rework (D335) and kept current here (D339).** The rework's rules are built and
> simulated before the wipe, so the owner starts the new game once. This table is the order of work. The sections below
> keep their first-draft numbers, given in the last column, and [rework/13](../rework/13-removals-and-plan-changes.md)
> §4 explains every change.

| Phase | Goal | Status | Sections below |
|---|---|---|---|
| **1** | A sound base: the API on the workspace domain, the startup budget enforced, GitHub Packages, the live manual | **Done, 2026-10-14 (D337)** | Phase 1 |
| **2** | **The rework's rules in the domain**, pure and tested, and `pnpm sim:loop` passing [game/12](../game/12-economy-and-pacing.md) §12. No UI and no save change | **Done, 2026-10-14 (D340–D351)** | — (new) |
| **3** | **Clean slate and the new game:** generation-2 save in the rework's shape, the wipe and purge, every deletion (RPG, Spark, Puzzles, Friendship, CL, stars, tokens, today's Farm), the new game on plain DOM screens. **The owner starts playing here** | **Done, 2026-10-15** (T134–T144, D352–D361; [M034](../tasks/M034-generation-2-cutover.md)) | Phase 2 |
| 4 | **Optional:** push notifications, a port of uma-rpg's, only if the owner asks | Waits on the owner | — (new) |
| 5 | Platform master data and the first shared packages | Planned | Phase 3 |
| **6** | The Hub: four pages, the place registry, art ([game/11](../game/11-hub-and-places.md)) | **Done, 2026-10-15, ahead of phase 5** (T145, D363): uma-rpg's Phaser town; new art via [A01–A02](../handoff/README.md) | Phase 4 |
| 7 | The Farm and Training Hub as pixel-art scenes on `uma-idle` | Planned | Phase 5 |
| 8 | The race on Phaser; PixiJS leaves the repo | Planned | Phase 6 |
| **9** | **World Expeditions:** 13 pools, about 89 course layouts, local champions, the Expedition Map, `sim:expeditions`. **Deadline:** before the first Uma finishes tier 1's last career, about 16–20 weeks after phase 3 | Starts as soon as phase 3 ships | — (new) |
| 9b | Race engine v10 inputs for tier 3's Expedition mechanics | About a year in | — (new) |

The first draft's phase 7 ("the owner's docs") is the rework itself, and its phase 8 ("the Puzzles' future") is
decided: they are deleted in phase 3 (D326).

**Why the rules come before the wipe.** The wipe should happen once, into the final save shape. Building and simulating
the rules first proves the pacing before the owner's fresh start depends on it. The domain modules don't touch the live
game, so they land on `main` piece by piece.

**Why plain screens before the Hub.** The canvas Hub and pixel-art scenes are presentation over the same places and
routes. Master-data ids stay the same strings (P19), so the owner keeps playing through phases 5–8 without another
reset.

**Cost.** No new cloud resources. The only new grant is read access to the platform bucket for `racer-api`'s service
account. Firestore use drops with the wipe. The monthly bill stays about $0.

## Phase 1: a sound base (done, D337)

| Step | Change | Exit |
|---|---|---|
| 1.1 | The domain builds a CJS `dist` (`tsconfig.cjs.json`). The API depends on `@racer/domain` and validates with its parsers. The Dockerfile follows uma-rpg's (workspace install, build domain, build API, `pnpm deploy --prod --legacy`). Delete `apps/api/src/save/puzzle-domain/**`, `farm-domain/**`, `scripts/sync-*-adapter.mjs` and the hand-kept wire copies where the domain has the same parser | Deploy green; about 17,800 generated lines gone |
| 1.2 | `scripts/check-size.mjs` (uma-rpg's) runs in `pnpm build`, measured first, then set to 180 KB gzip | CI fails when the entry chunk passes the budget |
| 1.3 | CI installs `@luismlorenzana/*` with `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` and `packages: read`; `.npmrc` as in uma-rpg; the Docker build takes the token as a secret | A throwaway import of `@luismlorenzana/uma-data` builds in CI |
| 1.4 | The live manual: `docs/game/` with uma-rpg's renderer and `pnpm docs:update`; first pages for scenarios, the race catalogue, the Farm catalogue and caps | `docs.test.ts` fails on a stale page |

## Phase 2: clean slate (now phase 3)

One integration branch, `cutover/g2`, receives the steps below as reviewed pull requests and merges into `main` once,
as a single release. The steps can't ship apart: each depends on the new save. `main` stays on today's game until the
merge.

| Step | Change | Page |
|---|---|---|
| 2.0 | Tag `pre-split` on `main` | [06](06-rpg-decommission.md) §2 |
| 2.1 | `@racer/domain/save`: generation 2 (kinds, parsers, `createInitialSave` with 20 Uma Tickets, sync v2 wire types, operations), domain subpath exports | [01](01-target-architecture.md) §3, §5 · [07](07-data-reset.md) §5 |
| 2.2 | API: save module at `saves/{uid}`, protocol v2 with 426 for anything else, operations re-run with the domain, `POST /api/legacy/purge`; delete the RPG, Inspiration-advance, Puzzle-prepare and Farm-prepare endpoints | [01](01-target-architecture.md) §6 · [07](07-data-reset.md) §3 |
| 2.3 | Web save layer: `uma-racer-g2` database, one store, outbox, one sync lane, first-boot wipe and purge; delete `runtime.ts`, `persistence.ts`, `db.ts` and `sync.ts` as they are | [01](01-target-architecture.md) §4.2–4.3 · [07](07-data-reset.md) §2 |
| 2.4 | Delete the RPG completely | [06](06-rpg-decommission.md) §3 |
| 2.5 | Delete Spark Rival Circuit (domain, scenes, screens, guide, chibi, its content pack), the v1/v2 Farm, the Farm cutover and recovery, Puzzle preservation and legacy paths, the Inspiration advance and bank, Training-EXP-bank settlement, owner gifts, and every migration and Dexie upgrade | [05](05-farm.md) §2 · [01](01-target-architecture.md) §1 |
| 2.6 | Inspiration tokens from career goal wins; the Convert screen in the Items screen | [06](06-rpg-decommission.md) §5 |
| 2.7 | Unlocking with Uma Tickets in the Stable; dev grants behind `DEV`; the Home without RPG and preparation cards (the Hub replaces it in phase 4) | [07](07-data-reset.md) §5 |
| 2.8 | Docs: the manual's save page; the design docs edited for generation 2; the deleted systems' docs removed | [06](06-rpg-decommission.md) §3 |

**Exit:** [07](07-data-reset.md) §7 and [06](06-rpg-decommission.md) §6, on the owner's iPhone.

**Verification before merging:**
- `pnpm lint && pnpm test && pnpm build`.
- A full local run (`pnpm dev`, auth off) through a fresh account: unlock, train, race, win a goal, earn tokens, open
  a lineage slot, run a Farm job, fight a Puzzle.
- Browser checks at 390×844.
- A second-device simulation: an old-protocol request gets 426.

## Phase 3: platform master data (now phase 5)

| Step | Repo | Change |
|---|---|---|
| 3.1 | uma-platform | Grant `racer-api`'s service account `roles/storage.objectViewer` on the platform bucket. Extract `uma-auth` and `uma-ui` (§4 of [02](02-platform-and-packages.md)), release them |
| 3.2 | uma-platform | Extract `uma-content` (web client and server reader) from uma-rpg and the racer's runtime, release it |
| 3.3 | uma-racer | The parity test against the last racer release, run locally; every difference resolved in the adapter, an overlay, or a platform minor release |
| 3.4 | uma-racer | `@racer/domain/master` adapter; API `master` module; the web content client; art families switched; the starter card overlay |
| 3.5 | uma-racer | Delete the GameTora and wiki pipelines; move the overlays to `scripts/overlays`; delete unreferenced master-data packs from the racer bucket |
| 3.6 | uma-racer | Adopt `uma-auth` and `uma-ui`; delete the local copies |

**Exit:**
- The racer deploys on the platform release with no GameTora code.
- A new Uma published by uma-platform appears in the Stable without a racer change.

## Phase 4: the Hub (now phase 6)

| Step | Repo | Change |
|---|---|---|
| 4.1 | uma-platform | Extract `uma-scene` with its `hub` subpath from uma-rpg; release |
| 4.2 | uma-platform | `uma-art`: the `racer` buildings family (Racecourse, Card Hall, Trophy Hall, Scenario Gate, Training Grounds, Puzzle Arena) and the Farm district buildings; minor release |
| 4.3 | uma-racer | Place registry in `@racer/domain/hub`; the places' Peek, Page and Counter registry; routes and one release of redirects |
| 4.4 | uma-racer | The Hub: Town, Training and Farm pages in Phaser, the DOM hit layer, the account bar, the bottom bar with the raised Race button, the global menu, the featured Uma in the plaza |
| 4.5 | uma-racer | Delete `HomeScreen`, `TabBar`, `TopBar` and the old routes; refresh `docs/design/ux.md` |

**Exit:** [04](04-hub.md) §7.

## Phase 5: the Farm (now phase 7)

| Step | Repo | Change |
|---|---|---|
| 5.1 | uma-platform | Extract `uma-idle` (batch-at-end and one-after-another production); `uma-art` `farm` family (station props in states, item family icons); release |
| 5.2 | uma-racer | `@racer/domain/farm` on `uma-idle`; the operations of [05](05-farm.md) §6 |
| 5.3 | uma-racer | The Farm scene per district, the station sheets, the Farmhouse, Farm goods in the Warehouse |

**Exit:** [05](05-farm.md) §8.

## Phase 6: the race on Phaser (now phase 8)

| Step | Change |
|---|---|
| 6.1 | `RaceScene` rewritten on Phaser behind its current surface; `presentation.ts` and `course-path.ts` unchanged |
| 6.2 | The clock-equivalence test; device check at 60 fps with 18 runners |
| 6.3 | `pixi.js` imported only under `scenes/puzzles/` |

**Exit:** [03](03-rendering-and-textures.md) §6.

## Phase 7: the owner's docs (became the rework)

The owner writes what the racer should become: new features and rebalancing. Each doc becomes tasks in
`docs/tasks/` with their own numbers, on top of whatever phase is done. The architecture is meant to absorb them
without structural change:
- new places register in the Hub;
- new passive production uses `uma-idle`;
- new art goes through `uma-art`;
- new rules live in the domain and are rendered into the manual.

## Phase 8: the Puzzles (decided: deleted in phase 3)

When the owner decides:
- **If they stay,** `PuzzleBattleScene` moves to Phaser and PixiJS leaves the repo.
- **If they move to uma-puzzle** (platform Phase 4), it ports from `pre-split` and from the then-current code, and the
  racer deletes them as completely as the RPG, with a new source for Constellation Level.

## Risks and how they're handled

| Risk | Handling |
|---|---|
| **The cutover is large** | One integration branch, reviewed in steps, merged once; full local run and browser checks first; `pre-split` to roll the code back (an old build would find an empty `players/` and start a fresh old-format account) |
| **The platform data differs subtly from the racer's packs** | The parity test lists every difference before the switch, and each is resolved on purpose |
| **A stale device writes old data** | Protocol and generation stamps, 426 for anything old, create-only on missing documents |
| **The Hub chunk grows the startup** | The size check in CI; Phaser and every Page lazy |
| **The kit is extracted from one game's habits** | It's taken from code that runs in both games, and each game adopts it in its own session; anything game-specific stays a parameter |
| **Inspiration pacing changes** | Sized to need (six goals pay a scenario's 6 + 12); the owner's rebalancing docs can retune it |
