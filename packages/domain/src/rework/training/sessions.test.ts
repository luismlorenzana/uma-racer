// Sessions on T127's work engine (docs/rework/05-training-hub.md §2): the `session` kind checks a request where its slot
// is and lists each unlock's dish and seconds; the engine's own `start`, `queue`, `collect`, `recall` and `speed-up` run
// it. One session per facility reserves N dishes, finishes each unlock at its duration ÷ speed, Collect commits exactly
// the finished ones and Recall returns the rest.
import { describe, expect, it } from 'vitest'
import { COLT, placeUma } from '../../__fixtures__/rework-tiers'
import { ENV, TIER_AND_TRAINING, cardOf, slotAt, workAccount } from '../../__fixtures__/rework-training'
import type { FacilityId, RoomId } from '../farm/buildings'
import { SPEED_TICKET_ID } from '../items/catalogue'
import { secondsToMs } from '../time'
import { isRefusal, type OpResult, type ReworkState, type UmaBuild } from '../types'
import { WORK_KINDS, type PlanContext } from '../work/kinds'
import { collect, queue, recall, speedUp, start } from '../work/operations'
import type { SlotRef, WorkRequest, WorkState } from '../work/types'
import { commitUnlocks } from './build'
import { nextUnlocks } from './order'
import { planSession, paySession, sessionKind, sessionRequest } from './sessions'
import { fixedUnlock, layerUnlocks, type Unlock, type UnlockRef } from './unlocks'

const HOUR = 3_600_000
const MINUTE = 60_000
/** 22:30 on a synthetic day. */
const NIGHT = 22 * HOUR + 30 * MINUTE
const clock = (ms: number) => [Math.floor(ms / HOUR) % 24, Math.floor((ms % HOUR) / MINUTE)]

const ref = (kind: UnlockRef['kind'], target: string): UnlockRef => ({ kind, target })
const node = (k: number) => ref('node', `n${k}`)
const fixed = (kind: Unlock['kind'], target: string): Unlock => fixedUnlock({ kind, target })!

/** Colt in tier 1, scenario `scenario`, with these unlocks open, on the engine with this Warehouse. */
function account(scenario: number, open: readonly Unlock[] = [], items: Readonly<Record<string, number>> = {}, build: (b: UmaBuild) => UmaBuild = (b) => b): WorkState {
  const state = workAccount([COLT.id], items)
  const uma = placeUma(state.umas[COLT.id]!, { tier: 1, scenario: scenario as 1, level: 10 * (scenario - 1) + 1 }, TIER_AND_TRAINING)
  return { ...state, umas: { [COLT.id]: { ...uma, build: build(commitUnlocks(uma.build, uma, open).build) } } }
}
const nodes = (count: number) => Array.from({ length: count }, (_, i) => fixed('node', `n${i + 1}`))
const context = (slot: SlotRef, extra: Partial<PlanContext> = {}): PlanContext => ({ slot, speed: 1, earlier: [], env: ENV, ...extra })
const plan = (state: WorkState, building: FacilityId, room: RoomId | undefined, unlocks: readonly UnlockRef[], extra: Partial<PlanContext> = {}) =>
  planSession(state, COLT.id, sessionRequest(unlocks), NIGHT, context(slotAt(building, room), extra))
const code = (result: unknown) => (isRefusal(result) ? result.code : 'ok')
function ok<R, S extends ReworkState>(result: OpResult<R, S>): { state: S; receipt: R } {
  if (isRefusal(result)) throw new Error(`${result.code}: ${result.reason} ${JSON.stringify(result.data)}`)
  return result
}
const begin = (state: WorkState, building: FacilityId, room: RoomId | undefined, unlocks: readonly UnlockRef[], now = NIGHT) =>
  start(state, { outfitId: COLT.id, slot: slotAt(building, room), request: sessionRequest(unlocks) }, now, ENV)

