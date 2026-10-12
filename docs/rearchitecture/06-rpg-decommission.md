# 06 · RPG decommission

The Global Uma RPG leaves uma-racer completely (D322): code, API routes, save kinds, local tables, private packs,
bucket files, sims, docs and proof images. There are no feature flags, no dormant code and no compatibility readers.
uma-rpg is its own game now (platform P2–P4), and the owner accepts the data loss.

Survey: `main` at `0786b97` (D320). It found about **13,400 lines**: 11,100 in whole files to delete (8,550
hand-written, 2,663 generated), about 650 lines of edits in shared files, and 1,737 lines of docs plus 46 images.

## 1. When, and why that order is safe

The decommission ships **with the clean-slate cutover** (phase 2 in [08](08-phases.md)), not before it.

Done alone on today's save, it would need care:
- A new Dexie version would have to drop eleven tables and purge queued RPG outbox rows, or sync stops with "Outbox
  row is malformed".
- `parseSaveSnapshot` rejects a whole save that holds an unknown kind, so the API and the web app would have to change
  in a set order.
- Farm recovery archives contain RPG rows.

Shipped with generation 2 ([07](07-data-reset.md)), none of that applies:
- The new database, Firestore root and protocol simply have no RPG kinds.
- The old database and collections are deleted, not read.

## 2. Before anything is deleted

- **Tag `pre-split` on `main`** (platform roadmap Phase 3). It is the reference for anything ported later, and the
  point uma-puzzle can port from.
- **Move two shared pieces out of the RPG folders**, because non-RPG code uses them:
  - `ui/rpg/RpgModalFocus.tsx`: 8 files use it (constellation, Farm Extra Stats, Farm guide, Puzzle guide, preset load
    button, Farm sheet, Puzzle components). It becomes `uma-ui`'s focus trap or `ui/ModalFocus.tsx`.
  - `readRpgManifest` in `scripts/data/src/rpg.ts`, which `scripts/data/src/puzzles.ts` uses (lines 8, 36, 53).
- **Inspiration's dev proofs** (`screens/rpg/InspirationProofScreen.tsx`, `InspirationAdvanceProofScreen.tsx`,
  `ui/rpg/RpgInspirationReward.tsx`) are deleted with the D256 advance they prove.

## 3. Delete

### Code

| Path | Lines |
|---|---|
| `packages/domain/src/rpg/` (26 files) | 3,790 |
| `apps/api/src/save/puzzle-domain/rpg/` (generated; goes with all generated copies, [01](01-target-architecture.md) §2) | 2,663 |
| `apps/api/src/save/rpg-command.ts`, `rpg-command.test.ts`, `rpg-save.types.ts`, `rpg-progression.ts` | 1,100 |
| `apps/web/src/screens/rpg/` (12 files) | 1,421 |
| `apps/web/src/ui/rpg/` (16 files, after moving `RpgModalFocus`) | 795 |
| `apps/web/src/content/rpg.ts`, `rpg-release.ts`, `rpg-manifest.ts` and their tests | 239 |
| `apps/web/src/game/rpg-local.ts` and its test | 633 |
| `scripts/data/src/rpg.ts`, `rpg-cli.ts`, `rpg.test.ts`, `__fixtures__/rpg.ts` | 243 |
| `scripts/assets/src/priconne.ts`, `priconne-cli.ts`, `priconne.test.ts` | 138 |
| `scripts/sim/rpg-campaign.ts` | 192 |

### Wiring

| File | What goes |
|---|---|
| `apps/web/src/app/router.tsx` | The `/rpg` tree (186–201) and the Inspiration proof routes (260–265) |
| `apps/web/src/screens/HomeScreen.tsx` | `RpgHomeCard` (the Home is replaced anyway, [04](04-hub.md)) |
| `apps/web/src/api/client.ts` | `rpgCommand` |
| `apps/web/src/content/runtime.ts` | The `priconne` art kind (replaced anyway by the content client, [02](02-platform-and-packages.md)) |
| `apps/api/src/save/save.controller.ts` | `POST /api/rpg/command` |
| `packages/domain/src/index.ts` | `export * from './rpg'` |
| Root `package.json` | `data:rpg:import`, `data:rpg:validate`, `assets:rpg:import`, `sim:rpg:campaign` |
| `scripts/data/package.json`, `scripts/assets/package.json`, `scripts/data/src/publish.ts`, `pack.ts` | RPG scripts, the RPG pack kinds, the rule that keeps `data/rpg-*` across imports |

These are rewritten in generation 2, so no RPG edits are needed in them: `game/db.ts`, `game/persistence.ts`,
`game/runtime.ts`, domain `save.ts`, and the API's `save.types.ts` and repositories. The `pendingRpgCommands` checks
in `inspiration-advance.ts`, `inspiration-host.ts`, `puzzles/backup.ts`, `puzzles/preparation.ts` and
`farm/kitchen/cutover.ts` go with those files, which are all deleted machinery ([05](05-farm.md) §2, [07](07-data-reset.md)).

### Words on screen

Remove the RPG from:
- `ui/InspirationBankPanel.tsx`
- `screens/farm/ItemInventoryScreen.tsx`
- `screens/puzzles/PuzzleGuide.tsx`
- `ui/puzzles/PuzzlePreparation.tsx`
- the code comments in `farm/kitchen/operations.ts`, `puzzles/presentation.ts` and `ui/puzzles/kit.tsx`

`minigames/uma-puzzles/index.ts` aliases Puzzle names only to avoid clashing with the RPG; drop the aliases.

"Racing RPG" in `package.json`, `vite.config.ts`, `AGENTS.md`, `CLAUDE.md` and the overview describes the whole app,
not this mode. It stays.

