// The committed balance reports (T133) agree with the rules they measure: every T = 1–14 in every part, each hard
// ladder miss waits for the owner (and no listed one has since held), every career cell over today's 25% floor, and
// the rivals' typical values follow the report by T133's rule.
import { describe, expect, it } from 'vitest'
import { CAREER_STAGES } from '../../career-stages'
import { SCENARIO_BUFFS } from '../../scenario-buffs'
import { DISTANCE_CATEGORIES } from '../../types'
import { REWORK_BUFF_TYPICAL } from '../tiers/rivals'
import { BUILDS_REPORT } from './builds-report'
import { CAREERS_REPORT } from './careers-report'
import { CAREER_TARGETS, LADDER_OPEN_MISSES, isOpenLadderMiss, meetsCareerTarget } from './targets'

const TODAY_T = Array.from({ length: 14 }, (_, i) => i + 1)

describe('the committed reports', () => {
  it('cover every scenario with a career, T = 1–14, in every part', () => {
    expect(BUILDS_REPORT.ladder.map((row) => row.T)).toEqual(TODAY_T)
    expect(BUILDS_REPORT.g1.map((row) => row.T)).toEqual(TODAY_T)
    expect(BUILDS_REPORT.typical.map((row) => row.T)).toEqual(TODAY_T)
    expect(CAREERS_REPORT.rates.map((row) => row.T)).toEqual(TODAY_T)
    for (const row of BUILDS_REPORT.ladder) expect(row.stamina).toHaveLength(BUILDS_REPORT.rungs.length)
  })

  it('list exactly the hard ladder misses that wait for the owner', () => {
    const hard = BUILDS_REPORT.ladder.flatMap((row) => row.misses.filter((miss) => miss.hard).map((miss) => ({ T: row.T, name: miss.name })))
    expect(hard).toEqual([...LADDER_OPEN_MISSES])
    expect(hard.every((miss) => isOpenLadderMiss(miss.T, miss.name))).toBe(true)
  })

  it('keep every career cell over today\'s 25% floor, and read the targets as 03 §12 states them', () => {
    for (const row of CAREERS_REPORT.rates) {
      for (const stage of CAREER_STAGES) for (const category of DISTANCE_CATEGORIES) expect(row.stages[stage][category].rate).toBeGreaterThanOrEqual(25)
    }
    expect(CAREER_TARGETS).toEqual({ maiden: { min: 100, words: 'won' }, trials: { min: 90, words: '90% or more' }, main: { min: 60, words: '60–100%' } })
    expect([meetsCareerTarget('trials', 90), meetsCareerTarget('trials', 89), meetsCareerTarget('main', 60), meetsCareerTarget('maiden', 95)])
      .toEqual([true, false, true, false])
  })
})

describe("the rivals' typical values (04 §8)", () => {
  it('pin the re-measured values: re-pinned where the rework moved one by more than half a point, today\'s elsewhere', () => {
    expect(REWORK_BUFF_TYPICAL).toEqual([0.033, 0.037, 0.037, 0, 0, 0.046, 0.039, 0.067, 0.047, 0, 0.015, 0.028, 0.009, 0.042])
    for (const row of BUILDS_REPORT.typical) {
      const today = SCENARIO_BUFFS[row.T - 1]!.typical
      const expected = Math.abs(row.measured - today) > 0.005 ? Math.round(row.measured * 1000) / 1000 : today
      expect(REWORK_BUFF_TYPICAL[row.T - 1], `T${row.T}`).toBe(expected)
    }
  })
})
