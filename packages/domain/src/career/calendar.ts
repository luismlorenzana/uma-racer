// The career's calendar (docs/game/03-careers.md §1–§2, D383): three school years of four seasons, indices 0–11, then
// the Finale at 12. Each objective sits in its race's season of the year, in the year its stage asks for: the Maiden in
// Junior, the Trials in Classic, the earliest Main G1 in Classic and the other Main G1s in Senior. A race that would come
// before the objective ahead of it moves to the next year, and two objectives may share a season. Pure.
import type { RaceTemplate } from '../content'
import type { CareerStage, ScenarioJourney } from '../career-shapes'
import { CAREER_STAGES } from '../career-stages'
import { goalRaceIds } from '../scenario-goals'
import { FINALE_SEASON, SEASONS } from '../save/records'

export const YEARS = ['Junior', 'Classic', 'Senior'] as const
export type Year = (typeof YEARS)[number]
export const QUARTERS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const
export type Quarter = (typeof QUARTERS)[number]
export const SEASONS_PER_YEAR = QUARTERS.length

/**
 * `RaceTemplate.season` (the original's course season code, which skills read) as a season of the year: 1 spring
 * (March to June), 2 summer (July and August), 3 autumn (September to November), 4 winter (December to February) and
 * 5 the cherry-blossom weeks of early April, which are spring. A race without a season (0) has no place on the
 * calendar, so it never becomes an objective.
 */
export const RACE_SEASON_QUARTER: Readonly<Record<number, number>> = Object.freeze({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 0 })

/** The race's season of the year, 0–3, or null when it has none. */
export function raceQuarter(race: Pick<RaceTemplate, 'season'>): number | null {
  return RACE_SEASON_QUARTER[race.season] ?? null
}

/** A season's index from its year (0–2) and quarter (0–3). */
export const seasonIndex = (year: number, quarter: number): number => year * SEASONS_PER_YEAR + quarter

/** A season's name: "Classic Spring", or "Finale" at 12. */
export function seasonName(season: number): string {
  if (season === FINALE_SEASON) return 'Finale'
  if (!Number.isInteger(season) || season < 0 || season >= SEASONS) throw new RangeError(`No season ${season}`)
  return `${YEARS[Math.floor(season / SEASONS_PER_YEAR)]} ${QUARTERS[season % SEASONS_PER_YEAR]}`
}

/** The year each stage's objectives fall in. The Main G1s after the earliest fall a year later (Senior). */
export const STAGE_YEAR: Readonly<Record<CareerStage, number>> = Object.freeze({ maiden: 0, trials: 1, main: 1 })

export interface PlacedObjective {
  readonly raceId: string
  readonly stage: CareerStage
  /** 0–11. */
  readonly season: number
}

/** The journey's races, one per objective, in stage order: a race set's legs become one objective each. */
export function journeyRaces(journey: Pick<ScenarioJourney, 'goals'>): { raceId: string; stage: CareerStage }[] {
  return CAREER_STAGES.flatMap((stage) => journey.goals.filter((goal) => goal.slot === stage)
    .flatMap((goal) => goalRaceIds(goal).map((raceId) => ({ raceId, stage }))))
}

/**
 * Places a frozen journey on the calendar. Within a stage the races go by season of the year (ties keep the journey's
 * order); each takes its stage's year (the Main G1s after the first, Senior); and one that would fall before the
 * objective ahead of it moves a year later until it doesn't. Throws on a race the content lacks, a race without a season,
 * or one pushed past Senior Winter: content that can't make a career, which `planScenarioCareer` doesn't pick.
 */
export function placeObjectives(journey: Pick<ScenarioJourney, 'goals'>, races: readonly Pick<RaceTemplate, 'id' | 'season'>[]): PlacedObjective[] {
  const byId = new Map(races.map((race) => [race.id, race]))
  const quarterOf = (raceId: string): number => {
    const race = byId.get(raceId)
    if (race === undefined) throw new RangeError(`No race ${raceId}`)
    const quarter = raceQuarter(race)
    if (quarter === null) throw new RangeError(`Race ${raceId} has no season`)
    return quarter
  }
  const placed: PlacedObjective[] = []
  let floor = 0
  for (const stage of CAREER_STAGES) {
    const entries = journeyRaces(journey).filter((entry) => entry.stage === stage)
      .map((entry, order) => ({ ...entry, order, quarter: quarterOf(entry.raceId) }))
      .sort((a, b) => a.quarter - b.quarter || a.order - b.order)
    entries.forEach((entry, n) => {
      const year = STAGE_YEAR[stage] + (stage === 'main' && n > 0 ? 1 : 0)
      let season = seasonIndex(year, entry.quarter)
      while (season < floor) season += SEASONS_PER_YEAR
      if (season >= SEASONS) throw new RangeError(`Race ${entry.raceId} doesn't fit before the Finale`)
      floor = season
      placed.push({ raceId: entry.raceId, stage, season })
    })
  }
  return placed
}
