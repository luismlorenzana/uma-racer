// Repeat (docs/rework/02-check-ins-and-notifications.md §5, §12; docs/rework/07-farm.md §9; docs/rework/05-training-hub.md
// §2): every row of 02 §5's table, same or fit, Collect all then Repeat all always finding slots, and competing Umas
// taking the stock in slot order.
import { describe, expect, it } from 'vitest'
import {
  account, atFarmLevel, clock, cook, craft, ENV, gather, nodes, ok, session, slot, uma,
} from '../../__fixtures__/rework-check-in'
import { buyPrice } from '../exchange/exchange'
import { farmItemSeconds } from '../farm/jobs'
import { collect, queue, recall, start } from '../work/operations'
import type { SlotRef, WorkRequest, WorkState } from '../work/types'
import { collectAll } from './collect-all'
import { repeat, setRepeatSizing } from './repeat'
import { DEFAULT_CHECK_INS, fitSize } from './schedule'
import { fill } from './words'

/** She worked `request` at `at` from 08:00 and it was collected at 20:00; the Warehouse then holds `items`. */
function didWork(request: WorkRequest, at: SlotRef, items: Readonly<Record<string, number>>, who = uma(1), state = account(8, items)): WorkState {
  const started = ok(start(state, { outfitId: who, slot: at, request }, clock('08:00'), ENV)).state
  return collect(started, { outfitId: who }, clock('20:00'), ENV).state
}
const withItems = (state: WorkState, items: Readonly<Record<string, number>>): WorkState => ({ ...state, items: { ...items } })
const NOW = clock('20:30')

