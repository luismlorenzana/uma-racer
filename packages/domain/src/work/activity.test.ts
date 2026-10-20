// The activity rule (docs/game/01-game-loop.md §2, docs/game/07-farm.md §5, D328): Free, Working or Ready, racing
// in all three, every row of 01 §2's table, and the tier rules' use of it (advancing leaves work alone, promotion needs
// her Free).
import { describe, expect, it } from 'vitest'
import { placeUma } from '../__fixtures__/tiers'
import {
  clock, ENV, farmAccount, node, ok, PLAIN, SESSION_ENV, STUDENT, WORK_CONTENT, withNodes, withStock,
} from '../__fixtures__/work'
import { farmItemSeconds } from '../farm/jobs'
import { advanceScenario } from '../tiers/advance'
import { recordExpeditionRace } from '../tiers/expedition'
import { promote, promotionReadiness } from '../tiers/promotion'
import { isRefusal } from '../state/types'
import { collectBeforeRace, freeAt, isFree, workState } from './index'
import { collect, queue, recall, start } from './adapter'
import type { FarmRequest, SlotRef, WorkState } from './types'

const T0 = clock('08:00')
const G = farmItemSeconds('gather', 1) * 1000
const GARDEN: SlotRef = { building: 'vegetable-garden', slot: 0 }
const OBSERVATORY: SlotRef = { building: 'observatory', slot: 0 }
const carrots = (count: number): FarmRequest => ({ kind: 'gather', item: 'carrot', count })

/** Student in 05 §2's night at the Observatory from 22:30, in base minutes: nodes 6–8 end 01:30, 04:45 and 08:00. */
function inSession(): WorkState {
  const state = withNodes(withStock(farmAccount(), { 'tonic-1': 1, 'tonic-2': 2 }), STUDENT.id, 5)
  return ok(start(state, { outfitId: STUDENT.id, slot: OBSERVATORY, request: { kind: 'session', unlocks: [node(6), node(7), node(8)] } }, clock('22:30'), SESSION_ENV)).state
}

describe('work states', () => {
  const working = () => ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(2) }, T0, ENV)).state

  it('are Free, Working or Ready', () => {
    expect(workState(farmAccount(), PLAIN.id, T0, ENV)).toBe('free')
    expect(workState(working(), PLAIN.id, T0, ENV)).toBe('working')
    expect(workState(working(), PLAIN.id, T0 + 2 * G - 1, ENV)).toBe('working')
    expect(workState(working(), PLAIN.id, T0 + 2 * G, ENV)).toBe('ready')
    expect(workState(collect(working(), { outfitId: PLAIN.id }, T0 + 2 * G, ENV).state, PLAIN.id, T0 + 2 * G, ENV)).toBe('free')
  })

  it('say when a Working Uma is free, queue included, and nothing otherwise', () => {
    const queued = ok(queue(working(), { outfitId: PLAIN.id, add: { request: carrots(3), building: 'vegetable-garden' } }, T0, ENV)).state
    expect(freeAt(working(), PLAIN.id, T0, ENV)).toBe(T0 + 2 * G)
    expect(freeAt(queued, PLAIN.id, T0, ENV)).toBe(T0 + 5 * G)
    expect(freeAt(queued, PLAIN.id, T0 + 3 * G, ENV)).toBe(T0 + 5 * G)
    expect(freeAt(queued, PLAIN.id, T0 + 5 * G, ENV)).toBeNull()
    expect(freeAt(farmAccount(), PLAIN.id, T0, ENV)).toBeNull()
  })

  it('call her Free with no row, or a row that only keeps her last work', () => {
    const ready = working()
    expect(isFree(ready, PLAIN.id)).toBe(false)
    const done = collect(ready, { outfitId: PLAIN.id }, T0 + 2 * G, ENV).state
    expect(done.work[PLAIN.id]!.last).not.toBeNull()
    expect(isFree(done, PLAIN.id)).toBe(true)
    expect(isFree(done, 'nobody')).toBe(true)
    // T125's untyped rows that aren't idle work rows are not Free.
    expect(isFree({ work: { x: { kind: 'session' } } }, 'x')).toBe(false)
    expect(isFree({ work: { x: {} } }, 'x')).toBe(false)
  })
})

