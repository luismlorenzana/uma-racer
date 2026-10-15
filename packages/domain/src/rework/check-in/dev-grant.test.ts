// `dev-grant` (M034 "Dev shortcuts are dev-only"; T134): refused unless the env says `dev: true`; every grant is a ledger
// row, so 09 §9's audit holds; finishing her work ends it now and its queue moves on; the gate jump lets her advance.
import { describe, expect, it } from 'vitest'
import { account, clock, ENV, gather, nodes, ok, slot, uma } from '../../__fixtures__/rework-check-in'
import { GATE_SHARD_REWARD, umaGateShardLedgerId } from '../../progression'
import { careerComplete } from '../../scenario-goals'
import { ledgerTotal } from '../exchange/ledger'
import { craftedItem, SPEED_TICKET_ID } from '../items/catalogue'
import { lifetimeLevel } from '../tiers/map'
import { isRefusal } from '../types'
import { collect, queue, start } from '../work/operations'
import { endsAt } from '../work/timeline'
import { devGrant, devGrantLedgerId } from './dev-grant'
import { runOnce } from './once'
import { CHECK_IN_REFUSALS } from './words'

const NOW = clock('12:00')
const DEV = { ...ENV, dev: true }
const CHOPPED = craftedItem('vegetables', 1).id

describe('dev-grant', () => {
  it('is refused, changing nothing, unless the env says dev', () => {
    const state = account(1)
    for (const env of [ENV, { ...ENV, dev: false }]) {
      expect(devGrant(state, { prizeMoney: 500 }, NOW, env, 'grant-001')).toEqual({ refused: true, code: 'dev-only', reason: CHECK_IN_REFUSALS['dev-only'] })
      const once = runOnce(state, { id: 'grant-001', name: 'dev-grant', input: { prizeMoney: 500 } }, NOW, env)
      expect(isRefusal(once)).toBe(true)
    }
  })

  it('grants items, Prize Money and Uma Tickets as ledger rows, so the audit still holds', () => {
    const state = account(1)
    const result = ok(devGrant(state, { items: { [CHOPPED]: 4, [SPEED_TICKET_ID]: 2 }, prizeMoney: 5_000, umaTickets: 3 }, NOW, DEV, 'grant-002'))
    expect(result.state.profile).toMatchObject({ prizeMoney: 5_000, umaTickets: state.profile.umaTickets + 3 })
    expect(result.state.items).toEqual({ [CHOPPED]: 4, [SPEED_TICKET_ID]: 2 })
    expect(result.receipt.ledger).toEqual([
      { id: devGrantLedgerId('grant-002', 'prize-money'), resource: 'prize-money', delta: 5_000, reason: 'dev-grant', at: NOW },
      { id: devGrantLedgerId('grant-002', 'uma-tickets'), resource: 'uma-tickets', delta: 3, reason: 'dev-grant', at: NOW },
    ])
    expect(result.receipt.itemLedger).toEqual([
      { id: `dev-grant:grant-002:${CHOPPED}`, itemId: CHOPPED, delta: 4, reason: 'dev-grant', at: NOW },
      { id: `dev-grant:grant-002:${SPEED_TICKET_ID}`, itemId: SPEED_TICKET_ID, delta: 2, reason: 'dev-grant', at: NOW },
    ])
    expect(ledgerTotal(result.state.ledger, 'prize-money')).toBe(result.state.profile.prizeMoney)
  })

  it('finishes her running work now, without tickets, and her queue moves on', () => {
    let state = ok(start(account(1), { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 3) }, clock('11:00'), ENV)).state
    state = ok(queue(state, { outfitId: uma(1), add: { request: gather('wheat', 2), building: 'fields' } }, clock('11:01'), ENV)).state
    const result = ok(devGrant(state, { finish: uma(1) }, NOW, DEV, 'grant-003'))
    const row = result.state.work[uma(1)]!
    expect(result.receipt.finished).toEqual({ outfitId: uma(1), startedAt: clock('11:00') })
    expect(endsAt(row.entries[0]!)).toBe(NOW)
    expect(row.entries).toHaveLength(2)
    expect(row.entries[1]!.startedAt).toBe(NOW)
    expect(result.state.items[SPEED_TICKET_ID]).toBeUndefined()
    expect(collect(result.state, { outfitId: uma(1) }, NOW, ENV).receipt.outputs).toHaveLength(3)
    // Nothing running: no change to her work.
    expect(ok(devGrant(account(1), { finish: uma(1) }, NOW, DEV, 'grant-004')).receipt.finished).toBeNull()
  })

  it('jumps her to her gate with her career won, pays the Shard once, and she can advance', () => {
    const state = account(1)
    const result = ok(devGrant(state, { gate: uma(1) }, NOW, DEV, 'grant-005'))
    const her = result.state.umas[uma(1)]!
    expect(her.racing).toEqual({ level: 10, exp: 0 })
    expect(careerComplete(her.career)).toBe(true)
    expect(result.receipt.gate).toEqual({ umaId: uma(1), level: 10, shardsPaid: GATE_SHARD_REWARD })
    expect(result.state.ledger.at(-1)!.id).toBe(umaGateShardLedgerId(uma(1), lifetimeLevel(1, 10)))
    expect(ok(devGrant(result.state, { gate: uma(1) }, NOW, DEV, 'grant-006')).receipt.gate!.shardsPaid).toBe(0)
    const advanced = runOnce(result.state, { id: 'advance-01', name: 'advance-scenario', input: { umaId: uma(1) } }, NOW, ENV)
    if (isRefusal(advanced)) throw new Error(advanced.reason)
    expect(advanced.state.umas[uma(1)]!.scenario).toBe(2)
  })

  it('treats a malformed grant as a caller bug, and an unknown Uma as a refusal', () => {
    const state = ok(start(account(1, { 'dish-vegetables-1': 1 }), { outfitId: uma(1), slot: slot('observatory'), request: nodes(1) }, NOW, ENV)).state
    expect(() => devGrant(state, { prizeMoney: 0 }, NOW, DEV, 'grant-007')).toThrow(RangeError)
    expect(() => devGrant(state, { items: { 'no-such-item': 1 } }, NOW, DEV, 'grant-008')).toThrow(RangeError)
    expect(() => devGrant(state, { items: { [CHOPPED]: 1.5 } }, NOW, DEV, 'grant-009')).toThrow(RangeError)
    expect(devGrant(state, { gate: 'nobody' }, NOW, DEV, 'grant-010')).toMatchObject({ refused: true, code: 'unknown-uma' })
  })
})
