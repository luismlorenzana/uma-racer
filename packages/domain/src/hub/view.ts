// What the Hub shows, from the save (docs/game/11-hub-and-places.md, D381, D386): the top bar's tickets, each place's
// counter, the plaza's crowd, how many cards are unlocked, and the careers in progress with their next objective (the
// Careers quick look and the raised Career button). Pure: the state comes in, the view goes out, and no clock is read.
import type { CareerStage } from '../career-stages'
import { seasonName } from '../career/calendar'
import { isUnlocked, type CareerRecord } from '../save/records'
import type { SaveState } from '../save/state'
import { scenarioForTier } from '../scenarios'
import type { PlaceId } from './places'

export interface HubWallet {
  readonly umaTickets: number
  readonly cardTickets: number
}

/** A career's next objective: the first one still open, in calendar order. */
export interface HubObjective {
  readonly raceId: string
  readonly stage: CareerStage
  readonly season: number
}

/** One career in progress, as the Hub lists it. */
export interface HubCareer {
  /** `{umaId}:{T}`, its key in the save. */
  readonly id: string
  readonly umaId: string
  readonly T: number
  /** 0–11, or 12 at the Finale. */
  readonly season: number
  /** Her next open objective; null once every objective is won (the Finale is next). */
  readonly next: HubObjective | null
}

export interface HubView {
  readonly wallet: HubWallet
  /** Each place's counter, where it has one. */
  readonly counts: Readonly<Partial<Record<PlaceId, number>>>
  /** The owned Umas, newest unlock first: the plaza's crowd. */
  readonly owned: readonly string[]
  /** How many support cards are unlocked. */
  readonly ownedCards: number
  /** The careers in progress, the latest started first: the raised Career button opens the first. */
  readonly careers: readonly HubCareer[]
}

/** A career's next open objective, in calendar order. */
export function nextObjective(career: Pick<CareerRecord, 'objectives'>): HubObjective | null {
  const open = career.objectives.filter((objective) => objective.status === 'open')
  const first = [...open].sort((a, b) => a.season - b.season)[0]
  return first === undefined ? null : { raceId: first.raceId, stage: first.stage, season: first.season }
}

/** Where a career stands, in words: "URA Finale · Classic Spring", "URA Finale · Finale". */
export function careerSeasonLine(career: Pick<HubCareer, 'T' | 'season'>): string {
  const scenario = scenarioForTier(career.T)?.name ?? `Scenario ${career.T}`
  return `${scenario} · ${seasonName(career.season)}`
}

export function hubView(state: SaveState): HubView {
  const owned = Object.entries(state.umas)
    .sort(([a, left], [b, right]) => right.unlockedAt - left.unlockedAt || a.localeCompare(b))
    .map(([id]) => id)
  const careers = Object.entries(state.careers)
    .filter(([, career]) => career.completedAt === null)
    .sort(([a, left], [b, right]) => right.startedAt - left.startedAt || a.localeCompare(b))
    .map(([id, career]): HubCareer => ({ id, umaId: career.umaId, T: career.T, season: career.season, next: nextObjective(career) }))
  return {
    wallet: { umaTickets: state.account.umaTickets, cardTickets: state.account.cardTickets },
    counts: { stable: state.account.umaTickets, 'card-library': state.account.cardTickets, careers: careers.length },
    owned,
    ownedCards: Object.values(state.cards).filter(isUnlocked).length,
    careers,
  }
}
