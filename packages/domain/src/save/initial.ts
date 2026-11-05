// A new account (D381, M036 "Unlocks"): 20 Uma Tickets, 24 Card Tickets, and nothing unlocked. The server builds these
// rows from a create's `createdAt`; the device builds the same ones while it can't reach the server.
import { INITIAL_CARD_TICKETS, INITIAL_UMA_TICKETS } from '../account/ops'
import { entityDraft, type EntityDraft, type LogDraft } from './rows'
import type { SaveState } from './state'

export interface InitialSave {
  readonly state: SaveState
  readonly entities: readonly EntityDraft[]
  readonly logs: readonly LogDraft[]
}

export function initialSave(now: number): InitialSave {
  if (!Number.isSafeInteger(now) || now < 0) throw new RangeError('An account needs a creation time')
  const account = { createdAt: now, umaTickets: INITIAL_UMA_TICKETS, cardTickets: INITIAL_CARD_TICKETS }
  const state: SaveState = { account, umas: {}, cards: {}, careers: {}, bonds: {} }
  return { state, entities: [entityDraft('account', 'main', account)], logs: [] }
}
