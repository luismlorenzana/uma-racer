// 07 §11's edge cases (docs/game/07-farm.md §11; docs/game/02-check-ins-and-notifications.md §8–§9): an empty
// Warehouse, a stale start, an Uma in a session, Umas bought mid-tier, the clock moved either way, two devices.
import { describe, expect, it } from 'vitest'
import { clock, ENV, farmAccount, HELPER, minutes, node, ok, PLAIN, SESSION_ENV, STUDENT, withNodes, withStock } from '../__fixtures__/work'
import { farmItemSeconds } from '../farm/jobs'
import { isRefusal } from '../state/types'
import { workState } from './activity'
import { collect, queue, recall, start } from './operations'
import { settle } from './settle'
import { progress } from './timeline'
import type { FarmRequest, SlotRef, WorkState } from './types'

const T0 = clock('08:00')
const C = farmItemSeconds('craft', 1) * 1000
const PANTRY: SlotRef = { building: 'pantry', slot: 0 }
const GARDEN: SlotRef = { building: 'vegetable-garden', slot: 0 }
const chopped = (count: number): FarmRequest => ({ kind: 'craft', item: 'chopped-carrot', count })
const carrots = (count: number): FarmRequest => ({ kind: 'gather', item: 'carrot', count })

describe('an empty Warehouse', () => {
  it('lets gathering start, refuses the Pantry and Kitchen with the shortfall, and drops a queue that reaches them', () => {
    const state = farmAccount()
    expect(isRefusal(start(state, { outfitId: PLAIN.id, slot: GARDEN, request: carrots(1) }, T0, ENV))).toBe(false)
    expect(start(state, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(2) }, T0, ENV)).toMatchObject({
      code: 'short', data: { n: 2, item: 'carrot', largestCoverable: 0 },
    })
    expect(start(state, { outfitId: PLAIN.id, slot: { building: 'kitchen', slot: 0 }, request: { kind: 'cook', item: 'dish-fish-1', count: 1 } }, T0, ENV))
      .toMatchObject({ code: 'short', data: { n: 4, item: 'carp-fillet', largestCoverable: 0 } })
    let working = ok(start(withStock(state, { carrot: 1 }), { outfitId: PLAIN.id, slot: PANTRY, request: chopped(1) }, T0, ENV)).state
    working = ok(queue(working, { outfitId: PLAIN.id, add: { request: chopped(1), building: 'pantry' } }, T0, ENV)).state
    expect(settle(working, T0 + C, ENV).state.work[PLAIN.id]!.dropped).toMatchObject({ short: [{ item: 'carrot', qty: 1 }] })
  })
})

describe('a stale start', () => {
  it('re-checks against the latest stock and offers the largest size it covers', () => {
    // The sheet showed 5 carrots; the other device's start took 2 of them.
    const shown = withStock(farmAccount(), { carrot: 5 })
    const latest = ok(start(shown, { outfitId: HELPER.id, slot: { building: 'pantry', slot: 1 }, request: chopped(2) }, T0, ENV)).state
    expect(start(latest, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(5) }, T0 + 1, ENV)).toMatchObject({
      code: 'short', data: { n: 2, item: 'carrot', largestCoverable: 3 },
    })
    expect(isRefusal(start(latest, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(3) }, T0 + 1, ENV))).toBe(false)
    // A slot the other device filled is taken.
    expect(start(latest, { outfitId: PLAIN.id, slot: { building: 'pantry', slot: 1 }, request: chopped(1) }, T0 + 1, ENV)).toMatchObject({ code: 'slot-taken' })
  })
})

describe('an Uma in a session', () => {
  it('is busy until the session ends', () => {
    const state = withNodes(withStock(farmAccount(), { 'tonic-1': 1 }), STUDENT.id, 0)
    const session = ok(start(state, { outfitId: STUDENT.id, slot: { building: 'observatory', slot: 0 }, request: { kind: 'session', unlocks: [node(1)] } }, T0, SESSION_ENV)).state
    expect(workState(session, STUDENT.id, T0, SESSION_ENV)).toBe('working')
    expect(start(session, { outfitId: STUDENT.id, slot: GARDEN, request: carrots(1) }, T0, SESSION_ENV)).toMatchObject({
      code: 'busy', data: { time: T0 + minutes(180) },
    })
  })
})

