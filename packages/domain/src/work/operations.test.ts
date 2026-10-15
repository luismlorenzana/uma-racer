// The work operations (docs/rework/07-farm.md §2, §5, §7, §8; docs/rework/13-removals-and-plan-changes.md §6):
// start, queue, collect, recall, speed-up, finish and upgrade, each with its checks in order and its receipt.
import { describe, expect, it } from 'vitest'
import {
  atFarmLevel, clock, ENV, farmAccount, HELPER, minutes, ok, PLAIN, STRONG, withLevel, withPrizeMoney, withStock,
} from '../__fixtures__/work'
import { ledgerTotal } from '../economy/ledger'
import { farmItemSeconds } from '../farm/jobs'
import { isRefusal } from '../state/types'
import { collect, finish, MAX_ITEMS_PER_ENTRY, MAX_QUEUE, queue, recall, slotsOf, speedUp, start, upgrade } from './operations'
import { endsAt } from './timeline'
import type { FarmRequest, SlotRef, WorkState } from './types'

const GARDEN: SlotRef = { building: 'vegetable-garden', slot: 0 }
const PANTRY: SlotRef = { building: 'pantry', slot: 0 }
const KITCHEN: SlotRef = { building: 'kitchen', slot: 0 }
const carrots = (count: number): FarmRequest => ({ kind: 'gather', item: 'carrot', count })
const chopped = (count: number): FarmRequest => ({ kind: 'craft', item: 'chopped-carrot', count })
const GATHER_MS = farmItemSeconds('gather', 1) * 1000
const CRAFT_MS = farmItemSeconds('craft', 1) * 1000
const T0 = clock('08:00')

describe('constants', () => {
  it('pin 1–10 items and 3 queued (07 §2)', () => {
    expect(MAX_ITEMS_PER_ENTRY).toBe(10)
    expect(MAX_QUEUE).toBe(3)
  })
})

