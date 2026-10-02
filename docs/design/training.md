# Training

> All numbers are **draft values for tuning**. The goal is readable formulas, not a copy of the original game.

Training is **persisted and deliberate**, not a turn loop. You play a minigame to unlock slots, then you decide
what fills them. Nothing is rolled and nothing is spent per turn. Card and lineage choices are freely reversible;
Extra stat nodes are bought once with Farm crops and switched on or off freely (D120, D235).

```
Play Spark Rival Circuit ──► Training Level rises ──► constellation nodes unlock
                                                      │
                          decide what fills them ◄─────┘
                                                      │
                                                      ▼
                                          stats · skills · aptitudes
                                                      │
                                                      ▼
                                                    Race
```

The two halves have their own docs:

- **[Constellations](constellations.md)** — the per-scenario skill tree. What the nodes are, what they pay, the
  stat budget and its invariance rule, skills, aptitudes, and lineage.
- **[Minigames](minigames.md)** — Spark Match's Rival Circuit raises Training Levels through a deterministic
  continuous-drag puzzle battle; the card minigame earns a card's stars.

## Two levels: Uma Level vs. Training Level

| | **Uma Level** | **Training Level (TL)** |
|---|---|---|
| Range | 1 → 10 × scenarios, **permanent** | **1–10, per scenario** |
| Earned by | **Racing only** (Uma EXP) | **Spark Rival Circuit**, 1,250 EXP a level (D211) |
| Controls | Which scenarios are unlocked | **How many card nodes are open (TL1–8) and the lineage (TL9–10)** |
| At level 1 of a scenario | — | the baseline node set only |

