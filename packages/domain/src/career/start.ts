// Starting a career (docs/game/03-careers.md §1, D383): any unlocked Uma, one career at a time, and in this release one
// URA Finale career (T = 1) each. Her objectives are frozen with `planScenarioCareer` on the races the calendar can
// place and placed by `placeObjectives`; the tree, the deck and the wallet start empty. Pure.
import type { RaceTemplate, UmaTemplate } from '../content'
import { careerRaceCatalog } from '../race-catalog'
import { planScenarioCareer } from '../scenario-goals'
import { refuse, type Refusal } from '../save/registry'
import { CAMPS, careerId, type CareerRecord } from '../save/records'
import type { SaveState } from '../save/state'
import { scenarioForTier } from '../scenarios'
import { zeroStats } from '../types'
import { placeObjectives, raceQuarter } from './calendar'

/** The scenarios a career can start in this release: URA Finale. */
export const OPEN_SCENARIOS: readonly number[] = Object.freeze([1])

/**
 * Whether a card of this era can be used in a career this release, and so unlocked (D392): an open scenario is its era's
 * or a later one. Opening a scenario in a release opens its era's cards with it.
 */
export const cardEraOpen = (era: number): boolean => OPEN_SCENARIOS.some((T) => T >= era)

/** The races a career's objectives come from: the regular catalogue, and only races with a season of the year. */
export const calendarRaces = (races: readonly RaceTemplate[]): RaceTemplate[] =>
  careerRaceCatalog(races).filter((race) => raceQuarter(race) !== null)

/** A new career's record: her objectives placed, everything else empty. Throws on content that can't make one. */
export function newCareer(uma: UmaTemplate, T: number, races: readonly RaceTemplate[], now: number): CareerRecord {
  const pool = calendarRaces(races)
  const { journey } = planScenarioCareer({ T, umaTemplate: uma, aptitudes: uma.aptitudes, races: pool })
  const objectives = placeObjectives(journey, pool).map((placed) => ({ ...placed, status: 'open' as const, wonAt: null }))
  return {
    umaId: uma.id, T, startedAt: now, season: 0, objectives, finale: { step: 0, won: false },
    deck: [], posts: {}, pips: zeroStats(), camps: Array.from({ length: CAMPS }, () => null), skills: [], spSpent: 0,
    wallet: { drills: zeroStats(), bond: 0, sp: 0 }, completedAt: null, racingBuild: null,
  }
}

/** Starts her career in scenario T, or says why not. */
export function startCareer(state: SaveState, umaId: string, T: number, races: readonly RaceTemplate[], umas: ReadonlyMap<string, UmaTemplate>, now: number): CareerRecord | Refusal {
  const uma = umas.get(umaId)
  if (uma === undefined) return refuse('unknown-uma', 'That Uma isn\'t in the game.')
  if (state.umas[umaId] === undefined) return refuse('uma-locked', `${uma.name} isn't in your Stable yet.`)
  if (!OPEN_SCENARIOS.includes(T)) {
    const name = scenarioForTier(T)?.name ?? `Scenario ${T}`
    return refuse('scenario-closed', `${name} careers aren't open yet: this release runs URA Finale.`, { T })
  }
  const running = Object.values(state.careers).find((career) => career.umaId === umaId && career.completedAt === null)
  if (running !== undefined) return refuse('career-running', `${uma.name} is already in a career: finish it first.`)
  if (state.careers[careerId(umaId, T)] !== undefined) {
    return refuse('career-done', `${uma.name} has already run her ${scenarioForTier(T)?.name ?? `scenario ${T}`} career.`)
  }
  try {
    return newCareer(uma, T, races, now)
  } catch {
    return refuse('no-calendar', `The race calendar can't give ${uma.name} a career.`)
  }
}