describe('start', () => {
  it('reserves every item’s inputs from free stock and starts now', () => {
    const state = withStock(farmAccount(), { carrot: 5 })
    const { state: next, receipt } = ok(start(state, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(3) }, T0, ENV))
    expect(next.items).toEqual({ carrot: 2 })
    expect(receipt).toMatchObject({ outfitId: PLAIN.id, slot: PANTRY, startedAt: T0, endsAt: T0 + 3 * CRAFT_MS, collected: null })
    expect(receipt.movements).toEqual([{ kind: 'reserve', item: 'carrot', qty: 3, outfitId: PLAIN.id, at: T0 }])
    const row = next.work[PLAIN.id]!
    expect(row).toMatchObject({ slot: PANTRY, queue: [], last: null, dropped: null })
    expect(row.entries).toEqual([{
      request: chopped(3), seconds: [1_620, 1_620, 1_620], inputs: Array(3).fill([{ item: 'carrot', qty: 1 }]),
      outputs: Array(3).fill({ item: 'chopped-carrot' }), farmExp: [108, 108, 108], startedAt: T0, acceleratedMs: 0, collected: 0, speed: 1,
      fromQueue: false,
    }])
  })

  it('checks the slot, her state, the count, the place, the grade and the stock, in that order', () => {
    const state = withStock(farmAccount(), { carrot: 2 })
    const busy = ok(start(state, { outfitId: HELPER.id, slot: PANTRY, request: chopped(1) }, T0, ENV)).state
    // The slot is taken by another Uma, before anything else.
    expect(start(busy, { outfitId: PLAIN.id, slot: PANTRY, request: { kind: 'craft', item: 'nothing', count: 99 } }, T0, ENV)).toEqual({
      refused: true, code: 'slot-taken', reason: 'That slot is taken.',
    })
    // She is Working elsewhere: refused with when she's free.
    const working = ok(start(state, { outfitId: PLAIN.id, slot: GARDEN, request: carrots(2) }, T0, ENV)).state
    expect(start(working, { outfitId: PLAIN.id, slot: KITCHEN, request: { kind: 'cook', item: 'x', count: 0 } }, T0 + 1, ENV)).toEqual({
      refused: true, code: 'busy', reason: '{uma} is busy until {time}.', data: { uma: PLAIN.id, time: T0 + 2 * GATHER_MS, freeAt: T0 + 2 * GATHER_MS },
    })
    expect(start(state, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(0) }, T0, ENV)).toMatchObject({ code: 'count', reason: 'Make 1 to 10 at a time.' })
    expect(start(state, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(11) }, T0, ENV)).toMatchObject({ code: 'count' })
    expect(start(state, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(1.5) }, T0, ENV)).toMatchObject({ code: 'count' })
    expect(start(state, { outfitId: PLAIN.id, slot: KITCHEN, request: { kind: 'craft', item: 'diced-potato', count: 1 } }, T0, ENV))
      .toMatchObject({ code: 'not-here', reason: "That isn't made here." })
    expect(start(state, { outfitId: PLAIN.id, slot: PANTRY, request: { kind: 'craft', item: 'diced-potato', count: 1 } }, T0, ENV))
      .toMatchObject({ code: 'grade', data: { level: 6 } })
    expect(start(state, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(5) }, T0, ENV)).toEqual({
      refused: true, code: 'short', reason: 'Short {n} {item}.', data: { n: 3, item: 'carrot', largestCoverable: 2 },
    })
    expect(start(state, { outfitId: 'nobody', slot: PANTRY, request: chopped(1) }, T0, ENV)).toMatchObject({ code: 'unknown-uma' })
  })

  it('throws on a slot the building does not have', () => {
    const state = farmAccount()
    expect(() => start(state, { outfitId: PLAIN.id, slot: { building: 'orchard', slot: 2 }, request: { kind: 'gather', item: 'apple', count: 1 } }, T0, ENV))
      .toThrow(RangeError)
    expect(() => start(state, { outfitId: PLAIN.id, slot: { building: 'gym', slot: 0 }, request: carrots(1) }, T0, ENV)).toThrow(RangeError)
    expect(() => start(state, { outfitId: PLAIN.id, slot: { building: 'orchard', room: 'speed', slot: 0 }, request: carrots(1) }, T0, ENV)).toThrow(RangeError)
  })

  it('collects a Ready Uma first, in the same receipt, and then her outputs count as stock', () => {
    const state = farmAccount()
    const gathering = ok(start(state, { outfitId: PLAIN.id, slot: GARDEN, request: carrots(2) }, T0, ENV)).state
    const later = T0 + 2 * GATHER_MS
    const { state: next, receipt } = ok(start(gathering, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(2) }, later, ENV))
    expect(receipt.collected).toMatchObject({ outputs: [{ item: 'carrot' }, { item: 'carrot' }], farmExp: 864, freed: true })
    expect(receipt.movements).toEqual([
      { kind: 'output', item: 'carrot', qty: 2, outfitId: PLAIN.id, at: later },
      { kind: 'reserve', item: 'carrot', qty: 2, outfitId: PLAIN.id, at: later },
    ])
    expect(next.items).toEqual({})
    expect(next.work[PLAIN.id]).toMatchObject({ slot: PANTRY, last: { slot: GARDEN, request: carrots(2) } })
    // Restarting in her own Ready slot works too.
    expect(isRefusal(start(gathering, { outfitId: PLAIN.id, slot: GARDEN, request: carrots(1) }, later, ENV))).toBe(false)
  })
})

