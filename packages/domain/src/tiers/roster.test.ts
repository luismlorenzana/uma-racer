// Uma Tickets, Shards and unlocking (docs/game/04-tiers-and-promotion.md §6, D336, 13 §5).
import { describe, expect, it } from 'vitest'
import { CONTENT, COLT, SPRINTER } from '../__fixtures__/tiers'
import { GATE_SHARD_REWARD } from '../progression'
import { emptyBuild, isRefusal, type ReworkState } from '../state/types'
import { freezeCareer } from './career'
import { EXPEDITION_WINS } from './expedition'
import { PROMOTION_UMA_TICKETS } from './promotion'
import { recommendedRacePreferences } from '../scenario-goals'
import {
  INITIAL_UMA_TICKETS, UMA_SHARDS_PER_TICKET, UMA_UNLOCK_TICKET_COST, exchangeShards, featureUma, newAccount, nextUmaShardExchangeSequence,
  racePreferencesOf, setRaceDefaults, unlockUma,
} from './roster'

function ok<R>(result: { state: ReworkState; receipt: R } | { refused: true; reason: string }): { state: ReworkState; receipt: R } {
  if ('refused' in result) throw new Error(result.reason)
  return result
}

describe('the numbers', () => {
  it('are 20 tickets to start, 1 an unlock, 1 a promotion, 1 Shard a gate, 5 a ticket and 8 Expedition wins', () => {
    expect([INITIAL_UMA_TICKETS, UMA_UNLOCK_TICKET_COST, PROMOTION_UMA_TICKETS, GATE_SHARD_REWARD, UMA_SHARDS_PER_TICKET, EXPEDITION_WINS])
      .toEqual([20, 1, 1, 1, 5, 8])
  })
})

describe('a new account', () => {
  it('holds 20 Uma Tickets and one ledger row', () => {
    expect(newAccount(42)).toEqual({
      profile: {
        generation: 2, createdAt: 42, umaTickets: 20, umaShards: 0, prizeMoney: 0, featuredUmaId: null,
        purse: { day: '1970-01-01', gross: 0, featuredPaid: [] }, exchangeGrade: 1, targets: [], checkIns: [480, 780, 1350], repeatSizing: 'same',
      },
      umas: {},
      work: {},
      ledger: [{ id: 'initial-uma-tickets', resource: 'uma-tickets', delta: 20, reason: 'initial-uma-tickets', at: 42 }],
    })
    expect(() => newAccount(1.5)).toThrow(RangeError)
  })
})

describe('unlockUma', () => {
  it('spends one ticket for an Uma at T1 · s1 · Racing Lv 1 · Farm Lv 1 with a frozen career (03 §12)', () => {
    const { state, receipt } = ok(unlockUma(newAccount(0), { outfitId: COLT.id }, 7, { content: CONTENT }))
    expect(receipt).toEqual({ outfitId: COLT.id, ticketsSpent: 1, featured: true })
    expect(state.profile).toMatchObject({ umaTickets: 19, featuredUmaId: COLT.id })
    expect(state.ledger.at(-1)).toEqual({ id: 'unlock-uma:colt', resource: 'uma-tickets', delta: -1, reason: 'unlock-uma', at: 7 })
    const uma = state.umas[COLT.id]!
    expect(uma).toMatchObject({ outfitId: COLT.id, tier: 1, scenario: 1, racing: { level: 1, exp: 0 }, farm: { level: 1, exp: 0 },
      closedCareers: [], expedition: { runs: [] }, tierHistory: [], hallOfFame: null, raceDefaults: { preferences: null, selectedPreset: 'medium' } })
    expect(uma.build).toEqual(emptyBuild('unique-colt'))
    expect(uma.build.presets.long.loadoutSkillIds).toEqual(['unique-colt'])
    expect(uma.career).toEqual(freezeCareer(uma, 1, CONTENT))
    expect(uma.career).toMatchObject({ tier: 1, state: 'active' })
  })

  it('keeps the featured Uma once there is one, and an Uma without a unique starts with an empty loadout', () => {
    const first = ok(unlockUma(newAccount(0), { outfitId: COLT.id }, 1, { content: CONTENT })).state
    const second = ok(unlockUma(first, { outfitId: SPRINTER.id }, 2, { content: CONTENT }))
    expect(second.receipt.featured).toBe(false)
    expect(second.state.profile).toMatchObject({ umaTickets: 18, featuredUmaId: COLT.id })
    expect(second.state.umas[SPRINTER.id]!.build.presets.sprint.loadoutSkillIds).toEqual([])
    expect(second.state.umas[SPRINTER.id]!.raceDefaults.selectedPreset).toBe('sprint')
  })

  it("refuses an Uma she already owns, and an unlock without a ticket", () => {
    const owned = ok(unlockUma(newAccount(0), { outfitId: COLT.id }, 1, { content: CONTENT })).state
    expect(unlockUma(owned, { outfitId: COLT.id }, 2, { content: CONTENT })).toEqual({
      refused: true, code: 'owned', reason: '{uma} is already in your Stable.', data: { uma: COLT.id },
    })
    const broke = { ...newAccount(0), profile: { ...newAccount(0).profile, umaTickets: 0 } }
    expect(unlockUma(broke, { outfitId: COLT.id }, 2, { content: CONTENT })).toMatchObject({ refused: true, code: 'no-ticket' })
    expect(() => unlockUma(newAccount(0), { outfitId: 'nobody' }, 2, { content: CONTENT })).toThrow(RangeError)
  })
})

