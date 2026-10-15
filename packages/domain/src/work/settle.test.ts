// Queue starts in time order (docs/game/07-farm.md §2, §11; docs/game/02-check-ins-and-notifications.md §3, §8):
// exact end times, collected stock only, drops that take the rest of the queue, ties by building, room and slot, and
// a result that doesn't depend on collect order, on how often the app settled, or on the device.
import { describe, expect, it } from 'vitest'
import {
  clock, dishUnlock, ENV, farmAccount, HELPER, ok, PLAIN, SESSION_ENV, SPRINTS, STRONG, STUDENT, withStock,
} from '../__fixtures__/work'
import { farmItemSeconds } from '../farm/jobs'
import { collect, queue, start } from './operations'
import { settle } from './settle'
import { endsAt } from './timeline'
import type { FarmRequest, SlotRef, WorkRequest, WorkState } from './types'
import type { WorkEnv } from './kinds'

const T0 = clock('08:00')
const G = farmItemSeconds('gather', 1) * 1000
const C = farmItemSeconds('craft', 1) * 1000
const carrots = (count: number): FarmRequest => ({ kind: 'gather', item: 'carrot', count })
const chopped = (count: number): FarmRequest => ({ kind: 'craft', item: 'chopped-carrot', count })
const PANTRY = (slot: number): SlotRef => ({ building: 'pantry', slot })

function begin(state: WorkState, outfitId: string, slot: SlotRef, request: WorkRequest, queued: readonly WorkRequest[], now = T0, env: WorkEnv = ENV): WorkState {
  let next = ok(start(state, { outfitId, slot, request }, now, env)).state
  for (const add of queued) next = ok(queue(next, { outfitId, add: { request: add, building: slot.building, ...(slot.room ? { room: slot.room } : {}) } }, now, env)).state
  return next
}

describe('a queued entry', () => {
  it('starts at the exact end, taking its inputs then', () => {
    const state = begin(withStock(farmAccount(), { carrot: 6 }), PLAIN.id, PANTRY(0), chopped(5), [chopped(1)])
    const { state: next, report } = settle(state, T0 + 5 * C, ENV)
    expect(report.started).toEqual([{ outfitId: PLAIN.id, slot: PANTRY(0), at: T0 + 5 * C, request: chopped(1) }])
    expect(report.movements).toEqual([{ kind: 'reserve', item: 'carrot', qty: 1, outfitId: PLAIN.id, at: T0 + 5 * C }])
    expect(next.work[PLAIN.id]!.entries[1]).toMatchObject({ startedAt: T0 + 5 * C, fromQueue: true, speed: 1 })
    expect(next.items).toEqual({})
    expect(settle(state, T0 + 5 * C - 1, ENV).state).toBe(state)
  })

  it('is not covered by finished outputs nobody collected', () => {
    let state = begin(withStock(farmAccount(), { carrot: 5 }), PLAIN.id, PANTRY(0), chopped(5), [chopped(1)])
    state = ok(start(state, { outfitId: HELPER.id, slot: { building: 'vegetable-garden', slot: 0 }, request: carrots(1) }, T0, ENV)).state
    // Helper's carrot is ready at 09:48, before Plain's queue is due at 10:15, but it waits for Collect.
    expect(T0 + G).toBeLessThan(T0 + 5 * C)
    const { state: next, report } = settle(state, clock('12:00'), ENV)
    expect(report.dropped).toEqual([{
      outfitId: PLAIN.id, at: T0 + 5 * C, slot: PANTRY(0), requests: [chopped(1)], short: [{ item: 'carrot', qty: 1 }], refused: null,
    }])
    expect(next.work[PLAIN.id]).toMatchObject({ queue: [], dropped: { at: T0 + 5 * C } })
    // Collecting later doesn't count backwards.
    const later = collect(next, { outfitId: HELPER.id }, clock('12:00'), ENV).state
    expect(later.items).toEqual({ carrot: 1 })
    expect(later.work[PLAIN.id]!.entries).toHaveLength(1)
  })

  it('drops with the rest of the queue behind it', () => {
    const state = begin(withStock(farmAccount(), { carrot: 2 }), PLAIN.id, PANTRY(0), chopped(1), [chopped(3), chopped(1)])
    const { state: next } = settle(state, clock('20:00'), ENV)
    expect(next.work[PLAIN.id]!.dropped).toMatchObject({ requests: [chopped(3), chopped(1)], short: [{ item: 'carrot', qty: 2 }] })
    expect(next.work[PLAIN.id]!.queue).toEqual([])
    const collected = collect(next, { outfitId: PLAIN.id }, clock('20:00'), ENV).state
    expect(collected.work[PLAIN.id]).toMatchObject({ slot: null, entries: [], dropped: { requests: [chopped(3), chopped(1)] } })
  })
})

