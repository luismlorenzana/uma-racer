# Scenarios

Every 10 Uma levels unlocks one **scenario tier**, named after the original game's career scenarios and ordered
by their **JP release date**. A scenario is a **complete career run** (D121): its own Training Level, its own
six-card set, its own [constellation](constellations.md), its own goals, races and milestones.

A scenario sets:

- A **cap profile**: five per-stat caps, shaped to that scenario's character.
- A **constellation template**: a shape, a slot count, and the node value that follows from it.
- A **scenario buff**: the one declared way this scenario bends the rules.
- A **career** for each Uma: a G3, two G2s and a G1 set that gate her levels (see [Scenario Careers](scenario-goals.md)).
- A **card era**, deciding which support cards are eligible for its card set.

## Timeline and tiers

| # | Global name | JP / alt name | JP release | Global release | Uma Levels |
|---|---|---|---|---|---|
| 1 | URA Finale | URA Finals | 2021-02-24 | 2025-06-26 | 1–10 |
| 2 | Unity Cup | Aoharu Cup | 2021-08-30 | 2025-11-06 | 11–20 |
| 3 | Trackblazer | Make a New Track (Climax) | 2022-02-24 | 2026-03-12 | 21–30 |
| 4 | Our Grand Concert | Grand Live | 2022-08-24 | 2026-07-22 | 31–40 |
| 5 | Grand Masters | Grand Masters | 2023-02-24 | — | 41–50 |
| 6 | Project L'Arc | Project L'Arc | 2023-08-24 | — | 51–60 |
| 7 | U.A.F. Ready GO! | U.A.F. Ready GO! | 2024-02-24 | — | 61–70 |
| 8 | Great Food Festival | Daihoushokusai | 2024-06-26 | — | 71–80 |
| 9 | Run! Mecha Umamusume | Mecha Umamusume | 2024-10-29 | — | 81–90 |
| 10 | The Twinkle Legends | The Twinkle Legends | 2025-02-24 | — | 91–100 |
| 11 | Design Your Island | Welcome to the Wild / Mujintou | 2025-06-27 | — | 101–110 |
| 12 | Yukoma Hot Springs | ごくらく♪ゆこま温泉郷 | 2025-10-29 | — | 111–120 |
| 13 | Beyond Dreams | Beyond Dreams 共に前へ、共に光を | 2026-02-24 | — | 121–130 |
| 14 | Tracen Diner | らっしゃい！トレセン軒！ | 2026-06-29 | — | 131–140 |

✅ Every date was verified against the public GameTora scenario dataset on 2026-09-19. Global names follow the
English version; Global has released only through #4, so **eras use JP dates** ✅.

## Cap profiles

Each scenario caps the five stats differently, and the five caps sum to that scenario's **cap budget**. This is
how the original game does it, and it is why a scenario is an identity rather than a number: Trackblazer is
where Stamina goes to 1900, Unity Cup is where Wit does.

**Tiers 1–4 are the original game's real values**, verified 2026-09-20 against the public stat-cap tables
(D119). Tiers 5–14 extend the idea on our own ladder, themed on each scenario's focus, with the budget rising
+250 per tier from tier 5 and no single stat above the game's 2000 ceiling.

| # | Scenario | Speed | Stamina | Power | Guts | Wit | Cap budget |
|---|---|---|---|---|---|---|---|
| 1 | URA Finale | 1400 | 1400 | 1400 | 1400 | 1400 | 7000 |
| 2 | Unity Cup | 1300 | 1300 | 1300 | 1300 | **1800** | 7000 |
| 3 | Trackblazer | 1200 | **1900** | 1200 | 1200 | 1500 | 7000 |
| 4 | Our Grand Concert | **1600** | 1300 | 1300 | **1500** | 1300 | 7000 |
| 5 | Grand Masters | 1400 | 1300 | 1500 | 1250 | **1800** | 7250 |
| 6 | Project L'Arc | 1400 | **1900** | 1400 | 1500 | 1300 | 7500 |
| 7 | U.A.F. Ready GO! | 1600 | 1550 | 1600 | 1500 | 1500 | 7750 |
| 8 | Great Food Festival | 1500 | 1700 | 1500 | **1900** | 1400 | 8000 |
| 9 | Run! Mecha Umamusume | 1900 | 1500 | **1950** | 1500 | 1400 | 8250 |
| 10 | The Twinkle Legends | **2000** | 1650 | 1700 | 1550 | 1600 | 8500 |
| 11 | Design Your Island | 1750 | 1750 | 1750 | 1750 | 1750 | 8750 |
| 12 | Yukoma Hot Springs | 1700 | 1900 | 1700 | **2000** | 1700 | 9000 |
| 13 | Beyond Dreams | **2000** | 1750 | 1800 | 1700 | **2000** | 9250 |
| 14 | Tracen Diner | 1850 | 1900 | **2000** | 1950 | 1800 | 9500 |

As in the original game ✅, the part of a stat **above 1200 counts about half in races**. That halving lives in
[Racing](racing.md) now, not in training gains.

