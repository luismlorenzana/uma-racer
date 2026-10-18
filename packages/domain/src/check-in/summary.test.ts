// The check-in summary and Speed up all (docs/game/02-check-ins-and-notifications.md §4): every section from a
// synthetic night, empty ones dropped, `since` clamped, the next finish and when all is done; and Speed up all's ticket
// counts, its clamp to Finish, and its refusal when tickets run short.
import { describe, expect, it } from 'vitest'
import {
  account, atFarmLevel, CHECK_IN_CONTENT, clock, cook, craft, ENV, gather, nodes, ok, slot, uma,
} from '../__fixtures__/check-in'
import { placeUma } from '../__fixtures__/tiers'
import { SPEED_TICKET_ID } from '../items/catalogue'
import { commitUnlocks } from '../training/build'
import { layerUnlocks } from '../training/unlocks'
import { isRefusal } from '../state/types'
import { queue, start } from '../work/operations'
import { endsAt } from '../work/timeline'
import type { WorkRequest, WorkState } from '../work/types'
import { collectAll } from './collect-all'
import { runOnce } from './once'
import { repeat } from './repeat'
import { checkInSummary, SPEED_UP_SPANS, speedUpAll, speedUpAllPlan, SUMMARY_SECTIONS } from './summary'

const MINUTE = 60_000
const MORNING = clock('08:00', 1)

/** A night of 8 Umas: a queue that moves on, a level-up, an unlock, a stopped queue, a job running past 08:00, a free
 * Uma, a trained one and one ready to advance, with Prize Money and tickets. */
function night(): WorkState {
  let state = account(8, { carrot: 9, 'tonic-1': 1, 'chopped-carrot': 1, 'dried-button-mushroom': 1, 'wheat-flour': 1, [SPEED_TICKET_ID]: 18 })
  state = { ...state, profile: { ...state.profile, prizeMoney: 1_240 } }
  const go = (who: number, at: ReturnType<typeof slot>, request: WorkRequest, when: number) => {
    state = ok(start(state, { outfitId: uma(who), slot: at, request }, when, ENV)).state
  }
  const add = (who: number, request: WorkRequest, building: 'pantry') => {
    state = ok(queue(state, { outfitId: uma(who), add: { request, building } }, clock('22:31'), ENV)).state
  }
  state = atFarmLevel(state, uma(2), 5, 400 * 4)
  go(1, slot('pantry', 0), craft('chopped-carrot', 4), clock('22:30'))
  add(1, craft('chopped-carrot', 4), 'pantry')
  go(2, slot('vegetable-garden'), gather('carrot', 2), clock('22:30'))
  go(3, slot('observatory'), nodes(1), clock('22:30'))
  go(4, slot('pantry', 1), craft('chopped-carrot', 1), clock('22:30'))
  add(4, craft('chopped-carrot', 5), 'pantry')
  go(5, slot('kitchen'), cook('tonic-1', 1), clock('07:00', 1))
  const seven = state.umas[uma(7)]!
  const trained = { ...seven, build: { ...commitUnlocks(seven.build, seven, layerUnlocks(1)).build, bonds: ['a', 'b', 'c', 'd', 'e', 'f'] } }
  const eight = placeUma(state.umas[uma(8)]!, { tier: 1, scenario: 1, level: 10, careerWon: true }, CHECK_IN_CONTENT)
  return { ...state, umas: { ...state.umas, [uma(7)]: trained, [uma(8)]: eight } }
}

