// The account's operations (docs/game/02-unlocks.md, D381): unlocking an Uma or a support card with a ticket, and the
// dev-only grant. Pure: the state, the input and `now` give the result.
import { defineOperation, refuse, type AnyOperationDef } from '../save/registry'
import type { SaveState } from '../save/state'
import { isRowId } from '../save/kinds'

/** A new account's tickets (M036): enough to unlock a first roster and build first decks. */
export const INITIAL_UMA_TICKETS = 20
export const INITIAL_CARD_TICKETS = 24

const idInput = (key: 'umaId' | 'cardId') => (value: unknown): { readonly id: string } | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const entry = value as Record<string, unknown>
  return Object.keys(entry).length === 1 && isRowId(entry[key]) ? { id: entry[key] as string } : null
}

export interface UnlockReceipt {
  readonly id: string
  readonly ticketsLeft: number
}

export const unlockUma = defineOperation<{ readonly id: string }, UnlockReceipt>({
  name: 'unlock-uma',
  parse: idInput('umaId'),
  apply: (state, { id }, now, env) => {
    const uma = env.content.umas.get(id)
    if (uma === undefined) return refuse('unknown-uma', 'That Uma isn\'t in the game.')
    if (state.umas[id] !== undefined) return refuse('already-unlocked', `${uma.name} is already in your Stable.`)
    if (state.account.umaTickets < 1) return refuse('no-tickets', 'You have no Uma Tickets left.')
    const account = { ...state.account, umaTickets: state.account.umaTickets - 1 }
    return { state: { ...state, account, umas: { ...state.umas, [id]: { unlockedAt: now } } }, receipt: { id, ticketsLeft: account.umaTickets } }
  },
})

export const unlockCard = defineOperation<{ readonly id: string }, UnlockReceipt>({
  name: 'unlock-card',
  parse: idInput('cardId'),
  apply: (state, { id }, now, env) => {
    const card = env.content.cards.get(id)
    if (card === undefined) return refuse('unknown-card', 'That card isn\'t in the game.')
    if (state.cards[id] !== undefined) return refuse('already-unlocked', `${card.title} is already in your Card Library.`)
    if (state.account.cardTickets < 1) return refuse('no-tickets', 'You have no Card Tickets left.')
    const account = { ...state.account, cardTickets: state.account.cardTickets - 1 }
    return { state: { ...state, account, cards: { ...state.cards, [id]: { unlockedAt: now } } }, receipt: { id, ticketsLeft: account.cardTickets } }
  },
})

export interface DevGrantInput {
  readonly umaTickets: number
  readonly cardTickets: number
}

const isGrant = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1000

/** Dev builds only (`env.dev`): adds tickets. Production refuses it. */
export const devGrant = defineOperation<DevGrantInput, SaveState['account']>({
  name: 'dev-grant',
  parse: (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
    const entry = value as Record<string, unknown>
    return Object.keys(entry).length === 2 && isGrant(entry.umaTickets) && isGrant(entry.cardTickets)
      ? { umaTickets: entry.umaTickets as number, cardTickets: entry.cardTickets as number } : null
  },
  apply: (state, input, _now, env) => {
    if (env.dev !== true) return refuse('dev-only', 'That only works in a dev build.')
    const account = {
      ...state.account,
      umaTickets: state.account.umaTickets + input.umaTickets,
      cardTickets: state.account.cardTickets + input.cardTickets,
    }
    return { state: { ...state, account }, receipt: account }
  },
})

export const ACCOUNT_OPERATIONS: readonly AnyOperationDef[] = [unlockUma, unlockCard, devGrant]
