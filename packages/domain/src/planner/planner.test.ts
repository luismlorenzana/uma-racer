// The planner (docs/game/02-check-ins-and-notifications.md §4 "Best use", §6, §12): targets, the cascade against a
// brute-force recount, allocation once in target order, what counts as coming, pick cards and gates, the views, her
// Needs tab and the roster totals.
import { describe, expect, it } from 'vitest'
import { account, CHECK_IN_CONTENT, clock, cook, craft, ENV, gather, nodes, ok, slot, uma } from '../__fixtures__/check-in'
import { placeUma } from '../__fixtures__/tiers'
import { cardOf } from '../__fixtures__/training'
import { itemById, type ItemId } from '../items/catalogue'
import { recipeOf } from '../items/recipes'
import { commitUnlocks } from '../training/build'
import { layerUnlocks } from '../training/unlocks'
import { queue, start } from '../work/operations'
import type { WorkState } from '../work/types'
import { checkInRefusal } from '../check-in/words'
import { bestUse, BEST_USE_MARKS, BEST_USE_WEIGHTS, facilityLines, neededFromStock, placeLines, plan, type PlanLine } from './needs'
import { NEEDS_STARTABLE, needsFor, rosterTotals } from './suggest'
import { AUTO_TARGETS, automaticTargets, MAX_TARGETS, setTargets, targetsOf } from './targets'

const NOW = clock('12:00')

describe('the numbers', () => {
  it('are five targets, five automatic, three Best use marks and three startable lines', () => {
    expect([MAX_TARGETS, AUTO_TARGETS, BEST_USE_MARKS, NEEDS_STARTABLE]).toEqual([5, 5, 3, 3])
    expect(BEST_USE_WEIGHTS).toEqual({ dish: 5, crafted: 1, raw: 1 })
    expect(checkInRefusal('targets').reason).toBe(`${['Zero', 'One', 'Two', 'Three', 'Four', 'Five'][MAX_TARGETS]} targets at most.`)
  })
})

/** Her build with layer 1's fixed unlocks open and six bonds: nothing left in scenario 1. */
function trained(state: WorkState, outfitId: string): WorkState {
  const uma = state.umas[outfitId]!
  const build = { ...commitUnlocks(uma.build, uma, layerUnlocks(1)).build, bonds: ['a', 'b', 'c', 'd', 'e', 'f'] }
  return { ...state, umas: { ...state.umas, [outfitId]: { ...uma, build } } }
}
const atScenario2 = (state: WorkState, outfitId: string): WorkState =>
  ({ ...state, umas: { ...state.umas, [outfitId]: placeUma(state.umas[outfitId]!, { tier: 1, scenario: 2, level: 11 }, CHECK_IN_CONTENT) } })
const withOpenNodes = (state: WorkState, outfitId: string, n: number): WorkState =>
  ({ ...state, umas: { ...state.umas, [outfitId]: { ...state.umas[outfitId]!, build: { ...state.umas[outfitId]!.build, constellationOpened: n } } } })

describe('targets', () => {
  it('take up to five owned Umas in order; an empty list means automatic', () => {
    const state = account(7)
    const marked = ok(setTargets(state, { outfitIds: [uma(3), uma(1)] }, 5))
    expect(marked.receipt).toEqual({ targets: [uma(3), uma(1)], automatic: false })
    expect(targetsOf(marked.state)).toEqual([uma(3), uma(1)])
    expect(ok(setTargets(marked.state, { outfitIds: [] }, 6)).receipt.automatic).toBe(true)
    expect(setTargets(state, { outfitIds: [1, 2, 3, 4, 5, 6].map(uma) }, 5)).toMatchObject({ code: 'targets', reason: 'Five targets at most.' })
    expect(setTargets(state, { outfitIds: ['nobody'] }, 5)).toMatchObject({ code: 'unknown-uma' })
    expect(() => setTargets(state, { outfitIds: [uma(1), uma(1)] }, 5)).toThrow(RangeError)
  })

  it('are automatically the five with the most unlocks left, only those with some left, ties by outfit id', () => {
    let state = account(7)
    state = atScenario2(state, uma(6))
    state = withOpenNodes(state, uma(1), 4)
    state = trained(state, uma(2))
    expect(automaticTargets(state)).toEqual([uma(6), uma(3), uma(4), uma(5), uma(7)])
    expect(targetsOf(state)).toEqual(automaticTargets(state))
    const one = trained(trained(trained(trained(trained(account(5), uma(1)), uma(2)), uma(3)), uma(4)), uma(5))
    expect(automaticTargets(one)).toEqual([])
  })

  it('end automatic once one is marked', () => {
    const state = ok(setTargets(account(7), { outfitIds: [uma(7)] }, 5)).state
    expect(targetsOf(state)).toEqual([uma(7)])
  })
})

