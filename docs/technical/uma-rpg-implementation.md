# Global Uma RPG — implementation

**Status:** the campaign (D260–D263). Product rules live in [the design](../design/uma-rpg.md). This page maps them to
code and storage. The first chapter map's grouped-command implementation (T090–T099: `/api/rpg/command` for every
step, leases, takeovers, pending queues) is retired; its history is in git and decisions D223–D259.

## Code map

| Concern | Where |
|---|---|
| Classes, stats, trees, promotion | `packages/domain/src/rpg/rules.ts` (unchanged rules; MP = 20 + 1.5 × Wit) |
| Battle engine v2 (pure, seeded, replayable) | `packages/domain/src/rpg/battle/` — `types.ts`, `skills.ts`, `engine.ts` |
| Generated chapters, foes, runs, rewards | `packages/domain/src/rpg/campaign/` — `chapters.ts`, `enemies.ts`, `run.ts`, `rewards.ts` |
| Row parsers and the one-time reset | `packages/domain/src/rpg/save.ts` (`rpgCampaignOutfit`, `rpgCampaignPreset`), `save.ts` dispatch |
| Local-first host | `apps/web/src/game/rpg-local.ts` |
| Screens | `apps/web/src/screens/rpg/` — `RpgScreen.tsx` (shell, parties, roster, profile, party editor, launch pad), `RpgMapScreen.tsx`, `RpgFightScreen.tsx`, `RpgGuide.tsx` |
| Cast gate | `apps/web/src/content/rpg-release.ts` (one cast member per portrait key, every portrait verified) |
| Server shapes | `apps/api/src/save/rpg-save.types.ts`, `save.types.ts` (`rpgOrdinaryRow`, bank repayment rule) |
| Balance | `scripts/sim/rpg-campaign.ts` (`pnpm sim:rpg:campaign`) |

The old `packages/domain/src/rpg/{chapter,combat,rewards}.ts` engine-v1 modules remain only because the private
content pipeline (`scripts/data/src/rpg*.ts`) still validates and replays the published pack with them.

## Storage

| Row | Kind | Notes |
|---|---|---|
| Outfit | `rpgOutfits/{outfitId}` schema 2 | Frozen enrollment inputs, class, tier/level/EXP, tree, legacy |
| Party | `rpgPresets/party-{1..5}` schema 2 | Five nullable slots (signature, loadout); `foregroundChapterId` = last opened chapter |
| Run | `rpgCheckpoints/{presetId}:{scenarioId}` schema 2 | `wins` per node, `mp` per outfit, `battle` (id, node, frozen `BattleInput`), `battles`, `clearedAt` |
| Result | `rpgResults/{battleId}` schema 2 log | Per-member EXP before/after, tokens, rounds |
| Promotion | `rpgPromotions` log | Archived tier tree |
| Tokens | `items` + `itemLedger` (`rpg-inspiration`, `debtPaid`) + `inspirationBank` | Gross grant, debt repaid first |
| Fight journal | Dexie `rpgFights` (device only) | Action list for the open fight; missing → replay from the first action |

Battle ids are `rpg-battle:{presetId}:{chapterId}:{n}`; the seed is a hash of the id. Ledger ids are
`rpg-inspiration:{battleId}:{slot|skill}`.

## Writes and sync

Each operation is one Dexie transaction that writes its rows and queues outbox markers (`queueInTransaction`), then
the screen calls `gameRuntime.schedule()`. The ordinary flush uploads RPG upserts and appends with every other row.
Conflicts adopt the server copy (`mergeRpgEntity`), never an older schema over a newer one.

- `finishRpgFight` replays the journal, settles the run (`rpgSettleRunBattle`), writes five outfits, the run, the
  result log and the token grants atomically, and deletes the journal.
- `actRpgFight` checks the expected action count, replays, applies one action and appends it.
- Server: `parseSyncRequest` accepts schema-2 RPG rows (id must match), `rpgResults` schema 2 and `rpgPromotions`;
  refuses `rpgReceipts`. `resolveUpserts` lets `inspirationBank` move only toward zero with the same cohort, never
  deleted. `/api/rpg/command` accepts only `spend-inspiration` (older apps).

## Migration (Dexie v27, D263)

Outfits schema 1 → 2 restart at Tier 1 Lv1 (projection revision +1); parties schema 1 → 2 clear loadouts and the
foreground chapter; schema-1 checkpoints are deleted locally (server copies are ignored on adoption); pending grouped
commands are dropped except a pending `spend-inspiration`, whose rows land locally and queue; old battle journals,
claims and archives are cleared. `parseSaveSnapshot` applies the same outfit/party migration to cloud rows, and
adoption queues the migrated rows once.
