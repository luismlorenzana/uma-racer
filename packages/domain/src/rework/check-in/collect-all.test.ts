// Collect all (docs/rework/02-check-ins-and-notifications.md §2, §9, §12; docs/rework/07-farm.md §9) on a synthetic
// 25-Uma account: one operation claims every finished item and unlock with a line per slot, a retry pays nothing
// twice, the other device's later Collect all reads "Already collected", a failing slot never blocks the rest, and
// nothing is started, bought, sold or spent.
import { describe, expect, it } from 'vitest'
import {
  account, atFarmLevel, clock, cook, craft, ENV, gather, nodes, ok, slot, uma,
} from '../../__fixtures__/rework-check-in'
import { gatherKind } from '../farm/jobs'
import { FAMILY_SITE } from '../farm/jobs'
import { BUILDING_IDS, type BuildingId } from '../farm/buildings'
import { FAMILY_IDS } from '../items/families'
import { rawItem, SPEED_TICKET_ID } from '../items/catalogue'
import { WORK_KINDS } from '../work/kinds'
import { start } from '../work/operations'
import type { SlotRef, WorkRequest, WorkState } from '../work/types'
import { collectAll, readyCount } from './collect-all'
import { runOnce } from './once'

/** Every site's slots at Lv 1, in building order: 18 gatherers. */
const SITE_SLOTS: SlotRef[] = FAMILY_IDS.flatMap((family) => {
  const site = FAMILY_SITE[family]
  return Array.from({ length: site === 'vegetable-garden' ? 4 : 2 }, (_, n) => slot(site, n))
}).sort((a, b) => BUILDING_IDS.indexOf(a.building) - BUILDING_IDS.indexOf(b.building) || a.slot - b.slot)

const familyAt = (building: BuildingId) => FAMILY_IDS.find((family) => FAMILY_SITE[family] === building)!

/** 25 Umas at work from 22:30: 18 gathering ×3, 3 crafting ×4, 2 cooking ×1 and 2 in an Observatory session. */
function busyNight(): { state: WorkState; slots: SlotRef[] } {
  let state = account(25, { carrot: 12, 'chopped-carrot': 8, 'wheat-flour': 2, 'dish-vegetables-1': 2, [SPEED_TICKET_ID]: 5 })
  state = { ...state, profile: { ...state.profile, prizeMoney: 777 } }
  const plan: [SlotRef, WorkRequest][] = [
    ...SITE_SLOTS.map((s): [SlotRef, WorkRequest] => [s, gather(rawItem(familyAt(s.building), 1).id, 3)]),
    ...[0, 1, 2].map((n): [SlotRef, WorkRequest] => [slot('pantry', n), craft('chopped-carrot', 4)]),
    ...[0, 1].map((n): [SlotRef, WorkRequest] => [slot('kitchen', n), cook('dish-vegetables-1', 1)]),
    ...[0, 1].map((n): [SlotRef, WorkRequest] => [slot('observatory', n), nodes(1)]),
  ]
  plan.forEach(([at, request], i) => {
    state = ok(start(state, { outfitId: uma(i + 1), slot: at, request }, clock('22:30'), ENV)).state
  })
  return { state, slots: plan.map(([at]) => at) }
}

