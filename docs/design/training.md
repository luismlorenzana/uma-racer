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
| Tier 1 stat cap (baseline 600) | 480 | 493 | 507 | 520 | 533 | 547 | 560 | 573 | 587 | 600 |
| Tier 2 stat cap (baseline 700) | 560 | 576 | 591 | 607 | 622 | 638 | 653 | 669 | 684 | 700 |

The cap reaches **100% of the baseline at TL10** ✅.

### Training EXP

```
trainingExpPerTurn = 36          (× 1.5 = 54 on a friendship training)
expToNextTL        = 100         → TL10 (900 EXP) in at most 25 trainings ✅, fewer with friendship trainings
```

TL10 is the maximum. Training at TL10 still raises stats up to the full caps, gives card EXP, and rolls skill hints.

### Carrying stats into a new scenario

Trained stats are permanent, but TL resets. So a stat maxed in the previous scenario can sit **above** the new scenario's TL1 cap:

> A tier 1 Uma with Speed 600 promotes. Tier 2 at TL1 caps at 560, so Speed **stays 600** (stats never go down),
> but Speed training gives no Speed until TL4 (cap 607). Her other, lower stats keep growing meanwhile.

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

## A training turn

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
| Speed | **30** | – | 12 | – | – | 6 |
| Stamina | – | **27** | – | 12 | – | 6 |
| Power | – | 12 | **27** | – | – | 6 |
| Guts | 9 | – | 9 | **24** | – | 6 |
| Wit | 6 | – | – | – | **27** | 12 |

## Gain formula

For each stat `s` (including SP) given by the chosen facility `f`:

```
gain(s) = ( base[f][s] + Σ bonus[s] of present cards )          ← Stat Bonus, or Skill Point Bonus for SP
          × (1 + umaGrowth[s])                                    ← 0 for SP
          × (1 + Σ trainingBonus of present cards)
          × Π (1 + friendshipBonus) of present cards whose type == f   ← "friendship training"
          × (1 + 0.05 × presentCardCount)                              ← crowd bonus

new(s) = current(s) ≥ cap(s) ? current(s) : min(cap(s), current(s) + round(gain(s)))
```

- There is no per-tier gain scaling: stats carry over, so later scenarios only add +100–200 per stat, and their stats mostly follow the Training Level cap curve. Newer cards (era multiplier) still speed things up.
- `umaGrowth` comes from the Uma template.
- **Card level decides how much each equipped card contributes** ✅: card effect values scale with LB and level
  (see [Support Cards](support-cards.md#effect-values-generated-not-copied)).

### Worked example (draft numbers)

Tier 2 Uma with Speed growth +20%, choosing **Speed**. Present cards:
an SSR Speed card (era 2, LB2) with training +10%, friendship +25%, Speed bonus +3, SP bonus +2,
and an SSR Power card (era 1, LB0) with training +5%.

```
common = 1.15 (training) × 1.25 (friendship) × 1.10 (crowd) ≈ 1.581

Speed = (30 + 3) × 1.20 (growth) × 1.581 ≈ 62.6  → +63
Power = (12 + 0) × 1.581                  ≈ 19.0  → +19
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

## Pacing check (validate with a simulation script later)

- **Tier 1 is the heaviest:** about +2,500 stat points from 5★ base stats (about 100 each) to the 600 caps. A good deck (about 90 points per training)
  reaches the caps around TL10 (25–30 trainings). A weaker deck needs 10–20 extra tickets to top off.
- **Later scenarios** add only +100–200 per stat, so stats track the rising TL cap, and training time goes mostly to skills and card EXP.
- Tickets are the single currency, so training competes with Uma promotions and card limit breaks for them.

## Later additions (not MVP)

- Energy, mood, and failure chance.
- Random events (character events per card).
- Scenario modifiers (see [Scenarios](scenarios.md)).