/** Free stock and running work for the recount: a tonic, a gather and a craft are running; reserved inputs have left. */
function busy(): WorkState {
  let state = account(6, { 'tonic-1': 9, 'chopped-carrot': 10, 'wheat-flour': 1, carrot: 3, 'dried-button-mushroom': 2 })
  state = ok(start(state, { outfitId: uma(3), slot: slot('kitchen'), request: cook('tonic-1', 1) }, clock('08:00'), ENV)).state
  state = ok(start(state, { outfitId: uma(4), slot: slot('vegetable-garden'), request: gather('carrot', 2) }, clock('08:00'), ENV)).state
  return ok(start(state, { outfitId: uma(5), slot: slot('pantry'), request: craft('chopped-carrot', 2) }, clock('11:00'), ENV)).state
}

type Counts = { need: number; have: number; coming: number; short: number }

/** The recount, written plainly: layer → meal or tonic → crafted → raw, each level for every target in order, stock then coming. */
function recount(targetDishes: readonly (readonly ItemId[])[], stock: Record<string, number>, coming: Record<string, number>) {
  const s = { ...stock }, c = { ...coming }
  const take = (item: ItemId, need: number): Counts => {
    const have = Math.min(s[item] ?? 0, need)
    s[item] = (s[item] ?? 0) - have
    const comes = Math.min(c[item] ?? 0, need - have)
    c[item] = (c[item] ?? 0) - comes
    return { need, have, coming: comes, short: need - have - comes }
  }
  const tally = (items: readonly [ItemId, number][]) => {
    const m = new Map<ItemId, number>()
    for (const [item, qty] of items) m.set(item, (m.get(item) ?? 0) + qty)
    return [...m]
  }
  const levels = targetDishes.map((dishes) => ({ dish: tally(dishes.map((d) => [d, 1])) as [ItemId, number][], lines: {} as Record<string, Record<ItemId, Counts>> }))
  const dish = levels.map(({ dish: demand }) => Object.fromEntries(demand.map(([item, qty]) => [item, take(item, qty)])))
  const below = (lines: Record<ItemId, Counts>[]) => lines.map((byItem) => tally(Object.entries(byItem).flatMap(([item, counts]) =>
    (recipeOf(item)?.inputs ?? []).map(({ item: input, qty }): [ItemId, number] => [input, qty * counts.short]))).filter(([, qty]) => qty > 0))
  const crafted = below(dish).map((demand) => Object.fromEntries(demand.map(([item, qty]) => [item, take(item, qty)])))
  const raw = below(crafted).map((demand) => Object.fromEntries(demand.map(([item, qty]) => [item, take(item, qty)])))
  return { dish, crafted, raw }
}

const byItem = (lines: readonly PlanLine[]) => Object.fromEntries(lines.map((l) => [l.item, { need: l.need, have: l.have, coming: l.coming, short: l.short }]))

