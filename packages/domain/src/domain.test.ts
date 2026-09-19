// Guards the numbers in docs/design against drift. If a doc changes, change the matching expectation here.
import { describe, expect, it } from 'vitest'
import {
  addTrainingExp,
  applyCappedGain,
  BASE_HINT_CHANCE,
  BASE_SPECIALTY_CHANCE,
  baselineSpCap,
  baselineStatCap,
  capMult,
  cardEffectValue,
  cardLevelCap,
  cardLimitBreakCost,
  CARD_UNIQUE_BONUS_MULTIPLIER,
  distanceCategory,
  deckSlotCount,
  eraOf,
  fieldForm,
  grantDailyTickets,
  isGateLevel,
  levelsIntoScenario,
  npcRaceStats,
  raceExp,
  progressionFieldSize,
  CHALLENGE_MARGIN_LENGTHS,
  scenarioGoalRequestedGrade,
  GATE_SHARD_REWARD,
  UMA_LEVEL_TICKET_REWARD,
  UMA_SHARDS_PER_COUPON,
  spCap,
  statCap,
  tierOfLevel,
  trainingExpForTurn,
  trainingGains,
  RANDOM_FACILITY_CHANCE,
  SKILL_ACTIVATION_MIN,
  SKILL_ACTIVATION_WIT_DIVISOR,
  COURSE_WIDTH,
  FRONT_BLOCK_DISTANCE,
  FRONT_BLOCK_LANE_FACTOR,
  FRONT_LEAD_METERS,
  FRONT_OVERTAKE_COEF,
  FRONT_OVERTAKE_EXIT_METERS,
  FRONT_SPEED_UP_COEF,
  HORSE_LANE,
  LANE_ACCELERATION,
  MAX_LANE_SPEED,
  NEAR_DISTANCE,
  NEAR_LANES,
  OVERLAP_DISTANCE,
  OVERLAP_LANES,
  PACE_UP_EX_COEF,
  PACE_DOWN_MIDDLE_COEF,
  PACE_DOWN_OPENING_COEF,
  PACE_UP_COEF,
  POSITION_KEEP_CHECK_SECONDS,
  POSITION_KEEP_COOLDOWN_SECONDS,
  POSITION_KEEP_LAST_SECTION,
  SIDE_BLOCK_DISTANCE,
  SIDE_BLOCK_LANES,
  SOLO_FRONT_LEAD_METERS,
  VISIBLE_DISTANCE,
  umaPromotionCost,
  yourForm,
  OVERFLOW_BANK_LEVELS,
  PROMOTION_BONUS_PER_STAT,
  compileRaceSkill,
  grandparentWhitePickCap,
  BADGE_THRESHOLDS,
  BADGE_TIER_POINTS,
  BADGE_ONE_OFF_POINTS,
  GOAL_RIBBON_POINTS,
  HONORS_POINTS,
  TITLE_POINTS,
  PRESTIGE_FRAME_THRESHOLDS,
  FLAIR_SERIES_REQUIRED_FAMILIES,
  TRAINER_ACHIEVEMENT_THRESHOLDS,
} from './index'