describe('queue', () => {
  const running = (): WorkState => ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(1) }, T0, ENV)).state
  const add = (request: FarmRequest, building: SlotRef['building'] = 'vegetable-garden') => ({ outfitId: PLAIN.id, add: { request, building } })

  it('adds up to three behind the running entry and reserves nothing', () => {
    let state = running()
    for (const n of [1, 2, 3]) state = ok(queue(state, add(carrots(n)), T0 + 1, ENV)).state
    expect(state.work[PLAIN.id]!.queue).toEqual([carrots(1), carrots(2), carrots(3)])
    expect(state.items).toEqual({})
    expect(queue(state, add(carrots(4)), T0 + 1, ENV)).toMatchObject({ code: 'queue-full', reason: 'Three are already queued.' })
  })

  it('stays at one place, keeps 1–10 and checks the grade gate when added', () => {
    const state = running()
    expect(queue(state, add({ kind: 'craft', item: 'chopped-carrot', count: 1 }, 'pantry'), T0, ENV)).toMatchObject({ code: 'queue-place', reason: 'A queue stays at one place.' })
    expect(queue(state, { outfitId: PLAIN.id, add: { request: carrots(1), building: 'gym', room: 'speed' } }, T0, ENV)).toMatchObject({ code: 'queue-place' })
    expect(queue(state, add(carrots(11)), T0, ENV)).toMatchObject({ code: 'count' })
    expect(queue(state, add({ kind: 'gather', item: 'potato', count: 1 }), T0, ENV)).toMatchObject({ code: 'grade', data: { level: 6 } })
    expect(queue(state, add({ kind: 'gather', item: 'apple', count: 1 }), T0, ENV)).toMatchObject({ code: 'not-here' })
  })

  it('removes and moves entries', () => {
    let state = running()
    for (const n of [1, 2, 3]) state = ok(queue(state, add(carrots(n)), T0, ENV)).state
    const moved = ok(queue(state, { outfitId: PLAIN.id, move: { from: 2, to: 0 } }, T0, ENV))
    expect(moved.receipt.queued).toEqual([carrots(3), carrots(1), carrots(2)])
    const removed = ok(queue(moved.state, { outfitId: PLAIN.id, remove: 1 }, T0, ENV))
    expect(removed.state.work[PLAIN.id]!.queue).toEqual([carrots(3), carrots(2)])
    expect(queue(removed.state, { outfitId: PLAIN.id, remove: 5 }, T0, ENV)).toMatchObject({ code: 'finished' })
    expect(() => queue(removed.state, { outfitId: PLAIN.id, remove: -1 }, T0, ENV)).toThrow(RangeError)
  })

  it('needs a running entry: a finished or missing one is already finished', () => {
    expect(queue(farmAccount(), add(carrots(1)), T0, ENV)).toMatchObject({ code: 'finished', reason: "It's already finished." })
    expect(queue(running(), add(carrots(1)), T0 + GATHER_MS, ENV)).toMatchObject({ code: 'finished' })
  })
})

describe('collect', () => {
  it('pays each finished item once, partial then full, with its Farm EXP', () => {
    const state = ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(4) }, T0, ENV)).state
    const first = collect(state, { outfitId: PLAIN.id }, T0 + 2 * GATHER_MS + 1, ENV)
    expect(first.receipt).toMatchObject({ outputs: [{ item: 'carrot' }, { item: 'carrot' }], farmExp: 864, freed: false })
    expect(first.state.items).toEqual({ carrot: 2 })
    expect(first.state.work[PLAIN.id]!.entries[0]!.collected).toBe(2)
    const again = collect(first.state, { outfitId: PLAIN.id }, T0 + 2 * GATHER_MS + 2, ENV)
    expect(again.receipt).toMatchObject({ outputs: [], farmExp: 0, freed: false, movements: [] })
    expect(again.state).toEqual(first.state)
    const all = collect(first.state, { outfitId: PLAIN.id }, T0 + 9 * GATHER_MS, ENV)
    expect(all.receipt).toMatchObject({ outputs: [{ item: 'carrot' }, { item: 'carrot' }], farmExp: 864, freed: true })
    expect(all.state.items).toEqual({ carrot: 4 })
    expect(all.state.umas[PLAIN.id]!.farm).toEqual({ level: 1, exp: 4 * 432 })
    expect(all.state.work[PLAIN.id]).toEqual({ outfitId: PLAIN.id, slot: null, entries: [], queue: [], last: { slot: GARDEN, request: carrots(4) }, dropped: null })
    // One collect of all four pays the same.
    const once = collect(state, { outfitId: PLAIN.id }, T0 + 9 * GATHER_MS, ENV)
    expect(once.state).toEqual(all.state)
  })

  it('never refuses: nothing ready, or nobody, pays nothing', () => {
    const state = farmAccount()
    expect(collect(state, { outfitId: PLAIN.id }, T0, ENV)).toEqual({
      state,
      receipt: { outfitId: PLAIN.id, outputs: [], farmExp: 0, farmLevel: { from: 1, to: 1 }, gradesOpened: [], paid: [], freed: false, movements: [], settled: { started: [], dropped: [], movements: [] } },
    })
    expect(collect(state, { outfitId: 'nobody' }, T0, ENV).receipt.outputs).toEqual([])
  })

  it('crosses several Farm Levels at once and names the grades it opened', () => {
    const state = atFarmLevel(farmAccount(), STRONG.id, 5, 4 * 400)
    const working = ok(start(state, { outfitId: STRONG.id, slot: GARDEN, request: carrots(10) }, T0, ENV)).state
    const { state: next, receipt } = collect(working, { outfitId: STRONG.id }, T0 + 10 * GATHER_MS, ENV)
    expect(receipt.farmExp).toBe(10 * 691)
    expect(receipt.farmLevel).toEqual({ from: 5, to: 9 })
    expect(receipt.gradesOpened).toEqual([2])
    expect(next.umas[STRONG.id]!.farm.level).toBe(9)
  })
})

