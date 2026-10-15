// Careers per scenario (docs/rework/03-uma-progression.md §4): today's planner on the rework's Uma, and the goal
// settlement on the rework's state.
import { describe, expect, it } from 'vitest'
import { CONTENT, COLT, DIRT_PARENT_A, DIRT_PARENT_B, DIRT_PARENT_C, RACES, SPRINTER, placeUma } from '../__fixtures__/tiers'
import { lineageAptitudes } from '../lineage'
import { createScenarioTraining, createUmaSave, type ScenarioGoal, type ScenarioJourney, type UmaSave } from '../career-shapes'
import { planScenarioCareer } from '../scenario-goals'
import { isRefusal, type UmaState } from '../state/types'
import { careerAptitudes, careerView, freezeCareer, settleGoalWin } from './career'
import { firstLevel, tierAndScenario } from './map'
import { newAccount, unlockUma } from './roster'

function unlocked(outfitId: string): UmaState {
  const result = unlockUma(newAccount(0), { outfitId }, 1, { content: CONTENT })
  if (isRefusal(result)) throw new Error(result.reason)
  return result.state.umas[outfitId]!
}

/** Today's Uma at scenario T, as today's tests build one. */
const todayAt = (template: typeof COLT, T: number): UmaSave => ({
  ...createUmaSave(template),
  level: (T - 1) * 10 + 1,
  unlockedTier: T,
  scenarios: Array.from({ length: T }, (_, index) => ({ ...createScenarioTraining(index + 1), started: true })),
})

describe('careers', () => {
  it("equal the planner's for a full today's Uma at the same level, at every playable T", () => {
    for (const template of [COLT, SPRINTER]) {
      const uma = unlocked(template.id)
      for (let T = 1; T <= 14; T += 1) {
        const at = tierAndScenario(T)
        const placed = placeUma(uma, { ...at, level: firstLevel(at.scenario) })
        const today = planScenarioCareer({ uma: todayAt(template, T), umaTemplate: template, aptitudes: template.aptitudes, races: RACES })
        expect(placed.career).toEqual(today.journey)
        expect(placed.career.tier).toBe(T)
      }
    }
  })

  it("gives tier 2's first scenario scenario 6's rotation", () => {
    const uma = unlocked(COLT.id)
    const tier2 = placeUma(uma, { tier: 2, scenario: 1, level: 1 })
    expect(tier2.career.tier).toBe(6)
    expect(tier2.career.goals.map((goal) => goal.id)[0]).toBe('goal:6:maiden')
    expect(tier2.career).toEqual(freezeCareer(uma, 6, CONTENT))
    expect(tier2.career).not.toEqual(freezeCareer(uma, 1, CONTENT))
  })

  it("shows the planner her lifetime level, preferences and selected preset", () => {
    const uma = { ...unlocked(COLT.id), raceDefaults: { preferences: { strategy: 'front', distance: 'mile', surface: 'turf' }, selectedPreset: 'long' } } as const
    const view = careerView(uma, 8)
    expect(view).toMatchObject({ templateId: 'colt', level: 71, unlockedTier: 8, activePreset: 'long', racePreferences: uma.raceDefaults.preferences })
    expect(() => freezeCareer(uma, 15, CONTENT)).toThrow(RangeError)
  })

  it("reads aptitudes from the selected preset's lineage in open slots (D252)", () => {
    const base = unlocked(SPRINTER.id)
    const lineage = { parent0: DIRT_PARENT_A.id, parent1: DIRT_PARENT_B.id, 'parent0-gp0': DIRT_PARENT_C.id }
    const presets = { ...base.build.presets, mile: { ...base.build.presets.mile, lineage } }
    const open = { ...base, raceDefaults: { ...base.raceDefaults, selectedPreset: 'mile' as const },
      build: { ...base.build, presets, inspiration: { ...base.build.inspiration, slots: ['parent0', 'parent1', 'parent0-gp0'] as const } } }
    expect(careerAptitudes(open, CONTENT)).toEqual(lineageAptitudes(SPRINTER.aptitudes, [DIRT_PARENT_A, DIRT_PARENT_B, DIRT_PARENT_C]))
    expect(careerAptitudes(open, CONTENT).surface.dirt).toBe('D')
    // A pick in a slot that isn't open, or in another preset, doesn't count.
    const closed = { ...open, build: { ...open.build, inspiration: { ...open.build.inspiration, slots: ['parent0'] as const } } }
    expect(careerAptitudes(closed, CONTENT)).toEqual(SPRINTER.aptitudes)
    expect(careerAptitudes({ ...open, raceDefaults: { ...open.raceDefaults, selectedPreset: 'sprint' } }, CONTENT)).toEqual(SPRINTER.aptitudes)
    const frozen = freezeCareer(open, 1, CONTENT)
    expect(frozen).toEqual(planScenarioCareer({ uma: careerView(open, 1), umaTemplate: SPRINTER,
      aptitudes: lineageAptitudes(SPRINTER.aptitudes, [DIRT_PARENT_A, DIRT_PARENT_B, DIRT_PARENT_C]), races: RACES }).journey)
  })
})