describe('exchangeShards', () => {
  const withShards = (umaShards: number, ledger: ReworkState['ledger'] = []): ReworkState =>
    ({ ...newAccount(0), profile: { ...newAccount(0).profile, umaShards }, ledger: [...newAccount(0).ledger, ...ledger] })

  it('refuses under five Shards', () => {
    expect(exchangeShards(withShards(4), {}, 1)).toEqual({
      refused: true, code: 'shards', reason: 'You need {need} Uma Shards for an Uma Ticket. You have {have}.', data: { need: 5, have: 4 },
    })
  })

  it("turns five Shards into one ticket under today's numbered pair", () => {
    const { state, receipt } = ok(exchangeShards(withShards(12), {}, 9))
    expect(receipt).toEqual({ sequence: 1, shardsSpent: 5, ticketsGained: 1 })
    expect(state.profile).toMatchObject({ umaShards: 7, umaTickets: 21 })
    expect(state.ledger.slice(-2)).toEqual([
      { id: 'uma-shard-exchange:1:shards', resource: 'uma-shards', delta: -5, reason: 'uma-shard-exchange', at: 9 },
      { id: 'uma-shard-exchange:1:coupon', resource: 'uma-tickets', delta: 1, reason: 'uma-shard-exchange', at: 9 },
    ])
    const second = ok(exchangeShards(state, {}, 10))
    expect(second.receipt.sequence).toBe(2)
    expect(second.state.profile.umaShards).toBe(2)
    expect(isRefusal(exchangeShards(second.state, {}, 11))).toBe(true)
  })

  it('numbers its rows after the highest one, as today', () => {
    const old = withShards(5, [{ id: 'uma-shard-exchange:7:shards', resource: 'uma-shards', delta: -5, reason: 'uma-shard-exchange', at: 1 }])
    expect(ok(exchangeShards(old, {}, 2)).receipt.sequence).toBe(8)
    expect(nextUmaShardExchangeSequence(['other:1', 'uma-shard-exchange:2:coupon', 'uma-shard-exchange:7:shards'])).toBe(8)
  })
})

describe('featureUma (game/11 §5, T138)', () => {
  const two = () => ok(unlockUma(ok(unlockUma(newAccount(0), { outfitId: COLT.id }, 1, { content: CONTENT })).state,
    { outfitId: SPRINTER.id }, 2, { content: CONTENT })).state

  it('features any owned Uma, naming who was featured before', () => {
    const { state, receipt } = ok(featureUma(two(), { outfitId: SPRINTER.id }, 3))
    expect(receipt).toEqual({ outfitId: SPRINTER.id, previous: COLT.id })
    expect(state.profile.featuredUmaId).toBe(SPRINTER.id)
    expect(state.ledger).toEqual(two().ledger)
  })

  it('changes nothing for the Uma already featured, and refuses one not in the Stable', () => {
    const state = two()
    expect(featureUma(state, { outfitId: COLT.id }, 3)).toEqual({ state, receipt: { outfitId: COLT.id, previous: COLT.id } })
    expect(featureUma(state, { outfitId: 'nobody' }, 3)).toMatchObject({ refused: true, code: 'unknown-uma', data: { uma: 'nobody' } })
    expect(() => featureUma(state, { outfitId: COLT.id }, 1.5)).toThrow(RangeError)
  })
})

describe('setRaceDefaults (03 §6–§7, T138)', () => {
  const one = () => ok(unlockUma(newAccount(0), { outfitId: COLT.id }, 1, { content: CONTENT })).state
  const preferences = { strategy: 'late', distance: 'long', surface: 'turf' } as const

  it('sets the selected preset, her preferences, or both, keeping the other', () => {
    const preset = ok(setRaceDefaults(one(), { umaId: COLT.id, selectedPreset: 'long' }, 2))
    expect(preset.receipt).toEqual({ umaId: COLT.id, raceDefaults: { preferences: null, selectedPreset: 'long' } })
    const both = ok(setRaceDefaults(preset.state, { umaId: COLT.id, preferences }, 3))
    expect(both.state.umas[COLT.id]!.raceDefaults).toEqual({ preferences, selectedPreset: 'long' })
    const back = ok(setRaceDefaults(both.state, { umaId: COLT.id, selectedPreset: 'mile', preferences: null }, 4))
    expect(back.state.umas[COLT.id]!.raceDefaults).toEqual({ preferences: null, selectedPreset: 'mile' })
  })

  it('leaves her frozen career, build and ledger alone', () => {
    const before = one()
    const { state } = ok(setRaceDefaults(before, { umaId: COLT.id, preferences }, 2))
    const { raceDefaults: _, ...rest } = state.umas[COLT.id]!
    const { raceDefaults: __, ...was } = before.umas[COLT.id]!
    expect(rest).toEqual(was)
    expect(state.ledger).toEqual(before.ledger)
  })

  it('refuses an Uma not in the Stable, and an input setting nothing is a caller bug', () => {
    expect(setRaceDefaults(one(), { umaId: 'nobody', selectedPreset: 'mile' }, 2)).toMatchObject({ refused: true, code: 'unknown-uma' })
    expect(() => setRaceDefaults(one(), { umaId: COLT.id }, 2)).toThrow(RangeError)
  })

  it("reads her preferences, or today's recommendation from her career aptitudes until she sets them", () => {
    const uma = one().umas[COLT.id]!
    const recommended = recommendedRacePreferences(COLT.aptitudes, COLT, CONTENT.races)
    expect(racePreferencesOf(uma, CONTENT)).toEqual(recommended)
    const set = ok(setRaceDefaults(one(), { umaId: COLT.id, preferences }, 2)).state.umas[COLT.id]!
    expect(racePreferencesOf(set, CONTENT)).toEqual(preferences)
  })
})