describe('recall', () => {
  it('pays the finished items and returns the inputs of every unmade one, the one in progress included', () => {
    const state = withStock(farmAccount(), { carrot: 4 })
    const crafting = ok(start(state, { outfitId: PLAIN.id, slot: PANTRY, request: chopped(4) }, T0, ENV)).state
    const at = T0 + CRAFT_MS + CRAFT_MS / 2
    const { state: next, receipt } = recall(crafting, { outfitId: PLAIN.id }, at, ENV)
    expect(receipt).toMatchObject({ recalled: true, outputs: [{ item: 'chopped-carrot' }], returned: [{ item: 'carrot', qty: 3 }], droppedQueue: [], lostMinutes: 13.5 })
    expect(receipt.movements).toEqual([
      { kind: 'output', item: 'chopped-carrot', qty: 1, outfitId: PLAIN.id, at },
      { kind: 'return', item: 'carrot', qty: 3, outfitId: PLAIN.id, at },
    ])
    expect(next.items).toEqual({ carrot: 3, 'chopped-carrot': 1 })
    expect(next.work[PLAIN.id]).toBeUndefined()
  })

  it('drops the queue without a record and clears her last work', () => {
    let state = ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(1) }, T0, ENV)).state
    state = collect(ok(start(state, { outfitId: PLAIN.id, slot: GARDEN, request: carrots(1) }, T0 + GATHER_MS, ENV)).state, { outfitId: PLAIN.id }, T0 + GATHER_MS, ENV).state
    expect(state.work[PLAIN.id]!.last).toEqual({ slot: GARDEN, request: carrots(1) })
    state = ok(queue(state, { outfitId: PLAIN.id, add: { request: carrots(2), building: 'vegetable-garden' } }, T0 + GATHER_MS + 1, ENV)).state
    const { state: next, receipt } = recall(state, { outfitId: PLAIN.id }, T0 + GATHER_MS + 2, ENV)
    expect(receipt.droppedQueue).toEqual([carrots(2)])
    expect(next.work[PLAIN.id]).toBeUndefined()
  })

  it('acts as collect when nothing is running', () => {
    const state = ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(1) }, T0, ENV)).state
    const later = T0 + GATHER_MS
    const recalled = recall(state, { outfitId: PLAIN.id }, later, ENV)
    const collected = collect(state, { outfitId: PLAIN.id }, later, ENV)
    expect(recalled.state).toEqual(collected.state)
    expect(recalled.receipt).toEqual({ ...collected.receipt, recalled: false, returned: [], droppedQueue: [], lostMinutes: 0 })
    expect(recall(farmAccount(), { outfitId: PLAIN.id }, T0, ENV).receipt.recalled).toBe(false)
  })
})

