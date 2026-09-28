// The Race tab's plan for one Uma: her career tracker, the handful of races worth running now, and the rest collapsed
// behind them (docs/design/scenario-goals.md#presentation, M017 part B). Pure: content, save and her own history in.

import {
  CAREER_STAGE_LABELS,
  CAREER_STAGE_LEVELS,
  CAREER_STAGES,
  GRADES,
  LEVELS_PER_SCENARIO,
  SCENARIOS,
  SCENARIO_SERIES_LABELS,
  isPastScenario,
  raceScenarioTier,
  trainedScenario,
  careerComplete,
  careerHoldLevel,
  careerProfile,
  careerStage,
  goalRaceIds,
  inCareerProfile,
  isCareerJourney,
  levelsIntoScenario,
  stableHash,
  type Aptitudes,
  type CareerProfile,
  type CareerStage,
  type RaceGrade,
  type RaceResultRecord,
  type RaceTemplate,
  type ScenarioGoal,
  type UmaSave,
  type UmaTemplate,
} from '@racer/domain'

/** Why a race card is worth a look, drawn as icons on the card. */
export type RaceMark =
  | { kind: 'goal'; stage: CareerStage | null; label: string }
  | { kind: 'set'; label: string; won: number; total: number }
  | { kind: 'trophy'; label: string }

export interface PlannedRace {
  race: RaceTemplate
  marks: RaceMark[]
  /** Starts in this scenario. */
  raced: number
  wonThisScenario: boolean
}

export interface StageView {
  stage: CareerStage
  label: string
  /** "Lv 1–2", levels into the scenario. */
  levels: string
  won: number
  total: number
  state: 'done' | 'current' | 'ahead'
  races: { race: RaceTemplate | null; raceId: string; won: boolean; set: string | null }[]
}

export interface CareerTracker {
  scenario: string
  profile: string
  stage: CareerStage | null
  stages: StageView[]
  /** Absolute Uma Level race EXP is holding at, and whether she is sitting on it now. */
  holdLevel: number | null
  held: boolean
  complete: boolean
}

export interface RacePlan {
  /** Null for a journey frozen before careers (goal plan v2) or a scenario not yet started. */
  tracker: CareerTracker | null
  nextUp: PlannedRace[]
  won: PlannedRace[]
  all: PlannedRace[]
}

export const NEXT_UP_MIN = 5
export const NEXT_UP_MAX = 10

const GRADE_ORDER: Record<RaceGrade, number> = { g1: 0, g2: 1, g3: 2, op: 3, 'pre-op': 4, maiden: 5, debut: 6 }

/** EXP races worth running at each point of a career: the stage's grade, then the one below it. */
const STAGE_EXP_GRADES: Record<CareerStage | 'complete', readonly RaceGrade[]> = {
  maiden: ['g3', 'op'],
  trials: ['g2', 'g3'],
  main: ['g1', 'g2'],
  complete: ['g1', 'g2'],
}

