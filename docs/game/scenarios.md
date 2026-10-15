# Scenarios

The game's scenarios are the original's, in Japanese release order: fifteen in three tiers of five, the 15th being
Japan's next. Scenario *s* of tier *t* is the game's scenario **T = 5(*t* − 1) + *s***. Code: `packages/domain/src/
tiers/map.ts` (the tier map), `scenarios.ts` (the scenario list, its release dates and eras), `constellation.ts` (cap
profiles), `tiers/scaling.ts` (cap budgets, SP caps and node values) and `training/buffs.ts` (the buffs).

Each scenario rule is rendered live on the page that owns it:

| What | Where |
|---|---|
| The tier map: each scenario's tier, Racing Levels, cap budget and SP cap | [04](04-tiers-and-promotion.md) §1 |
| Tier 3 and the 15th scenario until it ships | [04](04-tiers-and-promotion.md) §2 |
| Per-stat cap profiles | [04](04-tiers-and-promotion.md) §7 |
| Constellation node values, the Extra Stats term and Extra Stats values by tier | [04](04-tiers-and-promotion.md) §7 |
| Buffs, and the typical values rivals carry | [04](04-tiers-and-promotion.md) §8 |
| The re-authored trees: sizes, per-card caps and silhouettes | [05](05-training-hub.md) §4 |
| What each scenario of a tier adds to a build (its layer) | [05](05-training-hub.md) §3, and the [README](README.md#unlocks-per-scenario-layer-per-uma-per-tier) |
| The dish grades each scenario uses | The [README](README.md#grades-follow-scenarios) |
| Careers per scenario | [03](03-uma-progression.md) §4 |
| Era gating for cards | [06](06-cards-and-bonds.md) §3 |

## Keeping the list current

The scenario list is code (`SCENARIOS` in `scenarios.ts`), not content, so a new release in Japan needs a code change
and its decision. `pnpm data:import` warns when GameTora lists more released scenarios than the code models
(`scripts/data/src/scenario-coverage.ts`), naming none of them: aggregate dates only. Until the 15th is modelled, tier 3
runs four scenarios ([04](04-tiers-and-promotion.md) §2).