describe('flair', () => {
  it('pins catalog-v1 thresholds, points, frames, and private series cardinalities', () => {
    expect(BADGE_THRESHOLDS).toEqual({
      mastery: [1, 10, 25, 50, 100],
      gradeChampion: [1, 5, 10, 20, 40],
      g1Champion: [1, 3, 7, 15, 30],
      starts: [10, 50, 100, 250, 500],
      unbeaten: [3, 5, 8, 12, 20],
      specialist: [1, 5, 10, 20, 40],
      breadth: [1, 3, 5, 10, 20],
      venue: [1, 3, 7, 15, 30],
      backField: [1, 5, 15, 30, 60],
      statPeak: [600, 900, 1_200, 1_600, 2_000],
      balanced: [500, 800, 1_100, 1_500, 1_900],
      level: [10, 25, 50, 75, 100],
      diligent: [50, 250, 1_000, 3_000, 10_000],
      friendship: [10, 50, 200, 500, 1_000],
      lifetimeSkills: [5, 15, 30, 60, 100],
      scenarioSkills: [5, 10, 15, 20, 25],
      destiny: [3, 10, 25, 50, 100],
      legacy: [1, 5, 10, 25, 50],
      dynasty: [1, 3, 5, 10, 20],
    })
    expect(BADGE_TIER_POINTS).toEqual([1, 2, 4, 8, 16])
    expect([BADGE_ONE_OFF_POINTS, GOAL_RIBBON_POINTS, HONORS_POINTS, TITLE_POINTS]).toEqual([4, 1, 4, 10])
    expect(PRESTIGE_FRAME_THRESHOLDS).toEqual([0, 5, 15, 40, 80, 160, 300])
    expect(FLAIR_SERIES_REQUIRED_FAMILIES).toEqual({
      'triple-crown': 3,
      'triple-tiara': 3,
      'spring-triple-crown': 3,
      'autumn-triple-crown': 3,
      'grand-prix': 2,
      'sprint-crown': 2,
      'mile-crown': 2,
      'dirt-crown': 2,
    })
    expect(TRAINER_ACHIEVEMENT_THRESHOLDS).toEqual({
      stableMaster: [30, 40, 60, 90],
      cardCollector: [10, 25, 50, 100],
      maxedOut: [1, 5, 15, 40, 100],
      couponClipper: [1, 5, 15, 40, 100],
      stableWins: [10, 100, 500, 1_500, 5_000],
      stableG1s: [1, 10, 50, 150, 500],
      statBadges: [5, 25, 75, 200, 500],
      badgeHoarder: [25, 150, 500, 1_500, 5_000],
      titleHolders: [1, 5, 10, 20],
      graduations: [5, 25, 75, 200, 500],
      veteranStable: [1, 3, 10, 25, 50],
      legendaryStable: [1, 3, 5, 10, 25],
      heirs: [5, 25, 100, 250, 1_000],
      stableGoals: [5, 25, 100, 300, 1_000],
      honorsCollector: [1, 10, 30, 100, 300],
      familyTree: [2, 5, 10, 25, 50],
    })
  })
})

describe('scenarios', () => {
  it('pins inherited unique strength and the grandparent half-pool rule', () => {
    const inherited = compileRaceSkill({
      id: 'synthetic-gene', kind: 'inherited-unique', name: 'Synthetic', description: '', costSp: 100, iconId: null,
      inheritedSkillId: null, normalSkillId: null, conditions: [{ precondition: null, condition: 'always==1', baseTime: 10_000, cooldown: 0, effects: [{ type: 22, value: 10_000 }] }],
    })
    expect(inherited.groups[0]?.effects[0]?.amount).toBe(0.5)
    expect(grandparentWhitePickCap(5)).toBe(3)
  })

  it('pins the Uma shard exchange rate', () => {
    expect(UMA_SHARDS_PER_COUPON).toBe(5)
  })

  it('uses the original 1200 → 2000 cap ladder and keeps rising after #11', () => {
    expect(baselineStatCap(1)).toBe(1200)
    expect(baselineStatCap(6)).toBe(1600)
    expect(baselineStatCap(11)).toBe(2000)
    expect(baselineStatCap(12)).toBe(2080)
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
    expect(statCap(1, 1)).toBe(960)
    expect(statCap(1, 10)).toBe(1200)
    expect(statCap(2, 8)).toBe(1223)
    expect(spCap(1, 10)).toBe(300)
  })

  it('reaches TL10 in at most 25 trainings', () => {
    let state = { trainingLevel: 1, exp: 0 }
    for (let i = 0; i < 25; i++) state = addTrainingExp(state.trainingLevel, state.exp, trainingExpForTurn(false))
    expect(state.trainingLevel).toBe(10)
  })

  it('pins the Training deal chances and early deck slots', () => {
    expect(BASE_SPECIALTY_CHANCE).toBe(0.35)
    expect(RANDOM_FACILITY_CHANCE).toBe(0.7)
    expect(BASE_HINT_CHANCE).toBe(0.2)
    expect([1, 2, 3, 11].map(deckSlotCount)).toEqual([4, 5, 6, 6])
    expect(CARD_UNIQUE_BONUS_MULTIPLIER).toBe(0.25)
  })

  it('matches the worked example in training.md', () => {
    const gains = trainingGains('speed', { speed: 0.2 }, [
      { type: 'speed', trainingBonus: 0.1, friendshipBonus: 0.25, flatBonus: { speed: 6, sp: 2 } },
      { type: 'power', trainingBonus: 0.05, friendshipBonus: 0.2, flatBonus: {} },
    ])
    expect(gains).toEqual({ speed: 125, power: 38, sp: 13 })
  })

  it('never reduces a stat that already sits above the cap', () => {
    expect(applyCappedGain(1200, 50, 1024)).toBe(1200)
    expect(applyCappedGain(1000, 50, 1024)).toBe(1024)
  })

  it('halves the part of a gain above 1200, except for skill points', () => {
    expect(applyCappedGain(1190, 30, 1280)).toBe(1210)
    expect(applyCappedGain(1250, 40, 1280)).toBe(1270)
    expect(applyCappedGain(1190, 30, 1280, false)).toBe(1220)
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
    expect(npc.speed).toBeCloseTo(960)
    expect(npc.stamina).toBeCloseTo(864)
  })
})

