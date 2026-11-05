# Scenarios

The game's scenarios are the original's, in Japanese release order: fifteen in three tiers of five, the 15th being
Goshiki Shuntaisai (JP 2026-10-26, D381). Scenario *s* of tier *t* is the game's scenario **T = 5(*t* − 1) + *s***.
Code: `packages/domain/src/tiers/map.ts` (the tier map), `scenarios.ts` (the scenario list, its release dates and
eras) and `tiers/scaling.ts` (the caps and SP caps). Every mechanic is open in every scenario (D380); scenario buffs
retired with generation 2's trees (D381).

Each scenario rule is rendered live on the page that owns it:

| What | Where |
|---|---|
| The tier map: each scenario's tier, cap budget and SP cap | [04](04-tiers-and-scenarios.md) §1 |
| Per-stat caps | [04](04-tiers-and-scenarios.md) §2 |
| Era gating for cards | [04](04-tiers-and-scenarios.md) §3 |
| Careers per scenario | 03 · Careers (T154) |

## Keeping the list current

The scenario list is code (`SCENARIOS` in `scenarios.ts`), not content, so a new release in Japan needs a code change
and its decision. The pure master adapter's `scenarioCoverage` compares release dates when given today's date,
naming none of them: aggregate dates only (SE1). All fifteen are modelled since D381.