describe('speed-up and finish (07 §8)', () => {
  const running = (tickets = 10) =>
    withStock(ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(3) }, T0, ENV)).state, { 'speed-ticket': tickets })

  it('take 30 minutes a ticket off the running entry and spend the tickets', () => {
    const { state, receipt } = ok(speedUp(running(), { outfitId: PLAIN.id, startedAt: T0, tickets: 2 }, T0 + minutes(10), ENV))
    expect(receipt).toMatchObject({ tickets: 2, savedMinutes: 60, wastedMinutes: 0, endsAt: T0 + 3 * GATHER_MS - minutes(60) })
    expect(receipt.movements).toEqual([{ kind: 'ticket', item: 'speed-ticket', qty: 2, outfitId: PLAIN.id, at: T0 + minutes(10) }])
    expect(state.items).toEqual({ 'speed-ticket': 8 })
    expect(state.work[PLAIN.id]!.entries[0]!.acceleratedMs).toBe(minutes(60))
  })

  it('show the waste under 30 minutes and never spend past what finishes it', () => {
    const near = T0 + 3 * GATHER_MS - minutes(10)
    const one = ok(speedUp(running(), { outfitId: PLAIN.id, startedAt: T0, tickets: 1 }, near, ENV))
    expect(one.receipt).toMatchObject({ tickets: 1, savedMinutes: 10, wastedMinutes: 20, endsAt: near })
    const many = ok(speedUp(running(), { outfitId: PLAIN.id, startedAt: T0, tickets: 5 }, near, ENV))
    expect(many.receipt.tickets).toBe(1)
    expect(many.state.items).toEqual({ 'speed-ticket': 9 })
  })

  it('Finish spends ⌈remaining ÷ 30⌉, ends now and starts the queue at once', () => {
    let state = running(20)
    state = ok(queue(state, { outfitId: PLAIN.id, add: { request: carrots(1), building: 'vegetable-garden' } }, T0, ENV)).state
    const now = T0 + minutes(5)
    const { state: next, receipt } = ok(finish(state, { outfitId: PLAIN.id, startedAt: T0 }, now, ENV))
    expect(receipt.tickets).toBe(Math.ceil((3 * GATHER_MS - minutes(5)) / minutes(30)))
    expect(receipt.endsAt).toBe(now)
    expect(receipt.settled.started).toEqual([{ outfitId: PLAIN.id, slot: GARDEN, at: now, request: carrots(1) }])
    expect(next.work[PLAIN.id]!.entries[1]).toMatchObject({ startedAt: now, fromQueue: true })
  })

  it('refuse a finished, missing or misnamed entry, and too few tickets', () => {
    const state = running(1)
    expect(speedUp(state, { outfitId: PLAIN.id, startedAt: T0 + 1, tickets: 1 }, T0, ENV)).toMatchObject({ code: 'finished' })
    expect(speedUp(state, { outfitId: PLAIN.id, startedAt: T0, tickets: 1 }, T0 + 3 * GATHER_MS, ENV)).toMatchObject({ code: 'finished' })
    expect(speedUp(state, { outfitId: HELPER.id, startedAt: T0, tickets: 1 }, T0, ENV)).toMatchObject({ code: 'finished' })
    expect(finish(state, { outfitId: PLAIN.id, startedAt: T0 }, T0, ENV)).toEqual({
      refused: true, code: 'tickets', reason: 'Needs {n} Speed Tickets.', data: { n: 11, have: 1 },
    })
    expect(() => speedUp(state, { outfitId: PLAIN.id, startedAt: T0, tickets: 0 }, T0, ENV)).toThrow(RangeError)
  })

  it('leave Farm EXP as listed: tickets and a Lv 3 building pay the same', () => {
    const exp = (state: WorkState, now: number) => collect(state, { outfitId: PLAIN.id }, now, ENV).receipt.farmExp
    const plain = exp(running(), T0 + 3 * GATHER_MS)
    const finished = ok(finish(running(20), { outfitId: PLAIN.id, startedAt: T0 }, T0 + 1, ENV)).state
    const fast = ok(start(withLevel(farmAccount(), 'vegetable-garden', 3), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(3) }, T0, ENV)).state
    expect(fast.work[PLAIN.id]!.entries[0]!.seconds).toEqual([5_184, 5_184, 5_184])
    expect([exp(finished, T0 + 1), exp(fast, T0 + 3 * 5_184_000)]).toEqual([plain, plain])
    expect(plain).toBe(3 * 432)
  })
})

