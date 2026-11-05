# Racing

The race itself: what a finish pays in Racing EXP, how a grade's rivals are handicapped, and how they're rolled.
Code: `packages/race` (the engine), `packages/domain/src/progression.ts` (EXP) and `opponents.ts` (rivals), read by the
tier rules in `tiers/racing.ts` and `tiers/rivals.ts`. Design: [racing.md](../design/racing.md).

The rules here are the ones kept from before the rework (D336: the grade handicaps and the rival formula stay exactly
as they were). What the rework added around them lives on its own pages:

| Topic | Page |
|---|---|
| Racing Level 1–50 per tier, its curve, the holds, the gate and the advance | [03](../archive/g2-manual/03-uma-progression.md) §2–§5 |
| Careers and goals in each scenario | [03](../archive/g2-manual/03-uma-progression.md) §4 |
| Prize Money, the Daily Purse, featured races, the result and the race's commit | [09](../archive/g2-manual/09-racing-rewards-and-exchange.md) |
| Rival strength by tier on the re-authored trees, and Expedition difficulty | [04](../archive/g2-manual/04-tiers-and-promotion.md) §7 |
| The Racecourse, race select and the run on screen | [11](11-hub-and-places.md) §3.3, [09](../archive/g2-manual/09-racing-rewards-and-exchange.md) §3.5, §4 and §7 |
| The engine, determinism and the race scene | [Architecture](architecture.md#the-race) |

## Race presentation

**Art (SB6, D373).** Race presentation uses each outfit's bust: the pre-race runner and field, PixiJS runner tokens,
feed, result hero and finishing order. The scene loads only verified `bust` images in runner order, holds them while
playing and falls back to gate numbers if unavailable. Small Uma-selection controls and the shared picker use faces;
only the Town Hall plaza uses chibis. No result, reward, seed, playback timing or race rule changes.

## Rival handicaps

A race's rivals race weaker than a fully trained Uma by their grade's handicap, a share of every stat, so a grade is
equally soft at every tier (D152, D155). G1 is the real test. What a race pays in a career is T154's
(03 · Careers); generation 2's Racing EXP is [archived](../archive/g2-manual/03-uma-progression.md).

<!-- live:rival-handicaps -->
| Grade | Rival handicap |
|---|---|
| Debut | 35% |
| Maiden | 35% |
| Pre-OP | 30% |
| OP | 30% |
| G3 | 25% |
| G2 | 15% |
| G1 | 5% |
<!-- /live -->

## Rivals

Rivals are generated per race (D153, D159). Each style gets a preset built on a realistic set of cards. Stamina is set
first, from what the race's distance needs. Then each stat is rolled within a range of the preset. The tier rules give
the generator the scenario's typical trained Uma on the re-authored trees, with its Extra Stats and its buff's typical
value (`rivalTrainedStat`, [04](../archive/g2-manual/04-tiers-and-promotion.md) §7–§8).

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
