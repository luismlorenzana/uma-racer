# Milestone 12 — Constellation foundations

**Outcome:** the training turn is gone and an Uma's stats, skills and aptitudes are **derived** from a
per-scenario constellation. No UI yet beyond what is needed to prove it — this milestone is the engine.

Design: [Constellations](../design/constellations.md) · [Training](../design/training.md) ·
[Scenarios](../design/scenarios.md). Decisions D119–D125.

## What this deletes

This is mostly a deletion, and the deletion is the point. Removed from `packages/domain`, `apps/web`,
`apps/api` and `scripts/sim`:

- `training-turn.ts`, `scenario-modifiers.ts`, `scenario-promotion.ts`'s inheritance half, `inheritance.ts`,
  and every test that pins the gain formula, friendship, crowd bonus, specialty priority or hint rolls.
- `UmaSave.stats`, `skillPoints`, `aptitudes`, `deckCardIds`, `skillLibrary`, `loadoutSkillIds`,
  `trainingsThisScenario`, `currentParents`, `parentSnapshot`, `scenarioModifier`, `trainingLevel`,
  `trainingExp`.
- `CardSave.exp`; card level becomes derived from `limitBreak`.
- The Training screen's turn UI and the deck editor's slot ramp.

Anything that reads a deleted field must be migrated, not shimmed. A field that survives only to keep an old
test green is a field that will be wrong later.

## Tasks

| Task | Scope | Owner |
|---|---|---|
| T042 | Save v5: `scenarios[]` per-Uma, migration from v4, scenario-linked races and milestones | Claude |
| T043 | Constellation engine: templates, node values, budgets, derived stats, the invariance rule | Claude |
| T044 | Skills and aptitudes from nodes; lineage slots against Uma templates | Claude |
| T045 | Remove the turn loop end to end, including `scripts/sim` and the balance harness | Claude |

## Save v5 (T042)

```ts
interface UmaSave {
  schemaVersion: 5
  templateId: string
  level: number            // permanent, races only
  exp: number
  unlockedTier: number     // the active scenario (D121)
  scenarios: ScenarioTraining[]
  lifetimeSkills: SkillHistoryEntry[]
}

interface ScenarioTraining {
  tier: number
  trainingLevel: number    // 1–10
  trainingExp: number
  cardSetIds: string[]     // ≤ 6, era ≤ tier, no duplicate character
  assignments: Record<string, NodeAssignment>
  loadoutSkillIds: string[]
  goals: ScenarioGoal[]
  journey: ScenarioJourney | null
  raceHistory: RaceResult[]   // scenario-linked (D122)
  milestones: ScenarioMilestones
}

type NodeAssignment =
  | { kind: 'card'; cardId: string }
  | { kind: 'stat'; stat: StatKey }
  | { kind: 'lineage'; templateId: string }
```

### Migration from v4

A v4 Uma has one flat run. Migrate it into a **single `ScenarioTraining` at her current tier**:

- `trainingLevel` / `trainingExp` carry over as they are.
- `deckCardIds` become `cardSetIds`, truncated to 6.
- `assignments` starts **empty**. Her stored stats are discarded, because there is no configuration that
  reproduces them and inventing one would be a lie about how she was built.
- `raceHistory` moves in whole; earlier scenarios get no entry, which is honest — those races were never
  recorded per scenario.
- `currentParents`, `parentSnapshot` and `scenarioModifier` are dropped outright.

The migration must state plainly in the UI, once, that existing Umas need their constellations filled in. A
migrated Uma is never blocked from racing.

## Acceptance

- No file in the repo computes a stat from a training turn.
- `deriveStats(save, templates, cards)` is pure, total, and returns the same result for the same input.
- **The invariance test passes**: for every scenario tier, every full assignment of max-LB cards pays exactly
  `treeBudget(T)` raw points, checked across at least 500 generated configurations.
- The aptitude table is pinned: base F with six A/S slots is A; base G with six is B, never A.
- A v4 save loads, races, and shows an honest empty constellation.
- `pnpm lint`, `pnpm test`, `pnpm build` pass; main bundle stays ≤ 180 KB gzip.
