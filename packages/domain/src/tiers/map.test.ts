// Pins the tier map (docs/rework/04-tiers-and-promotion.md §1–§2) and Racing Level's place in it (03 §2–§3).
import { describe, expect, it } from 'vitest'
import {
  RACING_LEVELS_PER_TIER, SCENARIOS_PER_TIER, TIERS, TODAY_CATALOGUE, firstLevel, gateLevel, isLastScenario, lastGate,
  lifetimeLevel, scenarioCatalogue, scenarioNumber, scenarioPlayable, scenarioRow, scenariosInTier, tierAndScenario, tierOf,
} from './map'
import { capBudgetAt, spCapAt } from './scaling'

const FIFTEEN = scenarioCatalogue(15)

describe('the tier map', () => {
  it('is three tiers of five scenarios, fifty Racing Levels a tier', () => {
    expect(TIERS).toBe(3)
    expect(SCENARIOS_PER_TIER).toBe(5)
    expect(RACING_LEVELS_PER_TIER).toBe(50)
  })

  it("matches 04 §1's fifteen rows", () => {
    const rows = Array.from({ length: 15 }, (_, i) => {
      const row = scenarioRow(i + 1)
      return [row.tier, row.scenario, row.T, row.name, row.jpRelease, `${firstLevel(row.scenario)}–${gateLevel(row.scenario)}`,
        capBudgetAt(row.T), spCapAt(row.T)]
    })
    expect(rows).toEqual([
      [1, 1, 1, 'URA Finale', '2021-02-24', '1–10', 6000, 2000],
      [1, 2, 2, 'Unity Cup', '2021-08-30', '11–20', 6250, 2400],
      [1, 3, 3, 'Trackblazer', '2022-02-24', '21–30', 6500, 2800],
      [1, 4, 4, 'Our Grand Concert', '2022-08-24', '31–40', 6750, 3000],
      [1, 5, 5, 'Grand Masters', '2023-02-24', '41–50', 7000, 3200],
      [2, 1, 6, "Project L'Arc", '2023-08-24', '1–10', 7250, 3400],
      [2, 2, 7, 'U.A.F. Ready GO!', '2024-02-24', '11–20', 7500, 3600],
      [2, 3, 8, 'Great Food Festival', '2024-06-26', '21–30', 7750, 3800],
      [2, 4, 9, 'Run! Mecha Umamusume', '2024-10-29', '31–40', 8000, 4000],
      [2, 5, 10, 'The Twinkle Legends', '2025-02-24', '41–50', 8250, 4200],
      [3, 1, 11, 'Design Your Island', '2025-06-27', '1–10', 8500, 4400],
      [3, 2, 12, 'Yukoma Hot Springs', '2025-10-29', '11–20', 8750, 4600],
      [3, 3, 13, 'Beyond Dreams', '2026-02-24', '21–30', 9000, 4800],
      [3, 4, 14, 'Tracen Diner', '2026-06-29', '31–40', 9250, 5000],
      [3, 5, 15, "Japan's next", null, '41–50', 9500, 5200],
    ])
  })

  it('numbers scenario s of tier t as T = 5(t − 1) + s, both ways', () => {
    for (let T = 1; T <= 15; T += 1) {
      expect(scenarioNumber(tierAndScenario(T))).toBe(T)
      expect(tierOf(T)).toBe(Math.ceil(T / 5))
    }
    expect(scenarioNumber({ tier: 2, scenario: 3 })).toBe(8)
    expect(() => tierOf(0)).toThrow(RangeError)
    expect(() => tierOf(16)).toThrow(RangeError)
    expect(() => scenarioNumber({ tier: 4 as never, scenario: 1 })).toThrow(RangeError)
  })

  it('gives tier 3 four scenarios until the 15th is in the catalogue (04 §2)', () => {
    expect(TODAY_CATALOGUE).toEqual({ scenarioCount: 14 })
    expect(([1, 2, 3] as const).map((t) => scenariosInTier(t))).toEqual([5, 5, 4])
    expect(([1, 2, 3] as const).map((t) => scenariosInTier(t, FIFTEEN))).toEqual([5, 5, 5])
    expect(([1, 2, 3] as const).map((t) => lastGate(t))).toEqual([50, 50, 40])
    expect(([1, 2, 3] as const).map((t) => lastGate(t, FIFTEEN))).toEqual([50, 50, 50])
    expect(isLastScenario({ tier: 3, scenario: 4 })).toBe(true)
    expect(isLastScenario({ tier: 3, scenario: 4 }, FIFTEEN)).toBe(false)
    expect(isLastScenario({ tier: 1, scenario: 5 })).toBe(true)
    expect(() => scenarioCatalogue(13)).toThrow(RangeError)
    expect(scenarioPlayable(14)).toBe(true)
    expect(scenarioPlayable(15)).toBe(false)
  })

  it('puts the gates at 10s and lifetime level at 50(t − 1) + Racing Level (03 §2)', () => {
    expect([1, 2, 3, 4, 5].map(gateLevel)).toEqual([10, 20, 30, 40, 50])
    expect(([1, 2, 3, 4, 5] as const).map(firstLevel)).toEqual([1, 11, 21, 31, 41])
    expect(lifetimeLevel(2, 13)).toBe(63)
    expect(lifetimeLevel(3, 50)).toBe(150)
    expect(() => lifetimeLevel(1, 51)).toThrow(RangeError)
    expect(() => gateLevel(6)).toThrow(RangeError)
  })
})
