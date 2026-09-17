# Training

> All numbers are **draft values for tuning**. The goal is readable formulas, not a copy of the original game.

## Goals

- Simple enough to reason about and balance with a spreadsheet.
- **Cards clearly matter**, and **newer, higher-level cards are clearly stronger**.
- Stats and SP never exceed the current caps.
- Keeps the recognizable feel of the original game: five facilities, cards showing up at facilities, friendship training, skill hints.

## Two levels: Uma Level vs. Training Level

| | **Uma Level** | **Training Level (TL)** |
|---|---|---|
| Range | 1 → 10 × scenarios, **permanent** | **1–10, resets to 1 at every scenario start** |
| Earned by | **Racing only** (Uma EXP) | **Training only** (Training EXP) |
| Controls | Scenario gates and promotion · **Race Form** (race-stat nerf, see [Racing](racing.md#difficulty-race-form)) | **Stat and SP caps** within the scenario |
| Nerf at level 1 of a scenario | Race stats at 80% | Caps at 80% of the scenario baseline |

**Training gives Training EXP and card EXP. Racing gives only Uma EXP.**

## Training Level and caps

```
capMult(TL)       = 0.80 + (TL − 1) × 0.20 / 9        → TL1 80% · TL5 88.9% · TL10 100%
statCap(T, TL)    = baselineStatCap(T) × capMult(TL)
spCap(T, TL)      = baselineSpCap(T)   × capMult(TL)
```

Baseline caps per scenario are in [Scenarios](scenarios.md#timeline-and-tiers). Examples:

| TL | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| capMult | 80.0% | 82.2% | 84.4% | 86.7% | 88.9% | 91.1% | 93.3% | 95.6% | 97.8% | 100% |
| Tier 1 stat cap (baseline 1200) | 960 | 987 | 1013 | 1040 | 1067 | 1093 | 1120 | 1147 | 1173 | 1200 |
| Tier 2 stat cap (baseline 1280) | 1024 | 1052 | 1081 | 1109 | 1138 | 1166 | 1195 | 1223 | 1252 | 1280 |

The cap reaches **100% of the baseline at TL10** ✅.

### Training EXP

```
trainingExpPerTurn = 36          (× 1.5 = 54 on a friendship training)
expToNextTL        = 100         → TL10 (900 EXP) in at most 25 trainings ✅, fewer with friendship trainings
```

TL10 is the maximum. Training at TL10 still raises stats up to the full caps, gives card EXP, and rolls skill hints.

### Carrying stats into a new scenario

Trained stats are permanent, but TL resets. So a stat maxed in the previous scenario can sit **above** the new scenario's TL1 cap:

> A tier 1 Uma with Speed 1200 promotes. Tier 2 at TL1 caps at 1024, so Speed **stays 1200** (stats never go down),
> but Speed training gives no Speed until TL8 (cap 1223). Her other, lower stats keep growing meanwhile.
> With the +80 per-scenario ladder, early Training Levels of a new scenario mostly rebuild skills and card EXP, and
> stats resume growing near the end of the tier.

Caps only limit **gains**. They never reduce a stat. **Trained stats carry over between scenarios** ✅. Only Training Level and the skill library reset.
You keep training only when you need better stats or skills, or your cards have improved.

## Training Tickets

UMA training is **unlimited in principle**, and paced by tickets:

| Rule | Value |
|---|---|
| Cost | **1 ticket per training turn** |
| Daily grant | **+50 tickets per day**. Tickets also come from Uma and card level-ups (see [Economy](economy.md)) |
| Storage | **Capped at 500** ✅. The daily grant keeps accruing while you're away, up to the cap. Level-up tickets always go in, even above 500 |
| Scope | Account-wide, shared by all Umas |

Pacing: reaching TL10 takes **at most 25 trainings**, so a day's tickets take **two Umas** to TL10. Extra tickets go toward
topping stats off to the caps, leveling cards, or rebuilding skills.

## Opening training

The skill library refreshes each scenario (see [Skill library](skills-and-inheritance.md#skill-library)), so **a scenario's races unlock
after a single training turn in that scenario**. Beyond that, training is optional: train more when you need better stats or skills,
or when your cards have improved.

Training requires a nonempty, valid support deck saved on that Uma. Opening Training never auto-equips or rewrites cards;
an empty deck shows an Edit Deck action. The same ordered-deck validator drives the editor, Training, and progression-race
Race Bonus, so eligibility and displayed effects cannot disagree. Training results name each equipped card's EXP and new
level so the consequence of a manual deck choice is visible.

## A training turn

Deals and hint rolls use a seeded deterministic turn derived from the save, Uma, scenario, and committed turn count. A
reload before choosing a facility therefore shows the same deal; committing a turn advances to the next one. This keeps
the local-first action replayable and prevents refreshes from rerolling a more favorable layout.

1. **Deal:** each equipped card is placed at one of the five facilities, or sits out.
   - It goes to its own type's facility with probability `specialtyPriority` (draft base 35%, raised by card effects).
   - Otherwise it goes to a random facility (draft: 70%) or sits out (30%).
   - Friend/Group cards pick a random facility.
2. **Choose:** the player picks one facility. The expected gains are shown before confirming. **Costs 1 ticket.**
3. **Resolve:** stat and SP gains are applied and clamped to the caps. Present cards roll for **skill hints**.
   The Uma gains **Training EXP**, and all equipped cards gain **card EXP**.
4. *(MVP simplification)* No energy, failure chance, or mood during training.

## Facility base gains

| Facility | Speed | Stamina | Power | Guts | Wit | SP |
|---|---|---|---|---|---|---|
| Speed | **60** | – | 24 | – | – | 6 |
| Stamina | – | **54** | – | 24 | – | 6 |
| Power | – | 24 | **54** | – | – | 6 |
| Guts | 18 | – | 18 | **48** | – | 6 |
| Wit | 12 | – | – | – | **54** | 12 |

## Gain formula

For each stat `s` (including SP) given by the chosen facility `f`:

```
gain(s) = ( base[f][s] + Σ bonus[s] of present cards )          ← Stat Bonus, or Skill Point Bonus for SP
          × (1 + umaGrowth[s])                                    ← 0 for SP
          × (1 + Σ trainingBonus of present cards)
          × Π (1 + friendshipBonus) of present cards whose type == f   ← "friendship training"
          × (1 + 0.05 × presentCardCount)                              ← crowd bonus

new(s) = current(s) ≥ cap(s) ? current(s)
       : min(cap(s), current(s) + gainBelow1200 + ⌊gainAbove1200 / 2⌋)     ← original game's soft cap (not for SP)
```

- There is no per-tier gain scaling: stats carry over, so later scenarios only add +100–200 per stat, and their stats mostly follow the Training Level cap curve. Newer cards (era multiplier) still speed things up.
- `umaGrowth` comes from the Uma template.
- **Card level decides how much each equipped card contributes** ✅: card effect values scale with LB and level
  (see [Support Cards](support-cards.md#effect-values-generated-not-copied)).

### Worked example (draft numbers)

Tier 2 Uma with Speed growth +20%, choosing **Speed**. Present cards:
an SSR Speed card (era 2, LB2) with training +10%, friendship +25%, Speed bonus +6, SP bonus +2,
and an SSR Power card (era 1, LB0) with training +5%.

```
common = 1.15 (training) × 1.25 (friendship) × 1.10 (crowd) ≈ 1.581

Speed = (60 + 6) × 1.20 (growth) × 1.581 ≈ 125.2 → +125
Power = (24 + 0) × 1.581                  ≈ 37.9  → +38
SP    = (6 + 2)  × 1.581                  ≈ 12.6  → +13
Training EXP = 36 × 1.5 (friendship training) = 54 · Card EXP: see below
```

## Skill hints

Each card present at the chosen facility rolls a hint:

```
hintChance = 20% × (1 + hintFrequency)      × 2 if friendship training
```

On success, one skill the Uma doesn't know yet is added to her **skill library** for this scenario, taken from that card's hint
list. If she already knows every skill on the list, she gets +10 SP instead (still capped).
The library refreshes each scenario, so hint rates need tuning: a good deck should rebuild a useful loadout within about 10 trainings.

## Card EXP from training

| Situation (per turn, per equipped card) | Card EXP |
|---|---|
| Equipped, not present at the chosen facility | 5 |
| Present at the chosen facility | 15 |
| Friendship training (present, and the card type matches the facility) | 25 |

When Training first moves an LB4 card to level 25, the same atomic turn grants its one-time Card Select Coupon and marks
that card as paid. Reloading, retrying, or continuing to train a maxed card cannot grant the coupon again.

## Pacing check

- **Tier 1 is the heaviest:** about +5,500 stat points from 5★ base stats (about 100 each) to the 1200 caps. A good deck (about 180 points
  per training) reaches the caps around TL10 (25–30 trainings). A weaker deck needs 10–20 extra tickets to top off.
- **Later scenarios** add only +80 per stat (at half training value above 1200), so stats track the end of the TL cap curve, and training
  time goes mostly to skills and card EXP.
- Tickets are the single currency, so training competes with Uma promotions and card limit breaks for them.

The synthetic T010 harness (`pnpm sim:cards -- 300`) measures six-card weak/mid/mature decks at 17 optimized turns to
TL10, with average applied gains of 135.5 / 164.6 / 212.3 and learned hints of 4/6 / 3/6 / 5/6 for the fixed seeds.
See the [support-deck balance follow-up](../research/support-deck-balance.md). These are regression fixtures, not copied data.

## Later additions (not MVP)

- Energy, mood, and failure chance.
- Random events (character events per card).
- Scenario modifiers (see [Scenarios](scenarios.md)).