### Data

| Where | What |
|---|---|
| Firestore `players/{uid}/` | `rpgOutfits`, `rpgPresets`, `rpgCheckpoints`, `rpgResults`, `rpgPromotions`, `rpgReceipts`: deleted with the whole old root ([07](07-data-reset.md) §3) |
| IndexedDB `uma-racer` | 11 tables (the six above plus `pendingRpgCommands`, `rpgBattleJournals`, `rpgBattleClaims`, `rpgBattleArchives`, `rpgFights`): deleted with the old database |
| localStorage | `uma-racer:rpg-guide-v3` |
| Bucket `uma-racer-content` | `data/rpg-chapters.*.json`, `data/rpg-catalog.*.json`, `art/priconne/*` and the manifests that list them. Deleted after the cutover deploy, once no published manifest the app reads references them (an exception to the "never delete" publishing rule, made deliberately for a removed mode) |
| Owner's machine | `content/overrides/rpg-chapters.json`, `rpg-source-evidence.json`, `content/art/priconne/`, `scripts/assets/.cache/priconne/` |

### Docs

- **Deleted:**
  - `docs/design/uma-rpg.md`, `uma-rpg-classes.md`;
  - `docs/technical/uma-rpg-implementation.md`, `rpg-chapter-content.md`;
  - `docs/research/uma-rpg.md` and the ten `rpg-*` proof and acceptance pages;
  - the image folders `docs/research/images/rpg-*`, `rpg-battle/`, `rpg-chapter/`, `rpg-content-proof/`,
    `rpg-inspiration/`, `rpg-progression/` and `screenshots/rpg-release/`.
- **Edited:** `README.md` (status, routes, scripts, doc map), `docs/technical/architecture.md`,
  `docs/open-questions.md`, `docs/tasks/README.md`, and the passing mentions in `skills-and-inheritance.md`,
  `training.md`, `constellations.md`, `minigame-kit.md`, `uma-puzzles.md`, `uma-puzzles-implementation.md` and the
  farm-kitchen docs.
- **Decisions stay** (the log is append-only). D322 records that D215–D230, D232, D243, D245, D246, D248, D257–D266,
  D277–D282, D284–D286 and D309–D312 describe a mode that no longer exists. D250 and D256 (Inspiration), D273, D275,
  D283, D287, D290, D293, D300 and D301 (Puzzles), and D307, D308 and D317 (Farm) mention the RPG but stand for their own systems; D322 notes what changed in each.

## 4. What stays, though the RPG used it

- **Domain:** `scenarios`, `types`, `inspiration`, `inspiration-exchange`, and the content types (replaced by the
  adapter).
- **Web:**
  - UI pieces: `Button`, `Panel`, `ScreenState`, icons, `AtlasSprite`, `InspirationTokenIcon`,
    `InspirationBankPanel` (without the advance), `PagedGuide`, `MinigameShell`, `useArt`;
  - the constellation screen and `TrainingScene`.
- **`ui/icons/LimitBreakIcon.tsx`** is the card Limit Break, not the RPG's.
- **Past `itemLedger` rows** with reason `rpg-inspiration` matter only to today's save, which the wipe removes. The
  generation-2 parser doesn't accept that reason.

## 5. Inspiration tokens need a new source

The RPG was the **only** way to earn Inspiration Slot and Skill tokens (`rpg-local.ts` line 255), and the only Convert
screen lived under `/rpg/convert`. Without a replacement, lineage slots and golds (D250) could never open on a fresh
account.

**Decision (D322): career goal wins pay them.** When an Uma first wins one of her scenario career's goal races, she
earns that scenario's tokens: **1 Slot Token and 2 Skill Tokens per goal race**.

A career has six goal races: one G3 (Maiden), two G2s (Trials) and three G1s (the main set, D137). So a full career
pays one Uma **6 Slot and 12 Skill tokens per scenario**: exactly her six lineage slots and twelve gold positions
(D250, one token each). Why this source:
- **Races are the payoff** (design pillar 2), and the career is already the per-scenario path.
- **It can't be farmed:** goals pay once.
- **It's sized to need**, so no bank or advance is required.

| Rule | Detail |
|---|---|
| Earned when | A goal race's first win for that Uma in that scenario's career, recorded in the race result and the item ledger |
| Item ids | Today's `inspiration:t{tier}:{slot\|skill}` |
| Convert | The D309 exchange (two of a scenario make one of the next; one makes two of the previous) moves to the **Warehouse** ([04](04-hub.md)); its domain logic (`inspiration-exchange.ts`) is unchanged |
| Deleted | The D256 advance and its signed debt bank (`inspiration-bank.ts`, `inspiration-advance.ts`, `/api/inspiration/advance`, `inspirationBank/main`) |

The owner's rebalancing docs may change the amounts or add sources (the Farm, the Puzzles). The plumbing is
one function in `@racer/domain/training`, called from race settlement.

## 6. Done when

- `git grep -i -E "rpg|priconne"` over `apps`, `packages`, `scripts` and `docs` finds only:
  - the decisions log;
  - the word "RPG" describing the app as a racing RPG;
  - this folder.
- The API has no `/rpg` route, the domain no `rpg` export, Firestore and IndexedDB no `rpg*` collection or table, and
  the bucket no `rpg-*` or `priconne` object referenced by the current manifest.
- An Uma that wins her career's six goal races in a scenario holds 6 Slot and 12 Skill tokens for it, and can open
  all six lineage slots and twelve golds.
- `pnpm lint && pnpm test && pnpm build` pass, and the startup chunk shrinks.
