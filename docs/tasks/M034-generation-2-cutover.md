# M034 — The generation-2 cutover and the new game

**Re-architecture phase 3** ([08](../rearchitecture/08-phases.md), [rework/13](../rework/13-removals-and-plan-changes.md) §4).
**State: specified 2026-10-15; T134–T143 landed on `cutover/g2` 2026-10-15; T144 next.**

## Outcome

The owner opens the installed app and starts the **new game**: Race, Farm, Train on the phase-2 rules, on plain DOM
screens. Every account's old save is wiped once into **generation 2**, and every retired system is gone:
- the Global Uma RPG, Spark Rival Circuit, Uma Puzzles, Friendship Training and the other minigames;
- Constellation Level, card stars, coupons, Inspiration tokens and their advance, and Training Tickets;
- today's Farm (v1, v2 and the Stable Kitchen), owner gifts, and every save migration and Dexie upgrade.

A new account has 20 Uma Tickets and nothing else ([rework/13](../rework/13-removals-and-plan-changes.md) §5).

## Read first

- [AGENTS.md](../../AGENTS.md); this page; [rework/13](../rework/13-removals-and-plan-changes.md) (what leaves, what
  stays, the new account, the save, the docs to retire, "Done when"); [rework/11](../game/11-hub-and-places.md) (the
  routes, places and shell; §11 says what ships in phase 3); [rework/02](../game/02-check-ins-and-notifications.md)
  (check-ins on screen).
