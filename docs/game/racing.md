# Racing

The race itself: what a finish pays in Racing EXP, how a grade's rivals are handicapped, and how they're rolled.
Code: `packages/race` (the engine), `packages/domain/src/progression.ts` (EXP) and `opponents.ts` (rivals), read by the
tier rules in `tiers/racing.ts` and `tiers/rivals.ts`. Design: [racing.md](../design/racing.md).

The rules here are the ones kept from before the rework (D336: the grade handicaps and the rival formula stay exactly
as they were). What the rework added around them lives on its own pages:

| Topic | Page |
|---|---|
| Racing Level 1–50 per tier, its curve, the holds, the gate and the advance | [03](03-uma-progression.md) §2–§5 |
| Careers and goals in each scenario | [03](03-uma-progression.md) §4 |
| Prize Money, the Daily Purse, featured races, the result and the race's commit | [09](09-racing-rewards-and-exchange.md) |
| Rival strength by tier on the re-authored trees, and Expedition difficulty | [04](04-tiers-and-promotion.md) §7 |
| The Racecourse, race select and the run on screen | [11](11-hub-and-places.md) §3.3, [09](09-racing-rewards-and-exchange.md) §3.5, §4 and §7 |
| The engine, determinism and the race scene | [Architecture](architecture.md#the-race) |

## What a finish pays

A win pays the grade's EXP × (1 + Σ Race Bonus) over the cards in the race's preset, every card at its full Race Bonus
(D329); 2nd and 3rd pay a quarter of the win, and 4th or worse nothing ([03](03-uma-progression.md) §2). A grade's
rivals race weaker than a fully trained Uma by its handicap, a share of every stat, so a grade is equally soft at every
tier (D152, D155). G1 is the real test.

<!-- live:race-rewards -->
| Grade | Win EXP | 2nd or 3rd | Rival handicap |
|---|---|---|---|
| Debut | 40 | 10 | 35% |
| Maiden | 40 | 10 | 35% |
| Pre-OP | 60 | 15 | 30% |
| OP | 60 | 15 | 30% |
| G3 | 80 | 20 | 25% |
| G2 | 110 | 28 | 15% |
| G1 | 150 | 38 | 5% |
<!-- /live -->

## Rivals

Rivals are generated per race (D153, D159). Each style gets a preset built on a realistic set of cards. Stamina is set
first, from what the race's distance needs. Then each stat is rolled within a range of the preset. The tier rules give
the generator the scenario's typical trained Uma on the re-authored trees, with its Extra Stats and its buff's typical
value (`rivalTrainedStat`, [04](04-tiers-and-promotion.md) §7–§8).

<!-- live:rivals -->
| Rule | Value |
|---|---|
| Rivals per running style | 2–5 |
| Each rolled stat | 80%–100% of her style's preset |
| Skills per rival | 3–7 |
| Stamina reference, sprint | 1,400 m |
| Stamina reference, mile | 1,800 m |
| Stamina reference, medium | 2,400 m |
| Stamina reference, long | 3,200 m |
<!-- /live -->