describe('the plan', () => {
  it('equals a brute-force recount: layer, meal or tonic, crafted, raw, less stock and coming', () => {
    const state = busy()
    const planned = plan(state, [uma(1), uma(2)], NOW, {}, ENV)
    // Uniques take no item (D374): they ask nothing of the Farm.
    const layer = layerUnlocks(1).flatMap((u) => (u.dishId === null ? [] : [u.dishId]))
    const expected = recount([layer, layer],
      { 'tonic-1': 9, 'chopped-carrot': 9, carrot: 1, 'dried-button-mushroom': 1 },
      { 'tonic-1': 1, carrot: 2, 'chopped-carrot': 2 })
    planned.targets.forEach((target, t) => {
      expect(byItem(target.dishes), `dishes of ${target.outfitId}`).toEqual(expected.dish[t])
      expect(byItem(target.crafted), `crafted of ${target.outfitId}`).toEqual(expected.crafted[t])
      expect(byItem(target.raw), `raw of ${target.outfitId}`).toEqual(expected.raw[t])
      expect(target.pickCards).toBe(6)
    })
    // Six nodes and slots A and B take a Warm-Up Tonic each.
    expect(planned.targets[1]!.dishes.find((l) => l.item === 'tonic-1')).toMatchObject({
      need: 8, have: 1, coming: 1, short: 6, comingFrom: [{ outfitId: uma(3), at: clock('08:00') + 432 * 60_000, count: 1 }],
    })
    // Lines are lowest grade first.
    for (const lines of [planned.dishes, planned.crafted, planned.raw]) {
      expect(lines.map((l) => l.grade)).toEqual([...lines.map((l) => l.grade)].sort((a, b) => a - b))
    }
    expect(planned.pickCards).toBe(12)
  })

  it('allocates nothing twice across five targets, in target order', () => {
    const state = account(6, { 'tonic-1': 10, 'chopped-carrot': 9 })
    const order = [uma(4), uma(2), uma(5), uma(1), uma(3)]
    const planned = plan(state, order, NOW, {}, ENV)
    expect(planned.targets.map((t) => t.dishes.find((l) => l.item === 'tonic-1')!.have)).toEqual([8, 2, 0, 0, 0])
    expect(planned.targets.map((t) => t.crafted.find((l) => l.item === 'chopped-carrot')?.have ?? 0)).toEqual([0, 6, 3, 0, 0])
    const total = planned.dishes.find((l) => l.item === 'tonic-1')!
    expect(total).toMatchObject({ need: 40, have: 10, short: 30 })
    for (const level of [planned.dishes, planned.crafted, planned.raw]) {
      for (const line of level) expect(line.have).toBeLessThanOrEqual(state.items[line.item] ?? 0)
    }
    expect(() => plan(state, [uma(1), uma(1)], NOW, {}, ENV)).toThrow(RangeError)
  })

  it("counts uncollected outputs as coming; reserved inputs and projected drops count neither way", () => {
    let state = busy()
    // Uma 6 brews one Warm-Up Tonic with a second queued that will drop: the Warehouse has no Wheat Flour left for it.
    state = { ...state, items: { ...state.items, 'wheat-flour': 1 } }
    state = ok(start(state, { outfitId: uma(6), slot: slot('kitchen', 1), request: cook('tonic-1', 1) }, clock('08:00'), ENV)).state
    state = ok(queue(state, { outfitId: uma(6), add: { request: cook('tonic-1', 1), building: 'kitchen' } }, clock('08:01'), ENV)).state
    // At 15:30 both first tonics are finished and uncollected.
    const planned = plan(state, [uma(1)], clock('15:30'), {}, ENV)
    expect(planned.freeStock).toMatchObject({ 'chopped-carrot': 8, 'tonic-1': 9 })
    expect(planned.freeStock['wheat-flour']).toBeUndefined()
    const tonic = planned.targets[0]!.dishes.find((l) => l.item === 'tonic-1')!
    expect(tonic).toMatchObject({ need: 8, have: 8, coming: 0 })
    const later = plan(state, [uma(2), uma(1)], clock('15:30'), {}, ENV).targets[1]!.dishes.find((l) => l.item === 'tonic-1')!
    expect(later).toMatchObject({ have: 1, coming: 2, short: 5 })
    expect(later.comingFrom.map((c) => c.outfitId)).toEqual([uma(3), uma(6)])
  })

  it("lists bonds without a card as pick cards, asks no item for a chosen card's bond, and gates a grade no Free Uma can make", () => {
    const state = atScenario2(account(3), uma(1))
    const chosen = { [uma(1)]: [cardOf('speed-e1'), cardOf('speed-e2')] }
    const planned = plan(state, [uma(1)], NOW, chosen, ENV)
    const target = planned.targets[0]!
    expect(target.pickCards).toBe(9 - 2)
    expect(target.unlocks.filter((u) => u.unlock.kind === 'bond').map((u) => [u.unlock.target, u.unlock.dishId])).toEqual([
      ['speed-e1', null], ['speed-e2', null],
    ])
    // Only the layer's single takes a Speed meal; the bonds take none (D374).
    expect(target.dishes.find((l) => l.item === 'dish-sweets-1')!.need).toBe(1)
    expect(planned.highestFree).toBe(1)
    expect(target.dishes.find((l) => l.item === 'dish-sweets-3')!.gate).toEqual({ needsLevel: 11, highestFree: 1 })
    expect(target.dishes.find((l) => l.item === 'dish-sweets-1')!.gate).toBeNull()
    expect(target.raw.find((l) => l.item === itemById('sugar-beet')!.id)!.gate).toEqual({ needsLevel: 11, highestFree: 1 })
  })

  it('names no gate when no Uma is Free', () => {
    let state = account(1)
    state = ok(start(state, { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 1) }, clock('11:00'), ENV)).state
    const planned = plan(atScenario2(state, uma(1)), [uma(1)], NOW, {}, ENV)
    expect(planned.highestFree).toBeNull()
    expect([...planned.dishes, ...planned.crafted, ...planned.raw].every((l) => l.gate === null)).toBe(true)
  })
})

