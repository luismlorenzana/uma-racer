# Scenarios

Every 10 Uma levels is one **scenario tier**, named after the original game's career scenarios
and ordered by their **JP release date**. A scenario sets:

- **Baseline stat caps**: the most training can reach in this scenario, at Training Level 10. At TL1 the cap is 80% of the baseline (see [Training](training.md#training-level-and-caps)).
- **Baseline SP cap**, the skill loadout capacity: `300 + 200 × (T − 1)`, following the same Training Level curve (see [Skills & Inheritance](skills-and-inheritance.md)).
- **Scenario goals** for each Uma (see [Scenario Goals](scenario-goals.md)).
- **Card era**, which support cards (and possibly Umas) are available.
- A **scenario modifier**: a light, tier-local training twist themed on the original scenario.

## Timeline and tiers

Baseline caps follow the **original game's ladder** ✅: its **1200** launch cap at tier 1, rising **80 per scenario** to its current **2000** cap at tier 11, and continuing at +80 after that. As in the original, the part of a stat **above 1200 counts about half** in races and gains half from training.

| # | Global name | JP / alt name | JP release | Global release | Uma Levels | Baseline stat cap |
|---|---|---|---|---|---|---|
| 1 | URA Finale | URA Finals | 2021-02-24 | 2025-06-26 | 1–10 | 1200 |
| 2 | Unity Cup | Aoharu Cup | 2021-08-30 | 2025-11-06 | 11–20 | 1280 |
| 3 | Trackblazer | Make a New Track (Climax) | 2022-02-24 | 2026-03-12 | 21–30 | 1360 |
| 4 | Our Grand Concert | Grand Live | 2022-08-24 | 2026-07-22 | 31–40 | 1440 |
| 5 | Grand Masters | Grand Masters | 2023-02-24 | — | 41–50 | 1520 |
| 6 | Project L'Arc | Project L'Arc | 2023-08-24 | — | 51–60 | 1600 |
| 7 | U.A.F. Ready GO! | U.A.F. Ready GO! | 2024-02-24 | — | 61–70 | 1680 |
| 8 | Great Food Festival | Daihoushokusai | 2024-06-26 | — | 71–80 | 1760 |
| 9 | Run! Mecha Umamusume | Mecha Umamusume | 2024-10-29 | — | 81–90 | 1840 |
| 10 | The Twinkle Legends | The Twinkle Legends | 2025-02-24 | — | 91–100 | 1920 |
| 11 | Design Your Island | Welcome to the Wild / Mujintou | 2025-06-27 | — | 101–110 | 2000 |
| 12 | Yukoma Hot Springs | ごくらく♪ゆこま温泉郷 | 2025-10-29 | — | 111–120 | 2080 |
| 13 | Beyond Dreams | Beyond Dreams 共に前へ、共に光を | 2026-02-24 | — | 121–130 | 2160 |
| 14 | Tracen Diner | らっしゃい！トレセン軒！ | 2026-06-29 | — | 131–140 | 2240 |
| 15+ | *Every later JP scenario is included* | *Checked against the source each import* | — | — | 141+ | +80 each |

✅ Every date above was verified against the public GameTora scenario dataset on 2026-09-19. Tiers 12–14 are live, so the
Uma level cap is 140 and cards released after Design Your Island fall into their correct eras. The original game raised
its own hard cap to 2500 with Beyond Dreams; ladder A keeps +80 per scenario here, because our caps are tied to the 1200
soft cap (D108). Each private content import compares the released source-scenario count with this ladder and emits an
aggregate-only warning if the source has moved ahead.

Global release names follow the English version. Global has released only through #4 so far, so
**eras use JP dates** ✅.

## Era windows

A card's era is the **latest scenario released on or before the card's JP release date**:

```
era(card) = max { s.index : s.jpRelease ≤ card.jpRelease }
```

An Uma in tier `T` may equip any card with `era ≤ T`.

## Scenario modifiers

Every scenario gets its own modifier in [Milestone 8](../tasks/M008-scenario-identity.md), added in release order.
Modifiers are a training-side twist bound by D109: tier-local resources reset at promotion and never become currency,
caps and Race Form never change, any aptitude grant is capped at A, and every tier remains completable while ignoring its
modifier.

| # | Scenario | Modifier idea |
|---|---|---|
| 1 | URA Finale | None, the baseline and tutorial tier |
| 2 | Unity Cup | **Team Spirit:** 3+ cards at one facility trigger a Spirit Burst: +10 raw gain to all five stats |
| 3 | Trackblazer | **Climax:** eligible race wins grant one opt-in item that multiplies one training's raw stat/SP gains by 1.20 |
| 4 | Grand Concert | **Performances:** collect all five facility notes; the completing training gets +20 raw gain to all stats |
| 5 | Grand Masters | **Goddess fragments:** each training grants one; every eighth training gets a ×1.50 raw stat/SP burst |
| 6 | Project L'Arc | **Expedition:** five training stamps fund one chosen aptitude upgrade, capped at A |
| 7 | U.A.F. | **Sports genres:** facility colors level up, and matching colors give bonuses |
| 8 | Great Food Festival | **Cooking:** training harvests ingredients, and dishes give temporary buffs |
| 9 | Mecha Umamusume | **Research:** gear upgrades act as permanent facility research levels |
| 10 | Twinkle Legends | **Legends:** pick a legend's buff path for the tier |
| 11 | Design Your Island | **Construction:** development points build new facilities during the tier |
| 12 | Yukoma Hot Springs | **Soak:** relaxation builds up, and a full bath makes the next training free and doubled |
| 13 | Beyond Dreams | **Shared light:** training fills a gauge that bursts into the two lowest stats |
| 14 | Tracen Diner | **Orders:** training collects orders, and a served set buffs the next three turns |

### Modifier state and lifecycle

Progression save v4 adds one nullable, versioned `scenarioModifier` field to each Uma. Non-null state is a strict union
whose tier and kind match the active scenario. Scenario Start initializes the destination tier inside its existing atomic
commit; promotion replaces the old state, so tier-local counters and resources never carry forward. Tier 1 and modifiers
not implemented yet use `null`.

An older active save migrates with null state rather than invented progress. Training and racing stay available, while the
UI says that legacy run has no modifier until its next Scenario Start. Unknown future modifier versions are rejected as an
app-version mismatch, not treated as corrupt zero state. Journey keeps the scenario's static modifier identity after
promotion, but does not archive resources or counters.

### Unity Cup — Team Spirit

The deterministic card deal is unchanged. A facility with at least **3 present cards** is marked for a Spirit Burst.
Choosing it adds **10 raw gain to each of Speed, Stamina, Power, Guts, and Wit** after ordinary card/growth calculation and
before rounding, the 1200 soft cap, and scenario/TL caps. SP, hints, Training EXP, card EXP, friendship, and placement are
unchanged. Friend and Group cards count when present. State stores only how many bursts were committed.

### Trackblazer — Climax

A first-place progression-race finish grants **1 Climax item** unless that result closes the tier. It is not account
currency, has no inventory cap, and expires at promotion. On Training, the player may explicitly arm one item; the chosen
facility's ordinary raw stat and SP gains are multiplied by **1.20** before rounding, the soft cap, and caps, then exactly
one item is consumed in the same commit. The deal, Training/card EXP, hints, Race Bonus, Uma EXP, Race Form, and race
simulation remain unchanged. Losses, replays, gate-closing wins, previews, failed writes, and unarmed turns award or spend
nothing.

### Our Grand Concert — Performances

Each committed training collects the note matching its chosen facility: Speed, Stamina, Power, Guts, or Wit. Notes are
unique within the current set, so repeating a facility does not advance the set. A preview marks a new note, a repeated
note, or the completing note without changing state. Collecting all **5 facility notes** completes one Performance on
that same turn, clears the set, and adds **20 raw gain to each of the five stats** after ordinary card/growth calculation
and before rounding, the 1200 soft cap, and scenario/TL caps. SP, Training/card EXP, hints, friendship, placement, and
tickets are unchanged. State stores the currently held unique notes and completed-Performance count.

### Grand Masters — Goddess Fragments

Every committed training grants exactly **1 fragment**, regardless of facility, cards, or result caps. The training that
collects the **eighth fragment** automatically triggers a Goddess Burst: its ordinary raw stat and SP gains are multiplied
by **1.50** before rounding, the stat soft cap, and ordinary caps; the fragment gauge then resets to zero. Hint fallback SP,
Training/card EXP, hints, friendship, placement, and tickets are unchanged. A burst still counts when caps reduce its
applied gain to zero. State stores 0–7 held fragments and the committed burst count.

### Project L'Arc — Expedition

Every committed training adds **1 expedition stamp** until the gauge reaches **5**. A full gauge waits safely while
ordinary Training continues. From the Training modifier panel, the player completes the ready expedition by choosing any
surface, distance, or strategy aptitude below A; one atomic no-ticket action raises that grade by exactly one step, capped
at A, clears the gauge, and records the completion. If every aptitude is already A or S, the only valid completion clears
the gauge without changing an aptitude. The resulting aptitude is permanent and enters races only through the existing
visible aptitude input; the tier-local gauge and counters still expire at promotion. State stores 0–5 stamps, completed
expeditions, and successful aptitude upgrades.

## Scenario completion

Reaching the gate level grants **1 Uma Shard** (see [Collection](collection.md)) and completes that tier immediately; no
second EXP bar is required. Promotion atomically freezes the completed snapshot, spends `25 × tier` tickets, applies the
stat/card starting bonuses, refreshes skills, resets Training Level, and starts the next tier. Parent inheritance and
deterministic goals join that same Scenario Start commit. Before promotion, the prior Journey is closed and unfinished
targets become honest misses; final-tier completion does the same before freezing its snapshot. Goals never gate completion.
The resulting facts now award:

- The **Graduate** badge for that scenario, with scenario-specific art.
- The persisted **Honors** badge if every tracked scenario goal was completed.
- A **Perfect** variant if all five stats reach the scenario's baseline cap (the Training Level 10 cap) before promotion.
- A **Speedrun** variant if she promoted within 15 races of entering the tier.

T015 makes these facts durable. Immediately before promotion reset/bonuses—or during atomic final completion—it
captures the completed tier's stats, Training Level/counters, equipped card ids/eras, race count, Journey summary, and
frozen lineage. Cap checks use `>=` because permanent stats may already exceed the tier baseline. Graduate/Speedrun can be
reconstructed from existing Journey/race history; old Perfect/Capped/deck facts that were never stored remain untracked.
T016 evaluates the snapshot immediately and atomically appends Graduate, Capped, Perfect Form, Speedrun, Era Loyalist,
Fully Trained, Honors, Legacy, and Dynasty flair for every affected local Uma. Scenario Start/completion returns exact new
event ids for one post-commit summary; Back or an idempotent retry cannot earn them twice.