describe("02 §5's table", () => {
  it('starts the same size when the inputs cover it, reserving them', () => {
    const state = withItems(didWork(craft('chopped-carrot', 4), slot('pantry'), { carrot: 4 }), { carrot: 5 })
    const { state: after, receipt } = repeat(state, {}, NOW, ENV)
    expect(receipt.started).toMatchObject([{ outfitId: uma(1), slot: slot('pantry'), request: craft('chopped-carrot', 4), from: 4, to: 4, shrunk: false, notes: [] }])
    expect(after.items.carrot).toBe(1)
    expect(receipt.skipped).toEqual([])
  })

  it('starts the largest size the inputs cover, marked "×4 → ×3"', () => {
    const state = withItems(didWork(craft('chopped-carrot', 4), slot('pantry'), { carrot: 4 }), { carrot: 3 })
    const { receipt } = repeat(state, {}, NOW, ENV)
    expect(receipt.started[0]).toMatchObject({ request: craft('chopped-carrot', 3), from: 4, to: 3, shrunk: true })
    expect(receipt.started[0]!.notes.map(fill)).toEqual(['×4 → ×3'])
  })

  it('skips with the shortfall and its fixes when the inputs cover none', () => {
    const state = withItems(didWork(craft('chopped-carrot', 4), slot('pantry'), { carrot: 4 }), {})
    const { receipt } = repeat(state, {}, NOW, ENV)
    expect(receipt.started).toEqual([])
    expect(receipt.skipped).toMatchObject([{ outfitId: uma(1), code: 'short' }])
    expect(fill(receipt.skipped[0]!.words)).toBe('Short 4 carrot.')
    expect(receipt.skipped[0]!.fixes).toEqual([
      { kind: 'buy', items: [{ sku: 'carrot', qty: 4, unitPrice: buyPrice('carrot') }], total: 4 * buyPrice('carrot')! },
      { kind: 'make', item: 'carrot', qty: 4 },
      { kind: 'pick-another', building: 'pantry', room: null },
    ])
    // A dish's inputs are crafted, which the Exchange doesn't sell: no Buy.
    const cooked = withItems(didWork(cook('dish-vegetables-1', 1), slot('kitchen'), { 'chopped-carrot': 4, 'wheat-flour': 1 }), {})
    expect(repeat(cooked, {}, NOW, ENV).receipt.skipped[0]!.fixes.map((fix) => fix.kind)).toEqual(['make', 'pick-another'])
  })

  it('always starts gathering, which needs no inputs', () => {
    const state = withItems(didWork(gather('carrot', 6), slot('vegetable-garden', 2), {}), {})
    const { receipt } = repeat(state, {}, NOW, ENV)
    expect(receipt.started).toMatchObject([{ slot: slot('vegetable-garden'), request: gather('carrot', 6), to: 6 }])
  })

  it('takes the next unlocks at the same facility and room while their dishes last', () => {
    const observatory = withItems(didWork(nodes(1, 2), slot('observatory'), { 'dish-vegetables-1': 2 }), { 'dish-vegetables-1': 3 })
    const { receipt } = repeat(observatory, {}, NOW, ENV)
    expect(receipt.started[0]!.request).toEqual({ kind: 'session', unlocks: [expect.objectContaining({ kind: 'node', target: 'n3' }), expect.objectContaining({ kind: 'node', target: 'n4' })] })
    // Node 5's dish is there but node 4's isn't: the session stops at the first missing dish.
    const gap = withItems(observatory, { 'dish-vegetables-1': 1, 'dish-vegetables-2': 1 })
    expect(repeat(gap, {}, NOW, ENV).receipt.started[0]!.request).toEqual({ kind: 'session', unlocks: [expect.objectContaining({ target: 'n3' })] })
    const hall = withItems(didWork(session(['slot', 'parent0']), slot('lineage-hall'), { 'dish-mushrooms-1': 1 }), { 'dish-mushrooms-1': 1, 'dish-mushrooms-2': 1 })
    expect(repeat(hall, {}, NOW, ENV).receipt.started[0]!.request).toEqual({ kind: 'session', unlocks: [expect.objectContaining({ kind: 'slot', target: 'parent1' })] })
  })

  it("skips the Dojo with Pick cards: which card to bond is the owner's choice", () => {
    const state = didWork(session(['bond', 'speed-e1']), slot('dojo', 0, 'speed'), { 'dish-sweets-1': 1 })
    expect(state.umas[uma(1)]!.build.bonds).toEqual(['speed-e1'])
    const { receipt } = repeat(withItems(state, { 'dish-sweets-1': 5 }), {}, NOW, ENV)
    expect(receipt.skipped).toEqual([{ outfitId: uma(1), code: 'pick-cards', words: { text: 'Pick cards' }, fixes: [{ kind: 'pick-cards', room: 'speed' }] }])
  })

  it("skips a facility done for her open layers, with the planner's next suggestion as the fix", () => {
    const state = didWork(session(['single', 'speed-01']), slot('gym', 0, 'speed'), { 'dish-sweets-1': 1 })
    const { receipt } = repeat(withItems(state, { 'dish-sweets-1': 5 }), {}, NOW, ENV)
    expect(receipt.skipped).toMatchObject([{ code: 'place-done', fixes: [{ kind: 'suggestion' }] }])
    expect(fill(receipt.skipped[0]!.words)).toBe('gym done for this scenario.')
  })

  it('keeps the grade when her Farm Level opened a higher one, and notes it for Switch', () => {
    const state = atFarmLevel(didWork(gather('carrot', 2), slot('vegetable-garden'), {}), uma(1), 6)
    const { receipt } = repeat(state, {}, NOW, ENV)
    expect(receipt.started[0]).toMatchObject({ request: gather('carrot', 2), switchTo: { item: 'potato', grade: 2 } })
    expect(receipt.started[0]!.notes.map(fill)).toEqual(['grade 2 open'])
  })

  it('never repeats a recalled or promoted Uma: a deliberate stop is not undone', () => {
    let state = ok(start(account(3), { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 4) }, clock('08:00'), ENV)).state
    state = recall(state, { outfitId: uma(1) }, clock('09:00'), ENV).state
    expect(repeat(state, {}, NOW, ENV).receipt).toMatchObject({ started: [], skipped: [] })
    // Promotion clears her work row (T125), as does a recall's empty one: nothing to repeat.
    expect(repeat(state, { outfitIds: [uma(1), uma(2)] }, NOW, ENV).receipt.skipped.map((s) => [s.outfitId, s.code, fill(s.words)])).toEqual([
      [uma(1), 'nothing-to-repeat', 'Nothing to repeat.'], [uma(2), 'nothing-to-repeat', 'Nothing to repeat.'],
    ])
  })

  it('skips "pantry full." with Pick another when no slot is free there', () => {
    let state = withItems(didWork(craft('chopped-carrot', 1), slot('pantry'), { carrot: 1 }), { carrot: 10 })
    for (const n of [0, 1, 2]) state = ok(start(state, { outfitId: uma(n + 2), slot: slot('pantry', n), request: craft('chopped-carrot', 1) }, clock('20:10'), ENV)).state
    const { receipt } = repeat(state, { outfitIds: [uma(1)] }, NOW, ENV)
    expect(receipt.skipped).toMatchObject([{ code: 'place-full', words: { data: { place: 'pantry' } }, fixes: [{ kind: 'pick-another', building: 'pantry', room: null }] }])
  })

  it("skips an Uma who isn't Free, or whose queue stopped", () => {
    let state = didWork(craft('chopped-carrot', 1), slot('pantry'), { carrot: 6 })
    const busy = ok(start(state, { outfitId: uma(1), slot: slot('pantry'), request: craft('chopped-carrot', 4) }, clock('20:20'), ENV)).state
    expect(repeat(busy, { outfitIds: [uma(1)] }, NOW, ENV).receipt.skipped).toMatchObject([{ code: 'busy', words: { data: { time: clock('20:20') + 4 * 27 * 60_000 } } }])
    expect(repeat(busy, { outfitIds: [uma(1)] }, clock('23:00'), ENV).receipt.skipped).toMatchObject([{ code: 'collect-first' }])
    state = ok(start(state, { outfitId: uma(1), slot: slot('pantry'), request: craft('chopped-carrot', 1) }, clock('20:20'), ENV)).state
    state = ok(queue(state, { outfitId: uma(1), add: { request: craft('chopped-carrot', 9), building: 'pantry' } }, clock('20:21'), ENV)).state
    state = collectAll(state, {}, clock('23:00'), ENV).state
    expect(state.work[uma(1)]!.dropped).not.toBeNull()
    expect(repeat(state, {}, clock('23:00'), ENV).receipt.skipped).toMatchObject([{ outfitId: uma(1), code: 'queue-stopped', fixes: [{ kind: 'queue-stopped' }] }])
  })
})