describe('ties', () => {
  it('go by slot within a building, whoever she is', () => {
    for (const [first, second] of [[PLAIN.id, HELPER.id], [HELPER.id, PLAIN.id]] as const) {
      let state = withStock(farmAccount(), { carrot: 3 })
      state = begin(state, second, PANTRY(1), chopped(1), [chopped(1)])
      state = begin(state, first, PANTRY(0), chopped(1), [chopped(1)])
      const { state: next, report } = settle(state, clock('12:00'), ENV)
      expect(report.started.map((s) => s.outfitId)).toEqual([first])
      expect(report.dropped.map((d) => d.outfitId)).toEqual([second])
      expect(next.items).toEqual({})
    }
  })

  it("go by 07 §1's building order, then the facilities in 05 §1's order", () => {
    let state = farmAccount()
    state = begin(state, PLAIN.id, { building: 'fishery', slot: 0 }, { kind: 'gather', item: 'carp', count: 1 }, [{ kind: 'gather', item: 'carp', count: 1 }])
    state = begin(state, HELPER.id, { building: 'orchard', slot: 1 }, { kind: 'gather', item: 'apple', count: 1 }, [{ kind: 'gather', item: 'apple', count: 1 }])
    expect(settle(state, clock('12:00'), ENV).report.started.map((s) => s.outfitId)).toEqual([HELPER.id, PLAIN.id])

    let hub = withStock(farmAccount(), { 'dish-fruits-1': 3 })
    const fruit = { kind: 'session' as const, unlocks: [dishUnlock('dish-fruits-1')] }
    hub = begin(hub, STUDENT.id, { building: 'lineage-hall', slot: 0 }, fruit, [fruit], T0, SESSION_ENV)
    hub = begin(hub, SPRINTS.id, { building: 'gym', room: 'stamina', slot: 0 }, fruit, [fruit], T0, SESSION_ENV)
    const settled = settle(hub, clock('12:00'), SESSION_ENV)
    expect(settled.report.started.map((s) => s.slot.building)).toEqual(['lineage-hall'])
    expect(settled.report.dropped.map((d) => d.slot.building)).toEqual(['gym'])
  })
})

describe('order and replays', () => {
  /** Three chains started at 22:30 that run through the night. */
  function night(): WorkState {
    let state = withStock(farmAccount(), { carrot: 13, wheat: 2 })
    state = begin(state, PLAIN.id, { building: 'vegetable-garden', slot: 0 }, carrots(3), [carrots(2), carrots(1), carrots(4)], clock('22:30'))
    state = begin(state, HELPER.id, PANTRY(0), chopped(10), [chopped(2), { kind: 'craft', item: 'wheat-flour', count: 2 }, chopped(1)], clock('22:30'))
    state = begin(state, STRONG.id, PANTRY(1), chopped(1), [{ kind: 'craft', item: 'wheat-flour', count: 1 }, chopped(10)], clock('22:30'))
    return state
  }

  it('reaches the same state settled once after 12 hours or every 15 minutes', () => {
    const once = settle(night(), clock('10:30', 1), ENV).state
    let stepped = night()
    for (let t = clock('22:30'); t <= clock('10:30', 1); t += 15 * 60_000) stepped = settle(stepped, t, ENV).state
    expect(stepped).toEqual(once)
    for (const row of Object.values(once.work)) {
      row.entries.forEach((entry, i) => { if (i > 0) expect(entry.startedAt).toBe(endsAt(row.entries[i - 1]!)) })
    }
    expect(once.work[PLAIN.id]!.entries.map((e) => e.request)).toEqual([carrots(3), carrots(2), carrots(1), carrots(4)])
    // Strong's flour starts at 22:57 and takes a wheat, so Helper's two flours at 03:54 find one; Strong's ten crafts
    // at 23:24 find the two carrots Helper's queue then takes.
    expect(once.work[STRONG.id]!.dropped).toMatchObject({ at: clock('23:24'), requests: [chopped(10)], short: [{ item: 'carrot', qty: 8 }] })
    expect(once.work[HELPER.id]!.dropped).toMatchObject({
      at: clock('03:54', 1), requests: [{ kind: 'craft', item: 'wheat-flour', count: 2 }, chopped(1)], short: [{ item: 'wheat', qty: 1 }],
    })
  })

  it('is the same whichever Uma is collected first', () => {
    const now = clock('03:00', 1)
    const ab = collect(collect(night(), { outfitId: PLAIN.id }, now, ENV).state, { outfitId: HELPER.id }, now, ENV).state
    const ba = collect(collect(night(), { outfitId: HELPER.id }, now, ENV).state, { outfitId: PLAIN.id }, now, ENV).state
    expect(ab).toEqual(ba)
  })

  it('is idempotent, and a clock moved back undoes nothing', () => {
    const first = settle(night(), clock('06:00', 1), ENV)
    const second = settle(first.state, clock('06:00', 1), ENV)
    expect(second.state).toBe(first.state)
    expect(second.report).toEqual({ started: [], dropped: [], movements: [] })
    expect(settle(first.state, clock('23:00'), ENV).state).toBe(first.state)
  })
})