describe('the session kind', () => {
  it('is registered in the engine beside gather, craft and cook', () => {
    expect(WORK_KINDS.session).toBe(sessionKind)
  })

  it("plans each unlock's one dish and its seconds at the facility's speed, with no Farm EXP", () => {
    const state = account(1, nodes(5))
    const items = plan(state, 'observatory', undefined, [node(6), node(7), node(8)])
    if (isRefusal(items)) throw new Error(items.reason)
    expect(items.map((item) => [item.inputs, item.seconds, item.farmExp])).toEqual([
      [[{ item: 'dish-vegetables-1', qty: 1 }], 12_960, 0],
      [[{ item: 'dish-vegetables-2', qty: 1 }], 14_040, 0],
      [[{ item: 'dish-vegetables-2', qty: 1 }], 14_040, 0],
    ])
    expect(items.map((item) => item.output)).toEqual([6, 7, 8].map((k) => ({ unlock: fixed('node', `n${k}`) })))
    const fast = plan(state, 'observatory', undefined, [node(6)], { speed: 1.25 })
    expect(!isRefusal(fast) && fast[0]!.seconds).toBe(10_368)
  })

  it('meets a dependency with an earlier unlock of the same session or an earlier request, never across rooms', () => {
    const state = account(2, [fixed('single', 'power-01'), fixed('single', 'speed-01')])
    const power3 = ref('single', 'power-03'), speed3 = ref('single', 'speed-03'), duo = ref('duo', 'duo-power-speed-3')
    expect(code(plan(state, 'gym', 'power', [power3, duo]))).toBe('needs-first')
    expect(plan(state, 'gym', 'power', [power3, speed3, duo])).toMatchObject({ code: 'wrong-room', data: { unlock: 'Speed grade 3', room: 'power' } })
    // Her earlier requests count as made: a Speed session queued behind a Power one may take the Duo.
    const earlier: WorkRequest[] = [sessionRequest([power3])]
    expect(code(plan(state, 'gym', 'speed', [speed3, duo], { earlier }))).toBe('ok')
    expect(plan(state, 'gym', 'speed', [power3], { earlier })).toMatchObject({ code: 'wrong-room' })
    expect(plan(state, 'gym', 'power', [power3], { earlier })).toMatchObject({ code: 'duplicate', data: { item: 'Power grade 3' } })
  })

  it('refuses a session size outside 1–10, a second facility, the wrong facility, an unlock twice or open, and a later layer', () => {
    const state = account(1, nodes(1))
    expect(plan(state, 'observatory', undefined, [])).toEqual({ refused: true, code: 'session-size', reason: 'A session takes 1 to {max} unlocks.', data: { max: 10 } })
    expect(code(plan(state, 'observatory', undefined, layerUnlocks(1).filter((entry) => entry.kind === 'node').slice(1, 12)))).toBe('session-size')
    expect(code(plan(state, 'observatory', undefined, [node(2), ref('slot', 'parent0')]))).toBe('mixed-facility')
    expect(plan(state, 'lineage-hall', undefined, [node(2)])).toMatchObject({ code: 'not-here', reason: "That isn't made here." })
    expect(code(planSession(state, COLT.id, sessionRequest([node(2)]), NIGHT, context({ building: 'kitchen', slot: 0 })))).toBe('not-here')
    expect(code(planSession(state, COLT.id, { kind: 'cook', item: 'dish-vegetables-1', count: 1 }, NIGHT, context(slotAt('observatory'))))).toBe('not-here')
    expect(plan(state, 'observatory', undefined, [node(2), node(2)])).toMatchObject({ code: 'duplicate', data: { item: 'node 2' } })
    expect(plan(state, 'observatory', undefined, [node(1)])).toMatchObject({ code: 'already-open', data: { unlock: 'node 1' } })
    expect(plan(state, 'observatory', undefined, [node(3)])).toMatchObject({ code: 'needs-first', data: { needs: 'node 2' } })
    expect(plan(account(1, nodes(12)), 'observatory', undefined, [node(13)])).toEqual({
      refused: true, code: 'later-layer', reason: 'Opens in scenario {scenario} · {name}', data: { unlock: 'node 13', scenario: 2, name: 'Unity Cup' },
    })
    expect(code(planSession(state, 'nobody', sessionRequest([node(2)]), NIGHT, context(slotAt('observatory'))))).toBe('unknown-uma')
    expect(() => plan(state, 'observatory', undefined, [ref('node', 'n99')])).toThrow(RangeError)
    expect(() => plan(state, 'observatory', undefined, [{ kind: 'dish', target: 'dish-vegetables-1' } as never])).toThrow(RangeError)
  })

  it("bonds: reads the card's era and type, refuses one past her era, bonded or listed; any number otherwise", () => {
    const bond = (id: string) => ref('bond', id)
    const state = account(2, [], {}, (b) => ({ ...b, bonds: [...Array.from({ length: 18 }, (_, i) => `bonded-${i}`), 'speed-e1'] }))
    const items = plan(state, 'dojo', 'friend-group', [bond('friend-e2'), bond('group-e1')])
    expect(!isRefusal(items) && items.map((item) => item.inputs[0]!.item)).toEqual(['dish-grains-3', 'dish-grains-1'])
    expect(plan(state, 'dojo', 'speed', [bond('speed-e1')])).toMatchObject({ code: 'already-bonded', data: { card: 'speed-e1', uma: COLT.id } })
    expect(plan(state, 'dojo', 'wit', [bond('wit-e3')])).toMatchObject({ code: 'card-era', data: { scenario: 3, name: 'Trackblazer' } })
    expect(plan(state, 'dojo', 'wit', [bond('wit-e6')])).toMatchObject({ code: 'card-era', data: { tier: 2, scenario: 1 } })
    expect(plan(state, 'dojo', 'wit', [bond('wit-e1')], { earlier: [sessionRequest([bond('wit-e1')])] })).toMatchObject({ code: 'duplicate' })
    // A 20th and 21st bond are as welcome as the first: 18 is pacing, not a cap.
    expect(code(plan(state, 'dojo', 'speed', [bond('speed-e1b'), bond('speed-e2')]))).toBe('ok')
    expect(code(plan(state, 'dojo', 'speed', [bond('stamina-e1')]))).toBe('wrong-room')
    expect(() => planSession(state, COLT.id, sessionRequest([bond('speed-e2')]), NIGHT, context(slotAt('dojo', 'speed'), { env: { content: { umas: TIER_AND_TRAINING.umas } } })))
      .toThrow(RangeError)
  })
})

