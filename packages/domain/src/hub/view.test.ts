// The Hub's view (docs/game/11-hub-and-places.md §2, §4, §5, §14; 02 §2, §7) on synthetic accounts run by the real work
// engine: pips follow the work rows, busy first; past eight slots the eighth pip is "+N"; the pill's counts are
// `readyCount`'s and `freeUmas`'; the start rule's is `needsATap`'s; tab badges, counters, the featured Uma and the
// account bar's chips.
import { describe, expect, it } from 'vitest'
import {
  account, CHECK_IN_CONTENT, clock, ENV, gather, nodes, ok, slot, uma, withStock,
} from '../__fixtures__/check-in'
import { deepFreeze, placeUma } from '../__fixtures__/tiers'
import { withLevel } from '../__fixtures__/work'
import { needsATap, readyCount } from '../check-in/collect-all'
import { DOJO_ROOMS, GYM_ROOMS } from '../farm/buildings'
import { rawItem, SPEED_TICKET_ID } from '../items/catalogue'
import { freeUmas } from '../planner/suggest'
import { queue, start } from '../work/operations'
import { itemProgress } from '../work/timeline'
import type { WorkState } from '../work/types'
import { placeById } from './places'
import { featuredUma, hubView, MAX_PIPS } from './view'
import { tileLabel, umaTicketChip } from './words'

const CARROT = rawItem('vegetables', 1).id
const NINE = clock('09:00')

/**
 * Six Umas at 09:00: two gathering at a Lv 2 Vegetable Garden (one with a request queued), one whose gather finished
 * at 06:42, one whose Observatory session finished at 05:24, and two Free.
 */
function morning(): WorkState {
  let state = withLevel(withStock(account(6), { 'tonic-1': 1 }), 'vegetable-garden', 2)
  state = ok(start(state, { outfitId: uma(4), slot: slot('observatory', 0), request: nodes(1) }, clock('00:00'), ENV)).state
  state = ok(start(state, { outfitId: uma(2), slot: slot('vegetable-garden', 2), request: gather(CARROT, 1) }, clock('04:00'), ENV)).state
  state = ok(start(state, { outfitId: uma(1), slot: slot('vegetable-garden', 0), request: gather(CARROT, 3) }, clock('08:00'), ENV)).state
  state = ok(start(state, { outfitId: uma(3), slot: slot('vegetable-garden', 4), request: gather(CARROT, 2) }, clock('08:30'), ENV)).state
  return ok(queue(state, { outfitId: uma(3), add: { request: gather(CARROT, 1), building: 'vegetable-garden' } }, clock('08:30'), ENV)).state
}

