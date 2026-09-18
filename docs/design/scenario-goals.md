# Scenario Goals

Each started scenario freezes three optional race targets shaped by the Uma's post-inheritance aptitudes and normalized
career-objective families. They give the tier a story without gating Training, racing, or promotion. Targets are concrete
private `RaceTemplate.id` values: content updates never silently reroll an active or historical Journey.

## Three slots

| Slot | Selection | Rule |
|---|---|---|
| **Aptitude** | Lowest combined saved surface + distance aptitude score | Win the selected race |
| **Identity** | A normalized career-objective family with both relevant aptitudes B or better; aptitude fallback when none fits | Win the selected race |
| **Challenge** | A third lowest-score aptitude target | Win by at least **5 lengths** |

The data importer joins GameTora `ura-objectives` rows to every outfit of a character. It stores only ordered, distinct,
safe decimal race-family ids in `UmaTemplate.signatureRaceFamilyIds`; `RaceTemplate.familyId` connects those families to
retained gameplay races. Objective names, conditions, turn numbers, fan requirements, and source rows stay out of packs.

## Version-1 selection

Aptitude score is the sum of the saved surface- and distance-grade indices (`S = 0` through `G = 7`); lower is better.
Within an equally scored set, candidates are sorted by race id and rotated by a stable hash of Uma id, tier, and slot.
The generator uses no engine RNG, wall clock, or input iteration order. Identity first considers source-family races whose
surface and distance are both B or better, then uses the ordinary aptitude pool. Each slot excludes earlier targets, so a
normal catalog always yields three distinct races.

### Escalation across tiers

| Tier | Requested grade |
|---|---|
| 1 | Aptitude: Pre-OP. Identity and Challenge: OP |
| 2 | G3 |
| 3 | G2 |
| 4+ | G1 |

Every race remains open from scenario 1. When a requested bucket is empty after exclusions, selection visits weaker grades
nearest-first, then stronger grades nearest-first. Scenario Start fails before writes only when the complete catalog cannot
supply three distinct valid targets; its error reports aggregate counts, not private names or ids.

`SCENARIO_GOAL_VERSION = 1` freezes this algorithm. A later algorithm needs an explicit migration and must not reroll v1
plans in place.

## Authoritative completion

Completion counts only a committed progression result from the exact Uma, active tier, and frozen target race. All goals
require first place. Challenge reads the ordered second-place runner's stored `marginLengths` only after confirming the
player won; exactly 5.0 passes. Preview, abandoned playback, another tier, another Uma, or a later family alias cannot count.

New race results always snapshot `completedGoalIds` (including `[]`); legacy results may omit it. Goal evaluation occurs
inside the existing atomic race transaction after deterministic re-simulation and before the result is appended. A matching
retry returns the stored ids without awarding or animating again, while a same-id mismatch is corruption.

## Lifecycle and migration

- New Umas have no active Journey until free Scenario Start. Promotion closes the old Journey and generates the next from
  post-pink-spark aptitudes in the same transaction.
- Promotion/final completion preserves completed goals, marks remaining active goals missed, and closes the Journey.
  Completed and missed facts never reopen.
- The one-time v0→v1 bootstrap labels earlier tiers `legacy-untracked`, generates the current unfinished tier, and replays
  only that Uma's strictly parsed current-tier race history. A previously completed final tier is also legacy-untracked.
  Migration invents no wins, misses, or rewards.
- Missing or retired target content shows its safe id and leaves the frozen goal honestly unavailable until restored.

## Presentation

| Place | What it shows |
|---|---|
| **Home** | Active three-goal tracker, rules, state pips, and direct target-race actions |
| **Uma Profile Journey** | One medallion per reached tier; completed, missed, and active pips; distinct Not tracked state; race/result links |
| **Race Select** | Exact active target races pinned above normal ordering, deduplicated ribbons, and Goals-only filtering |
| **Pre-race** | Every active goal at stake, including the 5-length Challenge rule |
| **Results** | Serialized Goal Ribbon reveals after ordinary rewards; reload shows the same completed summary without re-earning |

Goals pay no tickets, coupons, shards, stats, or SP. Completing all three derives an Honors crest for Journey/results.
Persisted Goal Ribbon/Honors badges, titles, trophy shelves, Album rollups, and account achievements belong to Milestone 6;
they will evaluate these durable Journey and result facts rather than changing goal completion.