describe('pay', () => {
  it('commits the finished unlocks in order and reports them; paying again changes nothing', () => {
    const state = account(1)
    const outputs = [{ unlock: fixed('node', 'n1') }, { unlock: fixed('node', 'n2') }]
    const paid = paySession(state, COLT.id, outputs, { now: NIGHT, env: ENV })
    expect(paid.state.umas[COLT.id]!.build.constellationOpened).toBe(2)
    expect(paid.detail).toMatchObject({ umaId: COLT.id, opened: outputs.map((output) => output.unlock), bonded: [] })
    expect(paySession(paid.state, COLT.id, outputs, { now: NIGHT, env: ENV }).state).toBe(paid.state)
    expect(() => paySession(state, COLT.id, [{ item: 'apple' }], { now: NIGHT, env: ENV })).toThrow(RangeError)
    expect(() => paySession(state, 'nobody', outputs, { now: NIGHT, env: ENV })).toThrow(RangeError)
  })
})

describe('one session per facility on the engine', () => {
  const night = () => account(1, nodes(5), { 'dish-vegetables-1': 1, 'dish-vegetables-2': 2, [SPEED_TICKET_ID]: 2 })

  it("runs 05 §2's night at the Observatory at k = 1.2: three dishes reserved, finishes at 02:06, 06:00 and 09:54", () => {
    const state = night()
    const started = ok(begin(state, 'observatory', undefined, nextUnlocks(state.umas[COLT.id]!.build, state.umas[COLT.id]!, 'observatory', null, 3)))
    expect(started.state.items).toEqual({ [SPEED_TICKET_ID]: 2 })
    expect(started.receipt.movements.filter((move) => move.kind === 'reserve').map((move) => [move.item, move.qty]))
      .toEqual([['dish-vegetables-1', 1], ['dish-vegetables-2', 2]])
    const entry = started.state.work[COLT.id]!.entries[0]!
    const ends = entry.seconds.reduce<number[]>((list, seconds) => [...list, (list.at(-1) ?? NIGHT) + secondsToMs(seconds)], [])
    expect(ends.map(clock)).toEqual([[2, 6], [6, 0], [9, 54]])
    // At 08:00 two have finished: Collect commits exactly those.
    const morning = collect(started.state, { outfitId: COLT.id }, NIGHT + 9 * HOUR + 30 * MINUTE, ENV)
    expect(morning.receipt.outputs.map((output) => 'unlock' in output && output.unlock.target)).toEqual(['n6', 'n7'])
    expect(morning.receipt.paid).toMatchObject([{ umaId: COLT.id, opened: [{ target: 'n6' }, { target: 'n7' }], bonded: [] }])
    expect(morning.receipt.farmExp).toBe(0)
    expect(morning.state.umas[COLT.id]!.build.constellationOpened).toBe(7)
    const later = collect(morning.state, { outfitId: COLT.id }, ends[2]!, ENV)
    expect(later.receipt.paid).toMatchObject([{ opened: [{ target: 'n8' }] }])
    expect(later.receipt.freed).toBe(true)
  })

  it('returns every unmade dish on Recall, the one in progress included; two Speed Tickets move every finish an hour earlier', () => {
    const started = ok(begin(night(), 'observatory', undefined, [node(6), node(7), node(8)]))
    const recalled = recall(started.state, { outfitId: COLT.id }, NIGHT + 4 * HOUR + 30 * MINUTE, ENV)
    expect(recalled.receipt.outputs).toHaveLength(1)
    expect(recalled.receipt.returned).toEqual([{ item: 'dish-vegetables-2', qty: 2 }])
    expect(recalled.state.items['dish-vegetables-2']).toBe(2)
    expect(recalled.state.umas[COLT.id]!.build.constellationOpened).toBe(6)
    const sped = ok(speedUp(started.state, { outfitId: COLT.id, startedAt: NIGHT, tickets: 2 }, NIGHT + 30 * MINUTE, ENV))
    expect(clock(sped.receipt.endsAt)).toEqual([8, 54])
  })

  it('runs the Lineage Hall, a Gym room and a Dojo room the same way, at a Lv 3 facility', () => {
    let state: WorkState = account(1, [], { 'dish-mushrooms-1': 2, 'dish-mushrooms-2': 2, 'dish-fruits-1': 1, 'dish-sweets-1': 2 })
    state = { ...state, buildings: { ...state.buildings, 'lineage-hall': { level: 3 }, gym: { level: 3 }, dojo: { level: 3 } } }
    const her = () => state.umas[COLT.id]!
    const sessions: [FacilityId, RoomId | undefined, readonly UnlockRef[]][] = [
      ['lineage-hall', undefined, nextUnlocks(her().build, her(), 'lineage-hall', null, 10)],
      ['gym', 'stamina', nextUnlocks(her().build, her(), 'gym', 'stamina', 10)],
      ['dojo', 'speed', [ref('bond', 'speed-e1'), ref('bond', 'speed-e1b')]],
    ]
    let now = NIGHT
    for (const [building, room, unlocks] of sessions) {
      const started = ok(begin(state, building, room, unlocks, now))
      const entry = started.state.work[COLT.id]!.entries[0]!
      expect(entry.seconds).toEqual(entry.inputs.map(([dish]) => (dish!.item.endsWith('-1') ? 10_368 : 11_232)))
      const end = started.receipt.endsAt
      expect(collect(started.state, { outfitId: COLT.id }, end - 1, ENV).receipt.outputs).toHaveLength(unlocks.length - 1)
      state = collect(started.state, { outfitId: COLT.id }, end, ENV).state
      now = end
    }
    expect(her().build.inspiration).toEqual({ slots: ['parent0', 'parent1'], uniques: ['parent0', 'parent1'], golds: [] })
    expect(her().build.extraNodes).toEqual(['stamina-01'])
    expect(her().build.bonds).toEqual(['speed-e1', 'speed-e1b'])
    expect(state.items).toEqual({})
  })

  it('starts a queued session at the exact end, counting the running one as made, and refuses what is already listed', () => {
    const state = account(1, nodes(3), { 'dish-vegetables-1': 3, 'dish-vegetables-2': 1 })
    const started = ok(begin(state, 'observatory', undefined, [node(4), node(5)]))
    // Planned alone, node 6 waits on node 5; queued behind the running session, it continues in order.
    expect(code(plan(started.state, 'observatory', undefined, [node(6)]))).toBe('needs-first')
    const add = (unlocks: readonly UnlockRef[]) => queue(started.state, { outfitId: COLT.id, add: { request: sessionRequest(unlocks), building: 'observatory' } }, NIGHT, ENV)
    expect(add([node(5)])).toMatchObject({ code: 'duplicate', data: { item: 'node 5' } })
    expect(add([node(7)])).toMatchObject({ code: 'needs-first' })
    const queued = ok(add([node(6), node(7)]))
    const first = started.receipt.endsAt
    const settled = collect(queued.state, { outfitId: COLT.id }, first, ENV)
    expect(settled.receipt.paid).toMatchObject([{ opened: [{ target: 'n4' }, { target: 'n5' }] }])
    const row = settled.state.work[COLT.id]!
    expect(row.entries.map((entry) => [entry.startedAt, entry.fromQueue])).toEqual([[first, true]])
    expect(settled.state.items).toEqual({})
    const all = collect(settled.state, { outfitId: COLT.id }, first + 2 * 14_040_000, ENV)
    expect(all.state.umas[COLT.id]!.build.constellationOpened).toBe(7)
  })

  it('refuses to start without the dish, reserving nothing', () => {
    const state = account(1, [], { 'dish-vegetables-1': 0 })
    expect(begin(state, 'observatory', undefined, [node(1)])).toMatchObject({ code: 'short', data: { item: 'dish-vegetables-1', largestCoverable: 0 } })
  })
})
