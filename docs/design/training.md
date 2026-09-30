# Training

> All numbers are **draft values for tuning**. The goal is readable formulas, not a copy of the original game.

Training is **persisted and deliberate**, not a turn loop. You play a minigame to unlock slots, then you decide
what fills them. Nothing is rolled and nothing is spent per turn. Card and lineage choices are freely reversible;
Produce choices consume one Farm crop on first fill and replacement (D120, D205).

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
| Earned by | **Racing only** (Uma EXP) | **Spark Rival Circuit only** |
| Controls | Which scenarios are unlocked | **How many constellation nodes are open** |
| At level 1 of a scenario | — | the baseline node set only |

Training Level no longer sets stat caps. Caps belong to the scenario
([cap profiles](scenarios.md#cap-profiles)); Training Level decides how much of the tree you can reach, and the
tree is what pays the stats.

The six minor-stat slots are **Produce nodes**. Filling one consumes a crop from global Item inventory whose destination
scenario matches this constellation; that crop's stat receives the unchanged 40 raw points. A replacement consumes the
new crop, does not refund the old one and cannot be cleared by itself. Saves created before this bridge keep their exact
contribution as visibly labelled Legacy Produce until the player replaces it (D205).

## Stats are derived

An Uma's stats are recomputed from her active constellation whenever they are read:

```
raw(s)     = Σ over assigned nodes of ( nodeValue × lbPct × eraPct × share[type][s] )
derived(s) = min( capProfile(T)[s], round( baseStats[s] + raw(s) × (1 + growthRates[s]) ) )
```

`baseStats` and `growthRates` come from the Uma template, unchanged. There is no stored, accumulating stat
number and no gain formula. Remove a card and the stats it was paying for come straight back off.

This is what makes the constellation worth configuring: you set a build for a Medium race, move Card or Lineage nodes
freely, and deliberately spend stocked Produce when changing the six minor-stat choices.

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
- **Still trainable.** An earlier unit edits its free Card/Lineage configuration like any other, spends matching Produce
  for Produce-node changes, edits its card set within its own era, and
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
| Produce fill or replacement | **1 matching crop; no refund** |
| Daily grant | **+15 per day**, stored up to **60** (four days) |
| Scope | account-wide, shared by all Umas |

Card and lineage reconfiguration is free on purpose. Produce is the one deliberate material layer: its cost is inventory,
not a ticket, and the confirmation always states the spend and no-refund rule.

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
