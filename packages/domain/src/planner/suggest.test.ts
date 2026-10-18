// Suggestions for Free Umas (docs/game/02-check-ins-and-notifications.md §6; docs/game/01-game-loop.md §4): her
// own session first, then Farm Level order; the largest shortfall she can start for the first target she can work
// for; no slot, input or output promised twice; sizes fitted and capped by stock; and Start suggestions.
import { describe, expect, it } from 'vitest'
import { account, atFarmLevel, CHECK_IN_CONTENT, clock, ENV, gather, ok, slot, uma } from '../__fixtures__/check-in'
import { placeUma } from '../__fixtures__/tiers'
import { farmItemSeconds } from '../farm/jobs'
import { recipeOf } from '../items/recipes'
import { commitUnlocks } from '../training/build'
import { layerUnlocks, sessionSeconds } from '../training/unlocks'
import { start } from '../work/operations'
import { SESSION_KIND, type WorkState } from '../work/types'
import { DEFAULT_CHECK_INS, fitSize } from '../check-in/schedule'
import { freeUmas, startSuggestions, suggest, type Suggestion } from './suggest'
import { setTargets } from './targets'

const NOW = clock('12:00')
const ten = (seconds: number) => Array.from({ length: 10 }, () => seconds)
const unlockTargets = (s: Suggestion) => (s.request.kind === SESSION_KIND ? s.request.unlocks.map((u) => u.target) : [])