describe('the views', () => {
  it('give each Farm place the lines it makes while the targets need more than the Warehouse holds', () => {
    const planned = plan(busy(), [uma(1), uma(2)], NOW, {}, ENV)
    // The Warehouse's chopped carrots cover the Warm-Up Tonics; the Practice Tonics need potatoes.
    expect(placeLines(planned, 'vegetable-garden').map((l) => l.item)).toEqual(['potato'])
    expect(placeLines(planned, 'pantry').every((l) => l.level === 'crafted' && l.need > l.have)).toBe(true)
    expect(placeLines(planned, 'kitchen').map((l) => l.item)).toContain('tonic-2')
    expect(placeLines(planned, 'kitchen').map((l) => l.item)).toContain('tonic-1')
    expect(placeLines(planned, 'observatory')).toEqual([])
  })

  it('give each Training facility, per target, the unlocks left, items ready and items coming', () => {
    const state = busy()
    const planned = plan(state, [uma(1), uma(2)], NOW, {}, ENV)
    expect(facilityLines(planned, 'observatory')).toEqual([
      { outfitId: uma(1), left: 12, ready: 6, coming: 0, canStart: true },
      { outfitId: uma(2), left: 12, ready: 1, coming: 1, canStart: true },
    ])
    expect(facilityLines(planned, 'lineage-hall').map((l) => l.left)).toEqual([4, 4])
  })

  it('mark Best use: the three running entries covering the most target need', () => {
    let state = account(6, { 'tonic-1': 1, 'chopped-carrot': 2, 'dried-button-mushroom': 2, 'wheat-flour': 2, carrot: 4 })
    const begin = (who: number, at: ReturnType<typeof slot>, request: Parameters<typeof start>[1]['request'], when: string) => {
      state = ok(start(state, { outfitId: uma(who), slot: at, request }, clock(when), ENV)).state
    }
    begin(3, slot('kitchen'), cook('tonic-1', 2), '11:00')
    begin(4, slot('vegetable-garden'), gather('carrot', 3), '11:00')
    begin(5, slot('pantry'), craft('chopped-carrot', 4), '11:15')
    begin(6, slot('fields'), gather('wheat', 1), '11:00')
    begin(1, slot('observatory'), nodes(1), '11:30')
    const planned = plan(state, [uma(1), uma(2)], NOW, {}, ENV)
    // Two tonics count 2, Uma 1's own node 1, three carrots ⅗ and one wheat ⅕. Of the four crafted carrots one is
    // already finished, so speeding the craft brings three: ⅗, and it ends before the gather, so it wins the tie.
    expect(planned.uses.filter((u) => u.running).map((u) => [u.outfitId, u.covers]).sort()).toEqual([
      [uma(1), 1], [uma(3), 2], [uma(4), 0.6], [uma(5), 0.6], [uma(6), 0.2],
    ])
    expect(bestUse(planned).map((m) => [m.outfitId, m.covers, m.startedAt])).toEqual([
      [uma(3), 2, clock('11:00')], [uma(1), 1, clock('11:30')], [uma(5), 0.6, clock('11:15')],
    ])
    // Not a target, her own session covers nothing.
    expect(plan(state, [uma(2)], NOW, {}, ENV).uses.find((u) => u.outfitId === uma(1))!.covers).toBe(0)
  })

  it('tell the stock sheet how much of a stack the targets hold back', () => {
    const planned = plan(busy(), [uma(1)], NOW, {}, ENV)
    expect(neededFromStock(planned, 'tonic-1')).toBe(8)
    expect(neededFromStock(planned, 'speed-ticket')).toBe(0)
  })
})

