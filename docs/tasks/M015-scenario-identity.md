# Milestone 15 — Scenario identity

**Outcome:** the fourteen scenarios stop being fourteen numbers. Each has a cap profile you can feel, a
constellation you can recognise at a glance, a crest, and one rule it bends.

Design: [Scenarios](../design/scenarios.md). Replaces the deleted M008, whose scenario modifiers were
training-gain multipliers for a training loop that no longer exists (D120).

## Tasks

| Task | Scope | Owner |
|---|---|---|
| T051 | Scenario crests: import, atlas, and the Stable icon overlays | Claude |
| T052 | Constellation shapes for all 14 scenarios, authored as templates | Claude |
| T053 | Scenario buffs, tiers 1–7 | TBD |
| T054 | Scenario buffs, tiers 8–14 | TBD |
| T055 | Scenario-linked race records: a `tier` on `RaceResultRecord` (D122) | TBD |
| T056 | Training badge criteria for the minigame era | TBD |

## Carried over from M012

Two gaps M012 left open rather than papering over:

- **Races are not yet tier-stamped** (T055). D122 says the Arima Kinen won in Trackblazer and the one won in
  Our Grand Concert are separate accomplishments. Race results are a separate append-only log, so the fix is a
  `tier` field on the record rather than nesting history inside `ScenarioTraining` — which would mean
  restructuring the sync protocol for no gain.
- **Training badges read zero** (T056). Lifetime turns, friendship trainings and Full House counted training
  turns that no longer exist, so their history is explicitly `untracked` rather than silently zero. Spark Match
  runs and constellation milestones are the obvious replacements.

## Crests and overlays (T051)

Each scenario needs an icon-sized crest, imported through the private asset pipeline like every other image
and atlased at 128 px. The Stable's icons view then overlays the Uma's **active scenario** crest top-left and
her **Uma Level** bottom-right ([Collection](../design/collection.md#icon-overlays)).

This is the one place the owner asked for explicitly: at five-up, the icon is the whole tile, so these two
facts have to live on the art.

## Shapes (T052)

Fourteen authored templates — node positions, edges, and the breadth-first unlock order — matching the shapes
and slot counts in [Scenarios](../design/scenarios.md#constellation-shapes). Each is validated at import:
one connected tree rooted at the root node, lineage nodes detached with exactly two grandparents each, and
counts matching the table.

Authoring these by hand in JSON is the job. A generator would produce fourteen trees that look the same,
which defeats the point.

## Buffs (T053, T054)

Draft rules are in [Scenarios](../design/scenarios.md#scenario-buffs); each gets exact numbers and a state
shape when it becomes next. A buff must be deterministic, always visible, and must not introduce RNG, a
second currency, or a hidden race input.

## Definition of done

- Every scenario has a distinct cap profile, constellation shape, crest, and buff.
- The Stable's icons view shows crest and level overlays.
- No buff changes a race outcome except through the stats and skills the constellation already pays.
