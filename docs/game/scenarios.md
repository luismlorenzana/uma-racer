# Scenarios

Each scenario is a ten-level tier of an Uma's career, in Japanese release order. An Uma trains a constellation per
scenario and races its career there. Code: `packages/domain/src/scenarios.ts`, `constellation.ts`,
`scenario-buffs.ts`. Design: [scenarios.md](../design/scenarios.md), [constellations.md](../design/constellations.md).

> The rework turns these fourteen tiers into three tiers of five scenarios (D327, [rework/04](../rework/04-tiers-and-promotion.md)).
> This page changes when that ships.

## The ladder

The card node count and value size each scenario's constellation; the node value is a share of the cap budget. The
skill point cap is the most SP a build can hold.

<!-- live:scenarios -->
| Tier | Scenario | JP release | Constellation | Card nodes | Node value | SP cap | Buff |
|---|---|---|---|---|---|---|---|
| 1 | URA Finale | 2021-02-24 | single-trunk | 18 | 187 | 2,000 | Foundation |
| 2 | Unity Cup | 2021-08-30 | three-branch | 20 | 176 | 2,400 | Team Spirit |
| 3 | Trackblazer | 2022-02-24 | track-spurs | 17 | 215 | 2,800 | Climax |
| 4 | Our Grand Concert | 2022-08-24 | five-arm-star | 21 | 181 | 3,000 | Performance |
| 5 | Grand Masters | 2023-02-24 | twin-arcs | 25 | 158 | 3,200 | Fragments |
| 6 | Project L'Arc | 2023-08-24 | arch | 26 | 158 | 3,400 | Expedition |
| 7 | U.A.F. Ready GO! | 2024-02-24 | three-colour | 27 | 158 | 3,600 | Genres |
| 8 | Great Food Festival | 2024-06-26 | canopy | 27 | 163 | 3,800 | Cooking |
| 9 | Run! Mecha Umamusume | 2024-10-29 | lattice-spine | 28 | 163 | 4,000 | Research |
| 10 | The Twinkle Legends | 2025-02-24 | crown | 29 | 162 | 4,200 | Legends |
| 11 | Design Your Island | 2025-06-27 | island-ring | 30 | 162 | 4,400 | Construction |
| 12 | Yukoma Hot Springs | 2025-10-29 | spiral | 30 | 167 | 4,600 | Soak |
| 13 | Beyond Dreams | 2026-02-24 | twin-trunks | 31 | 166 | 4,800 | Shared Light |
| 14 | Tracen Diner | 2026-06-29 | counter | 32 | 166 | 5,000 | Orders |
<!-- /live -->

## Cap profiles

Per-stat caps. URA Finale caps every stat at 1,200; each later scenario adds 250: 100 to Speed, 100 to a main stat and
50 to a sub stat, round-robin through Stamina, Power, Guts and Wit.

<!-- live:caps -->
| Tier | Scenario | Speed | Stamina | Power | Guts | Wit | Budget |
|---|---|---|---|---|---|---|---|
| 1 | URA Finale | 1,200 | 1,200 | 1,200 | 1,200 | 1,200 | 6,000 |
| 2 | Unity Cup | 1,300 | 1,300 | 1,250 | 1,200 | 1,200 | 6,250 |
| 3 | Trackblazer | 1,400 | 1,300 | 1,350 | 1,250 | 1,200 | 6,500 |
| 4 | Our Grand Concert | 1,500 | 1,300 | 1,350 | 1,350 | 1,250 | 6,750 |
| 5 | Grand Masters | 1,600 | 1,350 | 1,350 | 1,350 | 1,350 | 7,000 |
| 6 | Project L'Arc | 1,700 | 1,450 | 1,400 | 1,350 | 1,350 | 7,250 |
| 7 | U.A.F. Ready GO! | 1,800 | 1,450 | 1,500 | 1,400 | 1,350 | 7,500 |
| 8 | Great Food Festival | 1,900 | 1,450 | 1,500 | 1,500 | 1,400 | 7,750 |
| 9 | Run! Mecha Umamusume | 2,000 | 1,500 | 1,500 | 1,500 | 1,500 | 8,000 |
| 10 | The Twinkle Legends | 2,100 | 1,600 | 1,550 | 1,500 | 1,500 | 8,250 |
| 11 | Design Your Island | 2,200 | 1,600 | 1,650 | 1,550 | 1,500 | 8,500 |
| 12 | Yukoma Hot Springs | 2,300 | 1,600 | 1,650 | 1,650 | 1,550 | 8,750 |
| 13 | Beyond Dreams | 2,400 | 1,650 | 1,650 | 1,650 | 1,650 | 9,000 |
| 14 | Tracen Diner | 2,500 | 1,750 | 1,700 | 1,650 | 1,650 | 9,250 |
<!-- /live -->

## Buffs

Each scenario bends its constellation's rules one declared way (D165). A buff reaches a race only through the stats and
skill points the tree pays. "Typical gain" is what a typical trained Uma of the scenario gets from it, as a share of her
tree's stats; rivals carry it too.

<!-- live:buffs -->
| Scenario | Buff | Rule | Typical gain |
|---|---|---|---|
| URA Finale | Foundation | Extra stats pay ×1.5. | 4% |
| Unity Cup | Team Spirit | Each filled lineage slot adds +1% to every card node. | 3.7% |
| Trackblazer | Climax | Each career goal won in this scenario adds +2% to every card node, up to +8%. | 3.7% |
| Our Grand Concert | Performance | A set with a Speed, Stamina, Power, Guts and Wit card: every card node pays +5%. | 2.3% |
| Grand Masters | Fragments | Cards at 3★ pay +8%. | 0% |
| Project L'Arc | Expedition | Cards from era 6 or newer pay +5%. | 4.6% |
| U.A.F. Ready GO! | Genres | A card type with two or more cards in the set pays +6% on those cards. | 2.2% |
| Great Food Festival | Cooking | A card on its full node cap pays +10% on all its nodes. | 2% |
| Run! Mecha Umamusume | Research | Speed and Power cards pay +10%. | 5.5% |
| The Twinkle Legends | Legends | The first parent slot may hold any Uma, owned or not. | 0% |
| Design Your Island | Construction | A card on exactly its fair share of nodes pays +8% on all of them. | 3.7% |
| Yukoma Hot Springs | Soak | Stamina and Guts cards pay +10%. | 2.8% |
| Beyond Dreams | Shared Light | Your two lowest stats from the tree each gain +8%. | 1.9% |
| Tracen Diner | Orders | Friend and Group cards also pay a quarter of a node's value as stats, beside their SP. | 5.4% |
<!-- /live -->
