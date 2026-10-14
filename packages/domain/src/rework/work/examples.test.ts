// The pages' worked examples through the operations: 07 §2's Potatoes at k = 1.2, 07 §2's Kitchen recall and 05 §2's
// night at the Observatory (with the tests' synthetic session kind, in the page's base minutes). The base-seconds
// versions of 07 §2 and 09 §5.1 are in timeline.test.ts.
import { describe, expect, it } from 'vitest'
import {
  atFarmLevel, clock, ENV, farmAccount, minutes, node, ok, PLAIN, SESSION_ENV, STUDENT, withNodes, withStock,
} from '../../__fixtures__/rework-work'
import { farmItemSeconds } from '../farm/jobs'
import { collect, finish, queue, recall, speedUp, start } from './operations'
import { endsAt } from './timeline'
import type { FarmRequest, SlotRef } from './types'

describe("07 §2: Gather Potato × 10 at 08:00, at k = 1.2", () => {
  const GARDEN: SlotRef = { building: 'vegetable-garden', slot: 0 }
  const potatoes: FarmRequest = { kind: 'gather', item: 'potato', count: 10 }
  const carrots: FarmRequest = { kind: 'gather', item: 'carrot', count: 6 }
  // 95 base minutes × 1.2 = 114 a Potato; 90 × 1.2 = 108 a Carrot. The page's 13:00 and 22:30 scale to 14:00 and 01:24.
  const POTATO = minutes(114), CARROT = minutes(108)

  function morning() {
    const state = withStock(atFarmLevel(farmAccount(), PLAIN.id, 7), { 'speed-ticket': 1 })
    let next = ok(start(state, { outfitId: PLAIN.id, slot: GARDEN, request: potatoes }, clock('08:00'), ENV)).state
    next = ok(queue(next, { outfitId: PLAIN.id, add: { request: carrots, building: 'vegetable-garden' } }, clock('08:00'), ENV)).state
    const check = collect(next, { outfitId: PLAIN.id }, clock('14:00'), ENV)
    const sped = ok(speedUp(check.state, { outfitId: PLAIN.id, startedAt: clock('08:00'), tickets: 1 }, clock('14:00'), ENV))
    return { check, sped }
  }

  it('pays 3 Potatoes and 342 Farm EXP at the check-in, and a ticket ends the job at 02:30', () => {
    expect(farmItemSeconds('gather', 2)).toBe(6_840)
    const { check, sped } = morning()
    expect(check.receipt.outputs).toHaveLength(3)
    expect(check.receipt.farmExp).toBe(3 * 114 * 4)
    expect(check.state.items).toMatchObject({ potato: 3 })
    expect(sped.receipt).toMatchObject({ tickets: 1, savedMinutes: 30, wastedMinutes: 0, endsAt: clock('02:30', 1) })
    expect(clock('08:00') + 10 * POTATO - minutes(30)).toBe(clock('02:30', 1))
  })

  it('starts the Carrots at the tenth Potato’s end, with nothing to reserve', () => {
    const { sped } = morning()
    const late = collect(sped.state, { outfitId: PLAIN.id }, clock('14:00', 1), ENV)
    expect(late.receipt.settled.started).toEqual([{ outfitId: PLAIN.id, slot: GARDEN, at: clock('02:30', 1), request: carrots }])
    expect(late.receipt.outputs).toHaveLength(7 + 6)
    expect(late.state.items).toMatchObject({ potato: 10, carrot: 6 })
    expect(clock('02:30', 1) + 6 * CARROT).toBe(clock('13:18', 1))
  })

  it('recalled at 01:24 instead: nine Potatoes in all, 48 minutes of the tenth lost, the Carrots dropped', () => {
    const { check, sped } = morning()
    const { state, receipt } = recall(sped.state, { outfitId: PLAIN.id }, clock('01:24', 1), ENV)
    expect(check.receipt.outputs.length + receipt.outputs.length).toBe(9)
    expect(receipt).toMatchObject({ recalled: true, returned: [], droppedQueue: [carrots], lostMinutes: 48 })
    expect(state.work[PLAIN.id]).toBeUndefined()
    expect(state.items).toEqual({ potato: 9 })
  })
})

