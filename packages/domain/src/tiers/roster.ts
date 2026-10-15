// Uma Tickets, Uma Shards and the roster (docs/game/04-tiers-and-promotion.md §6, D336): a new account holds 20
// tickets; a ticket unlocks an Uma not yet owned, always into tier 1, scenario 1; gates pay Shards, and five Shards make
// a ticket in an explicit exchange, as today. No Prize Money path makes a ticket. The featured Uma (game/11 §5) and
// each Uma's race defaults (03 §6–§7) are the roster's two settings, written by `feature-uma` and `set-race-defaults`
// (T138).
import { bestBaseDistance, type RacePreferences } from '../career-shapes'
import { recommendedRacePreferences } from '../scenario-goals'
import type { DistanceCategory } from '../types'
import { FIRST_EXCHANGE_GRADE } from '../economy/exchange'
import { emptyPurse } from '../economy/purse'
import { DEFAULT_CHECK_INS } from '../check-in/schedule'
import { emptyBuild, type OpResult, type ReworkState, type UmaState } from '../state/types'
import { careerAptitudes, freezeCareer, umaTemplate, type TierContent } from './career'
import { assertNow, hasLedgerEntry, withUma, writeLedger } from './ledger'
import { tierRefusal } from './refusals'

/** A new account's Uma Tickets (D323, 04 §6), under ledger `initial-uma-tickets`. */
export const INITIAL_UMA_TICKETS = 20
export const INITIAL_UMA_TICKETS_LEDGER_ID = 'initial-uma-tickets'
/** One ticket unlocks one Uma (04 §6). */
export const UMA_UNLOCK_TICKET_COST = 1
/** Five Shards make one ticket (D336). */
export const UMA_SHARDS_PER_TICKET = 5
/** One exchange makes one ticket, as today. */
export const TICKETS_PER_EXCHANGE = 1

export const unlockUmaLedgerId = (outfitId: string): string => `unlock-uma:${outfitId}`

/**
 * A generation-2 account on day one (13 §5): 20 Uma Tickets, no Umas, no work, nothing else. Its Daily Purse is empty
 * and the Exchange stocks grade 1 (T130, 09 §5.3). The planner's targets are automatic, the check-ins are 08:00, 13:00
 * and 22:30, and Repeat keeps the size (T131, 02 §3, §5, §6).
 */
export function newAccount(now: number): ReworkState {
  assertNow(now)
  return {
    profile: {
      generation: 2, createdAt: now, umaTickets: INITIAL_UMA_TICKETS, umaShards: 0, prizeMoney: 0, featuredUmaId: null,
      purse: emptyPurse(), exchangeGrade: FIRST_EXCHANGE_GRADE, targets: [], checkIns: DEFAULT_CHECK_INS, repeatSizing: 'same',
    },
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
 * The next exchange's number: one past the highest `uma-shard-exchange:{n}:shards` / `:coupon` row in the ledger.
 */
export function nextUmaShardExchangeSequence(ids: readonly string[]): number {
  let maximum = 0
  for (const id of ids) {
    const match = /^uma-shard-exchange:(\d+):(shards|coupon)$/.exec(id)
    if (!match) continue
    const sequence = Number(match[1])
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Invalid Uma shard exchange sequence')
    maximum = Math.max(maximum, sequence)
  }
  if (maximum >= Number.MAX_SAFE_INTEGER) throw new Error('Uma shard exchange sequence is exhausted')
  return maximum + 1
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

export interface FeatureUmaReceipt {
  readonly outfitId: string
  /** Who was featured before: the same Uma when she already was, which changes nothing. */
  readonly previous: string | null
}

/**
 * `feature-uma { outfitId }` (game/11 §5, 13 §6; T138): the Town Hall plaza's Uma, any owned one. Featuring the Uma
 * already featured changes nothing and answers as done.
 */
export function featureUma<S extends ReworkState>(state: S, input: { readonly outfitId: string }, now: number): OpResult<FeatureUmaReceipt, S> {
  assertNow(now)
  if (!state.umas[input.outfitId]) return tierRefusal('unknown-uma', { uma: input.outfitId })
  const previous = state.profile.featuredUmaId
  if (previous === input.outfitId) return { state, receipt: { outfitId: input.outfitId, previous } }
  return { state: { ...state, profile: { ...state.profile, featuredUmaId: input.outfitId } }, receipt: { outfitId: input.outfitId, previous } }
}

/** What `set-race-defaults` sets: the selected preset, her preferences (null: the recommendation), or both. */
export interface RaceDefaultsInput {
  readonly umaId: string
  readonly selectedPreset?: DistanceCategory
  readonly preferences?: RacePreferences | null
}

export interface RaceDefaultsReceipt {
  readonly umaId: string
  readonly raceDefaults: UmaState['raceDefaults']
}

/**
 * `set-race-defaults { umaId, selectedPreset?, preferences? }` (03 §6–§7, 13 §6; T138): the preset her profile and every
 * training screen show, and her preferred distance, surface and running style; kept at promotion (04 §4). Her career
 * stays as it was frozen, since preferences shape the next one (03 §4). Neither field given is a caller's bug.
 */
export function setRaceDefaults<S extends ReworkState>(state: S, input: RaceDefaultsInput, now: number): OpResult<RaceDefaultsReceipt, S> {
  assertNow(now)
  if (input.selectedPreset === undefined && input.preferences === undefined) throw new RangeError('Set a preset, preferences or both')
  const uma = state.umas[input.umaId]
  if (!uma) return tierRefusal('unknown-uma', { uma: input.umaId })
  const raceDefaults: UmaState['raceDefaults'] = {
    preferences: input.preferences === undefined ? uma.raceDefaults.preferences : input.preferences === null ? null : { ...input.preferences },
    selectedPreset: input.selectedPreset ?? uma.raceDefaults.selectedPreset,
  }
  return { state: withUma(state, { ...uma, raceDefaults }), receipt: { umaId: uma.outfitId, raceDefaults } }
}

/**
 * Her race preferences as a screen shows them (03 §7): the ones she has set, else today's recommendation from her career
 * aptitudes and the race catalogue, the one her career was frozen with.
 */
export function racePreferencesOf(uma: UmaState, content: TierContent): RacePreferences {
  return uma.raceDefaults.preferences
    ?? recommendedRacePreferences(careerAptitudes(uma, content), umaTemplate(content, uma.outfitId), content.races)
}
