# Training

> All numbers are **draft values for tuning**. The goal is readable formulas, not a copy of the original game.

Training is **persisted and deliberate**, not a turn loop. You play a minigame to unlock slots, then you decide
what fills them. Nothing is rolled, nothing is spent per turn, and every choice is reversible (D120).

```
Play Spark Match ──► Training Level rises ──► constellation nodes unlock
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
- **[Minigames](minigames.md)** — Spark Match raises Training Levels; Bond Recall limit breaks cards.

## Two levels: Uma Level vs. Training Level

| | **Uma Level** | **Training Level (TL)** |
|---|---|---|
| Range | 1 → 10 × scenarios, **permanent** | **1–10, per scenario** |
| Earned by | **Racing only** (Uma EXP) | **Spark Match only** |
| Controls | Which scenarios are unlocked | **How many constellation nodes are open** · **Race Form** |
| At level 1 of a scenario | — | the baseline node set only; race stats are at their fairest |

Training Level no longer sets stat caps. Caps belong to the scenario
([cap profiles](scenarios.md#cap-profiles)); Training Level decides how much of the tree you can reach, and the
tree is what pays the stats.

## Stats are derived

An Uma's stats are recomputed from her active constellation whenever they are read:

```
raw(s)     = Σ over assigned nodes of ( nodeValue × lbPct × eraPct × share[type][s] )
derived(s) = min( capProfile(T)[s], round( baseStats[s] + raw(s) × (1 + growthRates[s]) ) )
```

`baseStats` and `growthRates` come from the Uma template, unchanged. There is no stored, accumulating stat
number and no gain formula. Remove a card and the stats it was paying for come straight back off.

This is what makes the constellation worth reconfiguring: you set a build for a Medium race, swap two nodes,
and run a Long race with the same Uma minutes later.

## A scenario is a career run

Promoting does not continue a run, it starts a new one at a higher ceiling: new Training Level 1, new card set,
new goals, new milestones, and a temporarily weaker Uma who rebuilds. Races and achievements are
**scenario-linked** (D122) — the Arima Kinen won in Trackblazer and the Arima Kinen won in Our Grand Concert are
two separate records. Only the **active** scenario, always the highest unlocked, contributes to races (D121).

See [Constellations — a scenario is a career run](constellations.md#a-scenario-is-a-career-run).

## Training Tickets

Tickets remain the only currency and the only pacing lever ([Economy](economy.md)):

| Rule | Value |
|---|---|
| Spark Match run | **5 tickets** |
| Bond Recall run | **10 tickets** |
| Reconfiguring the constellation | **free, always** |
| Daily grant | **+50 per day**, stored up to **500** |
| Scope | account-wide, shared by all Umas |

Reconfiguration is free on purpose. Charging for it would make players hoard one safe build, which is the
opposite of what the constellation is for.

## Opening a scenario

A newly unlocked scenario starts at Training Level 1 with only the baseline nodes open and an empty six-card
set. Confirming the scenario freezes its goals and unlocks racing immediately; Spark Match is then played when
you want more nodes and a stronger Race Form.

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
