// The season machine (docs/game/03-careers.md §3, D383). A season is Play, Upgrade and Race: its stage is Furlong Hand,
// the prep heat on its first objective's course, when it holds an objective, and Training Yard otherwise. It ends with
// Next season once every objective in it is won. Stages, replays and lost races never move the calendar; the screens
// lead the steps' order, and the rules don't enforce it. Pure.
import { refuse, type Refusal } from '../save/registry'
import { FINALE_SEASON, type CareerObjective, type CareerRecord } from '../save/records'
import { STATS, type StatKey } from '../types'

export type CareerGame = 'training-yard' | 'furlong-hand'

/** What a season's Play step opens. */
export type SeasonStage =
  | {
    readonly game: 'furlong-hand'
    /** The race whose course the prep heat runs: the season's first objective, or the URA Finals' race. */
    readonly raceId: string
  }
  | {
    readonly game: 'training-yard'
    /** The season's focus stat, which tilts the Yard's colours. */
    readonly focus: StatKey
  }

/** The season's focus: Speed, Stamina, Power, Guts and Wit in turn, from Junior Spring. */
export const seasonFocus = (season: number): StatKey => STATS[season % STATS.length]!

/** The objectives that fall in a season, in calendar order. */
export const seasonObjectives = (career: Pick<CareerRecord, 'objectives' | 'season'>, season = career.season): CareerObjective[] =>
  career.objectives.filter((objective) => objective.season === season)

/**
 * The season's stage: Furlong Hand on the first objective's course when the season holds one, Training Yard with the
 * season's focus otherwise. At the Finale it's Furlong Hand on the URA Finals' course, which `finaleRaceId` names.
 */
export function seasonStage(career: Pick<CareerRecord, 'objectives' | 'season'>, finaleRaceId: string | null = null): SeasonStage {
  if (career.season === FINALE_SEASON) {
    if (finaleRaceId === null) throw new RangeError('The Finale\'s stage needs the URA Finals\' race')
    return { game: 'furlong-hand', raceId: finaleRaceId }
  }
  const first = seasonObjectives(career)[0]
  return first === undefined ? { game: 'training-yard', focus: seasonFocus(career.season) } : { game: 'furlong-hand', raceId: first.raceId }
}

/** Whether Next season is open: the career runs, isn't at the Finale, and every objective this season is won. */
export const canAdvance = (career: Pick<CareerRecord, 'objectives' | 'season' | 'completedAt'>): boolean =>
  career.completedAt === null && career.season < FINALE_SEASON && seasonObjectives(career).every((objective) => objective.status === 'won')

/** The career a season later, or why it can't move yet. */
export function nextSeason(career: CareerRecord): CareerRecord | Refusal {
  if (career.completedAt !== null) return refuse('career-complete', 'Her career is complete.')
  if (career.season >= FINALE_SEASON) return refuse('at-finale', 'She is at the Finale: the URA Finals end her career.')
  const open = seasonObjectives(career).filter((objective) => objective.status !== 'won').length
  if (open > 0) {
    return refuse('objectives-open', `Win ${open === 1 ? 'this season\'s objective' : `this season's ${open} objectives`} first.`, { open })
  }
  return { ...career, season: career.season + 1 }
}
