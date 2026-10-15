// Today's shapes, read from the rework state (T141 "View models that read UmaSave read the rework state through
// careerView"): her `UmaSave` as today's race plan, goal views and badge rules read it, and each `raceResults` row as
// today's `RaceResultRecord`. Lifetime level stands for today's Uma Level, which it equals at the same T (D340), so
// today's level helpers (holds, the tier of a level) read it unchanged.
import {
  createScenarioTraining, DISTANCE_CATEGORIES, type RaceResultRecord, type RaceResultRunner, type ScenarioUnit, type TrainingPreset, type UmaSave,
} from '@racer/domain'
import { careerView, firstLevel, lifetimeLevel, scenarioNumber, type UmaState } from '@racer/domain/rework/tiers'
import type { RaceResultRow } from '@racer/domain/save-g2'

/** Her lifetime level (03 §2): 50 × (tier − 1) + Racing Level. */
export const lifetimeOf = (uma: Pick<UmaState, 'tier' | 'racing'>): number => lifetimeLevel(uma.tier, uma.racing.level)

/**
 * Her `UmaSave` as today's views read it: `careerView` at her scenario T, at her lifetime level and EXP, her current
 * career started in her current scenario with the presets' sets and loadouts, and every closed career before it.
 */
export function umaSaveOf(uma: UmaState): UmaSave {
  const T = scenarioNumber(uma)
  const view = careerView(uma, T)
  const presets = Object.fromEntries(DISTANCE_CATEGORIES.map((distance) => {
    const preset = uma.build.presets[distance]
    const unit: TrainingPreset = {
      cardSetIds: [...preset.cardSetIds],
      assignments: Object.fromEntries(Object.entries(preset.assignments).map(([node, cardId]) => [node, { kind: 'card', cardId }])),
      activeExtraStats: [],
      loadoutSkillIds: [...preset.loadoutSkillIds],
    }
    return [distance, unit]
  })) as ScenarioUnit['presets']
  const current: ScenarioUnit = { ...createScenarioTraining(T), started: true, journey: uma.career, presets }
  const closed = uma.closedCareers
    .filter((journey) => journey.tier !== T)
    .map((journey): ScenarioUnit => ({ ...createScenarioTraining(journey.tier), started: true, journey }))
  return { ...view, level: lifetimeOf(uma), exp: uma.racing.exp, scenarios: [...closed, current].sort((a, b) => a.tier - b.tier) }
}

/** Her rows, oldest first (by time, then id): a row's index is its sequence, her number of results before it. */
export function rowsOf(rows: Readonly<Record<string, RaceResultRow>>, umaId: string): RaceResultRow[] {
  return Object.values(rows)
    .filter((row) => row.umaId === umaId)
    .sort((a, b) => a.at - b.at || (a.opId < b.opId ? -1 : a.opId > b.opId ? 1 : 0))
}

/** Her number of results so far: the race seed's n (T141 "Prepare"). */
export const resultCount = (rows: Readonly<Record<string, RaceResultRow>>, umaId: string): number =>
  Object.values(rows).filter((row) => row.umaId === umaId).length

/**
 * A row as today's record, at its sequence: placement and field from the run, EXP, levels and goals from the commit.
 * Levels are lifetime levels. The row doesn't keep her level at the start, so the start level is her scenario's first,
 * which names the scenario as today's `raceScenarioTier` reads it; the flair reads her level peak from the Uma.
 */
export function recordOf(row: RaceResultRow, sequence: number): RaceResultRecord {
  const { run, commit } = row
  const her = run.field.find((runner: RaceResultRunner) => runner.isPlayer)
  if (her === undefined) throw new Error(`Race ${row.opId} has no player`)
  const offset = lifetimeLevel(row.tier, 1) - 1
  return {
    engineVersion: run.engineVersion,
    ...(run.course === undefined ? {} : { course: run.course }),
    contentVersion: run.contentVersion,
    umaId: row.umaId,
    raceId: row.raceId,
    sequence,
    seed: run.seed,
    strategy: run.strategy,
    startLevel: lifetimeLevel(row.tier, firstLevel(row.scenario)),
    startExp: 0,
    startStats: { ...run.startStats },
    raceBonus: commit.raceBonus,
    playerPlacement: her.placement,
    expGained: commit.finish.expGained,
    levelsGained: commit.finish.levelsGained.map((level) => offset + level),
    ticketReward: 0,
    shardReward: commit.finish.shardsPaid,
    completedGoalIds: [...commit.finish.completedGoalIds],
    ...(run.accomplishmentFacts === undefined ? {} : { accomplishmentFacts: run.accomplishmentFacts }),
    field: run.field.map((runner) => ({ ...runner })),
    createdAt: row.at,
  }
}

/** Her rows as today's records, in sequence. */
export const historyOf = (rows: Readonly<Record<string, RaceResultRow>>, umaId: string): RaceResultRecord[] =>
  rowsOf(rows, umaId).map((row, sequence) => recordOf(row, sequence))
