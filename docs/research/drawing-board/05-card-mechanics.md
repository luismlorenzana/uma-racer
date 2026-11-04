# 05 · Card mechanics: real card numbers in a deterministic build

> **Research for the drawing board (2026-11-04). Not a decision.** The owner's calls that day: mini-games pay
> **resources**, the owner **spends them by hand in trees**, and what an allocation grants comes from the **real card
> mechanics**; no clock, no play limits, free retries, no energy, mood or rest. This replaces [README](README.md) §4's
> "stages pay stats directly". No original values appear here: card numbers are made up, and data is described by
> field names and shapes. Guesses are marked **(guess)**.

## 1. What card and Uma data we have

**Sources read:** the installed `@luismlorenzana/uma-data` types (`dist/esm/sets/*.d.ts`); uma-platform's
`docs/master-data.md` and its normalizer (`scripts/data/src/normalize/cards.ts`); the field names (never the values) in
the private release `uma-platform/content/release/data/`; and the racer's `packages/domain/src/master/adapter.ts`,
`cards.ts`, `card-focus.ts`, `constellation.ts` and `training/*`. The card schema is the same from uma-data 1.0.0 to
1.3.0; the later minors only add art families.

### 1.1 Support cards

The release has **566 cards: 147 R, 101 SR and 318 SSR**. 30 of them are Friend or Group cards. Per card:

| Field | Shape | In master | Racer keeps today |
|---|---|---|---|
| `type`, `rarity` | `speed…wit \| friend \| group`; 1 R, 2 SR, 3 SSR | Yes | Type; **SSR only** |
| `effects` | `{ type, values[11] }[]`, a value at card levels 1, 5, 10 … 50, with null meaning "keep the last one" | Yes, the full per-level table | **No.** Each effect is flattened to its highest value, divided by the SSR median and clamped to 0.5–1.5 (`effectProfile`). Only Race Bonus is read at runtime (D180) |
| `uniqueEffect` | `{ level, description, effects: { type, value, params[] }[] }` | Yes | Type and value only. `params` and `description` are dropped |
| `hints.skillIds` | the skills it can hint (about 7 a card) | Yes | Yes (`hintSkillIds`) |
| `hints.others` | non-skill hint rewards `{ type, value, minLevel }`: stats (types 1–5) or SP (30) | Yes, on about 300 SSRs | **No** |
| `eventSkillIds`, `globalEventSkillIds` | the skills its event chain teaches (golds come from here, D182) | Yes | Yes (Global first) |
| `release.jp` | date | Yes | As `era` (`eraOf`) |
| Card **events** (choices, the stats, SP and bond each pays) | n/a | **Missing.** GameTora keeps them in a separate events dataset that isn't imported | No |

