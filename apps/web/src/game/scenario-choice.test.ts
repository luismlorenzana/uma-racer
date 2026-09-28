import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chooseTier, chosenTier, resetScenarioChoiceCache } from './scenario-choice'

const store = new Map<string, string>()
const storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
}

const uma = (unlockedTier: number, tiers = [1, 2]) => ({
  templateId: 'u1',
  unlockedTier,
  scenarios: tiers.map((tier) => ({ tier })) as never,
})

describe('scenario in use (D190)', () => {
  beforeEach(() => {
    store.clear()
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
    resetScenarioChoiceCache()
  })
  afterEach(() => resetScenarioChoiceCache())

  it('is her current scenario until another is chosen, and remembers the choice', () => {
    expect(chosenTier(uma(2))).toBe(2)
    chooseTier(uma(2), 1)
    expect(chosenTier(uma(2))).toBe(1)
    resetScenarioChoiceCache()
    expect(chosenTier(uma(2))).toBe(1)
    chooseTier(uma(2), 2)
    expect(chosenTier(uma(2))).toBe(2)
  })

  it('returns to her new scenario once she advances, and ignores a scenario she does not have', () => {
    chooseTier(uma(2), 1)
    expect(chosenTier(uma(3, [1, 2, 3]))).toBe(3)
    chooseTier(uma(2), 5)
    expect(chosenTier(uma(2))).toBe(2)
    store.set('uma-racer:scenario-choice', '{"u1":{"tier":"x"}}')
    resetScenarioChoiceCache()
    expect(chosenTier(uma(2))).toBe(2)
  })
})
