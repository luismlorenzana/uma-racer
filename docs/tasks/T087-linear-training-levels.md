# T087 — Linear Training Levels and the EXP bank

**Goal:** every Training Level costs 1,250 EXP (TL1→10 = 11,250, today's TL1→7). Existing units re-level once without
losing anything. EXP past TL10 fills one account-wide bank that pays a **Training Level-Up Ticket** item for every full
1,250 (D211, D212).

Read [M027](M027-training-rebalance.md), D211 and D212, [Training](../design/training.md),
[Minigames — Training EXP](../design/minigames.md#training-exp-and-levelling) and
[Stable Farm — Global Item inventory](../design/farm.md#global-item-inventory). This task starts after PR #71 merges
(save v10, Dexie v16). Branch from current `main` and open a PR.

## The curve

```text
TRAINING_EXP_PER_LEVEL = 1250            every level, 1 → 9
trainingExpToNext(n)   = 1250            kept as a function so callers do not change
TL1 → 10               = 11,250
```

`addTrainingExp` also returns `overflowExp`: the EXP left over once the unit reaches TL10 (0 below TL10). `trainingExp` at
TL10 stays 0. `EXP_TO_NEXT_TRAINING_LEVEL`, which the legacy parsers read, keeps its old value of 1,000 for those
parsers only. Tests pin 1,250 and 11,250 in `domain.test.ts` beside the docs.

## Save v11: re-levelling every unit once

The migration from v10 to v11 converts each scenario unit (`trainingLevel`, `trainingExp`) through its total earned EXP,
using today's curve:

```text
total   = oldCumulative(TL) + trainingExp          oldCumulative: 0 · 1000 · 2350 · 4050 · 6100 · 8500 · 11250 · 14350 · 17800 · 21600
level   = max(TL, min(10, 1 + floor(total / 1250)))
exp     = level == 10 ? 0 : clamp(total − 1250 × (level − 1), 0, 1249)
surplus = max(0, total − 11250)
```

| Old unit | New unit | Surplus |
|---|---|---|
| TL1 · 600 | TL1 · 600 | 0 |
| TL2 · 0 | TL2 · 0 (never demoted, although 1,000 < 1,250) | 0 |
| TL3 · 1,000 | TL3 · 850 | 0 |
| TL6 · 0 | TL7 · 1,000 | 0 |
| TL7 · 0 | TL10 | 0 |
| TL10 | TL10 | 10,350 |

- The migration is one-way and happens exactly once, on whichever path first sees a v10 row: the Dexie v17 upgrade
  (`walkRowsToCurrent`) or a legacy cloud save adopted on a new device. The sum of every unit's surplus goes into the
  bank on that same path, under a single `exp-bank:migration-v11` evidence id, so a synced, already-migrated save never
  pays again.
- Units the migration raises to TL10 earn the existing TL10 badge facts (`reachedTl10`, `fullyTrainedTiers`) through
  the retroactive reconcile. That produces one archive summary, not one fanfare per unit.
- The owner's cloud copy (2026-09-30) would bank 6 × 10,350 = 62,100 EXP: **49 Level-Up Tickets and 850 left in the
  bank**. Report the real figure from the phone's save in the PR, as aggregates only.

## The bank and the ticket

- **Bank:** `PlayerProfile.trainingExpBank`, an integer from 0 to 1,249. Add it in save v11. The API validator rejects
  1,250 or more.
- **Deposit** (pure, domain): `depositTrainingExp(bank, exp) → { bank, tickets }`. It converts every full 1,250 at once.
- **Item:** `training:level-up-ticket`, "Training Level-Up Ticket" in a new `training` category in the checked-in item
  catalog, beside the crops. The API's item-id check (today `FARM_CROP_ID_PATTERN` only) accepts it.
- **Item ledger:** add the reasons `exp-bank` (a grant, `delta > 0`) and `training-level-up` (a spend, `delta < 0`,
  used by T088), with sources `{ kind: 'spark-run', runId }`, `{ kind: 'migration' }` and
  `{ kind: 'level-up', umaId, tier, fromLevel, fromExp }`. Ids are deterministic (`exp-bank:<runId>`, `exp-bank:migration-v11`),
  so a retried commit never grants twice. Define both reasons here so the API changes once.
- **Items screen:** a **Training** group above Produce shows the Level-Up Ticket and the bank as `850 / 1,250 EXP`.

## Spark commit

In the Spark branch of the run commit (`apps/web/src/game/minigame-runs.ts`), a run that reaches TL10 deposits its
`overflowExp` in the same Dexie transaction as the unit, the profile's bank, the item stack, the item-ledger row and the
outbox. The run's `RunReward` and result screen add **"+X EXP to the bank"** and, when one is granted,
**"+N Training Level-Up Ticket"** after the level bar. Memory-only saves follow the same rules in memory.

## Docs and sims

- `pnpm sim:spark`: the TL1→10 gate becomes a median of 5–7 paid runs and p90 ≤ 9 (measured 6 and 8 on 2026-09-30).
  Career and constellation sims run at TL10 and must not move.
- Update the level table, the projection and "ten good clears" in [Minigames](../design/minigames.md#training-exp-and-levelling).
- In [Training](../design/training.md), add the bank and the ticket.
- In [Economy](../design/economy.md), change the pacing lines: one Uma through TL10 is about 6 runs, and a day's 15
  tickets take two to three Umas there.
- Add the `training` category to [Stable Farm — Global Item inventory](../design/farm.md#global-item-inventory).
- Add save v11 to [Architecture](../technical/architecture.md).

## Tests

- Domain: the curve constants, `addTrainingExp` overflow at and below TL10, the migration table above (including never
  demoting), and `depositTrainingExp` at 0, 1,249, 1,250 and several levels at once.
- Save: v10 → v11 for a profile and an Uma. Parsers reject a bank of 1,250 or more and a unit whose EXP does not fit the
  new curve.
- Persistence: the Dexie upgrade pays the surplus exactly once. Adopting a legacy cloud save pays it once. Re-running
  the startup path pays nothing.
- Runs: a Spark commit that crosses TL10 banks its surplus and grants a ticket atomically, and a retried commit grants
  nothing more.
- API: accepts v11 profile and Uma rows, the ticket item and both reasons, and a v10 row it can still migrate. It
  rejects a bank of 1,250 or more.

## Acceptance

- In the browser at 390 × 844, a seeded v10 save with one TL10 and one TL6 unit becomes TL10 and TL7 · 1,000, with
  8 tickets and 350 in the bank. Items shows both. A Spark run that reaches TL10 shows the banked line.
- `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm sim:spark` pass. The main bundle stays under 180 KB gzip.
- This spec is deleted in the same PR (D104).

## Out of scope

Spending tickets (T088), Spark rules or rewards per run, unlock schedule, the three training views (D210), and running
Spark at TL10.