## Constellation shapes

The **shape** is the silhouette the nodes are laid out in — the thing that makes a scenario's tree recognisable
at a glance. The **slot count** is how finely that scenario's budget is divided, never how much it pays:

```
treeBudget(T) = round(0.60 × capBudget(T))
nodeValue(T)  = treeBudget(T) / (cardNodes + statNodes)
```

| # | Scenario | Shape | Card | Stat | Total | Node value |
|---|---|---|---|---|---|---|
| 1 | URA Finale | single trunk, short branches | 18 | 3 | 21 | 200 |
| 2 | Unity Cup | three long branches | 20 | 4 | 24 | 175 |
| 3 | Trackblazer | one long track with side spurs | 17 | 3 | 20 | 210 |
| 4 | Our Grand Concert | five-arm star | 21 | 4 | 25 | 168 |
| 5 | Grand Masters | twin arcs | 25 | 4 | 29 | 150 |
| 6 | Project L'Arc | an arch | 26 | 4 | 30 | 150 |
| 7 | U.A.F. Ready GO! | three coloured branches | 27 | 4 | 31 | 150 |
| 8 | Great Food Festival | wide canopy | 27 | 5 | 32 | 150 |
| 9 | Run! Mecha Umamusume | lattice spine | 28 | 5 | 33 | 150 |
| 10 | The Twinkle Legends | seven-point crown | 29 | 5 | 34 | 150 |
| 11 | Design Your Island | island ring | 30 | 5 | 35 | 150 |
| 12 | Yukoma Hot Springs | spiral | 30 | 6 | 36 | 150 |
| 13 | Beyond Dreams | twin trunks meeting | 31 | 6 | 37 | 150 |
| 14 | Tracen Diner | counter with pendants | 32 | 6 | 38 | 150 |

Early scenarios have few, chunky nodes, so each decision is heavy and legible. From tier 5 every node is worth
exactly **150** and the scenario's slot count is the whole progression. Each tier also carries the fixed
**2 parent + 4 grandparent** lineage nodes, which pay aptitudes and skills rather than stats.

## Scenario buffs

A buff is the **one declared way a scenario bends the rules**. Buffs are deterministic, always visible, never
RNG, and never secret. They may change totals — that is the scenario's character — but the
[invariance rule](constellations.md#the-invariance-rule) still holds for stat allocation *within* a scenario.

| # | Scenario | Buff | Draft rule |
|---|---|---|---|
| 1 | URA Finale | **Foundation** | stat nodes pay ×1.25 |
| 2 | Unity Cup | **Team Spirit** | +1% to every card node per distinct character in the card set |
| 3 | Trackblazer | **Climax** | the first card node on each branch pays ×1.5 |
| 4 | Our Grand Concert | **Performance** | if all five stat types appear in the set, every node pays +5% |
| 5 | Grand Masters | **Fragments** | the deepest node on each branch pays ×2 |
| 6 | Project L'Arc | **Expedition** | cards of era ≥ 6 pay ×1.10 |
| 7 | U.A.F. Ready GO! | **Genres** | a branch whose cards share a colour pays +10% |
| 8 | Great Food Festival | **Cooking** | a card on 3+ nodes pays +15% on all of them |
| 9 | Run! Mecha Umamusume | **Research** | each stat node also pays 25% of its value to a second stat you pick |
| 10 | The Twinkle Legends | **Legends** | one lineage slot may hold any Uma template, owned or not |
| 11 | Design Your Island | **Construction** | you choose which two branches receive +3 nodes |
| 12 | Yukoma Hot Springs | **Soak** | Spark Match targets are 25% lower |
| 13 | Beyond Dreams | **Shared light** | the two lowest stats after allocation each gain +8% |
| 14 | Tracen Diner | **Orders** | Friend and Group cards pay SP *and* 50% of a node's value as stats |

Draft rules only. Each buff gets its exact numbers, state shape, and UI in its own task, and none may introduce
RNG, a second currency, or a hidden race stat.

## Era windows

A card's era is the **latest scenario released on or before the card's JP release date**:

```
era(card) = max { s.index : s.jpRelease ≤ card.jpRelease }
```

A scenario at tier `T` may take any owned card with `era ≤ T` into its card set.

## Scenario completion and unlocking

Reaching the gate Uma Level (10, 20, 30…) grants **1 Uma Shard** and **unlocks the next scenario**. Unlocking
costs `25 × tier` training tickets and is explicit: the player chooses when to move on.

On unlocking, the new scenario opens at Training Level 1 with the baseline nodes, an empty six-card set, fresh
goals, and an empty race record. It **immediately becomes the active scenario** and drives races from then on
(D121). The previous scenario's constellation, card set, races, and milestones are **kept and readable**, and
stop affecting races.

Because achievements are scenario-linked (D122), each scenario carries its own milestone set, and the same
race won in two scenarios is two separate accomplishments. Badges earned in a completed scenario are permanent.
