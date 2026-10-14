# Racing

What a race pays, how an Uma levels, and how her rivals are made. Code: `packages/domain/src/progression.ts`,
`opponents.ts`; the engine is `packages/race`. Design: [racing.md](../design/racing.md),
[uma-progression.md](../design/uma-progression.md).

> The rework keeps these rules and the engine (D336: the grade handicaps and the rival formula stay exactly as they are).
> It adds Prize Money to every result and turns Uma Level into Racing Level 1–50 per tier ([rework/03](../rework/03-uma-progression.md),
> [rework/09](../rework/09-racing-rewards-and-exchange.md)).

## Uma Level

Every scenario's levels cost the same (D241). EXP comes only from races.

<!-- live:levels -->
| Level in a scenario | EXP |
|---|---|
| 1 → 2 | 100 |
| 2 → 3 | 125 |
| 3 → 4 | 150 |
| 4 → 5 | 175 |
| 5 → 6 | 200 |
| 6 → 7 | 225 |
| 7 → 8 | 250 |
| 8 → 9 | 275 |
| 9 → 10 | 300 |
| Scenario total | 1,800 |

10 levels a scenario, 140 in all. Each gate level pays 1 Uma Shard.
<!-- /live -->

## What a race pays

A win pays the grade's EXP; 2nd and 3rd pay a share of it. A grade's rivals race weaker than a fully trained Uma by its
handicap, a share of every stat, so a grade is equally soft at every tier (D152, D155). G1 is the real test.

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
first, from what the race's distance needs. Then each stat is rolled within a range of the preset.

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