describe('collect-all', () => {
  it('claims every finished item and unlock in one operation, a line per slot in building order', () => {
    const { state, slots } = busyNight()
    const morning = clock('08:00', 1)
    expect(readyCount(state, morning, ENV)).toBe(25)
    const { state: after, receipt } = collectAll(state, {}, morning, ENV)
    expect(receipt.lines).toHaveLength(25)
    expect(receipt.lines.every((line) => line.status === 'collected' && line.freed && line.words === null)).toBe(true)
    expect(receipt.lines.map((line) => line.slot)).toEqual([...slots].sort((a, b) =>
      BUILDING_IDS.indexOf(a.building) - BUILDING_IDS.indexOf(b.building) || a.slot - b.slot))
    expect(receipt.totals).toEqual({ items: 18 * 3 + 3 * 4, dishes: 2, unlocks: 2, farmExp: receipt.totals.farmExp, levelUps: 0 })
    expect(receipt.lines.find((line) => line.outfitId === uma(1))).toMatchObject({ items: [{ item: 'honeycomb', qty: 3 }], farmExp: 324 * 4 })
    expect(receipt.lines.find((line) => line.outfitId === uma(24))!.unlocks).toEqual([expect.objectContaining({ kind: 'node', target: 'n1' })])
    expect(readyCount(after, morning, ENV)).toBe(0)
    expect(after.items).toMatchObject({ honeycomb: 6, apple: 6, carrot: 12, 'chopped-carrot': 12, 'dish-vegetables-1': 2 })
    expect(after.umas[uma(24)]!.build.constellationOpened).toBe(1)
    expect(Object.values(after.work).every((row) => row.entries.length === 0 && row.last !== null)).toBe(true)
  })

  it("collects what's finished of a running job and lets it carry on", () => {
    const { state } = busyNight()
    const { state: after, receipt } = collectAll(state, {}, clock('02:30', 1), ENV)
    const gatherer = receipt.lines.find((line) => line.outfitId === uma(1))!
    expect(gatherer).toMatchObject({ status: 'collected', items: [{ item: 'honeycomb', qty: 2 }], freed: false })
    expect(after.work[uma(1)]!.entries[0]!.collected).toBe(2)
    expect(readyCount(after, clock('02:30', 1), ENV)).toBe(0)
  })

  it('limits itself to the places asked for', () => {
    const { state } = busyNight()
    const { receipt } = collectAll(state, { places: ['kitchen', 'pantry'] }, clock('08:00', 1), ENV)
    expect(receipt.lines.map((line) => line.slot.building)).toEqual(['pantry', 'pantry', 'pantry', 'kitchen', 'kitchen'])
  })

  it('pays Farm Levels crossed, the grades they open, and raises the Exchange stock mark', () => {
    const { state } = busyNight()
    const nearly = atFarmLevel(atFarmLevel(state, uma(1), 5, 470 * 4), uma(2), 1, 400 * 4)
    const { state: after, receipt } = collectAll(nearly, {}, clock('08:00', 1), ENV)
    expect(receipt.lines.find((line) => line.outfitId === uma(1))).toMatchObject({ farmLevel: { from: 5, to: 6 }, gradesOpened: [2] })
    expect(receipt.lines.find((line) => line.outfitId === uma(2))).toMatchObject({ farmLevel: { from: 1, to: 2 }, gradesOpened: [] })
    expect(receipt.totals.levelUps).toBe(2)
    expect(receipt.exchangeGrade).toEqual({ from: 1, to: 2 })
    expect(after.profile.exchangeGrade).toBe(2)
  })

  it('never starts, buys, sells or spends anything', () => {
    const { state } = busyNight()
    const { state: after, receipt } = collectAll(state, {}, clock('08:00', 1), ENV)
    expect(after.profile.prizeMoney).toBe(777)
    expect(after.items[SPEED_TICKET_ID]).toBe(5)
    expect(after.ledger).toEqual(state.ledger)
    expect(receipt.settled.started).toEqual([])
    expect(receipt.movements.every((movement) => movement.kind === 'output')).toBe(true)
  })

  it('pays nothing twice: a retry with the same id returns the first receipt and the same state', () => {
    const { state } = busyNight()
    const call = { id: 'tap-1', name: 'collect-all' as const, input: {} }
    const first = runOnce(state, call, clock('08:00', 1), ENV)
    if ('refused' in first) throw new Error(first.reason)
    const again = runOnce(first.state, call, clock('08:05', 1), ENV)
    if ('refused' in again) throw new Error(again.reason)
    expect(again.repeated).toBe(true)
    expect(again.state).toBe(first.state)
    expect(again.receipt).toEqual(first.receipt)
    expect(first.state.operations?.['tap-1']).toMatchObject({ name: 'collect-all', at: clock('08:00', 1) })
  })

  it("reads \"Already collected.\" on the other device's later Collect all", () => {
    const { state, slots } = busyNight()
    const ipad = runOnce(state, { id: 'ipad', name: 'collect-all', input: {} }, clock('08:00', 1), ENV)
    if ('refused' in ipad) throw new Error(ipad.reason)
    const iphone = runOnce(ipad.state, { id: 'iphone', name: 'collect-all', input: { shown: slots } }, clock('08:01', 1), ENV)
    if ('refused' in iphone) throw new Error(iphone.reason)
    expect(iphone.repeated).toBe(false)
    expect(iphone.receipt.lines).toHaveLength(25)
    expect(iphone.receipt.lines.every((line) => line.status === 'already-collected' && line.words?.text === 'Already collected.')).toBe(true)
    expect(iphone.state.items).toEqual(ipad.state.items)
    expect(iphone.receipt.totals).toEqual({ items: 0, dishes: 0, unlocks: 0, farmExp: 0, levelUps: 0 })
  })

  it("keeps a failing slot's reason and collects the others", () => {
    const { state } = busyNight()
    const env = {
      ...ENV,
      kinds: {
        ...WORK_KINDS,
        gather: {
          plan: gatherKind.plan,
          pay: ((s, outfitId, outputs, context) => {
            if (outfitId === uma(3)) throw new Error('disk full')
            return gatherKind.pay(s, outfitId, outputs, context)
          }) as typeof gatherKind.pay,
        },
      },
    }
    const { state: after, receipt } = collectAll(state, {}, clock('08:00', 1), env)
    const failed = receipt.lines.filter((line) => line.status === 'failed')
    expect(failed.map((line) => [line.outfitId, line.words?.text])).toEqual([[uma(3), "That didn't work. Try again."]])
    expect(receipt.lines.filter((line) => line.status === 'collected')).toHaveLength(24)
    expect(after.work[uma(3)]!.entries).toHaveLength(1)
    expect(readyCount(after, clock('08:00', 1), env)).toBe(1)
  })
})
