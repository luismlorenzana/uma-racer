// The stand-in Expedition and the Hall of Fame (docs/rework/04-tiers-and-promotion.md §3, §10, D332).
import { describe, expect, it } from 'vitest'
import { CONTENT, COLT, placeUma } from '../../__fixtures__/rework-tiers'
import { isRefusal, type ReworkState, type ScenarioOfTier, type Tier } from '../types'
import { advanceReadiness } from './advance'
import { EXPEDITION_WINS, recordExpeditionRace, type ExpeditionRaceReceipt } from './expedition'
import { scenarioCatalogue } from './map'
import { induct } from './promotion'
import { newAccount, unlockUma } from './roster'

const FIFTEEN = scenarioCatalogue(15)

function account(): ReworkState {
  const result = unlockUma(newAccount(0), { outfitId: COLT.id }, 1, { content: CONTENT })
  if (isRefusal(result)) throw new Error(result.reason)
  return result.state
}
const BASE = account()
const stateAt = (tier: Tier, scenario: ScenarioOfTier, level: number, careerWon = true): ReworkState =>
  ({ ...BASE, umas: { [COLT.id]: placeUma(BASE.umas[COLT.id]!, { tier, scenario, level, careerWon }) } })

function race(state: ReworkState, won: boolean, at: number, expeditionId = 'europe', catalogue = scenarioCatalogue(14)) {
  const result = recordExpeditionRace(state, { umaId: COLT.id, expeditionId, won }, at, { catalogue })
  if (isRefusal(result)) throw new Error(result.reason)
  return result
}
function runToEight(state: ReworkState, losses = 2): { state: ReworkState; receipts: ExpeditionRaceReceipt[] } {
  const receipts: ExpeditionRaceReceipt[] = []
  let next = state
  for (let i = 0; i < EXPEDITION_WINS + losses; i += 1) {
    const step = race(next, i >= losses, 100 + i)
    receipts.push(step.receipt)
    next = step.state
  }
  return { state: next, receipts }
}

describe('recordExpeditionRace', () => {
  it("opens only at the tier's last gate with her career complete", () => {
    expect(recordExpeditionRace(stateAt(1, 4, 40), { umaId: COLT.id, expeditionId: 'europe', won: true }, 1))
      .toMatchObject({ refused: true, code: 'not-at-gate', data: { uma: COLT.id, level: 50 } })
    expect(recordExpeditionRace(stateAt(1, 5, 50, false), { umaId: COLT.id, expeditionId: 'europe', won: true }, 1))
      .toMatchObject({ refused: true, code: 'career-open' })
    expect(recordExpeditionRace(stateAt(1, 5, 50), { umaId: 'nobody', expeditionId: 'europe', won: true }, 1))
      .toMatchObject({ refused: true, code: 'unknown-uma' })
  })

  it('counts races and wins, completes the run on its eighth win, and refuses more', () => {
    const { state, receipts } = runToEight(stateAt(1, 5, 50))
    expect(receipts.map((receipt) => receipt.completedNow)).toEqual([...Array(9).fill(false), true])
    expect(receipts.at(-1)).toMatchObject({ readyForPromotion: true, inducted: false, ticketsPaid: 0, awards: [] })
    expect(state.umas[COLT.id]!.expedition.runs).toEqual([{ expeditionId: 'europe', races: 10, wins: 8, completed: true }])
    expect(recordExpeditionRace(state, { umaId: COLT.id, expeditionId: 'europe', won: true }, 200)).toEqual({
      refused: true, code: 'run-complete', reason: '{uma} already has her eight wins in this Expedition.', data: { uma: COLT.id },
    })
    // Another Expedition is its own run.
    expect(race(state, false, 201, 'asia').state.umas[COLT.id]!.expedition.runs).toHaveLength(2)
    expect(state.profile).toBe(stateAt(1, 5, 50).profile)
  })

  it("inducts a tier-3 Uma in the eighth win's own call, resets nothing and pays one ticket", () => {
    const start = stateAt(3, 4, 40)
    const { state, receipts } = runToEight(start)
    const uma = state.umas[COLT.id]!
    expect(receipts.at(-1)).toMatchObject({ completedNow: true, readyForPromotion: false, inducted: true, ticketsPaid: 1, awards: ['hall-of-fame'] })
    expect(uma.hallOfFame).toEqual({ inductedAt: 109 })
    expect(uma).toMatchObject({ tier: 3, scenario: 4, racing: start.umas[COLT.id]!.racing })
    expect(uma.build).toBe(start.umas[COLT.id]!.build)
    expect(uma.career).toBe(start.umas[COLT.id]!.career)
    expect(uma.expedition.runs).toEqual([{ expeditionId: 'europe', races: 10, wins: 8, completed: true }])
    expect(state.profile.umaTickets).toBe(start.profile.umaTickets + 1)
    expect(state.ledger.at(-1)).toEqual({ id: 'promotion-uma-ticket:colt:3', resource: 'uma-tickets', delta: 1, reason: 'promotion-uma-ticket', at: 109 })
    // Other Expeditions stay open to her, for their titles alone, and never induct or pay again.
    let other = state
    let last: ExpeditionRaceReceipt | undefined
    for (let i = 0; i < EXPEDITION_WINS; i += 1) ({ state: other, receipt: last } = race(other, true, 300 + i, 'asia'))
    expect(last).toMatchObject({ completedNow: true, inducted: false, ticketsPaid: 0, awards: [] })
    expect(other.profile.umaTickets).toBe(state.profile.umaTickets)
    expect(other.umas[COLT.id]!.hallOfFame).toEqual({ inductedAt: 109 })
  })

  it('lets an inducted Uma advance into the 15th once it lands, and an open run continue at scenario 14', () => {
    const inducted = runToEight(stateAt(3, 4, 40)).state
    expect(advanceReadiness(inducted.umas[COLT.id]!, FIFTEEN)).toMatchObject({ ready: true, to: { tier: 3, scenario: 5 } })
    let open = stateAt(3, 4, 40)
    for (let i = 0; i < 3; i += 1) open = race(open, true, 10 + i).state
    // The 15th lands: scenario 14 is no longer tier 3's last, but her open run carries on (04 §2).
    const more = race(open, true, 20, 'europe', FIFTEEN)
    expect(more.receipt.run).toMatchObject({ races: 4, wins: 4 })
    expect(recordExpeditionRace(open, { umaId: COLT.id, expeditionId: 'asia', won: true }, 21, { catalogue: FIFTEEN }))
      .toMatchObject({ refused: true, code: 'not-at-gate', data: { level: 50 } })
  })
})

describe('induct', () => {
  it('needs tier 3 and a completed run, once', () => {
    expect(induct(stateAt(1, 5, 50), { umaId: COLT.id }, 1)).toMatchObject({ refused: true, code: 'use-promotion', data: { tier: 1 } })
    expect(induct(stateAt(3, 4, 40), { umaId: COLT.id }, 1)).toMatchObject({ refused: true, code: 'no-expedition' })
    const inducted = runToEight(stateAt(3, 4, 40)).state
    expect(induct(inducted, { umaId: COLT.id }, 1)).toMatchObject({ refused: true, code: 'inducted' })
    expect(induct(inducted, { umaId: 'nobody' }, 1)).toMatchObject({ refused: true, code: 'unknown-uma' })
  })
})
