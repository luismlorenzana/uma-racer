// The Exchange's rules are pure (docs/tasks/M033-rework-rules.md "Pure"): no clock, no randomness of their own, no I/O,
// no time factor (prices follow T126's work values, D338); they never write into their inputs, and the same input gives
// the same output. Their refusals are plain words (docs/rework/02-check-ins-and-notifications.md §9).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { codeOnly } from '../../__fixtures__/code-only'
import { RACES, mulberry32 } from '../../__fixtures__/rework-races'
import { deepFreeze } from '../../__fixtures__/rework-tiers'
import { rawItem, SPEED_TICKET_ID } from '../items/catalogue'
import { newAccount } from '../tiers/roster'
import { isRefusal, type OpResult, type ReworkState } from '../types'
import { buy } from './exchange'
import { featuredBoard, featuredSeed } from './featured'
import { settleRacePrize } from './race-prize'
import { EXCHANGE_REFUSALS } from './refusals'
import { sell } from './selling'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const sources = readdirSync(HERE).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))

describe('purity', () => {
  it('reads no clock, rolls no dice of its own and does no I/O', () => {
    expect(sources.length).toBeGreaterThanOrEqual(9)
    for (const file of sources) {
      const code = codeOnly(readFileSync(join(HERE, file), 'utf8'))
      for (const banned of [/Date\.now/, /\bDate\b/, /Math\.random/, /from 'node:/, /\brequire\(/, /\bfetch\(/, /localStorage/, /indexedDB/, /\bprocess\./, /\bconsole\./]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })

  it('never multiplies by the time factor or 1.2', () => {
    for (const file of sources) {
      const code = codeOnly(readFileSync(join(HERE, file), 'utf8'))
      expect(/TIME_FACTOR|\b1\.2\b/.test(code), file).toBe(false)
    }
  })

  it('never writes into deep-frozen inputs, and repeats itself exactly', () => {
    const run = () => {
      const receipts: unknown[] = []
      const step = <R>(result: OpResult<R>): ReworkState => {
        if (isRefusal(result)) throw new Error(result.reason)
        receipts.push(result.receipt)
        return deepFreeze(result.state)
      }
      let state: ReworkState = deepFreeze(newAccount(0))
      const day = '2026-10-13'
      const board = deepFreeze(featuredBoard(day, deepFreeze([...RACES]), mulberry32(featuredSeed(day))))
      for (let i = 0; i < 30; i += 1) {
        const race = RACES[i % RACES.length]!
        const result = settleRacePrize(state.profile, deepFreeze({ resultId: `r${i}`, raceId: race.id, grade: race.grade, place: 1 + (i % 7), localDay: day, board }), 10 + i)
        if (isRefusal(result)) throw new Error(result.reason)
        receipts.push(result.prize)
        state = deepFreeze({ ...state, profile: result.profile, ledger: [...state.ledger, ...result.ledger] })
      }
      state = step(buy(state, deepFreeze({ opId: 'b1', sku: SPEED_TICKET_ID, qty: 10, unitPrice: 30 }), 50))
      state = step(buy(state, deepFreeze({ opId: 'b2', sku: rawItem('fish', 1).id, qty: 5, unitPrice: 108 }), 51))
      state = step(sell(state, deepFreeze({ opId: 's1', itemId: rawItem('fish', 1).id, qty: 2, unitPrice: 36 }), 52))
      return { state, receipts }
    }
    const first = run()
    expect(run()).toEqual(first)
    expect(JSON.parse(JSON.stringify(first.state))).toEqual(first.state)
    expect(first.state.items).toEqual({ [SPEED_TICKET_ID]: 10, [rawItem('fish', 1).id]: 3 })
  })
})

describe('refusals', () => {
  it('list every rule failure in one table, keyed by what refused', () => {
    expect(Object.fromEntries(Object.entries(EXCHANGE_REFUSALS).map(([op, codes]) => [op, Object.keys(codes).sort()]))).toEqual({
      prize: ['place'],
      buy: ['not-sold', 'not-stocked', 'price-changed', 'prize-money', 'quantity'],
      sell: ['not-sellable', 'price-changed', 'quantity', 'sell-short'],
    })
  })

  it('use plain words: no protocol names, no codes', () => {
    const banned = /\b(operation|receipt|revision|generation|version|stale|conflict|payload|id|ids|sync|error|[1-5]\d\d)\b/i
    for (const codes of Object.values(EXCHANGE_REFUSALS)) {
      for (const [code, reason] of Object.entries(codes)) expect(banned.test(reason), `${code}: ${reason}`).toBe(false)
    }
  })
})
