// Queues at check-ins (docs/rework/02-check-ins-and-notifications.md §3, §4, §10, §12; docs/rework/07-farm.md §2): a
// queue runs overnight with nobody there, its starts don't depend on collect order, a stopped queue shows under Queue
// stopped with its fixes and goes back in one restart, the card warns before the night, and stock collected later
// never counts backwards.
import { describe, expect, it } from 'vitest'
import { account, clock, craft, ENV, gather, ok, slot, uma } from '../__fixtures__/check-in'
import { buyPrice } from '../economy/exchange'
import { projectWork, queueWarnings } from '../planner/project'
import { isRefusal } from '../state/types'
import { collect, queue, start } from '../work/operations'
import type { WorkRequest, WorkState } from '../work/types'
import { collectAll } from './collect-all'
import { dismissDropped, queueStopped, restartDropped } from './dropped'
import { runOnce } from './once'
import { checkInSummary } from './summary'
import { fill } from './words'

const PANTRY = slot('pantry')
const minutes = (n: number) => n * 60_000
const queueUp = (state: WorkState, outfitId: string, requests: readonly WorkRequest[], now: number) =>
  requests.reduce((s, request) => ok(queue(s, { outfitId, add: { request, building: 'pantry' } }, now, ENV)).state, state)

describe('a queue overnight', () => {
  it('runs a running entry and three queued ones from 22:30 with no operations, starting each on time', () => {
    let state = ok(start(account(2, { carrot: 16 }), { outfitId: uma(1), slot: PANTRY, request: craft('chopped-carrot', 4) }, clock('22:30'), ENV)).state
    state = queueUp(state, uma(1), [craft('chopped-carrot', 4), craft('chopped-carrot', 4), craft('chopped-carrot', 4)], clock('22:31'))
    // Each ×4 craft is 4 × 27 minutes at k = 1.2.
    const projected = projectWork(state, clock('22:31'), ENV)
    expect(projected.entries.map((entry) => entry.startsAt)).toEqual([1, 2, 3].map((k) => clock('22:30') + k * minutes(108)))
    const { state: morning, receipt } = collectAll(state, {}, clock('08:00', 1), ENV)
    expect(receipt.lines).toMatchObject([{ outfitId: uma(1), items: [{ item: 'chopped-carrot', qty: 16 }], freed: true, queueStarts: projected.entries.map((e) => e.startsAt) }])
    expect(receipt.settled.started.map((s) => s.at)).toEqual(projected.entries.map((e) => e.startsAt))
    expect(morning.items).toEqual({ 'chopped-carrot': 16 })
  })

  it('starts queued entries the same whatever order the cards are collected in', () => {
    let state = account(3, { carrot: 12 })
    state = ok(start(state, { outfitId: uma(1), slot: slot('pantry', 0), request: craft('chopped-carrot', 2) }, clock('22:30'), ENV)).state
    state = ok(start(state, { outfitId: uma(2), slot: slot('pantry', 1), request: craft('chopped-carrot', 3) }, clock('22:30'), ENV)).state
    state = queueUp(state, uma(1), [craft('chopped-carrot', 4)], clock('22:31'))
    state = queueUp(state, uma(2), [craft('chopped-carrot', 4)], clock('22:31'))
    // 7 carrots are left for two queued ×4 crafts: Uma 1's chain ends first, so hers starts and Uma 2's drops.
    const at = clock('08:00', 1)
    const oneThenTwo = collect(collect(state, { outfitId: uma(1) }, at, ENV).state, { outfitId: uma(2) }, at, ENV).state
    const twoThenOne = collect(collect(state, { outfitId: uma(2) }, at, ENV).state, { outfitId: uma(1) }, at, ENV).state
    const all = collectAll(state, {}, at, ENV).state
    expect(twoThenOne.work).toEqual(oneThenTwo.work)
    expect(all.work).toEqual(oneThenTwo.work)
    expect(all.items).toEqual(oneThenTwo.items)
    expect(all.work[uma(1)]!.dropped).toBeNull()
    expect(all.work[uma(2)]!.dropped).toMatchObject({ at: clock('22:30') + minutes(81), short: [{ item: 'carrot', qty: 1 }] })
  })
})

