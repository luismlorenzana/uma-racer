# T091 — Pure deterministic RPG combat and skill catalog

**Outcome:** a full five-member battle can be stepped or replayed from frozen inputs, with no renderer or save
dependency. Depends on T089. Read [M028](M028-uma-rpg.md), [RPG design](../design/uma-rpg.md),
[implementation contract](../technical/uma-rpg-implementation.md), [Minigame kit](../design/minigame-kit.md) and
D216–D219.

## Engine deliverables

1. Put reducer, action validation, catalog and replay under `packages/domain/src/rpg/combat/`. Export typed
   `createEncounter`, `applyAction` and `replay`: immutable next state, legality error or ordered render cues, plus
   versioned stable state hash. Input is frozen actor stats/kits, formation, enemy intent policy, content version and
   seed. No React, Pixi, browser clock, network or `Math.random`; animation may skip frames without changing state.
2. Settle and document the **turn contract** before screen work: initiative tie break, ally action opportunities,
   enemy intent reveal/selection, guard interception and target legality, MP deduction, damage/defense order, heal
   cap, status duration/stack/cap, KO handling, victory/loss and boss phase threshold. Item action stays disabled.
   Compare no weakness extra action with a bounded follow-up; do not allow recursive five-actor chains.
3. Publish a machine-readable synthetic skill catalog covering all six weapons and five element motifs. Each
   action declares id, weapon, element/channel, target mask, MP, base/rider calculation, status/support behavior,
   duration, stack policy, intent text and A/B/tree gate. Front Greatsword and both Pace paths are physical; both
   Late paths and End Tome are magical. A physical elemental rider uses ATK/physical defense, not MATK. One action
   has one element; Light/Dark are neutral to the Fire/Ice/Lightning triangle.
4. Add `pnpm sim:rpg:combat` with invented fixed-seed teams for each weapon/element, neutral/weak/resistant target,
   heal/guard/support pressure, KO and a two-phase boss. Report win rate, turns, HP/MP left and status contribution.
   Choose exact coefficients, rounding, follow-up and status order based on this focused sim; update the design,
   append a decision and pin numeric invariants in `packages/domain/src/domain.test.ts` in this PR.

## Replay and acceptance matrix

Same seed+frozen input+actions gives same hash/cues; live stepping equals prefix replay; invalid actor, target, MP,
skill grade or slot leaves state unchanged; intent and phase remain identical after reload. Front magical and End
physical actions fail; physical Fire Greatsword uses ATK and applies advantage only to its rider. A legal five-Pace
party proves no role quota. `pnpm lint`, `pnpm test`, `pnpm build`, the combat sim and fixed replay fixtures pass.
Delete this spec in its PR (D104).

**Out of scope:** persistence, UI, real PriConne rosters and EXP/items. Private enemy kits in T097 use this catalog
shape, not new hidden rules.