// ---- settleGoalWin ---------------------------------------------------------------------------------------------------

const goal = (id: string, slot: ScenarioGoal['slot'], raceId: string): ScenarioGoal => ({
  id, slot, raceId, kind: 'win', series: null, minimumMarginLengths: 0, status: 'active', completedRaceResultId: null, completedAt: null,
})
const seriesGoal = (id: string, legs: string[]): ScenarioGoal => ({
  id, slot: 'main', raceId: null, kind: 'win-series', minimumMarginLengths: 0, status: 'active', completedRaceResultId: null, completedAt: null,
  series: { tag: 'triple-crown', legs: legs.map((raceId) => ({ key: raceId, raceId, status: 'active', completedRaceResultId: null, completedAt: null })) },
})
const SINGLE: ScenarioJourney = { tier: 1, tracking: 'tracked', state: 'active', completedAt: null, goals: [
  goal('goal:1:maiden', 'maiden', 'g3-a'), goal('goal:1:trials:1', 'trials', 'g2-a'), goal('goal:1:trials:2', 'trials', 'g2-b'),
  goal('goal:1:main:1', 'main', 'g1-a'), goal('goal:1:main:2', 'main', 'g1-b'), goal('goal:1:main:3', 'main', 'g1-c'),
] }
const SERIES: ScenarioJourney = { tier: 1, tracking: 'tracked', state: 'active', completedAt: null, goals: [
  goal('goal:1:maiden', 'maiden', 'g3-a'), goal('goal:1:trials:1', 'trials', 'g2-a'), goal('goal:1:trials:2', 'trials', 'g2-b'),
  seriesGoal('goal:1:main:1', ['satsuki-sho', 'tokyo-yushun']), goal('goal:1:main:2', 'main', 'g1-a'),
] }

describe('settleGoalWin', () => {
  // A win completes an active single goal on that race, or an active leg of a set, which completes the set with its last
  // leg; a race no goal names, or a goal already won, changes nothing (D137).
  const WINS = ['g2-b', 'unrelated', 'satsuki-sho', 'g3-a', 'g1-a', 'satsuki-sho', 'tokyo-yushun', 'g2-a', 'g1-c', 'g1-b', 'g3-a']
  it.each([
    ['single goals', SINGLE, [['goal:1:trials:2'], [], [], ['goal:1:maiden'], ['goal:1:main:1'], [], [], ['goal:1:trials:1'], ['goal:1:main:3'], ['goal:1:main:2'], []]],
    ['a two-leg set', SERIES, [['goal:1:trials:2'], [], [], ['goal:1:maiden'], ['goal:1:main:2'], [], ['goal:1:main:1'], ['goal:1:trials:1'], [], [], []]],
  ] as const)('settles %s win by win', (_, career, completed) => {
    let rework: ScenarioJourney = career
    WINS.forEach((raceId, index) => {
      const at = 1000 + index
      const resultId = `race:colt:${index}`
      const actual = settleGoalWin(rework, raceId, resultId, at)
      expect(actual.completedGoalIds).toEqual(completed[index])
      for (const id of completed[index]!) {
        expect(actual.career.goals.find((entry) => entry.id === id)).toMatchObject({ status: 'completed', completedRaceResultId: resultId, completedAt: at })
      }
      rework = actual.career
    })
    expect(rework.goals.every((entry) => entry.status === 'completed')).toBe(true)
  })

  it('leaves a closed or untracked career alone', () => {
    expect(settleGoalWin({ ...SINGLE, state: 'completed' }, 'g3-a', 'r', 1).completedGoalIds).toEqual([])
    expect(settleGoalWin({ ...SINGLE, tracking: 'legacy-untracked' }, 'g3-a', 'r', 1).career.goals[0]!.status).toBe('active')
  })
})
