// `finish-race` (docs/rework/09-racing-rewards-and-exchange.md §9; docs/rework/01-game-loop.md §2; T134): a race's whole
// commit in one operation, once under its id. Her finished unlocks are collected first and a Farm job runs on; Racing EXP,
// goals and the gate's Shard follow; Prize Money and a featured bonus land under the race's ledger ids.
import { describe, expect, it } from 'vitest'
import { raceRun } from '../__fixtures__/race-run'
import { account, CHECK_IN_CONTENT, clock, ENV, gather, nodes, ok, slot, uma } from '../__fixtures__/check-in'
import { placeUma } from '../__fixtures__/tiers'
import { expToNextUmaLevel, raceExp, umaGateShardLedgerId } from '../progression'
import { goalRaceIds } from '../scenario-goals'
import { featuredBonusLedgerId, racePrizeLedgerId } from '../economy/ledger'
import { WIN_PRIZE } from '../economy/prizes'
import { deriveUmaPreset } from '../training/derive'
import { isRefusal } from '../state/types'
import { start } from '../work/operations'
import type { WorkState } from '../work/types'
import { finishRace } from './finish-race'
import { runOnce } from './once'

const NOW = clock('12:00')
const DAY = '2026-10-14'
const firstGoalRace = (state: WorkState, outfitId: string) => goalRaceIds(state.umas[outfitId]!.career.goals[0]!)[0]!
const input = (state: WorkState, outfitId: string, extra: Partial<Parameters<typeof finishRace>[1]> = {}) => ({
  umaId: outfitId, raceId: firstGoalRace(state, outfitId), placement: 1, localDay: DAY, board: [], run: raceRun(outfitId), ...extra,
})

describe('finish-race', () => {
  it('collects her finished unlocks first, then races on the preset of the race distance', () => {
    // Two sessions of 216 minutes each from 04:00: both are finished by noon.
    const studying = ok(start(account(1, { 'dish-vegetables-1': 2 }), { outfitId: uma(1), slot: slot('observatory'), request: nodes(1, 2) }, clock('04:00'), ENV)).state
    const result = ok(finishRace(studying, input(studying, uma(1)), NOW, ENV, 'race-op-01'))
    expect(result.receipt.collect.outputs.map((output) => 'unlock' in output && output.unlock.target)).toEqual(['n1', 'n2'])
    expect(result.state.umas[uma(1)]!.build.constellationOpened).toBe(2)
    expect(result.state.work[uma(1)]?.entries ?? []).toEqual([])
    const race = ENV.content.races.find((entry) => entry.id === firstGoalRace(studying, uma(1)))!
    expect(result.receipt.raceBonus).toBe(deriveUmaPreset(result.state.umas[uma(1)]!, race.distanceCategory, ENV.content).raceBonus)
    expect(result.receipt.grade).toBe(race.grade)
    expect(result.receipt.finish.completedGoalIds).toEqual([studying.umas[uma(1)]!.career.goals[0]!.id])
    expect(result.receipt.finish.expGained).toBe(raceExp(race.grade, 1, result.receipt.raceBonus))
    expect(result.receipt.movements).toEqual(result.receipt.collect.movements)
  })

  it('leaves a Farm job running and uncollected', () => {
    const working = ok(start(account(1), { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 3) }, clock('06:00'), ENV)).state
    const result = ok(finishRace(working, input(working, uma(1)), NOW, ENV, 'race-op-02'))
    expect(result.state.work[uma(1)]).toEqual(working.work[uma(1)])
    expect(result.receipt.collect.outputs).toEqual([])
    expect(result.state.items).toEqual(working.items)
  })

  it('pays the prize and a featured first win under race:<id>:prize and race:<id>:featured, through the purse', () => {
    const state = account(1)
    const raceId = firstGoalRace(state, uma(1))
    const grade = ENV.content.races.find((entry) => entry.id === raceId)!.grade
    const result = ok(finishRace(state, input(state, uma(1), { board: [raceId] }), NOW, ENV, 'race-op-03'))
    const rows = result.state.ledger.slice(state.ledger.length)
    expect(rows).toEqual([
      { id: racePrizeLedgerId('race-op-03'), resource: 'prize-money', delta: result.receipt.prize.paid, reason: 'race-prize', at: NOW },
      { id: featuredBonusLedgerId('race-op-03'), resource: 'prize-money', delta: WIN_PRIZE[grade], reason: 'featured-bonus', at: NOW },
    ])
    expect(result.receipt.prize).toMatchObject({ gross: WIN_PRIZE[grade], paid: WIN_PRIZE[grade], featuredBonus: WIN_PRIZE[grade] })
    expect(result.state.profile.prizeMoney).toBe(2 * WIN_PRIZE[grade])
    expect(result.state.profile.purse).toEqual({ day: DAY, gross: WIN_PRIZE[grade], featuredPaid: [raceId] })
    // The bonus is the day's once: a second win of the race pays its prize, not the bonus again.
    const again = ok(finishRace(result.state, input(result.state, uma(1), { raceId, board: [raceId] }), NOW + 1, ENV, 'race-op-04'))
    expect(again.receipt.prize.featuredBonus).toBe(0)
  })

  it("pays a gate's Shard once", () => {
    const gate = 10
    const state = account(1)
    const placed = placeUma(state.umas[uma(1)]!, { tier: 1, scenario: 1, level: gate - 1, exp: expToNextUmaLevel(gate - 1) - 1, careerWon: true }, CHECK_IN_CONTENT)
    const near: WorkState = { ...state, umas: { ...state.umas, [uma(1)]: placed } }
    const raceId = ENV.content.races.find((entry) => entry.grade === 'g1')!.id
    const first = ok(finishRace(near, input(near, uma(1), { raceId }), NOW, ENV, 'race-op-05'))
    expect(first.receipt.finish).toMatchObject({ reachedGate: gate, shardsPaid: 1 })
    expect(first.state.profile.umaShards).toBe(1)
    const second = ok(finishRace(first.state, input(first.state, uma(1), { raceId }), NOW + 1, ENV, 'race-op-06'))
    expect(second.receipt.finish).toMatchObject({ reachedGate: null, shardsPaid: 0 })
    expect(second.state.ledger.filter((row) => row.id === umaGateShardLedgerId(uma(1), gate))).toHaveLength(1)
  })

  it('is one operation: once under its id, refused for an unknown Uma, and a caller bug for an unknown race', () => {
    const state = account(1)
    const call = { id: 'race-op-07', name: 'finish-race' as const, input: input(state, uma(1)) }
    const first = runOnce(state, call, NOW, ENV)
    if (isRefusal(first)) throw new Error(first.reason)
    const retry = runOnce(first.state, call, NOW + 1, ENV)
    expect(retry).toEqual({ state: first.state, receipt: first.receipt, repeated: true })
    expect(finishRace(state, input(state, uma(1), { umaId: 'nobody' }), NOW, ENV, 'race-op-08')).toMatchObject({ refused: true, code: 'unknown-uma' })
    expect(() => finishRace(state, input(state, uma(1), { raceId: 'no-such-race' }), NOW, ENV, 'race-op-09')).toThrow(RangeError)
  })
})