const DISTANCE_LABEL = { sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long' } as const
export const profileLabel = (profile: CareerProfile): string =>
  `${profile.distances.map((distance) => DISTANCE_LABEL[distance]).join(' · ')} · ${profile.surface === 'turf' ? 'Turf' : 'Dirt'}`

const fits = (aptitudes: Aptitudes, race: RaceTemplate): boolean =>
  GRADES.indexOf(aptitudes.surface[race.surface]) <= GRADES.indexOf('B') &&
  GRADES.indexOf(aptitudes.distance[race.distanceCategory]) <= GRADES.indexOf('B')

/** The stage a legacy (v2) journey's player is effectively in, by level, for picking EXP races. */
const stageByLevel = (level: number): CareerStage => {
  const into = levelsIntoScenario(level) + 1
  return CAREER_STAGES.find((stage) => into <= CAREER_STAGE_LEVELS[stage].last) ?? 'main'
}

export interface RacePlanInput {
  uma: UmaSave
  template: UmaTemplate
  /** Her aptitudes now, from the racing scenario's constellation (D121, D190). */
  aptitudes: Aptitudes
  races: readonly RaceTemplate[]
  /** This Uma's results, any order. */
  history: readonly RaceResultRecord[]
  /** Which of her scenarios races (D190); her current one when omitted. */
  tier?: number
}

export function buildRacePlan(input: RacePlanInput): RacePlan {
  const { uma, aptitudes } = input
  const run = trainedScenario(uma, input.tier)
  // An earlier scenario races for its own record: its career is closed, so it has no tracker and no goals (D190).
  const past = isPastScenario(uma, run.tier)
  const journey = run.journey
  const byId = new Map(input.races.map((race) => [race.id, race]))
  const profile = careerProfile(aptitudes, input.template, input.races)

  // Her history, split into this scenario and ever.
  const here = input.history.filter((record) => record.umaId === uma.templateId && raceScenarioTier(record) === run.tier)
  const racedHere = new Map<string, number>()
  for (const record of here) racedHere.set(record.raceId, (racedHere.get(record.raceId) ?? 0) + 1)
  const wonHere = new Map<string, number>()
  for (const record of here) if (record.playerPlacement === 1) wonHere.set(record.raceId, Math.max(wonHere.get(record.raceId) ?? 0, record.createdAt))
  const g1FamiliesWon = new Set(input.history
    .filter((record) => record.umaId === uma.templateId && record.playerPlacement === 1)
    .map((record) => byId.get(record.raceId))
    .filter((race): race is RaceTemplate => race?.grade === 'g1')
    .map((race) => race.familyId))

  const activeGoals = journey?.state === 'active' && journey.tracking === 'tracked' ? journey.goals.filter((goal) => goal.status === 'active') : []
  const goalMarks = (race: RaceTemplate): RaceMark[] => activeGoals.flatMap((goal): RaceMark[] => {
    if (goal.series) {
      const leg = goal.series.legs.find((entry) => entry.raceId === race.id && entry.status === 'active')
      if (!leg) return []
      const won = goal.series.legs.filter((entry) => entry.status === 'completed').length
      return [
        { kind: 'goal', stage: isCareerJourney(journey) ? goal.slot as CareerStage : null, label: goalLabel(goal) },
        { kind: 'set', label: SCENARIO_SERIES_LABELS[goal.series.tag], won, total: goal.series.legs.length },
      ]
    }
    return goal.raceId === race.id ? [{ kind: 'goal', stage: isCareerJourney(journey) ? goal.slot as CareerStage : null, label: goalLabel(goal) }] : []
  })
  const planned = (race: RaceTemplate): PlannedRace => {
    const marks = goalMarks(race)
    if (race.grade === 'g1' && !g1FamiliesWon.has(race.familyId)) marks.push({ kind: 'trophy', label: 'First win' })
    return { race, marks, raced: racedHere.get(race.id) ?? 0, wonThisScenario: wonHere.has(race.id) }
  }

  const all = [...input.races]
    .sort((left, right) => GRADE_ORDER[left.grade] - GRADE_ORDER[right.grade] || left.distance - right.distance ||
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
    .map(planned)
  const won = all.filter((entry) => entry.wonThisScenario)
    .sort((left, right) => (wonHere.get(right.race.id) ?? 0) - (wonHere.get(left.race.id) ?? 0))

  if (!run.started && !past) return { tracker: null, nextUp: [], won, all }

  // Next up: unwon goals up to her current stage, then races graded for where she is, all in her profile.
  const stage = isCareerJourney(journey) ? careerStage(journey) : stageByLevel(uma.level)
  const reachable = isCareerJourney(journey)
    ? activeGoals.filter((goal) => stage !== null && CAREER_STAGES.indexOf(goal.slot as CareerStage) <= CAREER_STAGES.indexOf(stage))
    : activeGoals
  const picked = new Set<string>()
  const nextUp: PlannedRace[] = []
  const add = (race: RaceTemplate | undefined) => {
    if (!race || picked.has(race.id) || nextUp.length >= NEXT_UP_MAX) return
    picked.add(race.id)
    nextUp.push(planned(race))
  }
  for (const goal of reachable) {
    for (const raceId of goal.series ? goal.series.legs.filter((leg) => leg.status === 'active').map((leg) => leg.raceId) : goalRaceIds(goal)) {
      add(byId.get(raceId))
    }
  }
  const grades = STAGE_EXP_GRADES[stage ?? 'complete']
  const salt = `${uma.templateId}:${run.tier}`
  const pool = input.races
    .filter((race) => grades.includes(race.grade) && inCareerProfile(profile, race) && fits(aptitudes, race))
    .sort((left, right) => grades.indexOf(left.grade) - grades.indexOf(right.grade) ||
      Number(wonHere.has(left.id)) - Number(wonHere.has(right.id)) ||
      (racedHere.get(left.id) ?? 0) - (racedHere.get(right.id) ?? 0) ||
      stableHash(`${salt}:${left.id}`) - stableHash(`${salt}:${right.id}`))
  // In her main goals a first-win G1 is its own reason to race; earlier, a G1 is out of reach.
  if (stage === 'main' || stage === null) {
    for (const race of pool.filter((entry) => entry.grade === 'g1' && !g1FamiliesWon.has(entry.familyId)).slice(0, 2)) add(race)
  }
  // One family per list, so Next up never shows the same race twice under two variants.
  const families = new Set(nextUp.map((entry) => entry.race.familyId))
  for (const race of pool) {
    if (families.has(race.familyId)) continue
    families.add(race.familyId)
    add(race)
  }
  // A thin profile still offers something: widen to any race of those grades she fits.
  if (nextUp.length < NEXT_UP_MIN) {
    for (const race of input.races.filter((entry) => grades.includes(entry.grade) && fits(aptitudes, entry))) {
      if (nextUp.length >= NEXT_UP_MIN) break
      add(race)
    }
  }

  return { tracker: !past && isCareerJourney(journey) ? tracker(uma, journey!, profile, byId) : null, nextUp, won, all }
}

function goalLabel(goal: ScenarioGoal): string {
  if (goal.slot === 'maiden' || goal.slot === 'trials' || goal.slot === 'main') return `${CAREER_STAGE_LABELS[goal.slot]} goal`
  return `${goal.slot[0]!.toUpperCase()}${goal.slot.slice(1)} goal`
}

function tracker(uma: UmaSave, journey: NonNullable<UmaSave['scenarios'][number]['journey']>, profile: CareerProfile, byId: ReadonlyMap<string, RaceTemplate>): CareerTracker {
  const stage = careerStage(journey)
  const holdLevel = careerHoldLevel(journey, uma.level)
  const stages = CAREER_STAGES.map((entry): StageView => {
    const goals = journey.goals.filter((goal) => goal.slot === entry)
    const races = goals.flatMap((goal): StageView['races'] => {
      const set = goal.series ? SCENARIO_SERIES_LABELS[goal.series.tag] : null
      if (goal.series) return goal.series.legs.map((leg) => ({ race: byId.get(leg.raceId) ?? null, raceId: leg.raceId, won: leg.status === 'completed', set }))
      return goal.raceId ? [{ race: byId.get(goal.raceId) ?? null, raceId: goal.raceId, won: goal.status === 'completed', set }] : []
    })
    const { first, last } = CAREER_STAGE_LEVELS[entry]
    return {
      stage: entry,
      label: CAREER_STAGE_LABELS[entry],
      levels: `Lv ${first}–${last}`,
      won: races.filter((race) => race.won).length,
      total: races.length,
      state: stage === null || CAREER_STAGES.indexOf(entry) < CAREER_STAGES.indexOf(stage) ? 'done' : entry === stage ? 'current' : 'ahead',
      races,
    }
  })
  return {
    scenario: SCENARIOS[journey.tier - 1]?.name ?? `Scenario ${journey.tier}`,
    profile: profileLabel(profile),
    stage,
    stages,
    holdLevel,
    held: holdLevel !== null && uma.level === holdLevel,
    complete: careerComplete(journey),
  }
}

/** Levels into the scenario (1–10) for display. */
export const scenarioLevel = (level: number): number => Math.min(LEVELS_PER_SCENARIO, levelsIntoScenario(level) + 1)