Training Level no longer sets stat caps. Caps belong to the scenario
([cap profiles](scenarios.md#cap-profiles)); Training Level decides how much of the tree you can reach, and the
tree is what pays the stats.

The minor stats are **[Extra stats](constellations.md#extra-stats)** (D235): a grid of 20 nodes a scenario, four of each
stat, bought in order with that scenario's crop for the stat (1, 2, 3 and 4 crops), for good. Any six bought nodes can be
on, each paying 40 raw points to its stat, and switching is free. Training Level does not touch them. Save v12 turned each
filled Produce node into a bought, active node of its stat.

## Stats are derived

An Uma's stats are recomputed from her active constellation whenever they are read:

```
raw(s)     = Σ over assigned card nodes of ( nodeValue × lbPct × eraPct × share[type][s] ) + 40 × active Extra stats of s
derived(s) = min( capProfile(T)[s], round( baseStats[s] + raw(s) × (1 + growthRates[s]) ) )
```

`baseStats` and `growthRates` come from the Uma template, unchanged. There is no stored, accumulating stat
number and no gain formula. Remove a card and the stats it was paying for come straight back off.

This is what makes the constellation worth configuring: you set a build for a Medium race, move Card or Lineage nodes
freely, and switch which six Extra stats are on.

## A scenario is a career run

Promoting does not continue a run, it starts a new one at a higher ceiling: new Training Level 1, new card set,
new goals, new milestones, and a temporarily weaker Uma who rebuilds. Races and achievements are
**scenario-linked** (D122) — the Arima Kinen won in Trackblazer and the Arima Kinen won in Our Grand Concert are
two separate records. The **active** scenario, always the highest unlocked, is her career: the one that earns
Uma EXP and has goals (D121). Every earlier scenario stays a trained unit she can still race (below, D190).

See [Constellations — a scenario is a career run](constellations.md#a-scenario-is-a-career-run).

## Trained units

Every scenario an Uma has unlocked keeps its **trained unit**: that scenario's Training Level, card set,
constellation and loadout (D190). A Silence Suzuka trained in URA Finale and the same Silence Suzuka rebuilding in
Unity Cup are two units, and either can race.

- **Choosing.** Her profile and Race Select show one switch per unlocked scenario; the choice is remembered for her on
  the device and returns to her current scenario when she advances. Her current scenario is the default.
- **Racing in context.** A race uses the chosen scenario's derived stats, skills and aptitudes under its caps, its card
  set, and rivals rolled for that scenario. The result is recorded under that scenario (D122), so its wins, records,
  badges and flair count there.
- **No Uma EXP from an earlier scenario.** Levels and careers belong to the current scenario: an earlier scenario's
  race pays no Uma EXP, tickets or shards and settles no goals. A finished build therefore cannot farm the rebuild a
  new scenario asks for. It also never waits on her gate: an Uma ready to advance can still race her earlier units.
- **Still trainable.** An earlier unit edits its free Card/Lineage configuration and Extra stats like any other, buys
  Extra stat nodes with its own scenario's crops, edits its card set within its own era, and
  plays Spark Match (for a ticket) until it reaches Training Level 10. Friendship Training already earns stars per
  scenario.
- **Advancing is unchanged.** A newly unlocked scenario starts from scratch at Training Level 1 with an empty set.

## Training Tickets

Tickets remain the only currency and the only pacing lever ([Economy](economy.md)):

| Rule | Value |
|---|---|
| Spark Rival Circuit run | **1 ticket** |
| Card minigame run | **1 ticket** |
| Card and lineage reconfiguration | **free, always** |
| Extra stat node | **1–4 matching crops, once; no refund** |
| Extra stats on or off | **free, always** |
| Daily grant | **+15 per day**, stored up to **60** (four days) |
| Scope | account-wide, shared by all Umas |

Card and lineage reconfiguration is free on purpose. Extra stats are the one deliberate material layer: their cost is
Farm inventory, not a ticket, and the confirmation always states the spend and no-refund rule.

## Training Levels are linear

Every Training Level costs **1,250 Training EXP**, so TL1 → TL10 is **11,250**: what TL1 → TL7 cost on the old
`1000 + 350 × (n − 1)` curve, about six Spark Rival Circuit runs (D211). Leaving TL1 costs 250 more than it did; every
later level costs less.

Save v11 moved every unit once through its total earned EXP. It landed on the higher of its old level and what that total
buys, so nothing was demoted, and kept the remainder. A unit that was TL6 became TL7 · 1,000; anything at TL7 or above
became TL10.

## The Training EXP bank and Level-Up Tickets

EXP is never wasted at the top (D212). Whatever a unit earns past TL10 goes into **one account-wide Training EXP bank**,
and every full 1,250 there becomes a **Training Level-Up Ticket** at once: an item in the global
[Item inventory](farm.md#global-item-inventory), worth exactly one Training Level.

| Source | When |
|---|---|
| The Spark run that reaches TL10 | its EXP past TL10, in the same commit as the level |
| The v11 migration | what re-levelling carried past TL10, banked with the profile and settled into tickets at the next startup |

The bank shows on the Items screen as `850 / 1,250`, and a ticket grant is item-ledger evidence (`exp-bank`), so a retried
commit never pays twice. TL10 still ends Spark for that unit: the bank fills from real progress, not from replaying a
finished one.

### Spending Level-Up Tickets

Tickets are spent on the **Spark Match start screen**, on the unit it was opened for (D213), below TL10 and while no
Spark run is open for that unit. A **Level-Up Tickets** row shows `Owned 3 · EXP bank 850 / 1,250` and a stepper from 1 to
`min(owned, 10 − TL)`, previews `2 tickets · TL6 → TL8 · opens 3 nodes`, and **Use 2 tickets** confirms. With none owned
the row stays, with the hint that they are earned from EXP past TL10.

- **One ticket is one Training Level:** `n` tickets add `n × 1,250` Training EXP, so the unit keeps its progress inside
  the current level. EXP carried past TL10 goes back to the bank, and if that completes 1,250 a ticket pays straight
  back. Nothing else is spent: no Training Ticket, and no run is created.
- **One commit:** the unit, the ticket stack, `training-level-up` evidence `level-up:<umaId>:<tier>:<fromLevel>.<fromExp>`,
  the bank and any regranted ticket, badge facts (a unit reaching TL10 is Fully Trained, as by a Spark run) and outbox.
  The id is the starting point the screen saw: a retried tap finds its own receipt, and a stale screen that no longer
  matches the unit spends nothing and reloads.
- **The result** is the summary a Spark run shows: TL before and after, every level crossed and every opened node
  linking to its view, plus `−2 Training Level-Up Tickets` and any EXP banked. **Done** returns to the start screen at
  the new level, where a Spark run can begin.
- Tickets need local storage; a memory-only session never holds any.

## Opening a scenario

A newly unlocked scenario starts at Training Level 1 with only the baseline nodes open and an empty six-card set. Scenario
Start makes it available to train and race; Spark Match is how the player opens more nodes before racing. A loss still banks
bounded Training EXP, but the battle never creates race facts or Uma EXP. At TL10 no new Spark run may begin for that Uma
and scenario.

A valid six-card set is not required to race, but an empty constellation pays nothing, so an Uma with no cards
slotted races on base stats alone.

## Card sets

Each scenario holds its **own set of six cards** for that Uma (D125). The set is per Uma, per scenario, and is
what the scenario's card nodes may draw from. Six slots everywhere — the old 4/5/6 tier ramp is gone. Era
gating, ownership, and the no-duplicate-character rule are unchanged
([Support Cards](support-cards.md#ownership-vs-equipping)).

## Later additions (not MVP)

- Further minigames, one per scenario, replacing Spark Match as that scenario's level path.
- Constellation presets, if reconfiguring by hand ever becomes tedious.