describe('suggest', () => {
  it('gives her own session first when a tonic for her unlocks is in stock, Umas by Farm Level, highest first', () => {
    let state = account(4, { 'tonic-1': 3 })
    state = atFarmLevel(atFarmLevel(state, uma(1), 10), uma(3), 5)
    expect(freeUmas(state).map((u) => u.outfitId)).toEqual([uma(1), uma(3), uma(2), uma(4)])
    const { suggestions, idle } = suggest(state, NOW, { env: ENV })
    expect(idle).toEqual([])
    expect(suggestions.map((s) => [s.outfitId, s.kind, s.slot])).toEqual([
      [uma(1), 'session', slot('observatory', 0)],
      [uma(3), 'session', slot('observatory', 1)],
      [uma(2), 'session', slot('lineage-hall', 0)],
      [uma(4), 'job', slot('orchard', 0)],
    ])
    // From 12:00 even one 324-minute unlock overruns 13:00, so she fits 22:30: one node, and the next two Umas take
    // the other two tonics.
    expect(fitSize(NOW, ten(sessionSeconds(1)), DEFAULT_CHECK_INS, 0)).toBe(1)
    expect(unlockTargets(suggestions[0]!)).toEqual(['n1'])
    expect(unlockTargets(suggestions[1]!)).toEqual(['n1'])
    expect(unlockTargets(suggestions[2]!)).toEqual(['parent0'])
    expect(suggestions[0]!.forTarget).toBe(uma(1))
  })

  it('suggests gathering on an empty Warehouse, the largest shortfall first, fitted to the next check-in', () => {
    const state = account(5)
    const { suggestions } = suggest(state, NOW, { env: ENV })
    expect(suggestions).toHaveLength(5)
    expect(suggestions.every((s) => s.kind === 'job' && s.request.kind === 'gather')).toBe(true)
    const fitted = fitSize(NOW, ten(farmItemSeconds('gather', 1)), DEFAULT_CHECK_INS, 0)
    expect(fitted).toBe(3)
    expect(suggestions.every((s) => s.size === fitted)).toBe(true)
    // The first target's largest raw shortfalls she can gather at grade 1: the eight Warm-Up Tonics' mushrooms, carrots
    // and wheat tie at 8, Button Mushroom first.
    expect(suggestions[0]).toMatchObject({ outfitId: uma(1), forTarget: uma(1), request: gather('button-mushroom', 3) })
    expect(suggestions.map((s) => s.slot.building)).toContain('fields')
  })

  it('promises no slot, input or output twice', () => {
    let state = account(8, { carrot: 5, 'tonic-1': 3 })
    for (const n of [1, 2, 3]) state = atFarmLevel(state, uma(n), 3)
    const at = clock('13:00')
    const { suggestions } = suggest(state, at, { env: ENV })
    const slots = suggestions.map((s) => JSON.stringify(s.slot))
    expect(new Set(slots).size).toBe(slots.length)
    // The Observatory's two slots go to the first two; the third takes the last tonic to the Lineage Hall.
    expect(suggestions.filter((s) => s.slot.building === 'observatory').map((s) => s.outfitId)).toEqual([uma(1), uma(2)])
    expect(suggestions.filter((s) => s.slot.building === 'lineage-hall').map((s) => s.outfitId)).toEqual([uma(3)])
    const used = new Map<string, number>()
    for (const s of suggestions) {
      // Each suggested session is grade 1 nodes or slots: a Warm-Up Tonic an unlock.
      const inputs = s.request.kind === SESSION_KIND
        ? s.request.unlocks.map(() => ({ item: 'tonic-1', qty: 1 }))
        : (recipeOf(s.request.item)?.inputs ?? []).map(({ item, qty }) => ({ item, qty: qty * s.size }))
      for (const { item, qty } of inputs) used.set(item, (used.get(item) ?? 0) + qty)
    }
    expect(used.get('tonic-1')).toBe(3)
    // From 13:00 a 40.5-minute craft fits ×10 before 22:30, so one Uma takes all five carrots and no
    // other craft is promised them.
    expect(suggestions.filter((s) => s.request.kind === 'craft').map((s) => [s.slot.slot, s.size])).toEqual([[0, 5]])
    expect(used.get('carrot')).toBe(5)
  })

  it('caps a size by stock, not by need', () => {
    const state = account(1, { carrot: 2 })
    const { suggestions } = suggest(state, clock('13:00'), { env: ENV })
    // Chopped Carrot is the largest crafted shortfall she can start; two carrots cap it at ×2.
    expect(suggestions).toMatchObject([{ request: { kind: 'craft', item: 'chopped-carrot', count: 2 }, size: 2 }])
  })

  it('works for the first target she can: a grade her Farm Level opens', () => {
    let state = account(3)
    const first = placeUma(state.umas[uma(1)]!, { tier: 1, scenario: 3, level: 21 }, CHECK_IN_CONTENT)
    const opened = commitUnlocks(first.build, first, [...layerUnlocks(1), ...layerUnlocks(2)]).build
    state = { ...state, umas: { ...state.umas, [uma(1)]: { ...first, build: { ...opened, bonds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] } } } }
    state = ok(setTargets(state, { outfitIds: [uma(1), uma(2)] }, 5)).state
    // Uma 1 has only scenario 3 left: grades 5 and 6, with sides at 3 and 4. Farm Lv 1 opens grade 1, so the Free
    // Umas work for Uma 2 until one reaches Farm Lv 11.
    const { suggestions } = suggest(state, NOW, { env: ENV })
    expect(suggestions.map((s) => s.forTarget)).toEqual([uma(2), uma(2), uma(2)])
    const raised = atFarmLevel(state, uma(3), 11)
    expect(suggest(raised, NOW, { env: ENV }).suggestions[0]).toMatchObject({ outfitId: uma(3), forTarget: uma(1) })
  })

  it('follows marked targets', () => {
    const state = ok(setTargets(account(6), { outfitIds: [uma(6)] }, 5)).state
    expect(suggest(state, NOW, { env: ENV }).suggestions.every((s) => s.forTarget === uma(6))).toBe(true)
  })

  it('leaves busy Umas out and names a Free Uma with nothing to do as idle', () => {
    let state = account(2)
    state = ok(start(state, { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 1) }, clock('11:00'), ENV)).state
    // Uma 1 is working: only Uma 2 is Free.
    expect(suggest(state, NOW, { env: ENV }).suggestions.map((s) => s.outfitId)).toEqual([uma(2)])
    // With no targets left (her layer is done and Uma 1 is gone), she has nothing to start.
    const alone: WorkState = { ...state, work: {}, umas: { [uma(2)]: state.umas[uma(2)]! } }
    const her = alone.umas[uma(2)]!
    const finished = { ...alone, umas: { [uma(2)]: { ...her, build: { ...commitUnlocks(her.build, her, layerUnlocks(1)).build, bonds: ['a', 'b', 'c', 'd', 'e', 'f'] } } } }
    expect(suggest(finished, NOW, { env: ENV })).toEqual({ suggestions: [], idle: [uma(2)] })
  })
})

describe('Start suggestions', () => {
  it('runs one start per line, in order', () => {
    let state = account(4, { 'tonic-1': 4 })
    state = atFarmLevel(state, uma(1), 10)
    const { suggestions } = suggest(state, NOW, { env: ENV })
    const { state: after, started, refused } = startSuggestions(state, suggestions, NOW, ENV)
    expect(refused).toEqual([])
    expect(started.map((r) => r.outfitId)).toEqual(suggestions.map((s) => s.outfitId))
    expect(started.map((r) => r.endsAt)).toEqual(suggestions.map((s) => s.endsAt))
    expect(freeUmas(after)).toEqual([])
    // Run again on the started state, each line is refused with T127's plain reason.
    expect(startSuggestions(after, suggestions, NOW, ENV).refused.map((r) => r.refusal.code)).toContain('busy')
  })
})