/** Uma 1 crafts ×10 from 01:30 to 06:00 with two more queued and no carrots left; Uma 2 gathers 2 carrots by 04:12. */
function stoppedAtSix(): WorkState {
  let state = account(4, { carrot: 10 })
  state = ok(start(state, { outfitId: uma(1), slot: PANTRY, request: craft('chopped-carrot', 10) }, clock('01:30', 1), ENV)).state
  state = queueUp(state, uma(1), [craft('chopped-carrot', 2), craft('wheat-flour', 1)], clock('01:31', 1))
  return ok(start(state, { outfitId: uma(2), slot: slot('vegetable-garden'), request: gather('carrot', 2) }, clock('00:36', 1), ENV)).state
}

describe('a queue that stops', () => {
  it('warns on the card before the night', () => {
    const warnings = queueWarnings(stoppedAtSix(), clock('01:32', 1), ENV)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ outfitId: uma(1), at: clock('06:00', 1), request: craft('chopped-carrot', 2), short: [{ item: 'carrot', qty: 2 }] })
    expect(fill(warnings[0]!.words)).toBe('Short 2 carrot.')
  })

  it("drops at 06:00 even though carrots finished at 04:12: stock that's collected later doesn't count backwards", () => {
    const { state: morning } = collectAll(stoppedAtSix(), {}, clock('08:00', 1), ENV)
    expect(morning.work[uma(1)]).toMatchObject({
      entries: [], queue: [],
      dropped: { at: clock('06:00', 1), short: [{ item: 'carrot', qty: 2 }], requests: [craft('chopped-carrot', 2), craft('wheat-flour', 1)] },
    })
    expect(morning.items).toMatchObject({ carrot: 2, 'chopped-carrot': 10 })
    expect(queueWarnings(morning, clock('08:00', 1), ENV)).toEqual([])
  })

  it('shows under Queue stopped at 08:00 with Buy and restart, Make them and its price', () => {
    const { state: morning } = collectAll(stoppedAtSix(), {}, clock('08:00', 1), ENV)
    // Uma 2's two carrots have gone to other work, so the Warehouse is short again.
    const state = { ...morning, items: { ...morning.items, carrot: 0 } }
    const times = { times: state.profile.checkIns, utcOffsetMin: 0 }
    const stopped = queueStopped(state, uma(1), clock('08:00', 1), ENV, times)!
    expect(fill(stopped.words)).toBe('Short 2 carrot.')
    expect(stopped).toMatchObject({ restart: false, startSmaller: null, buy: { items: [{ sku: 'carrot', qty: 2, unitPrice: buyPrice('carrot') }], total: 2 * buyPrice('carrot')! } })
    expect(stopped.makeThem).toMatchObject({ outfitId: uma(2), kind: 'job', slot: slot('vegetable-garden'), request: gather('carrot', 2) })
    const summary = checkInSummary(state, { since: clock('22:30') }, clock('08:00', 1), { env: ENV })
    const section = summary.sections.find((s) => s.kind === 'queue-stopped')
    expect(section).toMatchObject({ kind: 'queue-stopped', queues: [{ outfitId: uma(1), buy: { total: 216 } }] })
  })

  it('goes back whole after a stock grant (standing in for the Exchange) and one restart', () => {
    const { state: morning } = collectAll(stoppedAtSix(), {}, clock('08:00', 1), ENV)
    const granted = { ...morning, items: { ...morning.items, carrot: 3 } }
    const { state, receipt } = ok(restartDropped(granted, { outfitId: uma(1), from: 'dropped' }, clock('08:01', 1), ENV))
    expect(receipt).toMatchObject({ request: craft('chopped-carrot', 2), queued: [craft('wheat-flour', 1)], restarted: { at: clock('06:00', 1) } })
    expect(state.work[uma(1)]).toMatchObject({ slot: PANTRY, queue: [craft('wheat-flour', 1)], dropped: null })
    expect(state.items.carrot).toBe(1)
  })

  it("goes back whole after T130's buy of the shortfall, as two operations in order", () => {
    const { state: morning } = collectAll(stoppedAtSix(), {}, clock('08:00', 1), ENV)
    const broke = { ...morning, items: { ...morning.items, carrot: 0 }, profile: { ...morning.profile, prizeMoney: 1_000 } }
    const fix = queueStopped(broke, uma(1), clock('08:01', 1), ENV, { times: broke.profile.checkIns, utcOffsetMin: 0 })!.buy!
    const bought = runOnce(broke, { id: 'buy-1', name: 'buy', input: { sku: fix.items[0]!.sku, qty: fix.items[0]!.qty, unitPrice: fix.items[0]!.unitPrice } }, clock('08:01', 1), ENV)
    if (isRefusal(bought)) throw new Error(bought.reason)
    expect(bought.state.ledger.at(-1)).toMatchObject({ id: 'buy:buy-1:pay', delta: -fix.total })
    const restarted = runOnce(bought.state, { id: 'restart-1', name: 'start', input: { outfitId: uma(1), from: 'dropped' } }, clock('08:01', 1), ENV)
    if (isRefusal(restarted)) throw new Error(restarted.reason)
    expect(restarted.state.work[uma(1)]).toMatchObject({ queue: [craft('wheat-flour', 1)], dropped: null })
    expect(restarted.state.profile.prizeMoney).toBe(1_000 - fix.total)
  })

  it('restarts smaller at Start ×N, in the next free slot when hers is taken, and refuses when the place is full', () => {
    const { state: morning } = collectAll(stoppedAtSix(), {}, clock('08:00', 1), ENV)
    const someoneThere = ok(start({ ...morning, items: { ...morning.items, carrot: 5 } }, { outfitId: uma(3), slot: PANTRY, request: craft('chopped-carrot', 1) }, clock('08:00', 1), ENV)).state
    const smaller = ok(restartDropped(someoneThere, { outfitId: uma(1), from: 'dropped', count: 1 }, clock('08:01', 1), ENV))
    expect(smaller.receipt).toMatchObject({ slot: slot('pantry', 1), request: craft('chopped-carrot', 1) })
    expect(() => restartDropped(someoneThere, { outfitId: uma(1), from: 'dropped', count: 3 }, clock('08:01', 1), ENV)).toThrow(RangeError)
    let full = someoneThere
    for (const [n, who] of [[1, 2], [2, 4]] as const) full = ok(start(full, { outfitId: uma(who), slot: slot('pantry', n), request: craft('chopped-carrot', 1) }, clock('08:00', 1), ENV)).state
    expect(restartDropped(full, { outfitId: uma(1), from: 'dropped' }, clock('08:01', 1), ENV)).toMatchObject({ code: 'place-full', data: { place: 'pantry' } })
  })

  it('clears on Dismiss, or on any other start for her; a restart with nothing stopped says so', () => {
    const { state: morning } = collectAll(stoppedAtSix(), {}, clock('08:00', 1), ENV)
    const dismissed = ok(dismissDropped(morning, { outfitId: uma(1), dismiss: true }, clock('08:01', 1), ENV))
    expect(dismissed.receipt.dismissed).toMatchObject({ at: clock('06:00', 1) })
    expect(dismissed.state.work[uma(1)]!.dropped).toBeNull()
    expect(ok(dismissDropped(dismissed.state, { outfitId: uma(1), dismiss: true }, clock('08:02', 1), ENV)).receipt.dismissed).toBeNull()
    expect(restartDropped(dismissed.state, { outfitId: uma(1), from: 'dropped' }, clock('08:02', 1), ENV))
      .toMatchObject({ code: 'nothing-stopped', reason: 'Nothing to restart.' })
    const elsewhere = ok(start(morning, { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 1) }, clock('08:01', 1), ENV))
    expect(elsewhere.state.work[uma(1)]!.dropped).toBeNull()
    const viaQueue = runOnce(morning, { id: 'd', name: 'queue', input: { outfitId: uma(1), dismiss: true } }, clock('08:01', 1), ENV)
    expect(!isRefusal(viaQueue) && viaQueue.state.work[uma(1)]?.dropped).toBeFalsy()
  })
})
