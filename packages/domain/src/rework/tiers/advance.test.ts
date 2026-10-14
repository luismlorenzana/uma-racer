// Advancing to the next scenario (docs/rework/03-uma-progression.md §5), and the 14 → 15 rule (04 §2).
import { describe, expect, it } from 'vitest'
import { CONTENT, COLT, placeUma } from '../../__fixtures__/rework-tiers'
import { closeScenarioJourney } from '../../scenario-goals'
import { isRefusal, type ReworkState, type ScenarioOfTier, type Tier } from '../types'
import { advanceReadiness, advanceScenario } from './advance'
import { freezeCareer } from './career'
import { scenarioCatalogue } from './map'
import { newAccount, unlockUma } from './roster'

const FIFTEEN = scenarioCatalogue(15)

function account(): ReworkState {
  const result = unlockUma(newAccount(0), { outfitId: COLT.id }, 1, { content: CONTENT })
  if (isRefusal(result)) throw new Error(result.reason)
  return result.state
}
const BASE = account()
const stateAt = (tier: Tier, scenario: ScenarioOfTier, level: number, careerWon: boolean, exp = 0): ReworkState => {
  const uma = placeUma(BASE.umas[COLT.id]!, { tier, scenario, level, exp, careerWon })
  return { ...BASE, umas: { [COLT.id]: uma }, work: { [COLT.id]: { kind: 'job', place: 'orchard' } } }
}

describe('advanceReadiness', () => {
  it('refuses each unmet condition with its own reason', () => {
    expect(advanceReadiness(stateAt(1, 1, 9, true).umas[COLT.id]!)).toEqual({
      refused: true, code: 'not-at-gate', reason: '{uma} needs Racing Lv {level} first.', data: { uma: COLT.id, level: 10 },
    })
    expect(advanceReadiness(stateAt(1, 1, 10, false).umas[COLT.id]!)).toMatchObject({ refused: true, code: 'career-open' })
    expect(advanceReadiness(stateAt(1, 5, 50, true).umas[COLT.id]!)).toMatchObject({ refused: true, code: 'last-scenario' })
    expect(advanceReadiness(stateAt(2, 3, 30, true).umas[COLT.id]!)).toEqual({
      ready: true, from: { tier: 2, scenario: 3 }, to: { tier: 2, scenario: 4 },
    })
  })

  it('offers tier 3 an advance into the 15th once the catalogue has it', () => {
    const atFourteen = stateAt(3, 4, 40, true).umas[COLT.id]!
    expect(advanceReadiness(atFourteen)).toMatchObject({ refused: true, code: 'last-scenario' })
    expect(advanceReadiness(atFourteen, FIFTEEN)).toMatchObject({ ready: true, to: { tier: 3, scenario: 5 } })
  })
})

describe('advanceScenario', () => {
  it('moves her to gate + 1 and spends nothing; a bank of 100 lands her on 10s + 2', () => {
    const state = stateAt(1, 2, 20, true, 100)
    const before = state.umas[COLT.id]!
    const result = advanceScenario(state, { umaId: COLT.id }, 900, { content: CONTENT })
    if (isRefusal(result)) throw new Error(result.reason)
    const after = result.state.umas[COLT.id]!
    expect(result.receipt).toEqual({ umaId: COLT.id, from: { tier: 1, scenario: 2 }, to: { tier: 1, scenario: 3 }, bankApplied: 100, racingLevel: 22 })
    expect(after).toMatchObject({ tier: 1, scenario: 3, racing: { level: 22, exp: 0 } })
    expect(result.state.profile).toBe(state.profile)
    expect(result.state.ledger).toBe(state.ledger)
    expect(result.state.work).toBe(state.work)
    // The old career is closed and kept; the new one is frozen for T = 3.
    expect(after.closedCareers).toEqual([closeScenarioJourney(before.career, 900)])
    expect(after.closedCareers[0]).toMatchObject({ tier: 2, state: 'completed', completedAt: 900 })
    expect(after.career).toEqual(freezeCareer(after, 3, CONTENT))
    // Build, Farm and Expedition stay exactly as they were.
    expect(after.build).toEqual(before.build)
    expect(after.farm).toEqual(before.farm)
    expect(after.expedition).toEqual(before.expedition)
    expect(after.build).toBe(before.build)
  })

  it('applies a smaller bank inside the first level', () => {
    const result = advanceScenario(stateAt(2, 1, 10, true, 40), { umaId: COLT.id }, 1, { content: CONTENT })
    if (isRefusal(result)) throw new Error(result.reason)
    expect(result.state.umas[COLT.id]!.racing).toEqual({ level: 11, exp: 40 })
    expect(result.state.umas[COLT.id]!.career.tier).toBe(7)
  })

  it('refuses as its readiness does, and refuses the 15th until the planner knows it', () => {
    expect(advanceScenario(stateAt(1, 1, 10, false), { umaId: COLT.id }, 1, { content: CONTENT })).toMatchObject({ code: 'career-open' })
    expect(advanceScenario(stateAt(1, 1, 10, true), { umaId: 'nobody' }, 1, { content: CONTENT })).toMatchObject({ code: 'unknown-uma' })
    expect(advanceScenario(stateAt(3, 4, 40, true), { umaId: COLT.id }, 1, { content: CONTENT, catalogue: FIFTEEN })).toEqual({
      refused: true, code: 'scenario-not-playable', reason: '{scenario} is not in the game yet.', data: { scenario: "Japan's next" },
    })
  })
})