describe('07 §2: the Kitchen recall', () => {
  it('Carrot Salad × 3 reserves 12 Chopped Carrot and 3 Wheat Flour; recalled after one and a half, it pays one and returns 8 and 2', () => {
    const KITCHEN: SlotRef = { building: 'kitchen', slot: 0 }
    const state = withStock(farmAccount(), { 'chopped-carrot': 12, 'wheat-flour': 3 })
    const started = ok(start(state, { outfitId: PLAIN.id, slot: KITCHEN, request: { kind: 'cook', item: 'dish-vegetables-1', count: 3 } }, clock('08:00'), ENV))
    expect(started.receipt.movements).toEqual([
      { kind: 'reserve', item: 'chopped-carrot', qty: 12, outfitId: PLAIN.id, at: clock('08:00') },
      { kind: 'reserve', item: 'wheat-flour', qty: 3, outfitId: PLAIN.id, at: clock('08:00') },
    ])
    expect(started.state.items).toEqual({})
    const halfway = clock('08:00') + 1.5 * farmItemSeconds('cook', 1) * 1000
    const { state: next, receipt } = recall(started.state, { outfitId: PLAIN.id }, halfway, ENV)
    expect(receipt.outputs).toEqual([{ item: 'dish-vegetables-1' }])
    expect(receipt.returned).toEqual([{ item: 'chopped-carrot', qty: 8 }, { item: 'wheat-flour', qty: 2 }])
    expect(next.items).toEqual({ 'dish-vegetables-1': 1, 'chopped-carrot': 8, 'wheat-flour': 2 })
  })
})

describe("05 §2: a night at the Observatory", () => {
  const OBSERVATORY: SlotRef = { building: 'observatory', slot: 0 }
  const night = () => {
    const state = withNodes(withStock(farmAccount(), { 'dish-vegetables-1': 1, 'dish-vegetables-2': 2, 'speed-ticket': 2 }), STUDENT.id, 5)
    return ok(start(state, { outfitId: STUDENT.id, slot: OBSERVATORY, request: { kind: 'session', unlocks: [node(6), node(7), node(8)] } }, clock('22:30'), SESSION_ENV))
  }

  it('reserves a Carrot Salad and two Potato Salads at 22:30 and opens nodes 6–8 at 08:00', () => {
    const { state, receipt } = night()
    expect(receipt.movements.map(({ item, qty }) => [item, qty])).toEqual([['dish-vegetables-1', 1], ['dish-vegetables-2', 2]])
    expect(state.items).toEqual({ 'speed-ticket': 2 })
    const entry = state.work[STUDENT.id]!.entries[0]!
    expect(entry.seconds.map((s) => s / 60)).toEqual([180, 195, 195])
    expect(endsAt(entry)).toBe(clock('08:00', 1))
    const morning = collect(state, { outfitId: STUDENT.id }, clock('08:00', 1), SESSION_ENV)
    expect(morning.receipt.paid).toEqual([{ opened: ['n6', 'n7', 'n8'] }])
    expect(morning.state.umas[STUDENT.id]!.build.constellationOpened).toBe(8)
    expect(morning.receipt.farmExp).toBe(0)
  })

  it('recalled at 03:00: node 6 opens and both Potato Salads return', () => {
    const { state, receipt } = recall(night().state, { outfitId: STUDENT.id }, clock('03:00', 1), SESSION_ENV)
    expect(receipt.paid).toEqual([{ opened: ['n6'] }])
    expect(receipt.returned).toEqual([{ item: 'dish-vegetables-2', qty: 2 }])
    expect(state.umas[STUDENT.id]!.build.constellationOpened).toBe(6)
  })

  it('two Speed Tickets at 23:00 move the finishes to 00:30, 03:45 and 07:00', () => {
    const { state, receipt } = ok(speedUp(night().state, { outfitId: STUDENT.id, startedAt: clock('22:30'), tickets: 2 }, clock('23:00'), SESSION_ENV))
    expect(receipt.endsAt).toBe(clock('07:00', 1))
    const morning = (at: string) => collect(state, { outfitId: STUDENT.id }, clock(at, 1), SESSION_ENV).receipt.outputs.length
    expect([morning('00:29'), morning('00:30'), morning('03:45'), morning('07:00')]).toEqual([0, 1, 2, 3])
    expect(finish(state, { outfitId: STUDENT.id, startedAt: clock('22:30') }, clock('23:00'), SESSION_ENV)).toMatchObject({ code: 'tickets', data: { n: 16 } })
  })
})