describe('the check-in summary', () => {
  it("lists 02 §4's sections in order", () => {
    expect(SUMMARY_SECTIONS).toEqual(['collected', 'free', 'queue-stopped', 'couldnt-repeat', 'training-done', 'ready-to-advance', 'next', 'money'])
  })

  it('shows every section after a night: Collected, Free, Queue stopped, Couldn\'t repeat, Training done, Ready to advance, Next, Money', () => {
    const collected = collectAll(night(), {}, MORNING, ENV)
    const repeated = repeat(collected.state, {}, MORNING, ENV)
    const summary = checkInSummary(repeated.state, { since: clock('22:30'), collect: collected.receipt, repeat: repeated.receipt }, MORNING, { env: ENV })
    expect(summary.sections.map((s) => s.kind)).toEqual(SUMMARY_SECTIONS)
    const section =<K extends (typeof SUMMARY_SECTIONS)[number]>(kind: K) => summary.sections.find((s) => s.kind === kind) as Extract<(typeof summary.sections)[number], { kind: K }>

    expect(section('collected')).toMatchObject({ items: 8 + 2 + 1, dishes: 0, unlocks: 1, queuesMovedOn: 1 })
    expect(section('collected').notes).toEqual([
      { kind: 'level', outfitId: uma(2), from: 5, to: 6, gradesOpened: [2] },
      { kind: 'unlocks', outfitId: uma(3), unlocks: [expect.objectContaining({ kind: 'node', target: 'n1' })] },
    ])
    // Repeat restarted Uma 1 (×4 → ×2 on the two carrots Uma 2 brought in) and Uma 2; the rest are Free.
    expect(repeated.receipt.started.map((s) => [s.outfitId, s.from, s.to])).toEqual([[uma(2), 2, 2], [uma(1), 4, 2]])
    expect(section('free').umas.map((u) => u.outfitId)).toEqual([3, 4, 6, 7, 8].map(uma))
    expect(section('free').umas.every((u) => u.suggestion !== null && u.suggestion.outfitId === u.outfitId)).toBe(true)
    // Uma 4's ×5 craft found 4 carrots at 23:10:30; at 08:00 none are left, so Buy and restart buys all five.
    const [stopped] = section('queue-stopped').queues
    expect(stopped).toMatchObject({
      outfitId: uma(4), dropped: { at: clock('22:30') + 40.5 * MINUTE, short: [{ item: 'carrot', qty: 1 }] },
      short: [{ item: 'carrot', qty: 5 }], buy: { items: [{ sku: 'carrot', qty: 5, unitPrice: 162 }], total: 810 }, startSmaller: null,
      makeThem: { outfitId: uma(3), request: gather('carrot', 5) },
    })
    expect(section('couldnt-repeat').skipped.map((s) => [s.outfitId, s.code, s.suggestion])).toEqual([[uma(4), 'queue-stopped', null], [uma(3), 'short', null]])
    expect(section('training-done').umas).toEqual([{ outfitId: uma(7), scenario: 1 }])
    expect(section('ready-to-advance').umas).toEqual([{ outfitId: uma(8), from: { tier: 1, scenario: 1 }, to: { tier: 1, scenario: 2 } }])
    // Next: Uma 1's ×2 craft at 09:21; everything is done when Uma 5's tonic ends at 14:12.
    expect(section('next')).toMatchObject({ next: { at: MORNING + 81 * MINUTE, outfitId: uma(1), request: craft('chopped-carrot', 2) }, allDoneAt: clock('14:12', 1) })
    expect(section('money')).toEqual({ kind: 'money', prizeMoney: 1_240, speedTickets: 18 })
    expect(summary).toMatchObject({ since: clock('22:30'), repeatAll: 2, startSuggestions: 5 })
  })

  it("attaches the planner's suggestion to a skip whose fix is the next suggestion", () => {
    let state = account(2, { 'dish-sweets-1': 1 })
    state = ok(start(state, { outfitId: uma(1), slot: slot('gym', 0, 'speed'), request: { kind: 'session', unlocks: [{ kind: 'single', target: 'speed-01' }] } }, clock('22:30'), ENV)).state
    const collected = collectAll(state, {}, MORNING, ENV)
    const repeated = repeat(collected.state, {}, MORNING, ENV)
    const summary = checkInSummary(repeated.state, { since: clock('22:30'), collect: collected.receipt, repeat: repeated.receipt }, MORNING, { env: ENV })
    const skipped = summary.sections.find((s) => s.kind === 'couldnt-repeat')
    expect(skipped).toMatchObject({ skipped: [{ outfitId: uma(1), code: 'place-done', suggestion: { outfitId: uma(1), kind: 'job' } }] })
  })

  it('drops empty sections and clamps since to now', () => {
    let busy = account(2)
    for (const who of [1, 2]) busy = ok(start(busy, { outfitId: uma(who), slot: slot('fields', who - 1), request: gather('wheat', 2) }, clock('07:00'), ENV)).state
    const summary = checkInSummary(busy, { since: clock('09:00', 3) }, clock('08:00'), { env: ENV })
    expect(summary.sections).toEqual([{ kind: 'next', next: expect.objectContaining({ outfitId: uma(1), at: clock('07:00') + 324 * MINUTE }), allDoneAt: clock('07:00') + 324 * MINUTE }])
    expect(summary.since).toBe(clock('08:00'))
    expect(checkInSummary(account(0), { since: 0 }, clock('08:00'), { env: ENV }).sections).toEqual([])
  })

  it('counts queues that moved on since the last visit, not before it', () => {
    const state = night()
    const collected = collectAll(state, {}, MORNING, ENV)
    const late = checkInSummary(collected.state, { since: clock('01:30', 1), collect: collected.receipt }, MORNING, { env: ENV })
    expect(late.sections.find((s) => s.kind === 'collected')).toMatchObject({ queuesMovedOn: 0 })
  })
})

