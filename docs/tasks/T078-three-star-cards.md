# T078 — Three stars (save v8)

**Goal:** a card maxes at **3★** instead of 5★ in each scenario, so bonding a set is three clears a card instead of
five, while a maxed card pays exactly what a 5★ card pays today (D200). Everyone's progress survives the change.

Read [M024](M024-card-training-loop.md), D147, D150, D177, D200, [Support Cards — stars](../design/support-cards.md#stars),
[Minigames — Friendship Training](../design/minigames.md#friendship-training--card-stars) and
[Economy](../design/economy.md). Branch from current `main`; open a PR; never push to `main`. The migration and the API
change ship together in one deploy; Claude reviews the migration before merge.

## The new star scale (fixed, D200)

| | 0★ | 1★ | 2★ | 3★ (max) |
|---|---|---|---|---|
| Node pays (`STAR_NODE_PCT`) | 60% | 68% | 84% | 100% |
| Race Bonus | 0 | node curve from 1★ | ″ | full, plus the unique bonus |
| Stages in the run that earns it | — | 1 | 2 | 3 |
| Target multiplier of that run | — | 1 | 1.18 | 1.12 |

The new 1★ · 2★ · 3★ are today's 1★ · 3★ · 5★: same node pay, same run length and the same target multiplier as the
run that earned those stars, so the hardest run is exactly as hard as before and a maxed card is untouched.

- `MAX_STARS = 3`. Every reader of it (18 files today) follows; nothing hard-codes 5.
- **Friendship Training:** `FT_STAGES = { 1: 1, 2: 2, 3: 3 }`, `FT_EARNING_TARGET_MULT = { 1: 1, 2: 1.18, 3: 1.12 }`,
  `FT_STRENGTH_PER_STAR = 1/6` so a maxed card still plays at ×1.5. The Fragments twist fires on a 3★ card
  (`fragmentsStars: 3`) and the Legends card plays as 3★ (`legendsStars: 3`).
- **Scenario buff Fragments** (Grand Masters) becomes "Cards at 3★ pay +8%" (`fragmentsStars: 3`); its typical value
  stays 0.
- **Rivals do not move:** `TYPICAL_CARD_STARS = 2` keeps a typical set at 84% a node; `trainedStat(1)` stays 736.496
  and every field is unchanged (pin both).
- **Card Select Coupon:** a card's first 3★ in any scenario earns it (`maxCouponGranted`, ledger reason `card-max`).
- **Maxed Out** (trainer achievement) counts cards at 3★.

## Save v8 and the migration

- Save schema v8: a card's per-scenario `stars` hold 0–3. `parseCardSave` refuses 4 and 5 for v8.
- **v7 → v8, once, on load:** each scenario's stars map `s → ⌈3s / 5⌉`, so 1→1, 2→2, 3→2, 4→3, 5→3. Nobody loses a
  node percent: old 2★ (76%) becomes 84%, old 4★ (92%) becomes the full 100%.
- A card that reaches 3★ through the migration and has never granted its coupon grants it now: +1 Card Select Coupon,
  `maxCouponGranted: true`, one ledger row `card-max-v8:<cardId>` with reason `card-max`, all in the migration
  transaction and idempotent by id.
- **Open Friendship Training runs** are closed at the migration with their ticket refunded under `minigame-refund`,
  exactly as D177 retired Bond Recall: their frozen setups were built for the five-star ladder. Completed rows stay as
  history and keep reading (their stored `trainingLevel`/stars facts are history, not re-scaled).
- **API (`apps/api/src/save/save.types.ts`):** accepts v8 cards (stars ≤ 3) and keeps accepting v7 cards (≤ 5) from a
  client that has not updated; a v7 write never replaces a v8 entity (the pattern the v1/v2 profile guard uses). The
  ledger vocabulary is unchanged.
- The migration is pure and in `packages/domain` (like `migrateUmaSaveV6`), with the Dexie wiring in the web app.

## Presentation

- `ui/Stars` shows three. Card page, album tiles and sorts, the Uma card set, the constellation's card sheet, Friendship
  Training's start/result and `GainedStars` read the new max.
- The Friendship Training guide's star copy ("+10% per star", the stage ladder) is regenerated from the constants.

## Balance and docs

- `pnpm sim:training`: report clear rates per star earned on the new ladder; each must stay inside the minigame doc's
  band for the run it replaces (1★ ← old 1★, 2★ ← old 3★, 3★ ← old 5★).
- `pnpm sim:constellation` and `pnpm sim:careers`: the 5★ rows become 3★ and must print the same numbers (a maxed card
  is unchanged); the 0★ rows are unchanged.
- Update [Support Cards](../design/support-cards.md#stars), [Constellations — card quality](../design/constellations.md#card-quality-era-and-stars),
  [Minigames](../design/minigames.md#friendship-training--card-stars), [Economy](../design/economy.md) (maxing a card is
  three clears: 1 + 2 + 3 = 6 stages instead of 11), [Scenarios](../design/scenarios.md#scenario-buffs) (Fragments),
  [Collection](../design/collection.md#trainer-achievements-account-wide) (Maxed Out), and
  [Racing](../design/racing.md#presets) (a typical set is 2★ of 3).
- Pins in `packages/domain/src/domain.test.ts` move with the constants (doc and test together).

## Tests

- Migration: every old star value maps as the table says; a card maxed only by migration grants one coupon once, a card
  that already granted one grants none; re-running the migration changes nothing; a v7 save with an open Friendship
  Training run comes out with the run closed, one ticket refunded, one `minigame-refund` row.
- Domain: node pay, Race Bonus and SP per node at 0–3★; `advanceCardStars` refuses past 3★ and grants the coupon on the
  first 3★; rivals' `trainedStat` unchanged.
- Friendship Training: a 3★ run has three stages at ×1.12; a maxed card plays at ×1.5; replay hashes of new runs are
  stable.
- API: v8 accepted, v7 card still accepted, v8 → v7 downgrade refused.

## Acceptance

- A copy of the production save (read-only, via Claude) migrates in the preview with no card below its old node pay and
  every expected coupon; the owner's maxed cards read 3★.
- `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm sim:training`, `pnpm sim:constellation`, `pnpm sim:careers` pass; the
  main bundle stays under 180 KB gzip.
- This spec is deleted in the same PR (D104).

## Out of scope

Partners and scenario gating (T079), card focus (T080), Bond achievements (T081), any change to what a maxed card pays.
