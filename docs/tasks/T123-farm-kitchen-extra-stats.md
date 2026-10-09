# T123 — Shared meal-funded Extra Stats, four builds and race integration

**M031 · after T122 merges · release off.** Read AGENTS/README/index, [M031](M031-farm-kitchen-rework.md),
[design §§9–11,13,16](../design/farm-kitchen-rework.md), [technical §§3–5,8](../technical/farm-kitchen-implementation.md),
current Constellations/reconfiguration, scenario/preset helpers, ExtraStatsScreen/runtime purchase paths,
deriveStats, race input/snapshot builders and actual T118–T121 types. D252–D255 preset/global-card rules stay.

## Goal and fixed choices

Make real meals buy a named node for one outfit/block, make the player configure each actual scenario/distance
independently, and make new race stats read that acknowledged configuration. A gorgeous map disconnected from
the save/race loop does not satisfy this task. All changes select the dormant active-generation path; existing
normal-account 20-node/crop builds remain unchanged until T124.

- 65 named nodes: 50 pure, all 10 pairs, 5 central Suns. No adjacency/CL/unlock-order gate; one matching meal/node.
- Bought IDs shared across the outfit's five-scenario block. Active IDs separate for each real scenario and
  Sprint/Mile/Medium/Long. No cross-outfit unlock or repeated purchase for another distance/scenario.
- 20 total/node, scenario capacity 18+2×(index−1), existing final caps/cards/SP/buffs outside Farm retained.
- Farm flat vector after base/card growth and before final cap/round, no Foundation/growth/Shared Light
  multiplier on Farm. Pin historical 240 normalization separately so a larger Farm pool cannot shrink cards.
- New units have empty active lists; shared bought nodes are available immediately, but no automatic copy/
  activation. New blocks start unbought; old blocks remain valid. No automatic scenario creation/promotion.

## Implementation contract

1. Add one canonical domain/runtime projection boundary joining `farmExtra` by outfit/block plus actual unit/
   distance. Extend narrow store selectors/cloud adoption/route models to carry these independent rows, without
   forcing new IDs into Uma's old Extra fields. Missing new row is empty; corrupt generation/template is visible
   recovery. Legacy fields stay zero after reset and legacy reducers/evidence never populate new maps.
2. Adapt domain derive/pre-cap output with the new optional Farm input/path, guarded by the caller's active
   generation. With no new Farm path, keep old deriveStats byte-for-byte. With new Farm, legacy Extra contributes 0;
   card-node value/era/stars/share/buff/growth stays exact, then Farm is added once, final rounding/caps once.
   Use T118 vectors; do not add Farm to an already-capped card result or let Farm alter Shared Light's card ranking.
3. Route every applicable reader through the same projection: Training/Profile stats, Extra detail/preview,
   pre-race and saved new race input, scenario views, scenario start/promotion parent snapshots and relevant
   diagnostic/stat comparisons. Actual race distance selects its preset even if another tab is active. Historical
   snapshots/raceResults/replays retain their frozen values. Do not rewrite the race engine/version.
4. Purchase calls T121 `buyNode` with explicit outfit/unit/block/node and selected distance/autoactivate intent.
   Re-read real target scenario/stock/map in the semantic transaction, debit one matching meal, purchase once.
   Optional autoactivate only when canonical capacity remains; otherwise buy/idle. If stale capacity/economics
   invalidate the confirmed preview, show new state and require confirmation, not hidden alternative spending.
5. Set-active is free, target-specific and atomic. Enforce only bought/unique template IDs/capacity, preserve
   all other scenarios/presets and inventory, reuse operation/expected revisions. No unannounced trimming of
   another build or reset of goals/racing level/CL. Pending activation/purchase is clearly Preview/Pending;
   only acknowledged map state feeds races/snapshots. Existing acknowledged builds work offline.
6. Existing Extra route shows five clusters with pair bridges and central Sun. Use a readable DOM/SVG topology
   and original stat glyphs, not a65-dot canvas as the only control. Provide accessible list mode/groups/search
   where needed, 44 pt node-detail sheet actions, no misleading prerequisite edges, safe areas/Back to Training.
   Map can use explicit zoom/details; no full-page pan trapping vertical navigation.
7. Header/summary names outfit, actual scenario, selected distance, block range, bought count, active capacity,
   source totals and meal stock. Detail names node/vector, Bought/Active, exact cost/block recipe link, marginal
   capped gains and waste. Purchase/activation are distinct actions; display +0 when a stat is capped honestly.
   Link missing meal to Farm's matching recipe/wishlist without switching the featured Uma/global Farm worker.
8. Disable legacy crop purchase/time-shift hooks on active generation and migrate old Extra deep links to the
   new contextual map. Do not merge Constellation/Inspiration pages or make CL unlock Farm nodes. Card/lineage
   skill/badge facts remain unchanged; a bought Farm node is not a filled card node or race achievement.

## Mandatory tests

| Area | Acceptance cases |
|---|---|
| Purchases | Each of 65 nodes first/out-of-order, signature match, no meal/wrong block, repeat same/different op IDs, same node bought from another scenario/preset, same meal raced by two devices, stale preview |
| Builds | All 14 scenarios/four distances, cap full/empty, bought but idle, dual/Sun vectors, independence/cross-outfit rejection, new-unit empty and new-block empty/old-block retained |
| Derivation | Exact card-only old/new equality over 14 tiers/0–3 stars/eras/growth/scenario buffs; Foundation Farm unscaled, Shared Light unaffected by Farm, zero legacy double count, round-before/after/cap-order tests |
| Race wiring | Select Sprint UI but race Long and vice versa, dirty pending Farm preview not used, canonical update/reload/cloud adoption, existing frozen race input/hash/result unchanged, mid-race edit locks |
| Integration | Real isolated host raw→process→cook→global Items→purchase→activate→runtime/pre-race stat delta; rejected/uncertain purchase pays/changes no canonical stats; actual matched receipt names |
| Regression | CL/card sets/stars/SP/skills/Inspiration/aptitudes/goals/career progress/badge facts unchanged; no old evidence rehydrates new map after reset; unknown future template recovery |

Update/run `sim:farm:stats` across the live joined derivation instead of only an isolated helper. Continue
`sim:constellation`, `sim:careers` and relevant race balance; retain old-path invariance while documenting the
new independent Farm allowance. Report remaining weak-stat gaps/cap waste, not blanket max-stat success.
If a card/base/race change is needed to meet directional examples, report a separate proposal; never sneak it in.

## Browser proof, docs and done

Extend isolated synthetic 390 × 844/375 × 667 proof with map/list, pure/pair/Sun details, insufficient stock, Bought/
Active/off states, full capacity/waste, all four preset tabs, recipe return link and matched real pre-race deltas.
Screenshots/README in the existing Farm proof folder contain no owner save/private images. Check label/keyboard/
focus/reduced motion and portrait fit; do not claim physical-device acceptance.

Lint/test/build and all relevant Farm/constellation/career/race/Puzzle/RPG regressions pass. Startup ≤ 180 KB gzip;
report Farm and Extra lazy chunks. Update design §§9–10, Constellations' planned active-generation formulas and
technical §8/architecture with the actual joined API, append decision, index/M031 and delete this spec under
D104. New activation capability remains false; legacy docs explicitly stay current until T124.

No live reset/release, unrelated card/base stat tuning, cap changes, engine coefficients, CL/Inspiration/RPG/
Puzzle rework, external content/infra, copied art or manual account edits.
