// The pages' worked examples through the operations: 07 §2's Potatoes at k = 1.8, 07 §2's Kitchen recall and 05 §2's
// night at the Observatory (with the tests' synthetic session kind, in the page's base minutes). The base-seconds
// versions of 07 §2 and 09 §5.1 are in timeline.test.ts.
import { describe, expect, it } from 'vitest'
import {
  atFarmLevel, clock, ENV, farmAccount, minutes, node, ok, PLAIN, SESSION_ENV, STUDENT, withNodes, withStock,
} from '../__fixtures__/work'
import { farmItemSeconds } from '../farm/jobs'
import { reservedStock } from './index'
import { collect, finish, queue, recall, speedUp, start } from './adapter'
import { endsAt } from './adapter'
import type { FarmRequest, SlotRef } from './types'

describe("07 §2: Gather Potato × 10 at 08:00, at k = 1.8", () => {
  const GARDEN: SlotRef = { building: 'vegetable-garden', slot: 0 }
  const potatoes: FarmRequest = { kind: 'gather', item: 'potato', count: 10 }
  const carrots: FarmRequest = { kind: 'gather', item: 'carrot', count: 6 }
  // 95 base minutes × 1.8 = 171 a Potato; 90 × 1.8 = 162 a Carrot. The page's 13:00 and 22:30 scale to 17:00 and 10:21.
  const POTATO = minutes(171), CARROT = minutes(162)

  function morning() {
    const state = withStock(atFarmLevel(farmAccount(), PLAIN.id, 7), { 'speed-ticket': 1 })
    let next = ok(start(state, { outfitId: PLAIN.id, slot: GARDEN, request: potatoes }, clock('08:00'), ENV)).state
    next = ok(queue(next, { outfitId: PLAIN.id, add: { request: carrots, building: 'vegetable-garden' } }, clock('08:00'), ENV)).state
    const check = collect(next, { outfitId: PLAIN.id }, clock('17:00'), ENV)
    const sped = ok(speedUp(check.state, { outfitId: PLAIN.id, startedAt: clock('08:00'), tickets: 1 }, clock('17:00'), ENV))
    return { check, sped }
  }

  it('pays 3 Potatoes and 513 Farm EXP at the check-in, and a ticket ends the job at 12:00 the next day', () => {
    expect(farmItemSeconds('gather', 2)).toBe(10_260)
    const { check, sped } = morning()
    expect(check.receipt.outputs).toHaveLength(3)
    expect(check.receipt.farmExp).toBe(3 * 171 * 4)
    expect(check.state.items).toMatchObject({ potato: 3 })
    expect(sped.receipt).toMatchObject({ tickets: 1, savedMinutes: 30, wastedMinutes: 0, endsAt: clock('12:00', 1) })
    expect(clock('08:00') + 10 * POTATO - minutes(30)).toBe(clock('12:00', 1))
  })

  it('starts the Carrots at the tenth Potato’s end, with nothing to reserve', () => {
    const { sped } = morning()
    const late = collect(sped.state, { outfitId: PLAIN.id }, clock('06:00', 2), ENV)
    expect(late.receipt.settled.started).toEqual([{ outfitId: PLAIN.id, slot: GARDEN, at: clock('12:00', 1), request: carrots }])
    expect(late.receipt.outputs).toHaveLength(7 + 6)
    expect(late.state.items).toMatchObject({ potato: 10, carrot: 6 })
    expect(clock('12:00', 1) + 6 * CARROT).toBe(clock('04:12', 2))
  })

  it('recalled at 10:21 the next day instead: nine Potatoes in all, 72 minutes of the tenth lost, the Carrots dropped', () => {
    const { check, sped } = morning()
    const { state, receipt } = recall(sped.state, { outfitId: PLAIN.id }, clock('10:21', 1), ENV)
    expect(check.receipt.outputs.length + receipt.outputs.length).toBe(9)
    expect(receipt).toMatchObject({ recalled: true, returned: [], droppedQueue: [carrots], lostMinutes: 72 })
    expect(state.work[PLAIN.id]).toBeUndefined()
    expect(state.items).toEqual({ potato: 9 })
  })
})

