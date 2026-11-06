// The account's operations (docs/game/02-unlocks.md, D381): unlocking an Uma or a support card with a ticket, a card
// only once its era's scenario is open, returning cards unlocked from later eras (D392), and the dev-only grant. Pure:
// the state, the input and `now` give the result.
import { cardEraOpen } from '../career/start'
import { defineOperation, refuse, type AnyOperationDef } from '../save/registry'
import { isUnlocked } from '../save/records'
import type { SaveState } from '../save/state'
import { isRowId } from '../save/kinds'
import { scenarioForTier } from '../scenarios'

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
    if (isUnlocked(state.cards[id])) return refuse('already-unlocked', `${card.title} is already in your Card Library.`)
    if (!cardEraOpen(card.era)) {
      const scenario = scenarioForTier(card.era)?.name ?? `scenario ${card.era}`
      return refuse('card-era', `${card.title} arrives with ${scenario}, which isn't open yet.`, { era: card.era })
    }
    if (state.account.cardTickets < 1) return refuse('no-tickets', 'You have no Card Tickets left.')
    const account = { ...state.account, cardTickets: state.account.cardTickets - 1 }
    return { state: { ...state, account, cards: { ...state.cards, [id]: { unlockedAt: now } } }, receipt: { id, ticketsLeft: account.cardTickets } }
  },
})

export interface ReturnLaterCardsReceipt {
  /** The cards locked again, by id. */
  readonly returned: readonly string[]
  readonly ticketsLeft: number
}

/**
 * `return-later-cards {}` (D392): every unlocked card whose era isn't open goes back, one Card Ticket each. A card in a
 * deck stays (the deck refuses later eras, so none is, but the rule holds anyway). The only way a card is ever locked
 * again; with nothing to return it changes nothing.
 */
/** The cards `return-later-cards` would lock again: unlocked, from an era that isn't open, and in no deck. By id. */
export function laterCards(state: Pick<SaveState, 'cards' | 'careers'>, cards: ReadonlyMap<string, { readonly era: number }>): string[] {
  const inDeck = new Set(Object.values(state.careers).flatMap((career) => career.deck))
  return Object.keys(state.cards).filter((id) => {
    const card = cards.get(id)
    return card !== undefined && isUnlocked(state.cards[id]) && !cardEraOpen(card.era) && !inDeck.has(id)
  }).sort()
}

export const returnLaterCards = defineOperation<Record<string, never>, ReturnLaterCardsReceipt>({
  name: 'return-later-cards',
  parse: (value) => (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0 ? {} : null),
  apply: (state, _input, now, env) => {
    const returned = laterCards(state, env.content.cards)
    if (returned.length === 0) return { state, receipt: { returned, ticketsLeft: state.account.cardTickets } }
    const cards = { ...state.cards }
    for (const id of returned) cards[id] = { unlockedAt: cards[id]!.unlockedAt, returnedAt: now }
    const account = { ...state.account, cardTickets: state.account.cardTickets + returned.length }
    return { state: { ...state, account, cards }, receipt: { returned, ticketsLeft: account.cardTickets } }
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

export const ACCOUNT_OPERATIONS: readonly AnyOperationDef[] = [unlockUma, unlockCard, returnLaterCards, devGrant]