**Limit break is the card level.** An SSR's maximum level is 30 at LB0, 35, 40, 45 and **50 at MLB**. An SR runs
25–45, an R 20–40 ([Game8](https://game8.co/games/Umamusume-Pretty-Derby/archives/541847)). So
"effects per limit break" means reading `values` at that level. Under D329 every card pays its maximum, so that is
level 50.

**Effect ids** follow the original's numbering, as named by [umamusu.wiki](https://umamusu.wiki/Module:Game/Supports/Data/Effects).
"SSRs" counts the cards that carry the effect, out of 318:

| Id | Effect | SSRs | Racer today |
|---|---|---|---|
| 1 | Friendship Bonus | 306 | in the profile, unused |
| 2 | Mood Effect | 223 | dropped |
| 3–7 | Speed … Wit Bonus (flat stat bonus) | 37–79 each | in the profile, unused |
| 8 | Training Effectiveness | 200 | in the profile, unused |
| 9–13 | Initial Speed … Wit | 19–67 each | in the profile, unused |
| 14 | Initial Friendship Gauge (initial bond) | 311 | dropped |
| 15 | Race Bonus | 256 | **used** (Racing EXP) |
| 16 | Fan Bonus | 256 | dropped |
| 17 | Hint Levels | 258 | dropped |
| 18 | Hint Frequency | 259 | in the profile, unused |
| 19 | Specialty Priority | 281 | in the profile, unused |
| 25, 26 | Event Recovery, Event Effectiveness | 16, 17 | dropped |
| 27 | Failure Protection | 11 | dropped |
| 28 | Energy Cost Reduction | 12 | dropped |
| 30 | Skill Point Bonus | 131 | in the profile, unused |
| 31 | Wit Friendship Recovery | 60 | dropped |
| 32 | Initial Skill Points | 17 | dropped |
| 20–24, 29 | Max stat, Minigame Effectiveness | 0 | none in this release |

**Unique effects** switch on at a card level (30, 40 or 1 here) and use the same ids plus conditional ids from 101 up,
with their extra numbers in `params`. **101** (a bonus above a bond threshold) is on about 145 cards. The rest, a few
each, count facility levels (111, 117), other cards at the same training (110), deck types (103, 105, 120), friendship
trainings (106, 113), the whole deck (115, 119), or energy and fans (104, 107, 108, 114).

### 1.2 Umas (outfits)

The release has **272 outfits**.

| Field | In master | Racer keeps |
|---|---|---|
| Base stats `stats.star1…star5` | Yes | `star5` as `baseStats` |
| Growth rates `growthRatePercents` (whole %, on every outfit) | Yes | Yes, as fractions |
| Aptitudes: surface ×2, distance ×4, strategy ×4, grades S–G | Yes | Yes |
| Skills: `unique`, `innate`, `awakening`/`globalAwakening`, `event`, `evolutions` | Yes | The first unique, awakening (Global first), innate and event. **Evolutions are dropped** |
| Her story events' rewards | **Missing** (the same events dataset) | No |

**Skills:** 2,220 records, 1,192 with an SP cost (`costSp`), plus white/gold pairs (`versionIds`), inherited
versions and Japan/Global mechanics. **Only in the racer's private overlay:** card focus (style and distance, D201) and
flair (race series and venues). Neither holds card numbers.

**What changes.** The master data already has everything; only the racer's adapter changes. `masterCards` keeps each
effect's level-50 value as is (not normalised), the unique effect with its `params`, and `hints.others`, and
`SupportCardTemplate` gets an `effects` map in place of `effectProfile`. The values stay in the private pack behind the
authenticated API; domain tests use `uma-data/testing`'s synthetic cards, so no real number reaches git.

## 2. How the original uses them

### 2.1 Stat gain of one training

One training's gain, per stat the facility trains
([uma.guide: Support Cards](https://uma.guide/guides/support-cards),
[umareference: Calculating Training Stat Gain](https://www.umareference.com/guide/support-cards-in-detail/calculating-training-stat-gain)):

```
gain = floor( (Base[facility, level, stat] + Σ StatBonus)
            × Π (1 + FriendshipBonus_i)            friendship cards only
            × (1 + Mood × (1 + Σ MoodEffect))
            × (1 + Σ TrainingEffectiveness)
            × (1 + 0.05 × cards present)
            × (1 + Growth[stat]) )
```

- **Base** depends on the scenario, the facility and its level (1–5, up one level every four uses). URA Finale at
  level 1 pays Speed 11 + Power 6 at Speed, Stamina 10 + Guts 6, Stamina 6 + Power 9, Speed 5 + Power 5 + Guts 8,
  and Speed 2 + Wit 10 at Wit, with 4 SP (5 at Wit) for about 20 energy (Wit restores 5)
  ([GameTora: URA Finals](https://gametora.com/umamusume/ura-finals)). Level 5 pays about a third more
  ([01](01-uma-career-and-scenarios.md) §1).
- **Stat Bonus** is flat, added before every multiplier, and only to stats the facility trains: a Power Bonus counts
  at Speed, which trains Power
  ([umareference: Stat Stick Passives](https://www.umareference.com/guide/support-cards-in-detail/stat-stick-passives)).
- **Friendship** needs the card at its own type's facility with bond ≥ 80. Each such card multiplies separately, and
  a unique friendship bonus multiplies again.
- **Mood** is −20% to +20% in 10-point steps, scaled by Mood Effect. **Training Effectiveness** adds up across the
  cards present. **Headcount** is +5% a card. **Growth** is the trainee's rate for that stat.

### 2.2 Skill points

Each training pays its facility's base SP (4–5 in URA). **Skill Point Bonus** adds a flat amount to it
([uma.guide](https://uma.guide/guides/support-cards)). That the same multipliers then apply to SP, and growth does not,
is the usual reading, but no source states it outright **(guess)**. Races and events also pay SP, and **Race Bonus**
raises what races pay ([umareference: Other Passives](https://www.umareference.com/guide/support-cards-in-detail/other-passives)).
**Initial Skill Points** adds SP at the start.

### 2.3 Bond

The gauge runs 0–100 from the card's **Initial Friendship Gauge**: +7 a training together, +5 a hint, +5 to +10 an
event, +2 under Charming. At 80 it turns orange and friendship training opens
([Game8: Friendship Training](https://game8.co/games/Umamusume-Pretty-Derby/archives/542672)).

### 2.4 Hints

**Hint Frequency** raises the chance a card shows a hint; **Hint Levels** makes its hints arrive at a higher level.
Each level cuts the skill's SP cost, 10% for each of the first three and 5% for the next two: **40% at level 5**
([uma.guide: Skills](https://uma.guide/guides/skills); [umamusu.wiki](https://umamusu.wiki/Game:Skills) says about 8%
a level, same cap). Only hinted skills and the trainee's own can be bought. Some hints pay stats or SP instead
(`hints.others`).

### 2.5 Everything else

**Specialty Priority** weights where a card shows up: its own facility at 100 + priority, each other at 100, absence
at 50, drawn every turn ([uma.guide](https://uma.guide/guides/support-cards)). **Initial stats** add flat at the start.
**Failure Protection**, **Energy Cost Reduction**, **Event Recovery** and **Wit Friendship Recovery** act on energy or
failure; **Event Effectiveness** on event stats; **Fan Bonus** on fans.

## 3. A deterministic model: resources → trees → stats

### 3.1 Resources: four kinds

| Resource | What it is in the original | Spent on |
|---|---|---|
| **Drills**, in five colours (Speed, Stamina, Power, Guts, Wit) | Energy spent at that facility | Training sessions in the matching branch |
| **Skill Points** | SP | Skills (§4) |
| **Bond** | Friendship gauge | One card's bond track, the owner's pick |
| **Aptitude points** | Pink sparks | One grade step on a distance, surface or style (§4) |

A stage pays a mix leaning on its scenario's "pays most" column ([README](README.md) §5), its focus picking the two
drill colours that pay most. A won race pays SP and drills × **(1 + Σ Race Bonus)**, Race Bonus's real meaning. The
card-race mini-game should read the same adapted card template, so one adapter change serves both.

### 3.2 The tree

**One tree per Uma per scenario, five branches** (one per facility):
- **A branch climbs facility levels 1 → 5.** Each level is a node with **four session pips**, as the original levels
  a facility every four uses. **A pip is one training:** 20 a branch, 100 a tree.
- **Two Camp nodes** open once any branch reaches level 3: four level-5 sessions each, in a branch the owner picks,
  like the original's summer camps. They are the tree's free choices.
- **A pip costs drills** of its branch's colour, the facility's energy cost: about 20–26 by level **(guess)**. Pips
  open in order; the next level opens when all four are full; one tap buys a level row.
- **Derived when read.** An open pip's pay is **recomputed from the current deck and bonds**, like today's
  `deriveBuild`: swapping a card or reaching bond 80 changes every open session at once. Purchase order never matters,
  and nothing is random.

**Posting.** The owner posts each of the six deck cards to one branch, by default its own type's. A branch seats at
most five, as a facility does, and a posted card counts on every pip of its branch. **Friendship** counts only on its
own type's branch at bond ≥ 80, the original's rule; Friend and Group cards never trigger it (D115). Specialty Priority
has nothing to decide, because the owner places every card.

### 3.3 What a session pays

The original's formula (§2.1), with mood fixed at Great and a single per-scenario scale:

```
P = cards posted to branch F           s(T) = capBudget(T) / 6,000   (1.00 at T1 … 1.58 at T15)  (guess)

gain[stat] = floor( s(T) × (Base[F, L, stat] + Σ_P StatBonus[stat])
                  × Π_{c∈P, type=F, bond≥80} (1 + Friendship_c) × (1 + UniqueFriendship_c)
                  × (1 + 0.20 × (1 + Σ_P MoodEffect))
                  × (1 + Σ_P TrainingEffectiveness)
                  × (1 + 0.05 × |P|)
                  × (1 + Growth[stat]) )                 only for stats facility F trains
gainSP     = the same, on Base_SP[F, L] + Σ_P SkillPointBonus, without Growth

stat = min( cap(T), baseStats.star5 + Σ_deck InitialStats + Σ open pips gain + hint stat rewards )
```

**Base** is URA's facility table at levels 1–5 in every scenario; the scenario's buff (`training/buffs.ts`) can still
bend it. How each card effect enters:

| Use | Effects |
|---|---|
| **As in the original** | Stat Bonus, Training Effectiveness, Friendship (and unique), headcount, Growth, Skill Point Bonus; Mood Effect (mood fixed at Great); Initial stats and Initial Skill Points (once per deck card); Initial Friendship Gauge, Hint Frequency and Hint Levels (§3.4, §4); Race Bonus (what races pay) |
| **Translated** | Energy Cost Reduction cuts the drill cost of pips in its branch; Wit Friendship Recovery cuts Wit pips' cost while in friendship; unique conditionals where a reading exists: bond threshold (101), pip level (111, 117), cards posted alongside (110), deck types (103, 105, 120), friendship pips (106, 113), deck-wide (115, 119) |
| **Dropped** (still shown on the card) | Specialty Priority, Failure Protection, Event Recovery, Fan Bonus, energy and fan uniques: no wandering, failure, energy or fans. Event Effectiveness, while card events stay unimported |

### 3.4 Bond tracks

Each card has a **bond track, 0–100**, per Uma, kept for the tier like today's bonds. It starts at the card's
**Initial Friendship Gauge**, and the owner pours **Bond** into it; the "extra bond gain" unique (121) multiplies the
pour. **Stops:** a **hint** every `round(20 / (1 + HintFrequency))` bond **(guess)**, paying the next hint skill in list
order and any `hints.others` reward due; **80, friendship**; **100, the event chain**, hinting its `eventSkillIds`, golds
included (D182). With unlimited play every track reaches 100, so bond sets the **pace**, not the ceiling.

### 3.5 Worked example (made-up numbers)

T1 (s = 1). One pip of Speed level 3: base Speed 12, Power 6, 4 SP, cost 23 Speed drills **(made up, URA-like)**.
The Uma's growth is Speed +20%, Power 0%. Three cards are posted to Speed:

| Card | Type | Bond | Effects |
|---|---|---|---|
| A | Speed | 85 | Speed Bonus +1, Friendship 25%, Mood Effect 30%, Training Effectiveness 10%, SP Bonus +1 |
| B | Speed | 60 | Power Bonus +1, Friendship 30%, Training Effectiveness 5% |
| C | Wit (posted off type) | any | Training Effectiveness 15%, Friendship 35%, Energy Cost Reduction 15% |

Multipliers: friendship **1.25** (A only: B is under 80, C off type) × mood 1 + 0.2 × 1.3 = **1.26** × effectiveness
**1.30** × headcount **1.15** = **2.3546**.

| | Speed | Power | SP | Drills |
|---|---|---|---|---|
| No cards (mood ×1.2 only) | ⌊12 × 1.2 × 1.2⌋ = 17 | ⌊6 × 1.2⌋ = 7 | 4 | 23 |
| A, B, C as above | ⌊13 × 2.3546 × 1.2⌋ = **36** | ⌊7 × 2.3546⌋ = **16** | ⌊5 × 2.3546⌋ = **11** | ⌈23 × 0.85⌉ = **20** |
| …once B reaches bond 80 (×1.30) | 47 | 21 | 15 | 20 |
| …with C posted to Wit instead | 31 | 13 | 9 | 23 |

**The pip shows** "Speed Lv 3 · 20 drills · +36 Speed +16 Power +11 SP (+47 / +21 / +15 at B's bond 80)", plus
"(12 over cap)" when it overflows. The owner sees what C is worth here and in Wit before committing.

### 3.6 Keeping it balanced

**Rough check.** I ran 100 sessions on URA-like bases at T1, starting at 100 a stat, with made-up "median" and "strong"
cards **(guess, for scale only)**. The share of the 6,000 cap budget each deck reaches:

| Deck | Share |
|---|---|
| No cards | 44% |
| One card of each type plus a Friend, unbonded | 55% |
| The same deck, bonded | 67% |
| A strong bonded deck | 80%. Speed and Power capped |
| Five Speed cards and a Wit card | 66%. Speed capped, the overflow wasted |

Rivals sit near 60% ([03](03-racer-today.md) §2): a median bonded deck wins modestly, a strong one comfortably, and
no deck caps all five. The original's formula over a fixed session count lands in the right band unaided.

**The levers:** per-stat caps clamp the strongest stacks (the preview shows overflow); the tree is finite, so play
fills it sooner but never raises the ceiling; the original's stacking limits hold (friendship on its own type only,
five seats, one post a card); the era gate (`card.era ≤ T`) keeps later, stronger cards out of early scenarios; and one
knob, `s(T)`, is set by a `sim:decks` run that reports median, strong and empty decks per scenario and fails when the
bands drift. No new multiplier is needed.

### 3.7 What of today's code stays

| Keep | Change | Retire |
|---|---|---|
| `tiers/scaling.ts`: `capProfileAt`, `capBudgetAt`, `spCapAt` | `CARD_TYPE_SHARES` becomes the facility base table. D180 already took its pairs from the original's facilities | `nodeValue`, `TREE_BUDGET_SHARE`, `HISTORICAL_CARD_NORMALIZATION`, `STAR_NODE_PCT` |
| `eraOf` and the era gate | `eraPct`'s 5-point decay goes. The real numbers' power creep already favours newer cards | Constellation templates and node assignments. The silhouettes could survive as tree art |
| `deriveBuild`'s shape: pure, derived when read, base + growth, clamp to caps, `skillLibrary`, `ownSkillIds`, the `DerivedBuild` contract that `prepare.ts` reads | Its node loop becomes the session formula over posted cards | Extra Stats (`extra.ts`, `extraBudget`) and the lineage and inspiration branches |
| `card-focus.ts`, `cardGoldSkillIds`, `race-skills` | `masterCards` carries the real level-50 values. `cardRaceBonus` reads the real Race Bonus | `skill-points.ts`'s baseline. D132 (Friend and Group pay SP) |

## 4. Skills and aptitudes

### Skills

**SP** comes from sessions (§3.3), Initial Skill Points, mini-game SP and races × Race Bonus. What an Uma can spend in
a scenario stays capped at `spCapAt(T)` (2,000 at T1 to 5,200 at T15): the SP ceiling, as the tree is for stats.

**Her library** is her unique (auto-equipped at Lv 5, as today), her innate, awakening and event skills
(`ownSkillIds`), and every skill a bond track has hinted. As in the original, nothing else can be bought.

**Cost:** `round(costSp × (1 − d))`, with *d* = 0, 10, 20, 30, 35 or 40% for hint levels 0–5. A hint arrives at level
**1 + the card's Hint Levels**; hints for one skill from several cards add up, to 5. A gold still needs its white
(`normalSkillId`), as today.

### Aptitudes

Aptitude points buy one grade step on any of the ten axes (2 surfaces, 4 distances, 4 styles), up to **A**, today's
cap and the grade rivals run at. A step costs **1 point up to C, 2 to B and 3 to A (guess)**. They replace the Lineage
Hall's pink sparks; lineage retires with the Training Hub.

## Open points for the owner

1. **Real card values in the rules**, reversing D54 and D90 (generated values), D125 (training effects deleted) and
   D132. Values live only in the private pack; tests use synthetic cards; the facility base table is a rule constant
   in code, like the cap ladder. **Recommended: yes.**
2. **Card level:** every SSR at level 50 (D329), or limit breaks earned by play? **Recommended: level 50.** Bond is
   already each card's progression; a second one per card would be busywork.
3. **Where cards train:** the owner posts each card (default: its own type), or a fixed rotation from Specialty
   Priority? **Recommended: posting**, allocation by hand and fully previewable. The rotation brings back the
   original's turn-by-turn feel at the cost of a lineup on every pip.
4. **Mood fixed at Great**, so Mood Effect (on about 70% of SSRs) still counts; at Normal it does nothing.
   **Recommended.**
5. **Tree size:** 100 sessions (5 branches × 5 levels × 4 pips) plus two camps, bought by the level row, or 25
   chunkier nodes worth four sessions each? **Recommended: 100**, since the real numbers land in the right band at
   that count (§3.6).
6. **Bond scope:** per Uma per tier, as today, or reset each scenario like the original's career? **Recommended: per
   tier**, so each new scenario's era brings new cards to bond.
