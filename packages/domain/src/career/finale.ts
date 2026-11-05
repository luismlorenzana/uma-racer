// The URA Finals (docs/game/03-careers.md §4, D383): after Senior Winter, the Finale season's prep heat (its stage),
// then three races at her best surface and distance by aptitude, on the catalogue's highest-grade race for that pair:
// a qualifier against a G2 field, a semifinal against a G1 field and a final against a G1 field with a smaller
// handicap. Each is retried until won. Winning the final completes the career and freezes her racing build. Pure.
import type { RaceTemplate, UmaTemplate } from '../content'
import { careerRaceCatalog } from '../race-catalog'
import { FINALE_RACES, FINALE_SEASON, type BondRecord, type CareerRecord, type RacingBuild } from '../save/records'
import { DISTANCE_CATEGORIES, GRADES, RACE_GRADES, SURFACES, type DistanceCategory, type RaceGrade, type Surface } from '../types'
import { prepareCareerRace, type PreparedRace, type RaceChoice, type RaceContent, type RaceSpec } from './races'

export const FINALE_ROUNDS = ['qualifier', 'semifinal', 'final'] as const
export type FinaleRound = (typeof FINALE_ROUNDS)[number]
export const FINALE_ROUND_NAMES: Readonly<Record<FinaleRound, string>> = Object.freeze({
  qualifier: 'URA Finals Qualifier', semifinal: 'URA Finals Semifinal', final: 'URA Finals Final',
})

/** The final's rivals race this much under the trained stat: stronger than a G1 field's (D383). */
export const FINAL_HANDICAP = 0.1

/** Each round's field: its grade, and the final's own handicap. */
export const FINALE_FIELDS: readonly { readonly round: FinaleRound; readonly grade: RaceGrade; readonly handicap?: number }[] = Object.freeze([
  { round: 'qualifier', grade: 'g2' },
  { round: 'semifinal', grade: 'g1' },
  { round: 'final', grade: 'g1', handicap: FINAL_HANDICAP },
])

const rank = (grade: (typeof GRADES)[number]): number => GRADES.indexOf(grade)

/**
 * Her URA Finals' surface and distance: her best surface by aptitude, then her best distance on it, among the pairs the
 * catalogue races. Ties go to the pair holding more of her objectives, then the catalogue's order.
 */
export function finalePair(uma: Pick<UmaTemplate, 'aptitudes'>, objectiveRaceIds: readonly string[], races: readonly RaceTemplate[]): { surface: Surface; distance: DistanceCategory } {
  const catalogue = careerRaceCatalog(races)
  const objectives = new Set(objectiveRaceIds)
  const pairs = SURFACES.flatMap((surface) => DISTANCE_CATEGORIES.map((distance) => {
    const held = catalogue.filter((race) => race.surface === surface && race.distanceCategory === distance)
    return { surface, distance, raced: held.length > 0, objectives: held.filter((race) => objectives.has(race.id)).length }
  })).filter((pair) => pair.raced)
  if (pairs.length === 0) throw new RangeError('The catalogue holds no race for the URA Finals')
  const best = pairs.map((pair, order) => ({ ...pair, order })).sort((a, b) =>
    rank(uma.aptitudes.surface[a.surface]) - rank(uma.aptitudes.surface[b.surface]) ||
    rank(uma.aptitudes.distance[a.distance]) - rank(uma.aptitudes.distance[b.distance]) ||
    b.objectives - a.objectives || a.order - b.order)[0]!
  return { surface: best.surface, distance: best.distance }
}

/** The race whose course the URA Finals run: the pair's highest grade, one of her objectives last, then by id. */
export function finaleRace(uma: Pick<UmaTemplate, 'aptitudes'>, career: Pick<CareerRecord, 'objectives'>, races: readonly RaceTemplate[]): RaceTemplate {
  const objectiveIds = career.objectives.map((objective) => objective.raceId)
  const { surface, distance } = finalePair(uma, objectiveIds, races)
  const objectives = new Set(objectiveIds)
  return careerRaceCatalog(races).filter((race) => race.surface === surface && race.distanceCategory === distance).sort((a, b) =>
    RACE_GRADES.indexOf(b.grade) - RACE_GRADES.indexOf(a.grade) ||
    Number(objectives.has(a.id)) - Number(objectives.has(b.id)) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]!
}

/** The round she races next: 0 qualifier, 1 semifinal, 2 final; null once the final is won. */
export const nextRound = (career: Pick<CareerRecord, 'finale'>): number | null =>
  (career.finale.step < FINALE_RACES ? career.finale.step : null)

/** A round's race: the URA Finals' course, its field, as strong as the Finale; its seed names the round. */
export function finaleSpec(race: RaceTemplate, round: number): RaceSpec {
  const field = FINALE_FIELDS[round]
  if (field === undefined) throw new RangeError(`No URA Finals round ${round}`)
  return {
    kind: 'finale', race, grade: field.grade, season: FINALE_SEASON, seedKey: `${race.id}:ura-${field.round}`,
    ...(field.handicap === undefined ? {} : { handicap: field.handicap }),
  }
}

/** Prepares her next URA Finals round. Throws before the Finale or after the final: the operation checks first. */
export function prepareFinaleRace(
  career: CareerRecord,
  choice: RaceChoice,
  bonds: Readonly<Record<string, BondRecord>>,
  content: RaceContent & { readonly races: readonly RaceTemplate[] },
  contentVersion: string,
): PreparedRace {
  const round = nextRound(career)
  if (career.season !== FINALE_SEASON || round === null) throw new RangeError('No URA Finals round is open')
  const uma = content.umas.get(career.umaId)
  if (uma === undefined) throw new RangeError(`No Uma ${career.umaId}`)
  return prepareCareerRace(career, finaleSpec(finaleRace(uma, career, content.races), round), choice, bonds, content, contentVersion)
}

/**
 * The career after a round: a win moves to the next round, and winning the final completes the career at `now` with
 * `build` frozen as her URA Finale racing build. A loss changes nothing (retries are free).
 */
export function settleFinale(career: CareerRecord, placement: number, now: number, build: RacingBuild): { career: CareerRecord; won: boolean; completed: boolean } {
  if (placement !== 1) return { career, won: false, completed: false }
  const step = career.finale.step + 1
  const completed = step === FINALE_RACES
  return {
    career: {
      ...career,
      finale: { step, won: completed },
      ...(completed ? { completedAt: now, racingBuild: build } : {}),
    },
    won: true,
    completed,
  }
}