describe('the hub view', () => {
  it('draws pips busy first, then ready, then free, matching the work rows (§4)', () => {
    const state = morning()
    const view = hubView(state, NINE, ENV)
    const garden = view.buildings['vegetable-garden']
    expect(garden).toMatchObject({ slots: 5, busy: 2, ready: 1, free: 2, queued: 1, more: 0 })
    expect(garden.pips.map((pip) => [pip.state, pip.outfitId, pip.queued])).toEqual([
      ['busy', uma(1), 0], ['busy', uma(3), 1], ['ready', uma(2), 0], ['free', null, 0], ['free', null, 0],
    ])
    expect(garden.pips[0]!.progress).toBeCloseTo(60 / 162, 10)
    expect(garden.pips[0]!.progress).toBe(itemProgress(state.work[uma(1)]!.entries[0]!, NINE))
    expect(garden.pips[1]!.progress).toBeCloseTo(30 / 162, 10)
    expect([garden.pips[2]!.progress, garden.pips[3]!.progress]).toEqual([1, 0])
    expect(view.buildings.observatory).toMatchObject({ slots: 2, busy: 0, ready: 1, free: 1 })
    expect(view.buildings.fields).toMatchObject({ slots: 2, free: 2, pips: [{ state: 'free' }, { state: 'free' }] })
    expect(tileLabel(placeById('vegetable-garden')!, view)).toBe('Vegetable Garden. 2 of 5 slots busy, 1 ready, 1 queued.')
    expect(tileLabel(placeById('fields')!, view)).toBe('Fields. 0 of 2 slots busy.')
  })

  it("counts the pill's Ready and Free as the check-in does, and the start rule's needs-a-tap (02 §2, §7)", () => {
    const state = morning()
    const view = hubView(state, NINE, ENV)
    expect(view.ready).toBe(2)
    expect(view.ready).toBe(readyCount(state, NINE, ENV))
    expect(view.free).toBe(freeUmas(state).length)
    expect(view.free).toBe(2)
    expect(view.needsATap).toBe(needsATap(state, NINE, ENV))
    expect(view.needsATap).toBe(4)
    expect(view.readySlots).toEqual(expect.arrayContaining([slot('vegetable-garden', 2), slot('observatory', 0)]))
    expect(view.readySlots).toHaveLength(2)
    expect(view.tabs).toEqual({ farm: 1, training: 1 })
    expect(view.umas).toBe(6)
    // Earlier that morning only the session had finished.
    expect(hubView(state, clock('06:00'), ENV)).toMatchObject({ ready: 1, tabs: { farm: 0, training: 1 } })
    expect(hubView(account(0), NINE, ENV)).toMatchObject({ ready: 0, free: 0, needsATap: 0, umas: 0, featured: null })
  })

  it('counts a running batch with finished items as Ready, as Collect all does (02 §2)', () => {
    const view = hubView(morning(), clock('11:00'), ENV)
    expect(view.buildings['vegetable-garden'].pips.find((pip) => pip.outfitId === uma(1))).toMatchObject({ state: 'ready', progress: 1 })
    expect(view.ready).toBe(readyCount(morning(), clock('11:00'), ENV))
  })

  it('shows the Kitchen at Lv 1 as six pips and at Lv 2 as seven and "+2", and the Gym at Lv 2 as seven and "+3" (§14)', () => {
    expect(hubView(account(0), NINE, ENV).buildings.kitchen).toMatchObject({ slots: 6, free: 6, more: 0, pips: { length: 6 } })
    const state = withLevel(withLevel(withLevel(account(0), 'kitchen', 2), 'gym', 2), 'dojo', 2)
    const view = hubView(state, NINE, ENV)
    expect(view.buildings.kitchen).toMatchObject({ slots: 9, free: 9, more: 2 })
    expect(view.buildings.kitchen.pips).toHaveLength(MAX_PIPS - 1)
    expect(view.buildings.gym).toMatchObject({ slots: 10, free: 10, more: 3 })
    expect(view.buildings.gym.pips.map((pip) => pip.room)).toEqual([...GYM_ROOMS.flatMap((room) => [room, room])].slice(0, 7))
    expect(view.buildings.dojo).toMatchObject({ slots: 12, more: 5 })
    expect(view.buildings.dojo.pips.map((pip) => pip.room)).toEqual(DOJO_ROOMS.flatMap((room) => [room, room]).slice(0, 7))
    expect(view.buildings.pantry.pips.every((pip) => pip.room === null)).toBe(true)
  })

  it("gives each place's counter from the rework rules, and the tile reads it (§3)", () => {
    let state = morning()
    const ready = placeUma(state.umas[uma(5)]!, { tier: 1, scenario: 1, level: 10, careerWon: true }, CHECK_IN_CONTENT)
    const ran = { expeditionId: 'synthetic', races: 8, wins: 5, completed: true }
    const promotable = { ...state.umas[uma(6)]!, expedition: { runs: [ran] } }
    const busy = { ...state.umas[uma(1)]!, expedition: { runs: [ran] } }
    state = { ...state, umas: { ...state.umas, [uma(5)]: ready, [uma(6)]: promotable, [uma(1)]: busy } }
    state = { ...state, profile: { ...state.profile, umaTickets: 3 } }
    const view = hubView(state, NINE, ENV)
    expect(view.counts).toEqual({
      stable: 3, 'scenario-gate': 1, 'expedition-map': 1, 'vegetable-garden': 1, observatory: 1,
      'sugar-grove': 0, orchard: 0, fishery: 0, 'nut-grove': 0, 'herb-garden': 0, fields: 0, 'mushroom-cave': 0, pantry: 0, kitchen: 0,
      'lineage-hall': 0, gym: 0, dojo: 0,
    })
    expect(tileLabel(placeById('stable')!, view, view.counts.stable!)).toBe('Stable. 3 Uma Tickets.')
    expect(tileLabel(placeById('scenario-gate')!, view, 1)).toBe('Scenario Gate. 1 ready to advance.')
    expect(tileLabel(placeById('warehouse')!, view, null)).toBe('Warehouse.')
    expect(tileLabel(placeById('kitchen')!, null)).toBe('Kitchen.')
  })

  it("features the profile's Uma, else D181's first by lifetime level, then name (§5)", () => {
    const state = morning()
    expect(featuredUma(state, ENV)).toBe(uma(1))
    expect(hubView(state, NINE, ENV).featured).toBe(uma(1))
    const unset = { ...state, profile: { ...state.profile, featuredUmaId: null } }
    expect(featuredUma(unset, ENV)).toBe(uma(1))
    const leveled = { ...unset, umas: { ...unset.umas, [uma(5)]: placeUma(unset.umas[uma(5)]!, { tier: 1, scenario: 1, level: 7 }, CHECK_IN_CONTENT) } }
    expect(featuredUma(leveled, ENV)).toBe(uma(5))
    const gone = { ...state, profile: { ...state.profile, featuredUmaId: 'not-owned' } }
    expect(featuredUma(gone, ENV)).toBe(uma(1))
  })

  it("fills the account bar's chips: Prize Money, Speed Tickets, and Uma Tickets with Shards held at 5/5 (§2.1)", () => {
    const state = withStock({ ...morning(), profile: { ...morning().profile, prizeMoney: 1234, umaTickets: 2, umaShards: 3 } }, { [SPEED_TICKET_ID]: 46 })
    const view = hubView(state, NINE, ENV)
    expect(view.wallet).toEqual({ prizeMoney: 1234, speedTickets: 46, umaTickets: 2, shards: 3, shardsPerTicket: 5, ticketReady: false })
    expect(umaTicketChip(view.wallet)).toBe('2 · 3/5')
    const many = hubView({ ...state, profile: { ...state.profile, umaShards: 7 } }, NINE, ENV)
    expect(many.wallet.ticketReady).toBe(true)
    expect(umaTicketChip(many.wallet)).toBe('2 · 5/5')
  })

  it('never writes into its input, repeats itself, and keeps every ring within 0–1 with the clock moved either way', () => {
    const state = deepFreeze(morning())
    const once = hubView(state, NINE, ENV)
    expect(hubView(state, NINE, ENV)).toEqual(once)
    expect(hubView(JSON.parse(JSON.stringify(state)) as WorkState, NINE, ENV)).toEqual(once)
    for (const at of [clock('00:00'), clock('07:00'), NINE, clock('23:00'), clock('09:00', 3)]) {
      for (const building of Object.values(hubView(state, at, ENV).buildings)) {
        for (const pip of building.pips) expect(pip.progress >= 0 && pip.progress <= 1, `${at}`).toBe(true)
      }
    }
    expect(() => hubView(state, Number.NaN, ENV)).toThrow(RangeError)
  })
})
