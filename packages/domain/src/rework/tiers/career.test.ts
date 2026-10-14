// Careers per scenario (docs/rework/03-uma-progression.md §4): today's planner on the rework's Uma, and the goal
// settlement restated for the rework's state, held to today's by parity.
import { describe, expect, it } from 'vitest'
import { CONTENT, COLT, DIRT_PARENT_A, DIRT_PARENT_B, DIRT_PARENT_C, RACES, SPRINTER, placeUma } from '../../__fixtures__/rework-tiers'
import type { RaceTemplate } from '../../content'
import { lineageAptitudes } from '../../lineage'
import type { RaceResultRecord } from '../../progression-race'
import { createScenarioTraining, createUmaSave, type ScenarioGoal, type ScenarioJourney, type UmaSave } from '../../save'
import { evaluateScenarioGoals, planScenarioCareer } from '../../scenario-goals'
import { isRefusal, type UmaState } from '../types'
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

// ---- settleGoalWin against evaluateScenarioGoals --------------------------------------------------------------------

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

const stats = { speed: 500, stamina: 500, power: 500, guts: 500, wit: 500 }
function winRecord(umaId: string, raceId: string): RaceResultRecord {
  return {
    contentVersion: 'synthetic', umaId, raceId, sequence: 1, seed: 7, strategy: 'pace', startLevel: 1, startExp: 0, startStats: stats,
    raceBonus: 0, playerPlacement: 1, expGained: 0, levelsGained: [], ticketReward: 0, shardReward: 0, createdAt: 1,
    field: Array.from({ length: 8 }, (_, index) => ({
      umaId: index === 0 ? umaId : `rival-${index}`, isPlayer: index === 0, strategy: 'pace' as const, gate: index, stats,
      aptitude: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const }, placement: index + 1,
      finishTime: 100 + index, marginLengths: index === 1 ? 1.5 : 0,
    })),
  }
}

describe('settleGoalWin', () => {
  it.each([['single goals', SINGLE], ['a two-leg set', SERIES]])('equals evaluateScenarioGoals on %s', (_, career) => {
    const uma = createUmaSave(COLT)
    const wins = ['g2-b', 'unrelated', 'satsuki-sho', 'g3-a', 'g1-a', 'satsuki-sho', 'tokyo-yushun', 'g2-a', 'g1-c', 'g1-b', 'g3-a']
    let today = career
    let rework = career
    wins.forEach((raceId, index) => {
      const at = 1000 + index
      const resultId = `race:colt:${index}`
      const expected = evaluateScenarioGoals({ journey: today, uma, race: { id: raceId } as RaceTemplate, resultId, result: winRecord('colt', raceId), completedAt: at })
      const actual = settleGoalWin(rework, raceId, resultId, at)
      expect(actual.career).toEqual(expected.journey)
      expect(actual.completedGoalIds).toEqual(expected.newlyCompletedIds)
      today = expected.journey
      rework = actual.career
    })
    expect(rework.goals.every((entry) => entry.status === 'completed')).toBe(true)
  })

  it('leaves a closed or untracked career alone', () => {
    expect(settleGoalWin({ ...SINGLE, state: 'completed' }, 'g3-a', 'r', 1).completedGoalIds).toEqual([])
    expect(settleGoalWin({ ...SINGLE, tracking: 'legacy-untracked' }, 'g3-a', 'r', 1).career.goals[0]!.status).toBe('active')
  })
})
