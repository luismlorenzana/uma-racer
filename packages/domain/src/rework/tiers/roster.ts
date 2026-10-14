// Uma Tickets, Uma Shards and the roster (docs/rework/04-tiers-and-promotion.md §6, D336): a new account holds 20
// tickets; a ticket unlocks an Uma not yet owned, always into tier 1, scenario 1; gates pay Shards, and five Shards make
// a ticket in an explicit exchange, as today. No Prize Money path makes a ticket.
import { nextUmaShardExchangeSequence } from '../../collection'
import { UMA_SHARDS_PER_COUPON } from '../../economy'
import { bestBaseDistance } from '../../save'
import { emptyBuild, type OpResult, type ReworkState, type UmaState } from '../types'
import { freezeCareer, umaTemplate, type TierContent } from './career'
import { assertNow, hasLedgerEntry, withUma, writeLedger } from './ledger'
import { tierRefusal } from './refusals'

/** A new account's Uma Tickets (D323, 04 §6), under ledger `initial-uma-tickets`. */
export const INITIAL_UMA_TICKETS = 20
export const INITIAL_UMA_TICKETS_LEDGER_ID = 'initial-uma-tickets'
/** One ticket unlocks one Uma (04 §6). */
export const UMA_UNLOCK_TICKET_COST = 1
/** Five Shards make one ticket: today's `UMA_SHARDS_PER_COUPON` (D336). */
export const UMA_SHARDS_PER_TICKET = UMA_SHARDS_PER_COUPON
/** One exchange makes one ticket, as today. */
export const TICKETS_PER_EXCHANGE = 1

export const unlockUmaLedgerId = (outfitId: string): string => `unlock-uma:${outfitId}`

/** A generation-2 account on day one (13 §5): 20 Uma Tickets, no Umas, no work, nothing else. */
export function newAccount(now: number): ReworkState {
  assertNow(now)
  return {
    profile: { generation: 2, createdAt: now, umaTickets: INITIAL_UMA_TICKETS, umaShards: 0, prizeMoney: 0, featuredUmaId: null },
    umas: {},
    work: {},
    ledger: [{ id: INITIAL_UMA_TICKETS_LEDGER_ID, resource: 'uma-tickets', delta: INITIAL_UMA_TICKETS, reason: 'initial-uma-tickets', at: now }],
  }
}

export interface UnlockUmaReceipt {
  readonly outfitId: string
  readonly ticketsSpent: number
  /** True when she became the featured Uma because none was. */
  readonly featured: boolean
}

/**
 * `unlock-uma` (13 §6): one ticket brings an unowned Uma into tier 1, scenario 1, Racing Lv 1, Farm Lv 1, with an empty
 * build and her career frozen (03 §12). She becomes the featured Uma if none is.
 */
export function unlockUma<S extends ReworkState>(
  state: S,
  input: { readonly outfitId: string },
  now: number,
  env: { readonly content: TierContent },
): OpResult<UnlockUmaReceipt, S> {
  assertNow(now)
  if (state.umas[input.outfitId] || hasLedgerEntry(state, unlockUmaLedgerId(input.outfitId))) {
    return tierRefusal('owned', { uma: input.outfitId })
  }
  const template = umaTemplate(env.content, input.outfitId)
  if (state.profile.umaTickets < UMA_UNLOCK_TICKET_COST) return tierRefusal('no-ticket', { uma: input.outfitId })

  const fresh: Omit<UmaState, 'career'> = {
    outfitId: input.outfitId,
    tier: 1,
    scenario: 1,
    racing: { level: 1, exp: 0 },
    farm: { level: 1, exp: 0 },
    closedCareers: [],
    build: emptyBuild(template.uniqueSkillId),
    expedition: { runs: [] },
    tierHistory: [],
    raceDefaults: { preferences: null, selectedPreset: bestBaseDistance(template) },
    hallOfFame: null,
  }
  const uma: UmaState = { ...fresh, career: freezeCareer(fresh, 1, env.content) }

  const featured = state.profile.featuredUmaId === null
  const paid = writeLedger(state, {
    id: unlockUmaLedgerId(input.outfitId), resource: 'uma-tickets', delta: -UMA_UNLOCK_TICKET_COST, reason: 'unlock-uma',
  }, now)
  const next = withUma(featured ? { ...paid, profile: { ...paid.profile, featuredUmaId: input.outfitId } } : paid, uma)
  return { state: next, receipt: { outfitId: input.outfitId, ticketsSpent: UMA_UNLOCK_TICKET_COST, featured } }
}

export interface ExchangeShardsReceipt {
  readonly sequence: number
  readonly shardsSpent: number
  readonly ticketsGained: number
}

/**
 * The Stable's Shard exchange (04 §6): five Uma Shards become one Uma Ticket, numbered with today's sequence and its
 * `uma-shard-exchange:{n}:shards` / `:coupon` ledger pair (Uma Select Coupons are Uma Tickets under their new name).
 */
export function exchangeShards<S extends ReworkState>(
  state: S,
  _input: Readonly<Record<string, never>>,
  now: number,
): OpResult<ExchangeShardsReceipt, S> {
  assertNow(now)
  if (state.profile.umaShards < UMA_SHARDS_PER_TICKET) {
    return tierRefusal('shards', { need: UMA_SHARDS_PER_TICKET, have: state.profile.umaShards })
  }
  const sequence = nextUmaShardExchangeSequence(state.ledger.map((entry) => entry.id))
  const prefix = `uma-shard-exchange:${sequence}`
  const spent = writeLedger(state, { id: `${prefix}:shards`, resource: 'uma-shards', delta: -UMA_SHARDS_PER_TICKET, reason: 'uma-shard-exchange' }, now)
  const next = writeLedger(spent, { id: `${prefix}:coupon`, resource: 'uma-tickets', delta: TICKETS_PER_EXCHANGE, reason: 'uma-shard-exchange' }, now)
  return { state: next, receipt: { sequence, shardsSpent: UMA_SHARDS_PER_TICKET, ticketsGained: TICKETS_PER_EXCHANGE } }
}
