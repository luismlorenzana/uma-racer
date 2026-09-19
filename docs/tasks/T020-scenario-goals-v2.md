# T020 — Scenario goals v2: career and sex identity (Milestone 7, part 2)

**Outcome:** the Identity goal finally means what it was designed to mean (D23). An Uma re-runs her real horse's career,
a colt chases the Triple Crown and a filly the Triple Tiara, and from tier 7 the slot asks for a whole set inside one
scenario. Read [Scenario Goals](../design/scenario-goals.md) first — it is the contract; this spec only says how to get
there.

## Why this is needed

Goal plan v1 ships an Identity slot that scores career-objective families by aptitude and picks one. `realHorseSex` is
imported and then used nowhere, no decision superseded D23, and one design doc still promised the rule. Goals are also
always single races, so "win the Triple Crown this scenario" was unreachable. D106 restores the rule.

## Fixed choices

- `SCENARIO_GOAL_VERSION = 2`. v1 plans are never rerolled in place unless the whole active plan is untouched.
- Selection stays pure and deterministic: no engine RNG, wall clock, or input iteration order.
- Goals still pay nothing and still gate nothing.
- Series legs come from the private mappings defined by [Badges](../design/badges.md#4-titles-and-g1-trophies). With no
  published coverage, series goals degrade to single-race identity goals and nothing errors.
- Aptitude and Challenge keep their current rules, plus the famous-race tie-break.

## Implementation contract

### Selection

1. **Identity, tiers 1–6.** Walk `UmaTemplate.signatureRaceFamilyIds` in career order. Take the first family that has a
   retained race, was not used by an earlier tracked tier of this Uma, and whose saved surface *and* distance aptitudes
   are B or better. The frozen target is that family's race chosen by the existing deterministic rule (lowest race id,
   rotated by the stable hash of Uma id, tier, and slot).
2. **Sex fallback.** When step 1 finds nothing, take the next unused leg of `realHorseSex`'s classic set —
   `triple-crown` for male, `triple-tiara` for female — under the same B-or-better check.
3. **Aptitude fallback.** When neither applies (no sex, no coverage, nothing eligible), use the ordinary aptitude pool at
   the tier's requested grade. The slot is never empty.
4. **Identity, tier 7+.** A series goal over the rotation in the design doc (classic → spring → autumn → grand prix →
   sprint → mile → dirt, repeating). Skip a set unless every leg is B or better; when none qualifies, take the set with
   the lowest summed aptitude score. One race per leg is frozen at Scenario Start, in the set's documented leg order.
5. **Aptitude/Challenge tie-break.** Among equally scored candidates, a race whose family carries any series tag sorts
   first; then race id; then the existing rotation. Slots still exclude races taken by earlier slots, and a series goal
   excludes all of its legs.

### Save shape

Bump `SAVE_SCHEMA_VERSION` to 3 with a one-way migration modelled on the existing v1→v2 path (`parseLegacyUmaSaveV2`,
`migrateUmaSaveV2`), including the `apps/api/src/save/save.types.ts` mirror and its tests.

```text
ScenarioGoal {
  id, slot, kind: 'win' | 'win-by-margin' | 'win-series',
  raceId: string | null,                 // single-race goals only
  series: {                              // 'win-series' only
    tag: FlairSeriesTag,
    legs: [{ key, raceId, status, completedRaceResultId, completedAt }]
  } | null,
  minimumMarginLengths, status, completedRaceResultId, completedAt
}
```

- Parsing stays exact-key strict: `win`/`win-by-margin` require `raceId` and `series: null`; `win-series` requires
  `series` with 2–3 legs, distinct leg keys, distinct race ids, and `raceId: null`. The margin rule is unchanged
  (challenge = `win-by-margin` at exactly 5).
- A migrated v2 goal becomes `{ kind: 'win' | 'win-by-margin', raceId, series: null }` with every other field preserved.
- The three goals of a tier must still be distinct; a series goal's legs must not repeat another slot's race id.

### Completion

- Leg completion is evaluated inside the existing atomic race transaction, on the same authoritative first-place result
  as today, and only for the exact frozen race id, the exact Uma, and the active tier. Winning a different alias of the
  same race does not count.
- The series goal completes when its last leg completes; that result id is the goal's `completedRaceResultId`. Earlier
  legs keep their own result ids.
- `completedGoalIds` semantics are unchanged: a retry returns stored ids without re-awarding, and a mismatch on the same
  id is corruption. Only completing the final leg emits the Goal Ribbon.
- Promotion marks a partially won series goal **missed** while keeping its won legs visible.

### Migration

At badge-independent save bootstrap, in one transaction: for every local Uma whose `goalPlanVersion` is 1 and whose
active Journey has all three goals `active` with no completions and no misses, regenerate that tier's plan under v2 and
set `goalPlanVersion = 2`. Any Journey with a completion or a miss is left exactly as it is, and closed Journeys are
never touched. The migration writes one aggregate diagnostic line, invents nothing, and is idempotent.

### Presentation

- Home tracker and the Journey medallion show one pip per leg for a series goal, and name the set.
- Race Select pins **every unwon leg** of an active series goal, keeps ribbons deduplicated, and keeps Goals-only
  filtering honest.
- Pre-race says which leg of which set is at stake; Results reveals one ribbon when the set finishes.
- Add the promised **real-horse sex filter** to the Stable ([Collection](../design/collection.md#uma-album)); Umas with no
  recorded sex are reachable under an explicit "Unknown" option.

## Tests

Synthetic fixtures only:

- Career order drives tiers 1–6; a used family, a missing race, and an off-aptitude family are each skipped.
- Male with no usable career takes Satsuki Sho → Derby → Kikuka; female takes Oka Sho → Oaks → Shuka Sho; `null` sex
  falls through to the aptitude pool.
- Tier 7+ produces the documented rotation, skips a set that fails the aptitude check, and freezes one race per leg.
- Series completion needs every leg inside one tier; a leg won in another tier, by another Uma, or as another alias does
  not count; partial sets become one missed goal that keeps its leg history.
- Parser rejects: `win` with `series`, `win-series` with `raceId`, duplicate leg keys, duplicate leg race ids, a one-leg
  set, a leg race also used by another slot.
- v2 → v3 migration round-trips every existing goal, and the v1 → v2 plan migration regenerates only untouched active
  plans.
- `domain.test.ts` pins the escalation table, the rotation order, and the 5-length challenge.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass, and the API save tests accept v3 while rejecting malformed goals.
- With the dev content packs: a female Uma's tier-1 identity goal is a race from her own career, and a tier-7 Uma is
  asked for a full set with one pip per leg.
- The design docs, `decisions.md`, and the data backlog match what shipped; this spec is deleted in the same PR (D104).

## Out of scope

New goal rewards, changing Honors or Ribbon semantics, goal rerolls the player can trigger, aptitude changes, the title
evaluator itself (T019), and any scenario-count change (T021).