- [rearchitecture/01](../rearchitecture/01-target-architecture.md) §4–§6 (web shape, one store, sync v2, the API),
  [06](../rearchitecture/06-rpg-decommission.md) (the RPG's deletion lists), [07](../rearchitecture/07-data-reset.md)
  (the wipe, the purge, stale devices, the new account), with the rework's revisions in rework/13 §5–§6.
- [The rework modules](../game/architecture.md#the-rework-modules): the phase-2 rules every screen calls. Decisions
  D321–D351.

## Fixed choices (every task)

- **One integration branch, one release.** Every task lands as a reviewed pull request (or commit series) into
  `cutover/g2`, which merges into `main` once, in T144. `main` stays on today's game until then (rearchitecture/08).
- **Build beside, switch once.** Until T143 the new game is built **next to** today's app, so every step stays green:
  - new web code goes under `apps/web/src/g2/` (`app/`, `hub/`, `places/`, `save/`, `ui/`), and nothing in today's
    entry imports it;
  - the new API save module goes under `apps/api/src/save-g2/`, unregistered in `AppModule`;
  - the generation-2 save goes in `@racer/domain/save-g2`.
  
  T143 makes the new app the entry, mounts the new API module, moves `g2/` and the rework modules to their final homes
  ([rearchitecture/01](../rearchitecture/01-target-architecture.md) §2–§4) and deletes the old code in one change.
- **The rules are the phase-2 modules.** Screens and the server call `@racer/domain/rework/*`'s operations and queries.
  No screen or API handler restates a rule or a number; a gap in a rule is fixed in its module, with its page, test and
  decision.
- **Server authority, local first.** The client applies an operation at once against its local state and queues it.
  The API re-runs the same domain operation against the authoritative save and commits, or refuses with the same
  plain words (rework/02 §9). A retried operation id returns its first receipt and is never applied twice (T131's
  `runOnce`). Entities, logs and operations sync in one lane; a missing document accepts only a create.
- **Plain DOM screens.** Places render as DOM tile grids with uma-art frames as CSS sprites at whole-number scales
  (rework/11 §11). The canvas Hub and the pixel-art scenes are phases 6–7. Mobile first, 390×844 portrait, 44 pt
  targets, safe areas, `m.*` Motion, transform and opacity only, and the 180 KB startup budget.
- **What stays as it is:** the race engine and the race scene, the content pipeline and private packs (until
  phase 5), the badges and flair records (scenario-linked, D122), auth, Hosting and Cloud Run.
- **PixiJS stays for the race scene only** until phase 8 ports it to Phaser. Every other PixiJS scene leaves with its
  system. rework/13 §9's "`pixi.js` in no `package.json`" check moves to phase 8 (decided here).
- **The wipe is irreversible, so it waits for the owner.** The cutover deploy (T144) runs only after the owner says
  "go" in chat on the day, after the full rehearsal passes. The `pre-split` tag keeps today's code recoverable; the
  old save data is not kept (D323).
- **Dev shortcuts are dev-only.** The rehearsal reaches a gate on a fresh account through one `dev-grant` operation
  (T134), which the API accepts only when `DEV_OPERATIONS=true` (T135) and Account offers only in dev builds (T138).
  Production never sets it.
- **Bond picks aren't saved** (T134, T142): the planner cascades only the bonds picked on screen. `sim:loop` plans the
  whole deck's bonds, so real play may pace a little slower. If the owner feels it, a `bondPicks` field on
  `umas/{outfitId}` is the follow-up.
- **Synthetic fixtures only;** no private data in git, tests or proofs.

## Tasks

| Task | Builds | Needs | Parallel with |
|---|---|---|---|
| T134 — The generation-2 save ✅ (D352) | `@racer/domain/save-g2`: the kinds of rework/13 §6, strict parsers, `createInitialSave` (20 Uma Tickets), operation envelopes and receipts, sync v2 wire types with the generation and protocol stamps, and the mapping between the rework state and save rows | — | T137 |
| T135 — The API on generation 2 ✅ (D354) | `save-g2/`: the `saves/{uid}` repository (Firestore and local JSON), `GET /api/save` and `POST /api/sync` on protocol 2 (426 for anything else), create-only on a missing document, operations re-run with the domain and its content, and `POST /api/legacy/purge` | T134 | T136 |
| T136 — The web save layer ✅ (D355) | `g2/save/`: Dexie `uma-racer-g2` (one table per kind, the outbox), one Zustand store over the rework state, actions that apply an operation locally and queue it, one sync lane, local-first boot, and the first-boot wipe of every old database, key and cache plus the purge call | T134 | T135 |
| T137 — The shell and the places ✅ (D353) | `@racer/domain/hub`'s place registry and `g2/app`: the route scheme with the redirects of rework/11 §7, the account bar, the bottom bar with the raised Race button, the menu, the floating pill, the four pages as DOM tile grids with uma-art building frames, every Peek and Page slot. `@luismlorenzana/uma-art` joins `@racer/web` | — | T134 |
| T138 — Town Hall ✅ (D356) | The Stable (Uma Tickets, Shards to tickets, the reveal), the Uma profile, the Warehouse (stock, selling), the Exchange, the Card Library (every SSR, bonds per Uma) and Account | T136, T137 | T139–T142 |
| T139 — Training ✅ (D357) | The Observatory, Lineage Hall, Gym and Dojo: session sheets, the build views (tree, Inspiration, Extra Stats map, bonds and card set, presets) | T136, T137 | T138, T140–T142 |
| T140 — The Farm ✅ (D358) | The eight family sites, the Pantry and the Kitchen: job sheets with sizes and queues, collect and recall, Speed Tickets, upgrades | T136, T137 | T138, T139, T141, T142 |
| T141 — Racing ✅ (D359) | The Racecourse (race select, the Daily Purse, featured races), the run and the result with Racing EXP and Prize Money on today's race engine and scene, the Scenario Gate (careers, advance, promotion), the Trophy Hall; the Expedition Map as a placeholder until phase 9 | T136, T137 | T138–T140, T142 |
| T142 — Check-ins ✅ (D360) | Collect all, Repeat, the check-in summary, the planner's needs and targets, queue warnings and stopped queues, and the pill's counts (rework/02) | T136, T137 | T138–T141 |
| T143 — The switch ✅ (D361) | Tag `pre-split`. The new app becomes the entry and the new API module is mounted; every retired system's code, routes, endpoints, tables, scripts, packs and docs are deleted (rework/13 §1, §7; rearchitecture/06 §3); the rework modules and `g2/` move to their final homes; the docs are rewritten as built | T134–T142 | — |
| T144 — The release | The rehearsal (a fresh account through every place locally, phone checks at 390×844, a stale-device 426 check, the purge on a synthetic account), the owner's go-ahead, the merge and deploy, the purge's verification, the bucket cleanup, and the owner's first session on the iPhone | T143 | — |

**Order.** T134 and T137 start at once. T135 and T136 follow T134. The five place tasks (T138–T142) run in parallel
once T136 and T137 land. T143 then switches everything at once, and T144 ships it.

## Cross-task acceptance

1. **A fresh account plays the loop** on the new screens, offline and then synced: it unlocks Umas with Uma Tickets,
   gathers, crafts and cooks, opens an unlock in a session, races for Racing EXP and Prize Money, buys a Speed Ticket,
   advances a scenario and runs Collect all and Repeat. Every action survives a reload and a second device's sync.
2. **Nothing old remains** (rework/13 §9): `git grep -i -E "puzzle|friendship|constellation level|training ticket|card coupon|inspiration token|rpg|priconne|spark rival"`
   over `apps`, `packages` and `scripts` finds only T143's allow-list: "racing RPG" describing the app, `uma-rpg`
   citations, and today's `friendshipBonus` card field. No old route, endpoint, table, collection, local key or pack is read or written.
3. **The save holds only generation 2's kinds** (rework/13 §6). A stale client on protocol 1 gets 426 and writes
   nothing; a missing server document accepts only a create.
4. **The wipe ran once, for the owner only.** `players/{uid}` is gone and `saves/{uid}/meta/purge` records it; a
   second device's purge call returns at once.
5. **The budgets hold:** startup JS ≤ 180 KB gzip, 44 pt targets, 390×844 first, and `pnpm lint && pnpm test:ci &&
   pnpm build` green.
6. **The docs say what runs:** the manual describes generation 2, the rework pages are moved into the manual "as
   built", and the retired systems' docs are deleted (git keeps them).

## Out of scope

- Push notifications (phase 4, if the owner asks); platform master data and the shared kit (phase 5); the canvas Hub
  (phase 6); the pixel-art Farm and Training scenes (phase 7); the race on Phaser (phase 8); World Expeditions'
  content and rules (phase 9).
- Any change to a rule or number of the phase-2 modules beyond fixing a gap a screen finds.
