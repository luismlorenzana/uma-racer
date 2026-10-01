# Global Uma RPG — implementation contract for M028–M029

**Status:** T089 rules and T090 save transport implemented; the RPG is not playable or Home-visible yet. Read [the design](../design/uma-rpg.md) for product rules and
[M028](../tasks/M028-uma-rpg.md) for PR order. This document fixes the boundaries that the short first task drafts
left ambiguous. T089's progression coefficients are now pinned in D227; T091/T096 must simulate their own remaining
combat/reward candidates, then update the design, `packages/domain/src/domain.test.ts` and append-only decisions log.

## Existing seams and the sync hazard

- `packages/domain/src/save.ts` remains save v11; `apps/web/src/game/db.ts` is Dexie v18. T090 added separate
  `rpgOutfits`, `rpgPresets`, `rpgCheckpoints` entities and `rpgResults`, `rpgPromotions`, `rpgReceipts` logs.
  The production API parses those shapes independently of `@racer/domain`.
- `apps/api/src/save/firestore-save.repository.ts` and `local-save.repository.ts` currently resolve each entity
  upsert and then append every new log even if an entity conflicted. The Firestore transaction is atomic as a database
  operation, but **the game command is not all-or-nothing**. The ordinary `/api/sync` batch must not carry an RPG
  result, EXP update or token movement as unrelated upserts/appends. T090 implements a grouped conditional RPG
  mutation at `POST /api/rpg/command`; tests demonstrate the existing orphan-log failure and prove it cannot occur for
  an RPG command. No workflow, infra or
  `.env` changes are authorized by this plan.
- The app remains local-first for battle **actions**. An active battle can continue and replay offline from a local
  journal. A new entry or terminal result made offline is explicitly **pending** until its grouped command is
  acknowledged; its EXP, next map node and Item reward cannot be spent while pending. A later conflict displays the
  server's accepted checkpoint and keeps the local journal for diagnosis; it cannot silently apply the rejected
  reward. This is the first-delivery cross-device policy (D223), not a claim that two disconnected devices can both
  win the same server revision. No network round trip is needed for each action.

## Persistence vocabulary and ownership

Use these as wire roles; code may choose names that fit the existing module layout, but not collapse unrelated state
into one giant profile row. Every synchronized shape has an explicit schema version, exact-key parser, bounded arrays/
strings and matching API-side parser. Every id uses the existing safe-id rules.

| State | Key and owner | Required fields / invariant |
|---|---|---|
| RPG outfit entity | owned outfit template id | Locked A-style and one weapon, default signature, frozen enrollment base-stat/growth inputs plus content version, tier-local level/EXP and bank, current-tier tree choices, bounded active legacy loadout, projection revision. Not stored in `UmaSave.scenarios`; Racing/Farm values never move. A promotion appends a mastery-history record instead of growing the outfit entity forever. |
| RPG preset entity | one of five stable preset ids | Editable name and five ordered nullable slots; each filled slot has a distinct owned outfit id, eligible active signature and bounded skill loadout. Partial presets save but cannot launch. An edit after a battle starts changes future entries only. |
| RPG checkpoint entity | preset id + chapter id | Chapter content id/version, attempt index/id, last cleared node, selected path, status (`not-started`, `at-checkpoint`, `in-battle`, `pending-result`, `cleared`), expected revision, and optional frozen entry. One preset may pause multiple chapters; changing the foreground chapter changes navigation, not those checkpoints. |
| Frozen entry | inside checkpoint | Stable entry id and seed, content hash/version, enemy team/phase kit, party ids/order, each member's tier/stats/skills/signature at entry, retry ordinal and lease revision. It never reads a later pack or profile to replay the same fight. A free retry increments only the ordinal; entry, seed and kit stay fixed. |
| Device-local journal | Dexie only, by entry id + retry ordinal | Engine version, frozen-entry hash, ordered validated player actions, replay state hash and terminal/pending marker. No private portrait bytes, no action journal in cloud save. |
| Result / promotion evidence | append-only sync log | Battle result id = entry id + retry ordinal; accepted outcome hash, member EXP deltas, relevant before/after state and content version. A promotion archive records prior tier mastery without unbounded profile growth. First accepted id wins. A loss receipt and later winning retry have distinct ids but the same frozen seed. |
| Grouped-command receipt | append-only sync log, by command id | Payload hash, accepted entity versions and result/evidence ids. This is the durable duplicate response, not a client-memory flag; a reused id with different payload rejects. |
| Scenario token | existing `items` + `itemLedger` | Item id derives from scenario id, not from a chapter's display label. Clear grant id derives from accepted chapter-attempt id; spend id derives from Uma/scenario/branch plus an increasing revision. Stacks are projections of accepted movements, not a second RPG wallet. |