/** Three running entries at 12:00: 50 minutes, 3 hours and 10 minutes left. */
function running(tickets: number): WorkState {
  let state = account(3, { carrot: 10, [SPEED_TICKET_ID]: tickets })
  state = ok(start(state, { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 1) }, clock('12:00') - 112 * MINUTE, ENV)).state
  state = ok(start(state, { outfitId: uma(2), slot: slot('vegetable-garden'), request: gather('carrot', 2) }, clock('12:00') + 180 * MINUTE - 324 * MINUTE, ENV)).state
  return ok(start(state, { outfitId: uma(3), slot: slot('pantry'), request: craft('chopped-carrot', 1) }, clock('12:00') - 30.5 * MINUTE, ENV)).state
}

describe('Speed up all', () => {
  it('gives each running entry ⌈span ÷ 30⌉ tickets, clamped to what finishes it, in building order, in one receipt', () => {
    const state = running(10)
    expect(SPEED_UP_SPANS).toEqual([60, 120, 'next-check-in'])
    expect(speedUpAllPlan(state, { all: true, span: 60 }, clock('12:00'), ENV).entries.map((e) => [e.outfitId, e.tickets]))
      .toEqual([[uma(1), 2], [uma(2), 2], [uma(3), 1]])
    const { state: after, receipt } = ok(speedUpAll(state, { all: true, span: 60 }, clock('12:00'), ENV))
    expect(receipt.tickets).toBe(5)
    expect(receipt.spanMinutes).toBe(60)
    expect(receipt.entries.map((e) => [e.outfitId, e.tickets, e.savedMinutes])).toEqual([[uma(1), 2, 50], [uma(2), 2, 60], [uma(3), 1, 10]])
    expect(after.items[SPEED_TICKET_ID]).toBe(5)
    // The clamp: the craft and the wheat now end exactly at 12:00.
    expect(endsAt(after.work[uma(3)]!.entries[0]!)).toBe(clock('12:00'))
    expect(endsAt(after.work[uma(1)]!.entries[0]!)).toBe(clock('12:00'))
  })

  it('takes "to the next check-in" as the time until it', () => {
    const plan = speedUpAllPlan(running(10), { all: true, span: 'next-check-in' }, clock('12:00'), ENV)
    expect(plan.spanMs).toBe(60 * MINUTE)
    expect(speedUpAllPlan(running(10), { all: true, span: 120 }, clock('12:00'), ENV).entries.map((e) => e.tickets)).toEqual([2, 4, 1])
    // At UTC+1 it is 13:00 local, so the next check-in is 22:30 local, 21:30 UTC.
    expect(speedUpAllPlan(running(10), { all: true, span: 'next-check-in', utcOffsetMin: 60 }, clock('12:00'), ENV).spanMs).toBe(clock('21:30') - clock('12:00'))
  })

  it('refuses whole when the tickets run short, and says so when nothing runs', () => {
    const state = running(4)
    expect(speedUpAll(state, { all: true, span: 60 }, clock('12:00'), ENV)).toMatchObject({ code: 'tickets', data: { n: 5, have: 4 } })
    expect(speedUpAll(account(1, { [SPEED_TICKET_ID]: 9 }), { all: true, span: 60 }, clock('12:00'), ENV)).toMatchObject({ code: 'finished' })
    const viaOnce = runOnce(running(10), { id: 'all-1', name: 'speed-up', input: { all: true, span: 120 } }, clock('12:00'), ENV)
    expect(!isRefusal(viaOnce) && viaOnce.receipt.tickets).toBe(7)
  })
})
