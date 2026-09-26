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

| # | Scenario | Shape | Card | Stat | Total | Card node value |
|---|---|---|---|---|---|---|
| 1 | URA Finale | a single trunk, short branches alternating like a fern | 18 | 6 | 24 | 220 |
| 2 | Unity Cup | three long branches from one stem | 20 | 6 | 26 | 198 |
| 3 | Trackblazer | one long oval track, open at the foot, with side spurs | 17 | 6 | 23 | 233 |
| 4 | Our Grand Concert | five-arm star around a central root | 21 | 6 | 27 | 189 |
| 5 | Grand Masters | twin arcs hanging from one bar, a pendant between them | 25 | 6 | 31 | 164 |
| 6 | Project L'Arc | an arch: a heavy lintel on two legs, the root its keystone | 26 | 6 | 32 | 164 |
| 7 | U.A.F. Ready GO! | three feathered branches, one per sport | 27 | 6 | 33 | 163 |
| 8 | Great Food Festival | wide canopy on a short trunk, rooted below | 27 | 6 | 33 | 169 |
| 9 | Run! Mecha Umamusume | a spine with ribs, their ends dropping like an open lattice | 28 | 6 | 34 | 168 |
| 10 | The Twinkle Legends | seven-point crown on its band, rooted below | 29 | 6 | 35 | 168 |
| 11 | Design Your Island | a central island, spokes out to a ring open at the foot | 30 | 6 | 36 | 167 |
| 12 | Yukoma Hot Springs | a square spiral out from the root | 30 | 6 | 36 | 172 |
| 13 | Beyond Dreams | twin trunks meeting at the root and touching at the foot | 31 | 6 | 37 | 171 |
| 14 | Tracen Diner | a counter with pendants of alternating length | 32 | 6 | 38 | 171 |

Early scenarios have few, chunky card nodes, so each decision is heavy and legible. Every tree has **six stat
nodes** of 40 raw points each (D162); the card nodes carry the rest of the budget ([Constellations](constellations.md#stat-budget)). Each tier also carries the fixed
**2 parent + 4 grandparent** lineage nodes, which pay aptitudes and skills rather than stats.

Each silhouette is drawn on a grid, which keeps every edge straight and uncrossed; see
[Constellations](constellations.md#silhouettes) for the format and how nodes are numbered from it.

## Scenario buffs

A buff is the **one declared way a scenario bends the rules** (D165). Buffs are deterministic, always visible on the
constellation, never random, never secret, and reach a race only through the stats and skill points the tree pays. They
may reward **which cards you bring** and **how many nodes each fills**, but never **which node** a card sits on, so the
placement half of the [invariance rule](constellations.md#the-invariance-rule) holds in every scenario: moving a card
never changes a total.

| # | Scenario | Buff | Rule | Typical |
|---|---|---|---|---|
| 1 | URA Finale | **Foundation** | Stat nodes pay ×1.5 (60 each) | 4.0% |
| 2 | Unity Cup | **Team Spirit** | Each filled lineage slot adds +1% to every card node | 3.7% |
| 3 | Trackblazer | **Climax** | Each career goal won in this scenario adds +2% to every card node, up to +8% | 3.7% |
| 4 | Our Grand Concert | **Performance** | A set with a Speed, Stamina, Power, Guts and Wit card: every card node pays +5% | 2.3% |
| 5 | Grand Masters | **Fragments** | Cards at 4★ or higher pay +8% | 0% |
| 6 | Project L'Arc | **Expedition** | Cards from era 6 or newer pay +5% | 4.6% |
| 7 | U.A.F. Ready GO! | **Genres** | A card type with two or more cards in the set pays +6% on those cards | 2.2% |
| 8 | Great Food Festival | **Cooking** | A card on its full node cap pays +10% on all its nodes | 2.0% |
| 9 | Run! Mecha Umamusume | **Research** | Speed and Power cards pay +10% | 5.5% |
| 10 | The Twinkle Legends | **Legends** | The first parent slot may hold any Uma, owned or not | 0% |
| 11 | Design Your Island | **Construction** | A card on exactly its fair share of nodes pays +8% on all of them | 3.7% |
| 12 | Yukoma Hot Springs | **Soak** | Stamina and Guts cards pay +10% | 2.8% |
| 13 | Beyond Dreams | **Shared Light** | The two lowest stats the tree pays each gain +8% | 1.9% |
| 14 | Tracen Diner | **Orders** | Friend and Group cards also pay a quarter of a node's value as stats, beside their SP | 5.4% |

**Typical** is what a typical trained Uma of the scenario gains, as a share of her tree: six 3★ current-era cards with
one Friend card, about four lineage slots filled, two career goals won. **Rivals carry it** (their `trainedStat`
includes it), so a buff makes you stronger than the field only as far as your build leans into it, and the grade
handicaps keep their meaning. Fragments and Legends have no typical value: a typical set is 3★, and a lineage choice
pays aptitudes and skills, not stats.

Five rules replace drafts that could not work (D165): Trackblazer, Grand Masters and U.A.F. paid by which node a card
sat on; Design Your Island added nodes, which fixed node ids cannot take; Yukoma Hot Springs changed Spark Match,
which is being rebuilt. Buffs are applied in `deriveStats` as a fourth whole percentage, so totals stay exact
(`packages/domain/src/scenario-buffs.ts`).

## Era windows

A card's era is the **latest scenario released on or before the card's JP release date**:

```
era(card) = max { s.index : s.jpRelease ≤ card.jpRelease }
```

A scenario at tier `T` may take any owned card with `era ≤ T` into its card set.

## Scenario completion and unlocking

Reaching the gate Uma Level (10, 20, 30…) grants **1 Uma Shard** and **unlocks the next scenario**. Unlocking
costs `5 × fromTier` training tickets (D148) and is explicit: the player chooses when to move on.

On unlocking, the new scenario opens at Training Level 1 with the baseline nodes, an empty six-card set, fresh
goals, and an empty race record. It **immediately becomes the active scenario** and drives races from then on
(D121). The previous scenario's constellation, card set, races, and milestones are **kept and readable**, and
stop affecting races.

Because achievements are scenario-linked (D122), each scenario carries its own milestone set, and the same
race won in two scenarios is two separate accomplishments. Badges earned in a completed scenario are permanent.
