# Milestone 27 — Training Rebalance

**Outcome:** Training Levels are linear and cheaper. TL1→10 costs what TL1→7 costs today, and every level costs the same.
EXP past TL10 is never wasted: it fills one account-wide **Training EXP bank**, and each full level's worth becomes a
**Training Level-Up Ticket** in the global Item inventory. The player spends those tickets on the Spark Match start screen
to raise the selected Uma's Training Level without playing.

Decisions: D211 (the linear curve), D212 (the EXP bank and Level-Up Tickets), D213 (spending them), D214 (T087 as built).
Source of truth once each task lands: [Training](../design/training.md),
[Minigames — Training EXP](../design/minigames.md#training-exp-and-levelling), [Economy](../design/economy.md),
[Stable Farm — Global Item inventory](../design/farm.md#global-item-inventory).

## Where it stands today (2026-09-30)

- **Training is splitting into three modes** (ChatGPT, [PR #71](https://github.com/luismlorenzana/uma-racer/pull/71),
  D210): **Constellation** (card nodes, the only Spark Match entry), **Inspiration** (parent and grandparent nodes, to be
  driven by a new minigame ChatGPT is authoring) and **Extra Stats** (the six Produce nodes, fed by the Farm since D205).
  PR #71 moves the save to v10 and Dexie to v16. M027 builds on it and does not touch those views.
- **The curve** (`packages/domain/src/training.ts`): leaving TL `n` costs `1000 + 350 × (n − 1)`, so TL1→7 is **11,250**
  EXP and TL1→10 is **21,600**. A competent Rival Circuit clear pays about 2,200. A loss pays at most 877.
- **Measured** with `pnpm sim:spark` on 2026-09-30: TL1→10 takes a median of **12** paid runs (p90 13). The same
  sample with a flat 1,250 per level takes **6** (p90 8).
- **TL10 ends Spark** for that unit, and the run that reaches it throws its surplus away (`addTrainingExp` zeroes it).
- **Training Level still opens nodes in all three views:** the baseline at TL1, card and Produce nodes over TL2–8, and
  lineage at TL9 and TL10. The `max(base, 50 × TL)` stat floor and the SP baseline (`TL / 10` of 40% of the cap) also
  read TL.
- **The global Item inventory** (M025, `items` and `itemLedger`) holds only `produce` today. Its item ids are validated
  as crop ids on the API, and its ledger reasons are `farm-harvest` and `constellation-produce`.
- **The cloud copy of the owner's save** (read-only, aggregates, 2026-09-30; the phone may be ahead) holds 34 trained
  units: 27 at TL1, 1 at TL6 and 6 at TL10.

## Tasks

| Task | Delivery | Depends on | Suggested owner |
|---|---|---|---|
| T087 ✅ | Linear curve (1,250 a level), save v11 re-levelling, the EXP bank, the Level-Up Ticket item and its grants | PR #71 merged | Claude, landed 2026-09-30 |
| [T088](T088-spend-level-up-tickets.md) | Spend Level-Up Tickets on the Spark Match start screen for the selected unit | T087 | Codex (delegable) |

```text
PR #71 three views (save v10) ──► T087 linear curve + bank (save v11) ──► T088 spend tickets before Spark
```

M027 is independent of M024: T080 and T081 change neither Training Levels nor the save schema, so either milestone can go
first.

## Fixed product contract

- **Linear.** Every Training Level costs **1,250** EXP, today's TL1→7 cost spread over nine levels. TL1→10 is **11,250**.
  Leaving TL1 costs 250 more than today; every later level costs less.
- **Nothing is lost in the change.** An existing unit keeps its total earned EXP. It lands on the higher of its current
  level and the level that total buys. EXP beyond TL10 goes to the bank.
- **One bank, account-wide.** EXP past TL10, from the run that reaches it, from a Level-Up Ticket, or from the one-time
  migration, goes into the bank. Each full 1,250 becomes one Training Level-Up Ticket at once, so the bank holds less
  than 1,250 after every commit; what the migration banked is settled at the next startup (D214).
- **The ticket is an item** in the global Item inventory, not a profile currency and not a Training Ticket. A Level-Up
  Ticket is exactly one level's EXP (+1,250), spent on the Spark Match start screen for the Uma and scenario unit that
  screen is for.
- **Unchanged:** TL10 as the maximum, TL10 ending Spark for that unit, the node unlock schedule, the stat floor, the SP
  baseline, one Training Ticket a Spark run, Rival Circuit difficulty rows and EXP budgets, and the three training views.

## Milestone verification

Each PR runs `pnpm lint`, `pnpm test`, `pnpm build` and the sims it names. The milestone is done when:

1. A v10 save migrates once to v11. No unit loses a level, every unit's EXP fits the new curve, and its surplus past TL10
   arrives as Level-Up Tickets plus a bank remainder, exactly once, synced.
2. `pnpm sim:spark` gates TL1→10 at a median of 5–7 paid runs and p90 ≤ 9.
3. A Spark run that reaches TL10 banks its surplus, and a Level-Up Ticket appears in Items when the bank passes 1,250.
4. On the Spark Match start screen the player spends Level-Up Tickets on the selected unit, sees the levels and nodes they
   opened, and any EXP a ticket carries past TL10 returns to the bank.
5. The design docs above describe the built loop, and every M027 spec is deleted (D104).

## Out of scope

- The Inspiration minigame and whether lineage keeps opening at TL9–10 (ChatGPT's minigame decides its own gate).
- Extra Stats and Produce. The Farm already feeds them (D205).
- Rival Circuit rules, rewards per run, difficulty by TL, and Training Ticket prices.
- Running Spark on a TL10 unit to fill the bank (D212).
- Any other use of Level-Up Tickets: other screens, other currencies, selling or exchanging.
