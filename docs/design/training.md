# Training

Training is **persisted and deliberate**, not a turn loop. Free account-wide **Uma Puzzles** battles earn
scenario/style materials; spend them to raise **Constellation Level (CL)**, then choose what fills the opened
card nodes. Card and lineage choices are freely reversible; Extra stats are bought once with Farm crops and
switched on/off freely (D120, D235, D267, D287–D290).

Card stars are **global** (D255). Each distance preset references the same owned cards. CL is shared by four
distance presets within an outfit/scenario, not across scenarios. Friendship Training chooses a scenario as
play context, not a new card-star track.

```
Home → Uma Puzzles → five-outfit party → free chapter fights
                                           │
                  independent Puzzle EXP + scenario/style materials
                                           │
                               legacy debt first → Items
                                           │
               Profile / Training / Constellation → CL level-up sheet
                                           │
                          card nodes open → configure build → Race
```

- **[Uma Puzzles](uma-puzzles.md)** — global roster, five-member parties, chapters, battles, independent Puzzle
  Levels, materials/debt/exchanges and explicit production-placeholder art.
- **[Constellations](constellations.md)** — per-scenario card tree, derived stats/SP, Inspiration and Extra stats.
- **[Minigames](minigames.md)** — Friendship earns global card stars; Spark remains historical rules/replays,
  not a new-run entry.

## Three independent levels

| | Uma Level | Constellation Level (CL) | Puzzle Level (PL) |
|---|---|---|---|
| Scope | permanent racing career | 1–10 per outfit/scenario; shared across four presets | permanent per enrolled outfit |
| Earned by | racing only | explicit material spend | winning Puzzle battles |
| Controls | unlocked racing scenarios | card nodes at CL1–8; baseline SP through CL10 | Puzzle stats and finite-kit skills |
| New scenario | permanent level continues | CL1, baseline nodes | unaffected |

CL does **not** scale base stats or caps. The scenario owns the caps and template; CL controls accessible card
nodes and the existing baseline SP formula. Inspiration and Extra stats have **no CL prerequisite**.

## Spending materials

Profile, Training and Constellation share the lazy **CL n/10 · Level up** sheet (D283). The selected racing
scenario supplies the material family; the distance preset supplies the stat preview, but the purchase raises
CL across all four presets. Each step costs one ticket of this scenario and an **original source-A running
style** of the outfit. Eligible styles may supply successive steps. Preserved **Legacy Universal CL Tickets**
may supply steps separately; missing style stock is never silently replaced with universals.
See [spend/exchange contract](../technical/uma-puzzles-implementation.md#t114-implemented-material-surfaces-d283).

Confirmation names quantities, CL before/after, every newly opened **actual template node**, and stat/SP deltas.
CL9/10 open no further card nodes but still raise baseline SP. Operations are authority-backed and idempotent;
offline/stale spending cannot keep unearned power. All preset choices survive canonical correction. Materials
live in global Items; negative legacy debt is separate.

## Stats are derived

```
raw(s)     = Σ card nodes (nodeValue × starPct × eraPct × share[type][s]) + 40 × active Extra stats of s
derived(s) = min(capProfile(T)[s], round(baseStats[s] + raw(s) × (1 + growthRates[s])))
```

Template base stats/growth are unchanged. [Scenario buffs](scenarios.md#scenario-buffs) still apply. Removing
a card removes its contribution. Puzzle wins never directly add racing stats/EXP, stars, crops or Inspiration.

## A scenario is a career run

Promotion starts a fresh career at a higher ceiling: **CL1**, new sets/configurations, goals and milestones.
The highest unlocked scenario earns Uma EXP and settles goals. Each older scenario stays a trained unit with
its own CL, four distance presets, Extra stats and Inspiration; races remain scenario-linked (D122, D190).

- Profile/Race Select remember the selected scenario on-device and return to the current scenario on advancement.
- Races read that scenario's derived stats/skills/aptitudes, distance build, caps and rival scaling.
- Earlier races pay **no Uma EXP, tickets or shards**, settle no current goals and never wait on its gate.
- Older units stay editable and may raise CL with their scenario materials. Future units are outside old debt.

## Training Tickets and other costs

| Action | Cost |
|---|---|
| Uma Puzzles entry, retry, chapter play | free |
| Friendship Training run | 1 Training Ticket |
| Next racing scenario | 5 × current tier Training Tickets |
| CL step | 1 matching scenario/source-A style material or explicitly selected preserved universal |
| Card/lineage reconfiguration | free |
| Extra stat purchase | 1, 2, 3 or 4 matching crops, once; no refund |
| Extra stats on/off | free |

Training Tickets retain **+15/day**, daily storage cap **60**, account-wide. The cap affects daily accrual,
not earned race level-up tickets or stable legacy refunds. See [Economy](economy.md).

## Card sets and training views

Every scenario has four distance presets (D252–D254), each with six cards, assignments, active Extra stats
and loadout. Ownership, era eligibility and no-duplicate-character rules are unchanged. Cards read global stars.
An empty set is allowed to race but pays no card stats. Training opens **Constellation**, **Inspiration** and
**Extra stats**; only Constellation offers CL level-up. Inspiration uses scenario Slot/Skill Tokens from RPG,
including its separate temporary debt. Extra stats use Farm crops: 20 nodes, four/stat, any six active, +40 raw
each before scenario buffs. Switching is free outside races.

## Preserved levels and recovery

Save16 retains the `trainingLevel` field as **CL**, with retired unit/account EXP exactly zero. D287 preserves
earned levels, all four builds, global cards, lineage, Extra stats, racing facts and other modes. It freezes
**CL−1 debt once per existing outfit/scenario**, under one original-A style, not per preset. Unapplied unit/account
EXP is pooled at **1,250 per universal**, with one positive-fraction compensation per account; existing universal
stock is retained. Migration credit bypasses debt. Nothing new mints universals, grants CL10 or unlocks a scenario.

Before any protected mutation, the preparing online device retains a **whole-account canonical backup plus old
local journals** in a device-only archive. Download privately from Settings or the Puzzle Hub; never clear app data
or partially restore. Failed backup/content verification blocks preparation. Finished pending Spark replays drain
before freeze; unfinished paid runs refund the original ledger cost once. Retry continues bounded receipts and
reconciles lost acknowledgements, never re-snapshotting. Other modes remain usable. See
[release acceptance](../research/uma-puzzles-release-acceptance.md) and
[recovery contract](../technical/uma-puzzles-implementation.md#t115-implemented-preservation-v2-d287).

## Historical Training EXP — not active gameplay

### Training Levels are linear

Before activation, Spark paid **1,250 EXP per TL step**, 11,250 from TL1→10 (D211). Save11 preserved old earned
totals under this linear curve.

### The Training EXP bank and Level-Up Tickets

EXP past TL10 minted one `training:level-up-ticket` per 1,250 through the bank (D212).

### Spending Level-Up Tickets

The old Spark-start spend retained partial EXP (D213). Parsers, ledger reasons and fixtures remain
for migration/history. New Spark runs, ordinary Training EXP/banking and old universal spends are retired for
active preserved accounts.
