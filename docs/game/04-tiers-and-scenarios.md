# 04 · Tiers and scenarios

> **Status: as released (M036, D388; D380, D381, D383).** The tier map, the caps, careers by scenario and the rivals
> by scenario are live. URA Finale is the only scenario open for careers, and **promotion arrives with release 4**
> ([the roadmap](../research/drawing-board/README.md#7-the-roadmap)). The old game's page is
> [archived](../archive/g2-manual/04-tiers-and-promotion.md).

## 1. The tier map

The game keeps the original's fifteen scenarios in JP release order, three tiers of five. Scenario *s* of tier *t* is
the game's scenario **T = 5(*t* − 1) + *s***. Every mechanic is open in every scenario (D380). Scenarios differ by
these things:
- their caps;
- an Uma's objectives;
- the rivals;
- the card era, since a card released after a scenario can't be used in it;
- the finale;
- themed stages.

<!-- live:tier-map -->
| Tier | *s* | T | Scenario | JP release | Cap budget | SP cap |
|---|---|---|---|---|---|---|
| **1** | 1 | 1 | URA Finale | 2021-02-24 | 6,000 | 2,000 |
| | 2 | 2 | Unity Cup | 2021-08-30 | 6,250 | 2,400 |
| | 3 | 3 | Trackblazer | 2022-02-24 | 6,500 | 2,800 |
| | 4 | 4 | Our Grand Concert | 2022-08-24 | 6,750 | 3,000 |
| | 5 | 5 | Grand Masters | 2023-02-24 | 7,000 | 3,200 |
| **2** | 1 | 6 | Project L'Arc | 2023-08-24 | 7,250 | 3,400 |
| | 2 | 7 | U.A.F. Ready GO! | 2024-02-24 | 7,500 | 3,600 |
| | 3 | 8 | Great Food Festival | 2024-06-26 | 7,750 | 3,800 |
| | 4 | 9 | Run! Mecha Umamusume | 2024-10-29 | 8,000 | 4,000 |
| | 5 | 10 | The Twinkle Legends | 2025-02-24 | 8,250 | 4,200 |
| **3** | 1 | 11 | Design Your Island | 2025-06-27 | 8,500 | 4,400 |
| | 2 | 12 | Yukoma Hot Springs | 2025-10-29 | 8,750 | 4,600 |
| | 3 | 13 | Beyond Dreams | 2026-02-24 | 9,000 | 4,800 |
| | 4 | 14 | Tracen Diner | 2026-06-29 | 9,250 | 5,000 |
| | 5 | 15 | Goshiki Shuntaisai | 2026-10-26 | 9,500 | 5,200 |
<!-- /live -->

- **The 15th is Goshiki Shuntaisai,** released in Japan on 2026-10-26 (D381). It fills the slot that waited for
  "Japan's next".
- **The SP cap** is what a career can spend on skills ([05](05-the-build.md) §8).

## 2. Caps

URA Finale caps every stat at 1,200. Each later scenario adds 250 to the budget: 100 to Speed, 100 to a main stat and
50 to a sub stat, round-robin through Stamina, Power, Guts and Wit (D244). An Uma's stats in a career never pass her
scenario's caps.

<!-- live:tier-caps -->
| T | Scenario | Speed | Stamina | Power | Guts | Wit | Budget |
|---|---|---|---|---|---|---|---|
| 1 | URA Finale | 1200 | 1200 | 1200 | 1200 | 1200 | 6000 |
| 2 | Unity Cup | 1300 | 1300 | 1250 | 1200 | 1200 | 6250 |
| 3 | Trackblazer | 1400 | 1300 | 1350 | 1250 | 1200 | 6500 |
| 4 | Our Grand Concert | 1500 | 1300 | 1350 | 1350 | 1250 | 6750 |
| 5 | Grand Masters | 1600 | 1350 | 1350 | 1350 | 1350 | 7000 |
| 6 | Project L'Arc | 1700 | 1450 | 1400 | 1350 | 1350 | 7250 |
| 7 | U.A.F. Ready GO! | 1800 | 1450 | 1500 | 1400 | 1350 | 7500 |
| 8 | Great Food Festival | 1900 | 1450 | 1500 | 1500 | 1400 | 7750 |
| 9 | Run! Mecha Umamusume | 2000 | 1500 | 1500 | 1500 | 1500 | 8000 |
| 10 | The Twinkle Legends | 2100 | 1600 | 1550 | 1500 | 1500 | 8250 |
| 11 | Design Your Island | 2200 | 1600 | 1650 | 1550 | 1500 | 8500 |
| 12 | Yukoma Hot Springs | 2300 | 1600 | 1650 | 1650 | 1550 | 8750 |
| 13 | Beyond Dreams | 2400 | 1650 | 1650 | 1650 | 1650 | 9000 |
| 14 | Tracen Diner | 2500 | 1750 | 1700 | 1650 | 1650 | 9250 |
| 15 | Goshiki Shuntaisai | 2600 | 1750 | 1800 | 1700 | 1650 | 9500 |
<!-- /live -->

## 3. Card eras

A card's era is the latest scenario released on or before its JP release date (`eraOf`). A career in scenario T uses
only cards of era T or older, and a card unlocks only once a scenario of its era or later is open (`cardEraOpen`,
D392): today, era 1. Opening a scenario opens its era's cards in the Card Library ([02](02-unlocks.md) §4).

## 4. Careers by scenario

An Uma's career is one scenario's ([03](03-careers.md)). Every scenario shares the career's shape: twelve seasons of
Play, Upgrade and Race, then the scenario's finale. What changes with T is the scenario's caps, the cards its era
allows, the objectives (the career generator rotates its race sets and families by T) and the rivals (§5).

- **Open in this release: URA Finale (T = 1),** one career per Uma, ending in the URA Finals. A career in any other
  scenario refuses until that scenario's release opens it, along with its session scale ([05](05-the-build.md) §4) and
  its finale.
- **Promotion** between tiers (an Uma moving on to the next scenario with what she has built) is **release 4**.

## 5. Rivals by scenario

A race's rivals are built on the **typical trained Uma** of its scenario, less the race grade's handicap
([Racing](racing.md#rivals)). URA Finale's is measured on this generation's build: the typical career's average stat
at its Finale (`sim:careers`, D383), and a career's fields scale with its calendar. The later scenarios keep generation
2's frozen values until their careers open and their own sims measure them. A scenario's field is never stronger than
a later one's (D191).

<!-- live:tier-rivals -->
| T | Scenario | Typical trained stat | Field stat (D191) | From |
|---|---|---|---|---|
| 1 | URA Finale | 559 | 559 | `sim:careers` (D383) |
| 2 | Unity Cup | 664.8 | 664.8 | generation 2, frozen (D381) |
| 3 | Trackblazer | 683.5 | 683.5 | generation 2, frozen (D381) |
| 4 | Our Grand Concert | 707.9 | 707.9 | generation 2, frozen (D381) |
| 5 | Grand Masters | 728.5 | 728.5 | generation 2, frozen (D381) |
| 6 | Project L'Arc | 763.3 | 763.3 | generation 2, frozen (D381) |
| 7 | U.A.F. Ready GO! | 777.6 | 777.6 | generation 2, frozen (D381) |
| 8 | Great Food Festival | 815.3 | 815.3 | generation 2, frozen (D381) |
| 9 | Run! Mecha Umamusume | 854.7 | 839.6 | generation 2, frozen (D381) |
| 10 | The Twinkle Legends | 839.6 | 839.6 | generation 2, frozen (D381) |
| 11 | Design Your Island | 853 | 853 | generation 2, frozen (D381) |
| 12 | Yukoma Hot Springs | 881.1 | 881.1 | generation 2, frozen (D381) |
| 13 | Beyond Dreams | 886 | 886 | generation 2, frozen (D381) |
| 14 | Tracen Diner | 969.3 | 969.3 | generation 2, frozen (D381) |
| 15 | Goshiki Shuntaisai | 969.3 | 969.3 | generation 2, frozen (D381) |
<!-- /live -->