describe('Umas bought mid-tier', () => {
  it('start at Farm Lv 1 and work grade 1 only, at any building', () => {
    const state = farmAccount()
    expect(state.umas[HELPER.id]!.farm).toEqual({ level: 1, exp: 0 })
    expect(isRefusal(start(state, { outfitId: HELPER.id, slot: { building: 'fishery', slot: 1 }, request: { kind: 'gather', item: 'carp', count: 1 } }, T0, ENV))).toBe(false)
    expect(start(state, { outfitId: HELPER.id, slot: { building: 'fishery', slot: 1 }, request: { kind: 'gather', item: 'trout', count: 1 } }, T0, ENV)).toMatchObject({ code: 'grade' })
  })
})

describe('the clock moved', () => {
  const working = (): WorkState => ok(start(withStock(farmAccount(), { carrot: 4 }), { outfitId: PLAIN.id, slot: PANTRY, request: chopped(4) }, T0, ENV)).state

  it('forward finishes work early, and Collect accepts it', () => {
    const { receipt } = collect(working(), { outfitId: PLAIN.id }, clock('09:00', 2), ENV)
    expect(receipt).toMatchObject({ freed: true })
    expect(receipt.outputs).toHaveLength(4)
  })

  it('back lengthens the wait, never below zero, and takes nothing back', () => {
    const collected = collect(working(), { outfitId: PLAIN.id }, T0 + 3 * C, ENV).state
    const entry = collected.work[PLAIN.id]!.entries[0]!
    expect(entry.collected).toBe(3)
    // Back to before the start: no progress, nothing paid again, nothing undone.
    const back = collect(collected, { outfitId: PLAIN.id }, T0 - minutes(60), ENV)
    expect(back.receipt.outputs).toEqual([])
    expect(back.state).toEqual(collected)
    expect(progress(entry, T0 - minutes(60))).toBe(0)
    // A recall then returns only the one item never made.
    const recalled = recall(collected, { outfitId: PLAIN.id }, T0 - minutes(60), ENV)
    expect(recalled.receipt.returned).toEqual([{ item: 'carrot', qty: 1 }])
    expect(recalled.receipt.lostMinutes).toBe(0)
  })

  it('back never undoes a queued start', () => {
    let state = ok(start(withStock(farmAccount(), { carrot: 2 }), { outfitId: PLAIN.id, slot: PANTRY, request: chopped(1) }, T0, ENV)).state
    state = ok(queue(state, { outfitId: PLAIN.id, add: { request: chopped(1), building: 'pantry' } }, T0, ENV)).state
    const started = settle(state, T0 + C, ENV).state
    expect(started.work[PLAIN.id]!.entries).toHaveLength(2)
    expect(settle(started, T0, ENV).state).toBe(started)
    expect(workState(started, PLAIN.id, T0, ENV)).toBe('working')
  })
})

describe('two devices', () => {
  it('reach the same jobs, stock and Farm Levels from the same operations, after a JSON round trip too', () => {
    const run = (state: WorkState) => {
      let next = ok(start(state, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(3) }, T0, ENV)).state
      next = ok(queue(next, { outfitId: PLAIN.id, add: { request: chopped(1), building: 'pantry' } }, T0, ENV)).state
      next = ok(start(next, { outfitId: HELPER.id, slot: GARDEN, request: carrots(2) }, T0 + 1, ENV)).state
      next = collect(next, { outfitId: PLAIN.id }, clock('14:00'), ENV).state
      return collect(next, { outfitId: HELPER.id }, clock('14:00'), ENV).state
    }
    const state = withStock(farmAccount(), { carrot: 4 })
    const phone = run(state)
    const tablet = run(JSON.parse(JSON.stringify(state)) as WorkState)
    expect(tablet).toEqual(phone)
    expect(JSON.parse(JSON.stringify(phone))).toEqual(phone)
    expect(phone.items).toEqual({ 'chopped-carrot': 4, carrot: 2 })
  })
})
