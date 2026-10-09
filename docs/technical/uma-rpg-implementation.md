# Global Uma RPG — implementation

**Status:** classes (D277–D282) on the campaign (D260–D266). Product rules live in [the design](../design/uma-rpg.md) and
[the class trees](../design/uma-rpg-classes.md). This page maps them to code and storage. The first chapter map's
grouped-command implementation (T090–T099: `/api/rpg/command` for every step, leases, takeovers, pending queues) and its
engine-v1 combat are retired; their history is in git and decisions D223–D259.

## Code map

| Concern | Where |
|---|---|
| Vocabulary: elements, weapons, damage kinds, classes, trees, statuses | `packages/domain/src/rpg/kinds.ts` |
| Every tree, node and number (330 nodes from one set of rules) | `packages/domain/src/rpg/catalog.ts` |
| Classes from running styles, class stats, hands, points, learning, loadouts, promotion | `packages/domain/src/rpg/rules.ts` |
| Battle engine v4 (pure, seeded, replayable): multi-part hits, two-action hands, Short Sword follow-ups, Cleric blessings, summons | `packages/domain/src/rpg/battle/` — `types.ts`, `skills.ts`, `engine.ts` |
| Generated chapters, foes (weaknesses by rank, boss HP by reach), runs, rewards | `packages/domain/src/rpg/campaign/` — `chapters.ts`, `enemies.ts`, `run.ts`, `rewards.ts` |
| Row parsers and the class migration | `packages/domain/src/rpg/save.ts` (`migrateRpgOutfitSave`, `migrateRpgPresetSave`), `save.ts` dispatch |
| Local-first host | `apps/web/src/game/rpg-local.ts` (`exchangeInspirationTokens` for Convert) |
| Token exchange and the advance's repaid share (D309) | `packages/domain/src/inspiration-exchange.ts`, `inspirationAdvanceDebts` in `inspiration-bank.ts` |
| Screens | `apps/web/src/screens/rpg/` — `RpgScreen.tsx` (shell, parties, roster, profile and tree screen, party editor, launch pad), `RpgItemsScreen.tsx` (Inventory, Convert), `RpgMapScreen.tsx`, `RpgFightScreen.tsx`, `RpgGuide.tsx` |
| Fight projections | `apps/web/src/ui/rpg/battle-view.ts` (choices, blessings, previews, who can break a foe) |
| Cast gate | `apps/web/src/content/rpg-release.ts` (one cast member per portrait key, every portrait verified) |
| Server shapes | `apps/api/src/save/rpg-save.types.ts` (its own class mapping, weapon sets and tree-branch table), `save.types.ts` (`rpgOrdinaryRow`, bank repayment rule) |
| Balance | `scripts/sim/rpg-campaign.ts` (`pnpm sim:rpg:campaign`): one Brawler, two Mages, a Cleric and a Summoner |

`packages/domain/src/rpg/chapter.ts` still parses the private pack, which now supplies only the cast (names and
portraits); its first-map actor kits are shape-checked, never played.

## Storage

| Row | Kind | Notes |
|---|---|---|
| Outfit | `rpgOutfits/{outfitId}` schema 3 | Frozen enrollment inputs, class, weapons, tier/level/EXP, learned nodes `{ tier, id }`, legacy |
| Party | `rpgPresets/party-{1..10}` schema 3 (ten parties, D284) | Five nullable slots (loadout of node refs, Familiar form); `foregroundChapterId` = last opened chapter |
| Run | `rpgCheckpoints/{presetId}:{scenarioId}` schema 2 | `wins` per node, `mp` per outfit, `battle` (id, node, frozen `BattleInput` v4), `battles`, `clearedAt` |
| Result | `rpgResults/{battleId}` schema 2 log | Per-member EXP before/after, tokens, rounds |
| Promotion | `rpgPromotions` log | Schema 2 archives node refs; schema 1 archived element-tree skills |
| Tokens | `items` + `itemLedger` (`rpg-inspiration`, `debtPaid`) + `inspirationBank` | Gross grant, debt repaid first |
| Conversions | `itemLedger` `inspiration-exchange:{id}:in` / `:out` (D309) | Each row carries direction, batches, side, kind and tier; the output's `debtPaid` repaid the advance |
| Fight journal | Dexie `rpgFights` (device only) | Action list for the open fight; missing → replay from the first action |

Node ids are `tree.branch.depth`, plus `a` or `b` for a variant (`greatsword.fire.3`, `mage-staff.ice.2b`); a node costs
its depth. Battle ids are `rpg-battle:{presetId}:{chapterId}:{n}`; the seed is a hash of the id. Ledger ids are
`rpg-inspiration:{battleId}:{slot|skill}`.

## Writes and sync

Each operation is one Dexie transaction that writes its rows and queues outbox markers (`queueInTransaction`), then
the screen calls `gameRuntime.schedule()`. The ordinary flush uploads RPG upserts and appends with every other row.
Conflicts adopt the server copy (`mergeRpgEntity`), never an older schema over a newer one.

- `finishRpgFight` replays the journal, settles the run (`rpgSettleRunBattle`), writes five outfits, the run, the
  result log and the token grants atomically, and deletes the journal.
- `actRpgFight` checks the expected action count, replays, applies one action and appends it.
- `forgetRpgSkill` swaps a variant out, refunding its points, and removes it from every party's loadout.
- Server: `parseSyncRequest` accepts schema-2 and schema-3 outfits and parties (schema 3 is checked against the class
  mapping, weapon sets, gates, points, core order, forks and the variant cap), schema-2 runs and results, and both
  promotion schemas; it refuses `rpgReceipts`. The generic schema order keeps schema 2 from overwriting schema 3.
  `/api/rpg/command` accepts only `spend-inspiration` (older apps).

## Migrations

- **Dexie v30 (D285):** the owner's one-time restart: every enrolled outfit returns to Tier 1 Lv1 with no EXP, tree
  or legacy skills (class and weapons stay), parties keep their members with empty loadouts, and the
  `party-1:ura-finale` run clears its wins, carried MP, open fight (and journal) and clear time while keeping its fight
  counter, so new battle ids never reuse a result id. Every changed row is queued.
- **Dexie v29 (D282):** outfits schema 1/2 → 3 take the first class open to their A running styles and its first weapon
  set, keep tier, level and EXP (schema 1 restarts at Lv1 as D263 did) and clear trees and legacy; parties → 3 clear
  loadouts and set every Familiar to Greatsword; a run's fight left open under engine v3 is closed and its journal
  deleted. Every changed row is queued. Snapshot adoption applies the same migration to cloud rows and re-uploads them.
- **Dexie v27 (D263):** schema-1 checkpoints are deleted; pending grouped commands are dropped except a pending
  `spend-inspiration`, whose rows land locally and queue; old battle journals, claims and archives are cleared.