describe('07 §2: the Kitchen recall', () => {
  it('Apple Tart × 3 reserves 12 Apple Preserve and 3 Dried Basil; recalled after one and a half, it pays one and returns 8 and 2', () => {
    const KITCHEN: SlotRef = { building: 'kitchen', slot: 0 }
    const state = withStock(farmAccount(), { 'apple-preserve': 12, 'dried-basil': 3 })
    const started = ok(start(state, { outfitId: PLAIN.id, slot: KITCHEN, request: { kind: 'cook', item: 'dish-fruits-1', count: 3 } }, clock('08:00'), ENV))
    expect(started.receipt.movements).toEqual([
      { kind: 'reserve', item: 'apple-preserve', qty: 12, outfitId: PLAIN.id, at: clock('08:00') },
      { kind: 'reserve', item: 'dried-basil', qty: 3, outfitId: PLAIN.id, at: clock('08:00') },
    ])
    expect(started.state.items).toEqual({})
    const halfway = clock('08:00') + 1.5 * farmItemSeconds('cook', 1) * 1000
    const { state: next, receipt } = recall(started.state, { outfitId: PLAIN.id }, halfway, ENV)
    expect(receipt.outputs).toEqual([{ item: 'dish-fruits-1' }])
    expect(receipt.returned).toEqual([{ item: 'apple-preserve', qty: 8 }, { item: 'dried-basil', qty: 2 }])
    expect(next.items).toEqual({ 'dish-fruits-1': 1, 'apple-preserve': 8, 'dried-basil': 2 })
  })

  it('holds as reserved exactly what Recall would return, item by item, over every Uma (T138)', () => {
    const KITCHEN: SlotRef = { building: 'kitchen', slot: 0 }
    const PANTRY: SlotRef = { building: 'pantry', slot: 0 }
    let state = withStock(farmAccount(), { 'apple-preserve': 12, 'dried-basil': 3, carrot: 4 })
    state = ok(start(state, { outfitId: PLAIN.id, slot: KITCHEN, request: { kind: 'cook', item: 'dish-fruits-1', count: 3 } }, clock('08:00'), ENV)).state
    state = ok(start(state, { outfitId: STUDENT.id, slot: PANTRY, request: { kind: 'craft', item: 'chopped-carrot', count: 4 } }, clock('08:00'), ENV)).state
    const cook = farmItemSeconds('cook', 1) * 1000
    expect(reservedStock(state, clock('08:00'))).toEqual({ 'apple-preserve': 12, 'dried-basil': 3, carrot: 4 })
    const halfway = clock('08:00') + 1.5 * cook
    // By then the Pantry job has finished: its carrots are used, so only the Kitchen's unmade dishes hold anything.
    expect(halfway).toBeGreaterThan(clock('08:00') + 4 * farmItemSeconds('craft', 1) * 1000)
    const held = reservedStock(state, halfway)
    expect(held).toEqual({ 'apple-preserve': 8, 'dried-basil': 2 })
    const returned = recall(state, { outfitId: PLAIN.id }, halfway, ENV).receipt.returned
    expect(Object.fromEntries(returned.map(({ item, qty }) => [item, qty]))).toEqual(held)
    expect(reservedStock(state, clock('08:00') + 3 * cook)).toEqual({})
    expect(reservedStock(farmAccount(), clock('08:00'))).toEqual({})
  })
})

describe("05 §2: a night at the Observatory", () => {
  const OBSERVATORY: SlotRef = { building: 'observatory', slot: 0 }
  const night = () => {
    const state = withNodes(withStock(farmAccount(), { 'tonic-1': 1, 'tonic-2': 2, 'speed-ticket': 2 }), STUDENT.id, 5)
    return ok(start(state, { outfitId: STUDENT.id, slot: OBSERVATORY, request: { kind: 'session', unlocks: [node(6), node(7), node(8)] } }, clock('22:30'), SESSION_ENV))
  }

  it('reserves a Warm-Up Tonic and two Practice Tonics at 22:30 and opens nodes 6–8 at 08:00', () => {
    const { state, receipt } = night()
    expect(receipt.movements.map(({ item, qty }) => [item, qty])).toEqual([['tonic-1', 1], ['tonic-2', 2]])
    expect(state.items).toEqual({ 'speed-ticket': 2 })
    const entry = state.work[STUDENT.id]!.entries[0]!
    expect(entry.seconds.map((s) => s / 60)).toEqual([180, 195, 195])
    expect(endsAt(entry)).toBe(clock('08:00', 1))
    const morning = collect(state, { outfitId: STUDENT.id }, clock('08:00', 1), SESSION_ENV)
    expect(morning.receipt.paid).toEqual([{ opened: ['n6', 'n7', 'n8'] }])
    expect(morning.state.umas[STUDENT.id]!.build.constellationOpened).toBe(8)
    expect(morning.receipt.farmExp).toBe(0)
  })

  it('recalled at 03:00: node 6 opens and both Practice Tonics return', () => {
    const { state, receipt } = recall(night().state, { outfitId: STUDENT.id }, clock('03:00', 1), SESSION_ENV)
    expect(receipt.paid).toEqual([{ opened: ['n6'] }])
    expect(receipt.returned).toEqual([{ item: 'tonic-2', qty: 2 }])
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
