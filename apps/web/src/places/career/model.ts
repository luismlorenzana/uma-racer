// The Careers place's view model (docs/game/11-hub-and-places.md §3.2; D386): the careers in progress and the completed
// ones as rows (her name, where she stands, her next objective by race name and grade), and the place's words. T158
// builds the season screens on it. Pure.
import type { RaceGrade, RaceTemplate } from '@racer/domain'
import { careerSeasonLine, hubWords, nextObjective } from '@racer/domain/hub'
import type { CareerRecord } from '@racer/domain/save'
import { scenarioForTier } from '@racer/domain'
import { seasonName } from '@racer/domain/career'

export const CAREERS_WORDS = Object.freeze({
  'about-careers': 'A career is twelve seasons and the URA Finals. Start one from an Uma\'s profile in the Stable.',
  'about-next': 'The season screens are coming next: until then, each game opens for practice on the Career page.',
  'in-progress': 'In progress',
  completed: 'Completed',
  'none-running': "No career running. Start one from an Uma's profile in the Stable.",
  'to-stable': 'Open the Stable',
  objectives: 'Objectives',
  won: 'Won',
  open: 'Open',
  'season-screens': 'The season screens are coming next.',
  'unknown-career': "That career isn't in your save.",
  'racing-build': 'Her racing build',
} as const)

export type CareersWord = keyof typeof CAREERS_WORDS
export const careersWords = (key: CareersWord): string => CAREERS_WORDS[key]

const GRADE_LABEL: Readonly<Record<RaceGrade, string>> = { debut: 'Debut', maiden: 'Maiden', 'pre-op': 'Pre-OP', op: 'OP', g3: 'G3', g2: 'G2', g1: 'G1' }

/** A race by name and grade, "Sim Cup (G1)", or its id while the content lacks it. */
export function raceLabel(raceId: string, races: readonly RaceTemplate[]): string {
  const race = races.find((each) => each.id === raceId)
  return race === undefined ? raceId : `${race.name} (${GRADE_LABEL[race.grade]})`
}

/** One career as a row. */
export interface CareerRow {
  readonly id: string
  readonly umaId: string
  readonly name: string
  /** "URA Finale · Classic Spring", or the scenario alone once complete. */
  readonly where: string
  /** "Next: Sim Cup (G1)", "Next: the URA Finals", or null once complete. */
  readonly next: string | null
  readonly completed: boolean
}

export function careerRow(id: string, career: CareerRecord, names: ReadonlyMap<string, { readonly name: string }>, races: readonly RaceTemplate[]): CareerRow {
  const completed = career.completedAt !== null
  const next = nextObjective(career)
  return {
    id,
    umaId: career.umaId,
    name: names.get(career.umaId)?.name ?? career.umaId,
    where: completed ? scenarioForTier(career.T)?.name ?? `Scenario ${career.T}` : careerSeasonLine(career),
    next: completed ? null : next === null ? hubWords('next-finale') : hubWords('next-objective', { race: raceLabel(next.raceId, races) }),
    completed,
  }
}

/** Every career as rows: in progress (the latest started first) and completed (the latest completed first). */
export function careerRows(careers: Readonly<Record<string, CareerRecord>>, names: ReadonlyMap<string, { readonly name: string }>, races: readonly RaceTemplate[]): {
  readonly running: CareerRow[]
  readonly completed: CareerRow[]
} {
  const entries = Object.entries(careers)
  const running = entries.filter(([, career]) => career.completedAt === null)
    .sort(([a, left], [b, right]) => right.startedAt - left.startedAt || a.localeCompare(b))
  const completed = entries.filter(([, career]) => career.completedAt !== null)
    .sort(([a, left], [b, right]) => right.completedAt! - left.completedAt! || a.localeCompare(b))
  return {
    running: running.map(([id, career]) => careerRow(id, career, names, races)),
    completed: completed.map(([id, career]) => careerRow(id, career, names, races)),
  }
}

/** A season's name for an objective's row. */
export const objectiveSeason = (season: number): string => seasonName(season)