describe('upgrade (07 §7, 05 §7)', () => {
  const rich = (state: WorkState) => withPrizeMoney(withStock(state, { 'chopped-carrot': 10, 'shredded-cabbage': 4 }), 5_000)

  it('charges Prize Money and items once and adds the slots at once', () => {
    const { state, receipt } = ok(upgrade(rich(farmAccount()), { building: 'vegetable-garden' }, T0, ENV))
    expect(receipt).toMatchObject({ building: 'vegetable-garden', from: 1, to: 2, prizeMoney: 1_200, slotsPerRoom: 5, totalSlots: 5, speed: 1 })
    expect(receipt.movements).toEqual([{ kind: 'cost', item: 'chopped-carrot', qty: 4, outfitId: null, at: T0 }])
    const row = { id: 'upgrade:vegetable-garden:2', resource: 'prize-money', delta: -1_200, reason: 'upgrade', at: T0 }
    expect(receipt.ledger).toEqual([row])
    expect(state.ledger[state.ledger.length - 1]).toEqual(row)
    expect(state.profile.prizeMoney).toBe(3_800)
    expect(state.items).toEqual({ 'chopped-carrot': 6, 'shredded-cabbage': 4 })
    expect(state.buildings['vegetable-garden']).toEqual({ level: 2 })
    expect(slotsOf(state, 'vegetable-garden')).toHaveLength(5)
    expect(isRefusal(start(state, { outfitId: PLAIN.id, slot: { building: 'vegetable-garden', slot: 4 }, request: carrots(1) }, T0, ENV))).toBe(false)
    const top = ok(upgrade(state, { building: 'vegetable-garden' }, T0, ENV))
    expect(top.receipt).toMatchObject({ to: 3, prizeMoney: 2_400, speed: 1.25, ledger: [{ id: 'upgrade:vegetable-garden:3', delta: -2_400 }] })
    // 09 §9's audit: the Prize Money rows move the balance by exactly what they say.
    expect(ledgerTotal(top.state.ledger, 'prize-money') - ledgerTotal(rich(farmAccount()).ledger, 'prize-money'))
      .toBe(top.state.profile.prizeMoney - rich(farmAccount()).profile.prizeMoney)
    expect(upgrade(top.state, { building: 'vegetable-garden' }, T0, ENV)).toMatchObject({ code: 'top-level', reason: 'Already at the top level.' })
  })

  it('refuses without the Prize Money or the items', () => {
    expect(upgrade(withPrizeMoney(farmAccount(), 1_199), { building: 'orchard' }, T0, ENV)).toEqual({
      refused: true, code: 'prize-money', reason: 'Needs {n} Prize Money.', data: { n: 1_200, have: 1_199 },
    })
    expect(upgrade(withPrizeMoney(withStock(farmAccount(), { 'apple-preserve': 1 }), 1_200), { building: 'orchard' }, T0, ENV)).toEqual({
      refused: true, code: 'short', reason: 'Short {n} {item}.', data: { n: 3, item: 'apple-preserve' },
    })
  })

  it('upgrades the facilities and their rooms', () => {
    const items = Object.fromEntries(['honey', 'apple-preserve', 'carp-fillet', 'peanut-butter', 'dried-basil', 'wheat-flour'].map((id) => [id, 1]))
    const { state, receipt } = ok(upgrade(withPrizeMoney(withStock(farmAccount(), items), 1_500), { building: 'dojo' }, T0, ENV))
    expect(receipt).toMatchObject({ slotsPerRoom: 2, totalSlots: 12 })
    expect(state.items).toEqual({})
    expect(slotsOf(state, 'dojo').slice(0, 3)).toEqual([
      { building: 'dojo', room: 'speed', slot: 0 }, { building: 'dojo', room: 'speed', slot: 1 }, { building: 'dojo', room: 'stamina', slot: 0 },
    ])
  })

  it('leaves running work at its frozen speed', () => {
    const working = ok(start(rich(farmAccount()), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(2) }, T0, ENV)).state
    const raised = ok(upgrade(ok(upgrade(working, { building: 'vegetable-garden' }, T0 + 1, ENV)).state, { building: 'vegetable-garden' }, T0 + 2, ENV)).state
    const entry = raised.work[PLAIN.id]!.entries[0]!
    expect(entry).toMatchObject({ speed: 1, seconds: [6_480, 6_480] })
    expect(endsAt(entry)).toBe(T0 + 2 * GATHER_MS)
    const next = ok(start(raised, { outfitId: HELPER.id, slot: { building: 'vegetable-garden', slot: 1 }, request: carrots(1) }, T0 + 3, ENV)).state
    expect(next.work[HELPER.id]!.entries[0]).toMatchObject({ speed: 1.25, seconds: [5_184] })
  })
})
