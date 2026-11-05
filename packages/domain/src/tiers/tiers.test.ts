// The tier map, the caps and the frozen rivals (docs/game/04-tiers-and-scenarios.md, D381), and their purity.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { codeOnly } from '../__fixtures__/code-only'
import { createRng } from '../__fixtures__/rng'
import { STATS } from '../types'
import { LAST_SCENARIO_NUMBER, scenarioNumber, scenarioRow, tierAndScenario, tierOf } from './map'
import { RIVAL_SEASON_SHARE, RIVAL_TRAINED_STAT, rivalFieldStat, rivalPresetAt, rivalSeasonShare, rivalTrainedStat, rollRivalFieldAt } from './rivals'
import { CAP_PROFILES, capBudgetAt, capProfileAt, spCapAt } from './scaling'

const HERE = fileURLToPath(new URL('.', import.meta.url))

describe('the tier map', () => {
  it('numbers fifteen scenarios in three tiers of five, the 15th Goshiki Shuntaisai', () => {
    expect(LAST_SCENARIO_NUMBER).toBe(15)
    expect(scenarioNumber({ tier: 2, scenario: 3 })).toBe(8)
    expect(tierAndScenario(15)).toEqual({ tier: 3, scenario: 5 })
    expect(tierOf(6)).toBe(2)
    expect(scenarioRow(1)).toMatchObject({ name: 'URA Finale', jpRelease: '2021-02-24' })
    expect(scenarioRow(15)).toMatchObject({ name: 'Goshiki Shuntaisai', jpRelease: '2026-10-26' })
    expect(() => tierOf(16)).toThrow(RangeError)
  })
})

describe('caps', () => {
  it('runs from 1,200 a stat at T1 by +250 a scenario to a 9,500 budget at T15', () => {
    expect(capProfileAt(1)).toEqual({ speed: 1200, stamina: 1200, power: 1200, guts: 1200, wit: 1200 })
    for (let T = 1; T < 15; T += 1) expect(capBudgetAt(T + 1) - capBudgetAt(T)).toBe(250)
    expect(capBudgetAt(15)).toBe(9500)
    expect(CAP_PROFILES).toHaveLength(14)
    expect([spCapAt(1), spCapAt(14), spCapAt(15)]).toEqual([2000, 5000, 5200])
  })
})

describe('rivals (D383)', () => {
  it('reads URA Finale\'s measured build and the later frozen ones, and never makes an earlier field stronger than a later one (D191)', () => {
    expect(RIVAL_TRAINED_STAT).toHaveLength(15)
    expect(rivalTrainedStat(1)).toBe(559)
    expect(rivalTrainedStat(2)).toBeCloseTo(664.8033, 4)
    for (let T = 1; T < 15; T += 1) expect(rivalFieldStat(T)).toBeLessThanOrEqual(rivalFieldStat(T + 1))
  })

  it('makes a career\'s fields as strong as its season, up to a finished career\'s at the Finale', () => {
    expect(RIVAL_SEASON_SHARE).toHaveLength(13)
    expect(RIVAL_SEASON_SHARE.every((share, season) => share > 0 && share <= 1 && (season === 0 || share >= RIVAL_SEASON_SHARE[season - 1]!))).toBe(true)
    expect(rivalSeasonShare(12)).toBe(1)
    expect(rivalSeasonShare(undefined)).toBe(1)
    expect(() => rivalSeasonShare(13)).toThrow(RangeError)
    const total = (stats: Record<string, number>) => Object.values(stats).reduce((a, b) => a + b, 0)
    const at = (season?: number) => total(rivalPresetAt({ T: 1, grade: 'g1', distance: 'mile', strategy: 'pace', ...(season === undefined ? {} : { season }) }))
    expect(at(0)).toBeLessThan(at(6))
    expect(at(6)).toBeLessThan(at(12))
    expect(at(12)).toBeCloseTo(at(), 6)
    const final = total(rivalPresetAt({ T: 1, grade: 'g1', distance: 'mile', strategy: 'pace', season: 12, handicap: 0.1 }))
    expect(final).toBeGreaterThan(at(12))
  })

  it('builds a preset under the caps and rolls a field of styles', () => {
    const preset = rivalPresetAt({ T: 1, grade: 'g1', distance: 'mile', strategy: 'pace' })
    for (const stat of STATS) expect(preset[stat]).toBeLessThanOrEqual(capProfileAt(1)[stat])
    const field = rollRivalFieldAt({ T: 1, grade: 'g1', distance: 'mile', count: 8, rng: createRng(7) })
    expect(field).toHaveLength(8)
    expect(new Set(field.map((slot) => slot.strategy)).size).toBeGreaterThan(1)
  })
})

describe('purity', () => {
  it('reads no clock, rolls no dice of its own and does no I/O', () => {
    const sources = readdirSync(HERE).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    for (const file of sources) {
      const code = codeOnly(readFileSync(join(HERE, file), 'utf8'))
      for (const banned of [/Date\.now/, /new Date\b/, /Math\.random/, /from 'node:/, /\bfetch\(/, /localStorage/, /\bprocess\./]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })
})
