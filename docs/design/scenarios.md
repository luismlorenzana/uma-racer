# Scenarios

Every 10 Uma levels is one **scenario tier**, named after the original game's career scenarios
and ordered by their **JP release date**. A scenario sets:

- **Baseline stat caps**: the most training can reach in this scenario, at Training Level 10. At TL1 the cap is 80% of the baseline (see [Training](training.md#training-level-and-caps)).
- **Baseline SP cap**, the skill loadout capacity: `300 + 200 × (T − 1)`, following the same Training Level curve (see [Skills & Inheritance](skills-and-inheritance.md)).
- **Scenario goals** for each Uma (see [Scenario Goals](scenario-goals.md)).
- **Card era**, which support cards (and possibly Umas) are available.
- *(Stretch)* A **scenario modifier**: a light training twist themed on the original scenario.

## Timeline and tiers

Baseline caps follow the **original game's ladder** ✅: its **1200** launch cap at tier 1, rising **80 per scenario** to its current **2000** cap at tier 11, and continuing at +80 after that. As in the original, the part of a stat **above 1200 counts about half** in races and gains half from training.

| # | Global name | JP / alt name | JP release | Global release | Uma Levels | Baseline stat cap |
|---|---|---|---|---|---|---|
| 1 | URA Finale | URA Finals | 2021-02-24 | 2025-06-26 | 1–10 | 1200 |
| 2 | Unity Cup | Aoharu Cup | 2021-08-30 | 2025-11-06 | 11–20 | 1280 |
| 3 | Trackblazer | Make a New Track (Climax) | 2022-02-24 | 2026-03-12 | 21–30 | 1360 |
| 4 | Our Grand Concert | Grand Live | 2022-08-24 | 2026-07-22 | 31–40 | 1440 |
| 5 | Grand Masters | Grand Masters | 2023-02-24 ⚠️ | — | 41–50 | 1520 |
| 6 | Project L'Arc | Project L'Arc | 2023-08-24 ⚠️ | — | 51–60 | 1600 |
| 7 | U.A.F. Ready GO! | U.A.F. Ready GO! | 2024-02-24 ⚠️ | — | 61–70 | 1680 |
| 8 | Great Food Festival | Daihoushokusai | 2024-06-26 | — | 71–80 | 1760 |
| 9 | Run! Mecha Umamusume | Mecha Umamusume | 2024-10-29 | — | 81–90 | 1840 |
| 10 | The Twinkle Legends | The Twinkle Legends | 2025-02-24 ⚠️ | — | 91–100 | 1920 |
| 11 | Design Your Island | Welcome to the Wild / Mujintou | 2025-06-26/27 ⚠️ | — | 101–110 | 2000 |
| 12+ | *Every later JP scenario is included* | *List to research* | — | — | 111+ | +80 each |

⚠️ = taken from search summaries, not the source page itself. Verify these before building the data files.
Rows without ⚠️ were confirmed on GameTora or Game8.

Global release names follow the English version. Global has released only through #4 so far, so
**eras use JP dates** ✅.

## Era windows

A card's era is the **latest scenario released on or before the card's JP release date**:

```
era(card) = max { s.index : s.jpRelease ≤ card.jpRelease }
```

An Uma in tier `T` may equip any card with `era ≤ T`.

## Scenario modifiers (stretch, after MVP)

In the MVP, all scenarios train the same way apart from caps and era. After the MVP, **every scenario gets its modifier**,
added in release order:

| # | Scenario | Modifier idea |
|---|---|---|
| 1 | URA Finale | None, the baseline and tutorial tier |
| 2 | Unity Cup | **Team Spirit:** when 3+ cards are present at one facility, a spirit burst adds bonus gains to every stat |
| 3 | Trackblazer | **Shop:** races pay scenario coins, spent on one-shot training items |
| 4 | Grand Concert | **Performances:** training builds "hype" notes, and full sets unlock bonus stats |
| 5 | Grand Masters | **Goddess fragments:** collect fragments from training, and a full set triggers a big burst |
| 6 | Project L'Arc | **Overseas expedition:** the chance to raise an aptitude grade |
| 7 | U.A.F. | **Sports genres:** facility colors level up, and matching colors give bonuses |
| 8 | Great Food Festival | **Cooking:** training harvests ingredients, and dishes give temporary buffs |
| 9 | Mecha Umamusume | **Research:** gear upgrades act as permanent facility research levels |
| 10 | Twinkle Legends | **Legends:** pick a legend's buff path for the tier |
| 11 | Design Your Island | **Construction:** development points build new facilities during the tier |

## Scenario completion

Reaching the gate level grants **1 Uma Shard** (see [Collection](collection.md)) and completes that tier immediately; no
second EXP bar is required. Promotion atomically freezes the completed snapshot, spends `25 × tier` tickets, applies the
stat/card starting bonuses, refreshes skills, resets Training Level, and starts the next tier. Parent inheritance and
deterministic goals join that same Scenario Start commit. Before promotion, the prior Journey is closed and unfinished
targets become honest misses; final-tier completion does the same before freezing its snapshot. Goals never gate completion.
The resulting facts later support:

- The **Graduate** badge for that scenario, with scenario-specific art.
- The **Honors** badge if every scenario goal was completed (the crest is derived now; the persisted badge arrives in Milestone 6).
- A **Perfect** variant if all five stats reach the scenario's baseline cap (the Training Level 10 cap) before promotion.
- A **Speedrun** variant if she promoted within 15 races of entering the tier.

T015 makes these future facts durable. Immediately before promotion reset/bonuses—or during atomic final completion—it
captures the completed tier's stats, Training Level/counters, equipped card ids/eras, race count, Journey summary, and
frozen lineage. Cap checks use `>=` because permanent stats may already exceed the tier baseline. Graduate/Speedrun can be
reconstructed from existing Journey/race history; old Perfect/Capped/deck facts that were never stored remain untracked.