T090 chose RPG wire schema v1, Dexie v18, five presets/five slots, 25 tree nodes, 64 path entries, 16,384 enemy-kit
JSON characters and 20 grouped operations (D228; pinned in `domain.test.ts` and wire tests). Do not store full
chapter definitions in mutable account rows: the checkpoint
stores its immutable version/hash and the frozen **entered encounter**; T097's content loader retains old packs needed
for open chapters. A missing old pack is a visible recovery error, not permission to substitute new enemies.

## Command state machine

Each command has a stable id, expected versions of **all** rows it mutates, and one grouped acknowledgement. The
server either accepts every associated entity/log/item movement or accepts none. A repeated command id with the
**same payload hash** returns the original receipt; reusing the id with different payload is rejected. On conflict
the client pulls authoritative rows/logs and re-evaluates the command; it never retries
with fresh seed, content, or reward id. A conflicting terminal result is **not** silently rebased into a new win.

| Command | Preconditions and frozen read | Accepted writes | Idempotency / conflict |
|---|---|---|---|
| Enroll outfit | Owned outfit, at least one source A running style, eligible signature; profile absent | RPG outfit entity with immutable style/weapon/enrollment inputs | Existing profile returns it; never re-enrolls to change class. |
| Edit preset | Expected preset revision; distinct owned outfits and legal signature/loadouts | Only that preset row | Stale editor reloads; cannot rewrite a frozen battle. |
| Start chapter / choose node | Complete preset; authored pack verified; expected checkpoint revision | Checkpoint with chapter version/attempt and then frozen encounter id/seed/kit | Duplicate command returns same entry. A paused other chapter remains. |
| Append battle action | Local journal and exact engine-valid action | Local journal only | Replaying the prefix gives the same hash; duplicate action index is refused. |
| Take over on another device | Synced open entry and expected lease revision; explicit player confirmation | Checkpoint lease revision only, preserving frozen entry byte-for-byte | Old device becomes stale; offline takeover waits for acknowledgement. |
| Commit battle result | Terminal replay hash matches frozen entry and retry ordinal; expected lease/checkpoint and involved outfit versions | Checkpoint, accepted result evidence and RPG EXP projections as one conditional group; an accepted loss increments only retry ordinal | Duplicate result receipt pays once. Stale/losing device stays pending/conflicted; no orphan log or EXP. A loss and later winning retry use different claim ids but identical entry/seed/kit. |
| Clear chapter | Boss result accepted for current attempt and checkpoint | Cleared checkpoint, one scenario token stack delta and item-ledger movement in one group | Replay starts a **new** attempt; reopening the same clear returns the same receipt. |
| Promote outfit | Lv50, no pending battle using that profile revision; expected outfit version | Next tier Lv1, bank carried, mastery archive evidence | Duplicate command returns same promotion; no loss of stats, points or usable legacy skills. |
| Spend Inspiration token | Correct scenario token owned, branch closed, expected Uma/item versions | Branch-open state, item stack −1 and item-ledger movement atomically | Double tap or stale branch cannot charge twice; old TL-open branches cost zero. |