describe('same or fit', () => {
  it('takes the fitted size when the account says fit, shrunk to the stock', () => {
    const state = ok(setRepeatSizing(didWork(gather('carrot', 2), slot('vegetable-garden'), {}), { sizing: 'fit' }, 5)).state
    const at = clock('13:00')
    const fitted = fitSize(at, Array.from({ length: 10 }, () => farmItemSeconds('gather', 1)), DEFAULT_CHECK_INS, 0)
    expect(fitted).toBe(5)
    expect(repeat(state, {}, at, ENV).receipt.started[0]).toMatchObject({ request: gather('carrot', fitted), from: 5, to: 5, shrunk: false })
    const crafted = ok(setRepeatSizing(withItems(didWork(craft('chopped-carrot', 1), slot('pantry'), { carrot: 1 }), { carrot: 4 }), { sizing: 'fit' }, 5)).state
    expect(repeat(crafted, {}, at, ENV).receipt.started[0]).toMatchObject({ from: 10, to: 4, shrunk: true })
    expect(() => setRepeatSizing(state, { sizing: 'more' as 'fit' }, 5)).toThrow(RangeError)
  })

  it('fits a session one unlock time at a time', () => {
    const state = ok(setRepeatSizing(withItems(didWork(nodes(1), slot('observatory'), { 'dish-vegetables-1': 1 }), { 'dish-vegetables-1': 5, 'dish-vegetables-2': 6 }), { sizing: 'fit' }, 5)).state
    // From 13:00 to 22:30: 216-minute g1 sessions, so two fit.
    expect(repeat(state, {}, clock('13:00'), ENV).receipt.started[0]!.to).toBe(2)
  })
})

describe('Collect all, then Repeat all', () => {
  it('always finds the slots it freed, and competing Umas take the stock in slot order', () => {
    // Uma 5 holds Pantry slot 0 and Uma 2 slot 1, so Uma 5 goes first though her id sorts later.
    let state = account(8, { carrot: 8 })
    state = ok(start(state, { outfitId: uma(5), slot: slot('pantry', 0), request: craft('chopped-carrot', 4) }, clock('08:00'), ENV)).state
    state = ok(start(state, { outfitId: uma(2), slot: slot('pantry', 1), request: craft('chopped-carrot', 4) }, clock('08:00'), ENV)).state
    for (const [n, who] of [[0, 3], [1, 4], [2, 6], [3, 7]] as const) {
      state = ok(start(state, { outfitId: uma(who), slot: slot('vegetable-garden', n), request: gather('carrot', 1) }, clock('08:00'), ENV)).state
    }
    const collected = collectAll({ ...state }, {}, clock('12:00'), ENV).state
    const short = { ...collected, items: { ...collected.items, carrot: 4 } }
    const { receipt } = repeat(short, {}, clock('12:00'), ENV)
    // The Vegetable Garden comes before the Pantry in building order (07 §1).
    expect(receipt.started.map((s) => [s.outfitId, s.slot])).toEqual([
      ...[3, 4, 6, 7].map((who, n) => [uma(who), slot('vegetable-garden', n)]),
      [uma(5), slot('pantry', 0)],
    ])
    expect(receipt.skipped.map((s) => [s.outfitId, s.code])).toEqual([[uma(2), 'short']])
    const plenty = repeat({ ...collected, items: { carrot: 8 } }, {}, clock('12:00'), ENV)
    expect(plenty.receipt.started).toHaveLength(6)
    expect(plenty.receipt.skipped).toEqual([])
  })
})
