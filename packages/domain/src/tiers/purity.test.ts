// The tier rules are pure (docs/game/architecture.md#the-rework-modules "Pure"): no clock, no randomness of their own, no I/O; they
// never write into their inputs; the same state, input and now give the same result. Their refusals are plain words
// (docs/game/02-check-ins-and-notifications.md §9).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CONTENT, COLT, SPRINTER, deepFreeze, wonCareer } from '../__fixtures__/tiers'
import { codeOnly } from '../__fixtures__/code-only'
import { isRefusal, type OpResult, type ReworkState } from '../state/types'
import { advanceScenario } from './advance'
import { recordExpeditionRace } from './expedition'
import { induct, promote } from './promotion'
import { applyRaceFinish } from './racing'
import { TIER_REFUSALS } from './refusals'
import { exchangeShards, newAccount, unlockUma } from './roster'

const HERE = fileURLToPath(new URL('.', import.meta.url))

describe('purity', () => {
  it('reads no clock, rolls no dice of its own and does no I/O', () => {
    const sources = readdirSync(HERE).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    expect(sources.length).toBeGreaterThan(10)
    for (const file of sources) {
      const code = codeOnly(readFileSync(join(HERE, file), 'utf8'))
      for (const banned of [/Date\.now/, /new Date\b/, /Math\.random/, /from 'node:/, /\brequire\(/, /\bfetch\(/, /localStorage/, /indexedDB/, /\bprocess\./, /\bconsole\./]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })

  it('never writes into deep-frozen inputs, and repeats itself exactly', () => {
    const content = deepFreeze({ ...CONTENT })
    const run = () => {
      const ops: unknown[] = []
      const step = <R>(result: OpResult<R>): ReworkState => {
        if (isRefusal(result)) throw new Error(result.reason)
        ops.push(result.receipt)
        return deepFreeze(result.state)
      }
      let state = deepFreeze(newAccount(0))
      state = step(unlockUma(state, { outfitId: COLT.id }, 1, { content }))
      state = step(unlockUma(state, { outfitId: SPRINTER.id }, 2, { content }))
      state = deepFreeze({ ...state, umas: { ...state.umas, [COLT.id]: { ...state.umas[COLT.id]!, career: wonCareer(state.umas[COLT.id]!.career) } } })
      for (let i = 0; i < 12; i += 1) state = step(applyRaceFinish(state, { umaId: COLT.id, raceId: 'x', resultId: `r${i}`, grade: 'g1', placement: 1, raceBonus: 0 }, 10 + i))
      state = step(advanceScenario(state, { umaId: COLT.id }, 30, { content }))
      state = deepFreeze({ ...state, profile: { ...state.profile, umaShards: 6 } })
      state = step(exchangeShards(state, {}, 31))
      const tier3 = { ...state.umas[COLT.id]!, tier: 3 as const, scenario: 4 as const, racing: { level: 40, exp: 0 } }
      let hall = deepFreeze({ ...state, umas: { ...state.umas, [COLT.id]: { ...tier3, career: wonCareer(tier3.career) } } })
      for (let i = 0; i < 8; i += 1) hall = step(recordExpeditionRace(hall, { umaId: COLT.id, expeditionId: 'europe', won: true }, 40 + i))
      const tier1 = { ...state.umas[COLT.id]!, scenario: 5 as const, racing: { level: 50, exp: 0 } }
      let promoted = deepFreeze({ ...state, umas: { ...state.umas, [COLT.id]: { ...tier1, career: wonCareer(tier1.career) } } })
      for (let i = 0; i < 8; i += 1) promoted = step(recordExpeditionRace(promoted, { umaId: COLT.id, expeditionId: 'europe', won: true }, 50 + i))
      const stats = { stats: { speed: 1, stamina: 1, power: 1, guts: 1, wit: 1 }, skillPoints: 1 }
      promoted = step(promote(promoted, { umaId: COLT.id, presets: { sprint: stats, mile: stats, medium: stats, long: stats } }, 60, { content }))
      expect(isRefusal(induct(hall, { umaId: COLT.id }, 70))).toBe(true)
      return { state, hall, promoted, ops }
    }
    const first = run()
    expect(run()).toEqual(first)
    expect(first.ops).toHaveLength(2 + 12 + 1 + 1 + 8 + 8 + 1)
    expect(first.hall.umas[COLT.id]!.hallOfFame).toEqual({ inductedAt: 47 })
    expect(first.promoted.umas[COLT.id]!.tier).toBe(2)
  })
})

describe('refusals', () => {
  it("list every rule failure in one table", () => {
    expect(Object.keys(TIER_REFUSALS).sort()).toEqual([
      'busy', 'career-open', 'inducted', 'last-scenario', 'no-expedition', 'no-ticket', 'not-at-gate', 'owned', 'run-complete',
      'scenario-not-playable', 'shards', 'unknown-uma', 'use-hall-of-fame', 'use-promotion',
    ])
    expect(TIER_REFUSALS['not-at-gate']).toBe('{uma} needs Racing Lv {level} first.')
  })

  it('use plain words: no protocol names, no codes', () => {
    const banned = /\b(operation|receipt|revision|generation|version|stale|conflict|payload|id|ids|sync|error|[1-5]\d\d)\b/i
    for (const [code, reason] of Object.entries(TIER_REFUSALS)) expect(banned.test(reason), `${code}: ${reason}`).toBe(false)
  })
})