describe('race skills', () => {
  it('pins the researched Wit activation curve', () => {
    expect(SKILL_ACTIVATION_MIN).toBe(0.2)
    expect(SKILL_ACTIVATION_WIT_DIVISOR).toBe(90)
  })

  it('pins every documented R3 pack coefficient', () => {
    expect({
      courseWidth: COURSE_WIDTH,
      horseLane: HORSE_LANE,
      lastSection: POSITION_KEEP_LAST_SECTION,
      checkSeconds: POSITION_KEEP_CHECK_SECONDS,
      cooldownSeconds: POSITION_KEEP_COOLDOWN_SECONDS,
      frontSpeedUp: FRONT_SPEED_UP_COEF,
      frontOvertake: FRONT_OVERTAKE_COEF,
      paceUp: PACE_UP_COEF,
      paceUpEx: PACE_UP_EX_COEF,
      paceDownOpening: PACE_DOWN_OPENING_COEF,
      paceDownMiddle: PACE_DOWN_MIDDLE_COEF,
      frontLeadMeters: FRONT_LEAD_METERS,
      soloFrontLeadMeters: SOLO_FRONT_LEAD_METERS,
      frontOvertakeExitMeters: FRONT_OVERTAKE_EXIT_METERS,
      frontBlockDistance: FRONT_BLOCK_DISTANCE,
      frontBlockLaneFactor: FRONT_BLOCK_LANE_FACTOR,
      sideBlockDistance: SIDE_BLOCK_DISTANCE,
      sideBlockLanes: SIDE_BLOCK_LANES,
      overlapDistance: OVERLAP_DISTANCE,
      overlapLanes: OVERLAP_LANES,
      nearDistance: NEAR_DISTANCE,
      nearLanes: NEAR_LANES,
      visibleDistance: VISIBLE_DISTANCE,
      laneAcceleration: LANE_ACCELERATION,
      maxLaneSpeed: MAX_LANE_SPEED,
    }).toEqual({
      courseWidth: 11.25,
      horseLane: 0.625,
      lastSection: 9,
      checkSeconds: 2,
      cooldownSeconds: 1,
      frontSpeedUp: 1.04,
      frontOvertake: 1.05,
      paceUp: 1.04,
      paceUpEx: 2,
      paceDownOpening: 0.915,
      paceDownMiddle: 0.945,
      frontLeadMeters: 4.5,
      soloFrontLeadMeters: 12.5,
      frontOvertakeExitMeters: 10,
      frontBlockDistance: 2,
      frontBlockLaneFactor: 0.75,
      sideBlockDistance: 1.05,
      sideBlockLanes: 2,
      overlapDistance: 0.4,
      overlapLanes: 0.4,
      nearDistance: 3,
      nearLanes: 3,
      visibleDistance: 20,
      laneAcceleration: 0.03,
      maxLaneSpeed: 0.6,
    })
  })
})

describe('progression and economy', () => {
  it('pays race EXP by grade and placement', () => {
    expect(raceExp('g1', 1)).toBe(150)
    expect(raceExp('g1', 2)).toBe(38)
    expect(raceExp('g1', 4)).toBe(0)
    expect(raceExp('op', 1, 0.1)).toBe(66)
    expect(UMA_LEVEL_TICKET_REWARD).toBe(5)
    expect(GATE_SHARD_REWARD).toBe(1)
    expect(progressionFieldSize({ fieldSize: 5 })).toBe(8)
    expect(progressionFieldSize({ fieldSize: 18 })).toBe(18)
  })

  it('prices promotions and limit breaks in tickets', () => {
    expect(umaPromotionCost(1)).toBe(25)
    expect(umaPromotionCost(10)).toBe(250)
    expect(PROMOTION_BONUS_PER_STAT).toBe(10)
    expect(OVERFLOW_BANK_LEVELS).toBe(1)
    expect([1, 2, 3, 4].map(cardLimitBreakCost).reduce((a, b) => a + b)).toBe(200)
  })

  it('pins scenario-goal grade escalation and the Challenge margin', () => {
    expect([1, 2, 3, 4].map((tier) => scenarioGoalRequestedGrade(tier, 'aptitude'))).toEqual(['pre-op', 'g3', 'g2', 'g1'])
    expect(scenarioGoalRequestedGrade(1, 'identity')).toBe('op')
    expect(CHALLENGE_MARGIN_LENGTHS).toBe(5)
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
