// Guards the numbers in docs/design against drift. If a doc changes, change the matching expectation here.
import { describe, expect, it } from 'vitest'
import {
  addTrainingExp,
  applyCappedGain,
  baselineSpCap,
  baselineStatCap,
  capMult,
  cardEffectValue,
  cardLevelCap,
  cardLimitBreakCost,
  distanceCategory,
  eraOf,
  fieldForm,
  grantDailyTickets,
  isGateLevel,
  levelsIntoScenario,
  npcRaceStats,
  raceExp,
  spCap,
  statCap,
  tierOfLevel,
  trainingExpForTurn,
  trainingGains,
  umaPromotionCost,
  yourForm,
} from './index'

describe('scenarios', () => {
  it('uses the baseline caps from the timeline and keeps rising after #11', () => {
    expect(baselineStatCap(1)).toBe(600)
    expect(baselineStatCap(7)).toBe(1200)
    expect(baselineStatCap(11)).toBe(2000)
    expect(baselineStatCap(12)).toBe(2200)
    expect(baselineSpCap(1)).toBe(300)
    expect(baselineSpCap(11)).toBe(2300)
  })

  it('maps Uma Levels to tiers and gates', () => {
    expect(tierOfLevel(1)).toBe(1)
    expect(tierOfLevel(10)).toBe(1)
    expect(tierOfLevel(11)).toBe(2)
    expect(isGateLevel(20)).toBe(true)
    expect(levelsIntoScenario(11)).toBe(0)
    expect(levelsIntoScenario(20)).toBe(9)
  })

  it('assigns card eras by JP release date', () => {
    expect(eraOf('2021-02-24')).toBe(1)
    expect(eraOf('2021-08-29')).toBe(1)
    expect(eraOf('2023-03-01')).toBe(5)
    expect(eraOf('2026-01-01')).toBe(11)
  })

  it('categorizes distances', () => {
    expect(distanceCategory(1400)).toBe('sprint')
    expect(distanceCategory(1800)).toBe('mile')
    expect(distanceCategory(2400)).toBe('medium')
    expect(distanceCategory(2500)).toBe('long')
  })
})

describe('training', () => {
  it('scales caps from 80% at TL1 to 100% at TL10', () => {
    expect(capMult(1)).toBeCloseTo(0.8)
    expect(capMult(10)).toBeCloseTo(1)
    expect(statCap(1, 1)).toBe(480)
    expect(statCap(1, 10)).toBe(600)
    expect(statCap(2, 4)).toBe(607)
    expect(spCap(1, 10)).toBe(300)
  })

  it('reaches TL10 in at most 25 trainings', () => {
    let state = { trainingLevel: 1, exp: 0 }
    for (let i = 0; i < 25; i++) state = addTrainingExp(state.trainingLevel, state.exp, trainingExpForTurn(false))
    expect(state.trainingLevel).toBe(10)
  })

  it('matches the worked example in training.md', () => {
    const gains = trainingGains('speed', { speed: 0.2 }, [
      { type: 'speed', trainingBonus: 0.1, friendshipBonus: 0.25, flatBonus: { speed: 3, sp: 2 } },
      { type: 'power', trainingBonus: 0.05, friendshipBonus: 0.2, flatBonus: {} },
    ])
    expect(gains).toEqual({ speed: 63, power: 19, sp: 13 })
  })

  it('never reduces a stat that already sits above the cap', () => {
    expect(applyCappedGain(600, 50, 560)).toBe(600)
    expect(applyCappedGain(540, 50, 560)).toBe(560)
  })
})

describe('race form', () => {
  it('starts even and ends about 10% ahead, resetting each scenario', () => {
    expect(yourForm(1)).toBeCloseTo(0.8)
    expect(fieldForm(1)).toBeCloseTo(0.8)
    expect(yourForm(10)).toBeCloseTo(0.98)
    expect(fieldForm(10)).toBeCloseTo(0.89)
    expect(yourForm(11)).toBeCloseTo(0.8)
  })

  it('builds identical generic NPC stats (racing.md example)', () => {
    const npc = npcRaceStats(1, 'g1', 'medium', 1)
    expect(npc.speed).toBeCloseTo(480)
    expect(npc.stamina).toBeCloseTo(432)
  })
})

describe('progression and economy', () => {
  it('pays race EXP by grade and placement', () => {
    expect(raceExp('g1', 1)).toBe(150)
    expect(raceExp('g1', 2)).toBe(38)
    expect(raceExp('g1', 4)).toBe(0)
    expect(raceExp('op', 1, 0.1)).toBe(66)
  })

  it('prices promotions and limit breaks in tickets', () => {
    expect(umaPromotionCost(1)).toBe(25)
    expect(umaPromotionCost(10)).toBe(250)
    expect([1, 2, 3, 4].map(cardLimitBreakCost).reduce((a, b) => a + b)).toBe(200)
  })

  it('caps only the daily grant', () => {
    expect(grantDailyTickets(480, 1)).toBe(500)
    expect(grantDailyTickets(520, 3)).toBe(520)
    expect(grantDailyTickets(0, 20)).toBe(500)
  })
})

describe('cards', () => {
  it('levels 5 per limit break up to 25', () => {
    expect(cardLevelCap(0)).toBe(5)
    expect(cardLevelCap(4)).toBe(25)
  })

  it('makes newer, higher-LB cards stronger', () => {
    const base = cardEffectValue('trainingBonus', { era: 1, limitBreak: 0, level: 1 })
    const late = cardEffectValue('trainingBonus', { era: 11, limitBreak: 4, level: 25 })
    expect(base).toBeCloseTo(0.05)
    expect(late).toBeCloseTo(0.05 * 1.8 * 1.5 * 1.08)
  })
})