`begin` and `commit` may queue offline, but **only acknowledged state is spendable**. The UI must show Pending sync,
Conflict, Frozen content unavailable and Accepted states distinctly. T090 owns grouped transport/receipt semantics;
T092 owns the local journal; T096 owns EXP integration; T098 extends the grouped command to the Item sink. The local
JSON API and Firestore repository must agree on acceptance, duplicate and conflict behavior.
As elsewhere in this personal game, the server validates wire shape, ownership, expected versions and command
identity; the **client** checks combat legality and replay hash with the pure engine. This does not require the API to
run a second TypeScript combat engine or to trust unbounded/unparsed request bodies.

## Pure engine, content and results

- T089 owns aptitude/enrollment projection, repeatable tier math and tree eligibility; T091 owns the battle reducer.
  Public API shape: `createEncounter(frozenInputs)`, `applyAction(state, action)` and `replay(frozenInputs, actions)`
  returning state, ordered render cues, legality errors and a stable hash. No React, browser time, network or
  `Math.random` in either rule package. Renderer timing never changes the hash.
- The skill catalog is composed from **six weapon paths × five element motifs × branch definitions**, with Attack
  and Guard always available. T091 must publish a machine-readable catalog table: action id, channel, element,
  target mask, MP, base/rider magnitude, status duration/stack rule and intent text. Each A/B/slot gate has a
  validation path. A single action has one element, not multiple simultaneous advantages. Front cannot use MATK;
  End cannot use ATK. T089 owns tree unlocks; T091 owns what an unlocked action actually does.
- First chapter fixture in git is invented: five synthetic allies, several synthetic enemy teams, a route fork that
  reconverges, an optional recovery/elite choice and a phase-changing boss. Its purpose is to exercise every map
  transition and reward boundary, **not** to set the production chapter's fight count. T095 authors a concrete
  production chapter schema and measures phone pacing; T097 privately authors the first real chapter against it.
- The result is a receipt, not a screen-local claim: member EXP and level changes are per outfit; a KO rule and
  catch-up/taper are fixed in T096; chapter clear token is granted only after accepted boss completion in T098.
  Race EXP, Training EXP, Farm XP, badges and card stars are absent. The result screen names pending versus accepted
  rewards and links the token to global Items and Inspiration once T098 lands.

## Checkpoints for implementers

1. **Rules gate (T089/T091):** measured synthetic tables and exact numeric choices are in the design, a new decision
   explains any departure from candidate values, and `domain.test.ts` pins the result. Later tasks never choose
   coefficients in UI code.
2. **Persistence gate (T090/T092):** local and Firestore repositories pass an adversarial two-device matrix: same
   checkpoint, competing begin, takeover, duplicate append, offline pending result, stale terminal commit, duplicate
   accepted receipt and reconnect. No log may survive a rejected grouped command.
3. **Vertical slice gate (T093–T096):** one synthetic chapter goes from enrollment through boss result and two-tier
   promotion on a browser, survives reload, and shows accurate pending/accepted status. No Home entry yet.
4. **Content/sink gate (T097/T098):** one privately published real chapter resolves every character, image, action,
   phase and scenario id; its clear grants exactly one spendable token, including after reconnect/replay. Existing
   TL9/10-open Inspiration branches stay open without payment.
5. **Release/coverage gate (T099/M029):** T099 links Home only after the first real chapter and owner device pass;
   [M029](../tasks/M029-rpg-chapter-rollout.md) then tracks authored coverage of all fourteen current scenarios.

Every task PR reports `pnpm lint`, `pnpm test`, `pnpm build`, relevant `sim:rpg:*` commands, startup gzip ≤180 KB and
RPG chunk size; screen PRs attach 390×844 and small-iPhone screenshots. Private content diagnostics report only
version/hash and aggregate validation counts, never extracted rows or art.