describe("01 §2's table", () => {
  it('an Uma mid-session races with every finished unlock, collected in the same tap', () => {
    const { state, receipt } = collectBeforeRace(inSession(), STUDENT.id, clock('05:00', 1), SESSION_ENV)
    expect(receipt.outputs).toEqual([{ unlock: node(6) }, { unlock: node(7) }])
    expect(receipt.paid).toEqual([{ opened: ['n6', 'n7'] }])
    expect(state.umas[STUDENT.id]!.build.constellationOpened).toBe(7)
    expect(workState(state, STUDENT.id, clock('05:00', 1), SESSION_ENV)).toBe('working')
    // The one in progress counts once it finishes.
    expect(collectBeforeRace(state, STUDENT.id, clock('07:59', 1), SESSION_ENV).receipt.outputs).toEqual([])
  })

  it('an Uma mid-job races and the job runs on, uncollected', () => {
    const state = ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(2) }, T0, ENV)).state
    const raced = collectBeforeRace(state, PLAIN.id, T0 + G, ENV)
    expect(raced.receipt.outputs).toEqual([])
    expect(raced.state).toBe(state)
  })

  it('an Uma mid-job is refused a session with her free time, and Recall frees her', () => {
    const state = withStock(ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(2) }, T0, ENV)).state, { 'tonic-1': 1 })
    const session = { outfitId: PLAIN.id, slot: OBSERVATORY, request: { kind: 'session' as const, unlocks: [node(1)] } }
    expect(start(state, session, T0 + 1, SESSION_ENV)).toMatchObject({ code: 'busy', data: { uma: PLAIN.id, time: T0 + 2 * G } })
    const recalled = recall(state, { outfitId: PLAIN.id }, T0 + 1, SESSION_ENV).state
    expect(isRefusal(start(recalled, session, T0 + 1, SESSION_ENV))).toBe(false)
  })

  it('an Uma mid-session is refused a Farm job the same way', () => {
    expect(start(inSession(), { outfitId: STUDENT.id, slot: GARDEN, request: carrots(1) }, clock('23:00'), SESSION_ENV)).toMatchObject({
      code: 'busy', data: { uma: STUDENT.id, time: clock('08:00', 1) },
    })
  })

  it('a Ready Uma assigned elsewhere is collected first', () => {
    const { receipt, state } = ok(start(inSession(), { outfitId: STUDENT.id, slot: GARDEN, request: carrots(1) }, clock('08:00', 1), SESSION_ENV))
    expect(receipt.collected).toMatchObject({ outputs: [{ unlock: node(6) }, { unlock: node(7) }, { unlock: node(8) }], freed: true })
    expect(state.umas[STUDENT.id]!.build.constellationOpened).toBe(8)
    expect(state.work[STUDENT.id]).toMatchObject({ slot: GARDEN, last: { slot: OBSERVATORY } })
  })

  it('a session never queues behind a Farm job', () => {
    const state = ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(2) }, T0, ENV)).state
    expect(queue(state, { outfitId: PLAIN.id, add: { request: { kind: 'session', unlocks: [node(1)] }, building: 'observatory' } }, T0, SESSION_ENV))
      .toMatchObject({ code: 'queue-place' })
  })

  it('advancing mid-job leaves her work, the Warehouse and the buildings alone', () => {
    const working = ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(2) }, T0, ENV)).state
    const state = { ...working, umas: { ...working.umas, [PLAIN.id]: placeUma(working.umas[PLAIN.id]!, { tier: 1, scenario: 1, level: 10, careerWon: true }, WORK_CONTENT) } }
    const advanced = ok(advanceScenario(state, { umaId: PLAIN.id }, T0 + 1, { content: WORK_CONTENT })).state
    expect(advanced.umas[PLAIN.id]!.scenario).toBe(2)
    expect(advanced.work).toBe(state.work)
    expect(advanced.items).toBe(state.items)
    expect(advanced.buildings).toBe(state.buildings)
  })

  it('an Expedition race is allowed in any work state', () => {
    const working = ok(start(farmAccount(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(2) }, T0, ENV)).state
    const state = { ...working, umas: { ...working.umas, [PLAIN.id]: placeUma(working.umas[PLAIN.id]!, { tier: 1, scenario: 5, level: 50, careerWon: true }, WORK_CONTENT) } }
    expect(isRefusal(recordExpeditionRace(state, { umaId: PLAIN.id, expeditionId: 'europe', won: true }, T0 + 1))).toBe(false)
  })
})

describe('promotion needs her Free (04 §5)', () => {
  const STATS = { stats: { speed: 1, stamina: 1, power: 1, guts: 1, wit: 1 }, skillPoints: 1 }
  const PRESETS = { sprint: STATS, mile: STATS, medium: STATS, long: STATS }

  function ready(): WorkState {
    let state = atExpeditionEnd(farmAccount())
    for (let i = 0; i < 8; i += 1) state = ok(recordExpeditionRace(state, { umaId: PLAIN.id, expeditionId: 'europe', won: true }, T0 + i)).state
    return state
  }
  function atExpeditionEnd(state: WorkState): WorkState {
    return { ...state, umas: { ...state.umas, [PLAIN.id]: placeUma(state.umas[PLAIN.id]!, { tier: 1, scenario: 5, level: 50, careerWon: true }, WORK_CONTENT) } }
  }

  it('is refused while she works or waits for Collect, and allowed once collected', () => {
    const working = ok(start(ready(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(1) }, T0, ENV)).state
    expect(promotionReadiness(working, PLAIN.id)).toMatchObject({ code: 'busy' })
    expect(promote(working, { umaId: PLAIN.id, presets: PRESETS }, T0 + 2 * G, { content: WORK_CONTENT })).toMatchObject({ code: 'busy' })
    const collected = collect(working, { outfitId: PLAIN.id }, T0 + 2 * G, ENV).state
    expect(promotionReadiness(collected, PLAIN.id)).toMatchObject({ ready: true })
  })

  it('starts her at Farm Lv 1 with no last work to repeat', () => {
    const working = ok(start(ready(), { outfitId: PLAIN.id, slot: GARDEN, request: carrots(1) }, T0, ENV)).state
    const collected = collect(working, { outfitId: PLAIN.id }, T0 + G, ENV).state
    const promoted = ok(promote({ ...collected, umas: { ...collected.umas, [PLAIN.id]: { ...collected.umas[PLAIN.id]!, farm: { level: 30, exp: 60_000 } } } },
      { umaId: PLAIN.id, presets: PRESETS }, T0 + G, { content: WORK_CONTENT })).state
    expect(promoted.umas[PLAIN.id]!.farm).toEqual({ level: 1, exp: 0 })
    expect(promoted.work[PLAIN.id]).toBeUndefined()
    expect(promoted.items).toBe(collected.items)
    expect(promoted.buildings).toBe(collected.buildings)
    expect(start(promoted, { outfitId: PLAIN.id, slot: GARDEN, request: { kind: 'gather', item: 'potato', count: 1 } }, T0 + G, ENV)).toMatchObject({ code: 'grade' })
  })
})
