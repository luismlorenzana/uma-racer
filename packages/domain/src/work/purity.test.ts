// The work engine and the Farm are pure (docs/game/architecture.md#the-rework-modules "Pure"): no clock but the given `now`, no
// dice, no I/O and no browser globals; they never write into their inputs; the same state, input and `now` give the
// same result. Their refusals are one table of plain words (docs/game/02-check-ins-and-notifications.md §9).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { deepFreeze } from '../__fixtures__/tiers'
import { clock, ENV, farmAccount, HELPER, node, PLAIN, SESSION_ENV, STUDENT, withNodes, withPrizeMoney, withStock } from '../__fixtures__/work'
import { codeOnly } from '../__fixtures__/code-only'
import { isRefusal, type OpResult } from '../state/types'
import { collectBeforeRace } from './activity'
import { collect, finish, queue, recall, speedUp, start, upgrade } from './operations'
import { WORK_REFUSALS } from './refusals'
import { settle } from './settle'
import type { WorkState } from './types'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const FARM = fileURLToPath(new URL('../farm/', import.meta.url))

describe('purity', () => {
  it('reads no clock, rolls no dice and does no I/O in rework/work or rework/farm', () => {
    const sources = [HERE, FARM].flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => join(dir, f)))
    expect(sources.length).toBeGreaterThan(12)
    for (const file of sources) {
      const code = codeOnly(readFileSync(file, 'utf8'))
      for (const banned of [/Date\.now/, /new Date\b/, /Math\.random/, /from 'node:/, /\brequire\(/, /\bfetch\(/, /localStorage/, /indexedDB/, /\bwindow\./, /\bdocument\./, /\bprocess\./, /\bconsole\./]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })

  it('never writes into deep-frozen inputs, and repeats itself exactly, after a JSON round trip too', () => {
    const run = (initial: WorkState) => {
      const receipts: unknown[] = []
      let state = deepFreeze(initial)
      const step = <R>(result: OpResult<R, WorkState> | { state: WorkState; receipt: R }) => {
        if (isRefusal(result)) throw new Error(result.reason)
        receipts.push(result.receipt)
        state = deepFreeze(result.state)
      }
      step(start(state, { outfitId: PLAIN.id, slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: 'chopped-carrot', count: 4 } }, clock('08:00'), SESSION_ENV))
      step(queue(state, { outfitId: PLAIN.id, add: { request: { kind: 'craft', item: 'wheat-flour', count: 2 }, building: 'pantry' } }, clock('08:01'), SESSION_ENV))
      step(start(state, { outfitId: STUDENT.id, slot: { building: 'observatory', slot: 0 }, request: { kind: 'session', unlocks: [node(1), node(2)] } }, clock('08:02'), SESSION_ENV))
      step(start(state, { outfitId: HELPER.id, slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 3 } }, clock('08:03'), SESSION_ENV))
      step(speedUp(state, { outfitId: PLAIN.id, startedAt: clock('08:00'), tickets: 1 }, clock('08:30'), SESSION_ENV))
      step(collectBeforeRace(state, STUDENT.id, clock('11:30'), SESSION_ENV))
      step(upgrade(state, { building: 'fields' }, clock('11:31'), SESSION_ENV))
      step(collect(state, { outfitId: PLAIN.id }, clock('12:00'), SESSION_ENV))
      step(finish(state, { outfitId: HELPER.id, startedAt: clock('08:03') }, clock('12:01'), SESSION_ENV))
      step(recall(state, { outfitId: STUDENT.id }, clock('12:02'), SESSION_ENV))
      const settled = settle(state, clock('23:00'), SESSION_ENV)
      step({ state: settled.state, receipt: settled.report })
      return { state, receipts }
    }
    const initial = withNodes(withPrizeMoney(withStock(farmAccount(), {
      carrot: 4, wheat: 2, 'dish-vegetables-1': 2, 'speed-ticket': 20, 'wheat-flour': 4,
    }), 2_000), STUDENT.id, 0)
    const first = run(initial)
    expect(run(initial)).toEqual(first)
    expect(run(JSON.parse(JSON.stringify(initial)) as WorkState)).toEqual(first)
    expect(first.receipts).toHaveLength(11)
    expect(first.state.buildings.fields).toEqual({ level: 2 })
    expect(ENV.kinds).toBeUndefined()
  })
})

describe('refusals', () => {
  it('list every rule failure in one table', () => {
    expect(WORK_REFUSALS).toEqual({
      'slot-taken': 'That slot is taken.',
      busy: '{uma} is busy for another {time}.',
      count: 'Make 1 to 10 at a time.',
      'not-here': "That isn't made here.",
      grade: 'Needs Farm Lv {level}.',
      'top-level': 'Already at the top level.',
      short: 'Short {n} {item}.',
      'queue-full': 'Three are already queued.',
      'queue-place': 'A queue stays at one place.',
      finished: "It's already finished.",
      tickets: 'Needs {n} Speed Tickets.',
      'prize-money': 'Needs {n} Prize Money.',
    })
  })

  it('use plain words: no protocol names, no codes', () => {
    const banned = /\b(operation|receipt|revision|generation|version|stale|conflict|payload|id|ids|sync|error|[1-5]\d\d)\b/i
    for (const [code, reason] of Object.entries(WORK_REFUSALS)) expect(banned.test(reason), `${code}: ${reason}`).toBe(false)
  })
})
