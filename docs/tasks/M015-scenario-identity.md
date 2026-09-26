# Milestone 15 — Scenario identity

**Outcome:** the fourteen scenarios stop being fourteen numbers. Each has a cap profile you can feel, a
constellation you can recognise at a glance, a crest, and one rule it bends.

Design: [Scenarios](../design/scenarios.md). Replaces the deleted M008, whose scenario modifiers were
training-gain multipliers for a training loop that no longer exists (D120).

## Tasks

| Task | Scope | Owner |
|---|---|---|
| T053 | Scenario buffs, tiers 1–7 | Claude |
| T054 | Scenario buffs, tiers 8–14 | Claude |

Landed on 2026-09-26 and removed under D104: **T051** (the crests were already imported and atlased; the Stable's
icons view now overlays the active scenario's crest and the Uma Level, [Collection](../design/collection.md#icon-overlays)),
**T055** (a race's scenario is the tier of its start level, since a promotion raises both together, so no new record
field was needed, D164) and **T056** (training badges count Spark Match runs, TL10s and full constellations, D164).

## Buffs (T053, T054)

Draft rules are in [Scenarios](../design/scenarios.md#scenario-buffs); each gets exact numbers and a state
shape when it becomes next. A buff must be deterministic, always visible, and must not introduce RNG, a
second currency, or a hidden race input.

## Definition of done

- Every scenario has a distinct cap profile, crest, and buff. (Its constellation shape landed with T052.)
- The Stable's icons view shows crest and level overlays.
- No buff changes a race outcome except through the stats and skills the constellation already pays.
