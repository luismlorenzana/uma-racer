// The season machine (docs/game/03-careers.md §3, D383, D391). A season is Play, Upgrade and Race. Its Play step offers
// every career game (`CAREER_GAMES`), the main one first: Furlong Hand on the course her season is training for, then
// Training Yard with the season's focus. At the Finale it's Furlong Hand alone, the URA Finals' prep heat. Every game
// pays the same bundle (`career/pay.ts`), so they stand in for each other. The season ends with Next season once every
// objective in it is won. Stages, replays and lost races never move the calendar; the screens lead the steps' order,
// and the rules don't enforce it. Pure.
import { refuse, type Refusal } from '../save/registry'
import { FINALE_SEASON, type CareerObjective, type CareerRecord } from '../save/records'
import { STATS, type StatKey } from '../types'

export type CareerGame = 'training-yard' | 'furlong-hand'

/**
 * The games a career's season offers, in order: the first is the main one (D391). Reorder it to change the main game,
 * or drop Training Yard to leave Furlong Hand alone in careers; a game left out stays playable as practice.
 */
export const CAREER_GAMES: readonly CareerGame[] = Object.freeze(['furlong-hand', 'training-yard'] as const)

/** The games the Finale offers: the URA Finals' prep heat. */
export const FINALE_GAMES: readonly CareerGame[] = Object.freeze(['furlong-hand'] as const)

/** One game a season's Play step opens, with what it plays. */
export type SeasonStage =
  | {
    readonly game: 'furlong-hand'
    /**
     * The race whose course it runs (`furlongRaceFor`): her season's first objective, else her next one, else the URA
     * Finals'. Null when the content names none.
     */
    readonly raceId: string | null
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

/** The games a season offers: `CAREER_GAMES`, or at the Finale `FINALE_GAMES`. */
export const seasonGames = (season: number): readonly CareerGame[] => (season === FINALE_SEASON ? FINALE_GAMES : CAREER_GAMES)

/**
 * The season's games in order, each with what it plays: Furlong Hand on `furlongRaceId` (the race `furlongRaceFor`
 * names, which the caller reads from the content), Training Yard on the season's focus. At the Finale, Furlong Hand
 * alone on the URA Finals' course.
 */
export function seasonStages(career: Pick<CareerRecord, 'season'>, furlongRaceId: string | null): SeasonStage[] {
  if (career.season === FINALE_SEASON && furlongRaceId === null) throw new RangeError('The Finale\'s stage needs the URA Finals\' race')
  return seasonGames(career.season).map((game): SeasonStage =>
    game === 'furlong-hand' ? { game, raceId: furlongRaceId } : { game, focus: seasonFocus(career.season) })
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
