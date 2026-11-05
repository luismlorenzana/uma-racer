// What the Hub shows, from the save (docs/game/11-hub-and-places.md, D381): the top bar's tickets and each place's
// counter. Pure: the state comes in, the view goes out, and no clock is read.
import type { SaveState } from '../save/state'
import type { PlaceId } from './places'

export interface HubWallet {
  readonly umaTickets: number
  readonly cardTickets: number
}

export interface HubView {
  readonly wallet: HubWallet
  /** Each place's counter, where it has one. */
  readonly counts: Readonly<Partial<Record<PlaceId, number>>>
  /** The owned Umas, newest unlock first: the plaza's crowd. */
  readonly owned: readonly string[]
}

export function hubView(state: SaveState): HubView {
  const open = Object.values(state.careers).filter((career) => career.completedAt === null).length
  const owned = Object.entries(state.umas)
    .sort(([a, left], [b, right]) => right.unlockedAt - left.unlockedAt || a.localeCompare(b))
    .map(([id]) => id)
  return {
    wallet: { umaTickets: state.account.umaTickets, cardTickets: state.account.cardTickets },
    counts: { stable: state.account.umaTickets, 'card-library': state.account.cardTickets, careers: open },
    owned,
  }
}