describe('her Needs tab', () => {
  it('plans for her alone without touching the targets: progress, an estimate, and three startable lines', () => {
    const state = ok(setTargets(withOpenNodes(busy(), uma(2), 3), { outfitIds: [uma(1)] }, 5)).state
    const needs = needsFor(state, uma(2), NOW, { env: ENV })
    expect(needs.progress).toEqual([
      { facility: 'observatory', done: 3, total: 12 },
      { facility: 'lineage-hall', done: 0, total: 4 },
      { facility: 'gym', done: 0, total: 5 },
      { facility: 'dojo', done: 0, total: 6 },
    ])
    expect(needs.plan.targets.map((t) => t.outfitId)).toEqual([uma(2)])
    expect(state.profile.targets).toEqual([uma(1)])
    expect(needs.estimateSeconds).toBeGreaterThan(0)
    expect(needs.startable.length).toBeLessThanOrEqual(NEEDS_STARTABLE)
    expect(needs.startable.length).toBeGreaterThan(0)
    const slots = needs.startable.map((s) => `${s.start.slot.building}/${s.start.slot.slot}`)
    expect(new Set(slots).size).toBe(slots.length)
    // Each line its own Free Uma, so every Start can run (T142).
    const workers = needs.startable.map((s) => s.start.outfitId)
    expect(new Set(workers).size).toBe(workers.length)
    for (const { line, start: job } of needs.startable) {
      expect(line.short).toBeGreaterThan(0)
      expect(job.item).toBe(line.item)
    }
  })
})

describe('the roster view', () => {
  it('plans for every Uma, most unlocks left first', () => {
    const state = atScenario2(withOpenNodes(account(4), uma(1), 5), uma(3))
    const { order, plan: planned } = rosterTotals(state, NOW, { env: ENV })
    expect(order.map((o) => o.outfitId)).toEqual([uma(3), uma(2), uma(4), uma(1)])
    expect(order.map((o) => o.unlocksLeft)).toEqual([50, 27, 27, 22])
    expect(planned.targets.map((t) => t.outfitId)).toEqual(order.map((o) => o.outfitId))
  })
})
