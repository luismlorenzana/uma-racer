// Guards the numbers in docs/design against drift. If a doc changes, change the matching expectation here.
import { describe, expect, it } from 'vitest'
import {
  addTrainingExp,
  APTITUDE_REFS,
  LINEAGE_SLOT_COUNT,
  lineageSteps,
  upgradedGrade,
  trainingExpToNext,
  capProfile,
  capBudget,
  treeBudget,
  nodeValue,
  SPARK_MATCH_TICKET_COST,
  BOND_RECALL_TICKET_COST,
  DAILY_TICKETS,
  TICKET_STORAGE_CAP,
  cardUnlockCost,
  redenominateTickets,
  MAX_STARS,
  cardRaceBonus,
  skillPointCap,
  averageCap,
  MAX_UMA_LEVEL,
  SCENARIOS,
  distanceCategory,
  eraOf,
  GRADE_HANDICAP,
  NPC_PROFILE,
  grantDailyTickets,
  isGateLevel,
  levelsIntoScenario,
  raceExp,
  progressionFieldSize,
  GATE_SHARD_REWARD,
  UMA_LEVEL_TICKET_REWARD,
  UMA_SHARDS_PER_COUPON,
  tierOfLevel,
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
  trainedStat,
  OVERFLOW_BANK_LEVELS,
  PROMOTION_BONUS_PER_STAT,
  compileRaceSkill,
  BADGE_THRESHOLDS,
  BADGE_TIER_POINTS,
  BADGE_ONE_OFF_POINTS,
  GOAL_RIBBON_POINTS,
  HONORS_POINTS,
  TITLE_POINTS,
  PRESTIGE_FRAME_THRESHOLDS,
  FLAIR_SERIES_REQUIRED_LEGS,
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
      balanced: [400, 600, 800, 1_000, 1_200],
      level: [10, 25, 50, 75, 100],
      diligent: [10, 25, 50, 100, 140],
      lifetimeSkills: [5, 15, 30, 60, 100],
      scenarioSkills: [5, 10, 15, 20, 25],
      destiny: [3, 10, 25, 50, 100],
      legacy: [1, 5, 10, 25, 50],
      dynasty: [1, 3, 5, 10, 20],
    })
    expect(BADGE_TIER_POINTS).toEqual([1, 2, 4, 8, 16])
    expect([BADGE_ONE_OFF_POINTS, GOAL_RIBBON_POINTS, HONORS_POINTS, TITLE_POINTS]).toEqual([4, 1, 4, 10])
    expect(PRESTIGE_FRAME_THRESHOLDS).toEqual([0, 5, 15, 40, 80, 160, 300])
    expect(FLAIR_SERIES_REQUIRED_LEGS).toEqual({
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
  })

  it('pins the Uma shard exchange rate', () => {
    expect(UMA_SHARDS_PER_COUPON).toBe(5)
  })

  it('pins the lineage aptitude rule: a perfect F reaches A, a G never does', () => {
    const slots = Array.from({ length: LINEAGE_SLOT_COUNT }, (_, i) => ({
      id: `p${i}`,
      aptitudes: {
        surface: { turf: 'A' as const, dirt: 'C' as const },
        distance: { sprint: 'C' as const, mile: 'C' as const, medium: 'C' as const, long: 'A' as const },
        strategy: { front: 'C' as const, pace: 'C' as const, late: 'C' as const, end: 'C' as const },
      },
    }))
    const long = APTITUDE_REFS.find((ref) => ref.key === 'long')!
    expect(lineageSteps(slots, long)).toBe(5)
    expect(upgradedGrade('F', slots, long)).toBe('A')
    expect(upgradedGrade('G', slots, long)).toBe('B')
  })

  it('pins all 14 JP scenarios, the +80 cap ladder, and the tier-14 SP cap', () => {
    expect(SCENARIOS.map((scenario) => [scenario.tier, scenario.jpRelease])).toEqual([
      [1, '2021-02-24'], [2, '2021-08-30'], [3, '2022-02-24'], [4, '2022-08-24'],
      [5, '2023-02-24'], [6, '2023-08-24'], [7, '2024-02-24'], [8, '2024-06-26'],
      [9, '2024-10-29'], [10, '2025-02-24'], [11, '2025-06-27'], [12, '2025-10-29'],
      [13, '2026-02-24'], [14, '2026-06-29'],
    ])
    expect(MAX_UMA_LEVEL).toBe(140)
    expect(averageCap(1)).toBe(1400)
    expect(averageCap(14)).toBe(1900)
    // D133: grounded at tiers 2–3 (Unity Cup ~2,000–2,500, Trackblazer ~2,800), drafted elsewhere.
    expect(skillPointCap(1)).toBe(2000)
    expect(skillPointCap(3)).toBe(2800)
    expect(skillPointCap(14)).toBe(5000)
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
    expect([
      '2025-10-28', '2025-10-29',
      '2026-02-23', '2026-02-24',
      '2026-06-28', '2026-06-29',
    ].map(eraOf)).toEqual([11, 12, 12, 13, 13, 14])
  })

  it('categorizes distances', () => {
    expect(distanceCategory(1400)).toBe('sprint')
    expect(distanceCategory(1800)).toBe('mile')
    expect(distanceCategory(2400)).toBe('medium')
    expect(distanceCategory(2500)).toBe('long')
  })
})

describe('training levels', () => {
  it('pins the Spark Match target curve', () => {
    expect(trainingExpToNext(1)).toBe(1000)
    expect(trainingExpToNext(9)).toBe(3800)
    expect([1, 2, 3].map(trainingExpToNext)).toEqual([1000, 1350, 1700])
  })

  it('carries surplus over and can cross more than one level in a run', () => {
    expect(addTrainingExp(1, 0, 1200)).toEqual({ trainingLevel: 2, trainingExp: 200, levelsGained: 1 })
    expect(addTrainingExp(1, 0, 2400)).toEqual({ trainingLevel: 3, trainingExp: 50, levelsGained: 2 })
  })

  it('stops accumulating at the maximum', () => {
    expect(addTrainingExp(10, 0, 99_999)).toEqual({ trainingLevel: 10, trainingExp: 0, levelsGained: 0 })
  })

  it('reaches TL10 in roughly ten good runs', () => {
    let state = { trainingLevel: 1, trainingExp: 0, levelsGained: 0 }
    let runs = 0
    while (state.trainingLevel < 10 && runs < 40) {
      state = addTrainingExp(state.trainingLevel, state.trainingExp, 2400)
      runs += 1
    }
    expect(state.trainingLevel).toBe(10)
    expect(runs).toBeLessThanOrEqual(12)
  })

  it('pins the cap profiles and tree budgets from docs/design/scenarios.md', () => {
    expect(capProfile(2).wit).toBe(1800)
    expect(capProfile(3).stamina).toBe(1900)
    expect([1, 2, 3, 4].map(capBudget)).toEqual([7000, 7000, 7000, 7000])
    expect(treeBudget(1)).toBe(4200)
    // D134: card nodes share what the 240-point stat pool leaves of the tree.
    expect([1, 2, 3, 4].map(nodeValue)).toEqual([220, 198, 233, 189])
    expect(skillPointCap(1)).toBe(2000)
  })
})

describe('rivals (D152)', () => {
  it('builds on a typical trained Uma: median base plus a fifth of a realistic set (D159)', () => {
    // Tier 1: 15 of 18 card nodes pay stats (the Friend card's 3 pay SP), at 3★ 84% of 220, plus the 240 stat pool:
    // 3,012 raw points, 602.4 a stat, on a base of 110.
    expect(trainedStat(1)).toBeCloseTo(712.4)
    expect(trainedStat(14)).toBeGreaterThan(trainedStat(1))
  })

  it('handicaps G3 most, then G2, then G1, and the lower grades more still', () => {
    expect(GRADE_HANDICAP).toEqual({ debut: 0.35, maiden: 0.35, 'pre-op': 0.3, op: 0.3, g3: 0.25, g2: 0.15, g1: 0.05 })
  })

  it('shapes what Stamina leaves by distance without shrinking it', () => {
    for (const row of Object.values(NPC_PROFILE)) {
      expect(Object.values(row).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(4)
    }
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
    expect(UMA_LEVEL_TICKET_REWARD).toBe(1)
    expect(GATE_SHARD_REWARD).toBe(1)
    expect(progressionFieldSize({ fieldSize: 5 })).toBe(8)
    expect(progressionFieldSize({ fieldSize: 18 })).toBe(18)
  })

  it('prices every run at one ticket, and unlocks at a fifth of their old price (D148)', () => {
    expect(SPARK_MATCH_TICKET_COST).toBe(1)
    expect(BOND_RECALL_TICKET_COST).toBe(1)
    expect(umaPromotionCost(1)).toBe(5)
    expect(umaPromotionCost(10)).toBe(50)
    expect(cardUnlockCost(1)).toBe(6)
    expect(cardUnlockCost(14)).toBe(19)
  })

  it('grants ten a day and banks five days, capping only the grant', () => {
    expect(DAILY_TICKETS).toBe(10)
    expect(TICKET_STORAGE_CAP).toBe(5 * DAILY_TICKETS)
    expect(grantDailyTickets(45, 1)).toBe(50)
    expect(grantDailyTickets(60, 3)).toBe(60)
    expect(grantDailyTickets(0, 20)).toBe(50)
  })

  it('re-denominates a v6 balance to a fifth, rounding up so no run is lost', () => {
    expect(redenominateTickets(0)).toBe(0)
    expect(redenominateTickets(1)).toBe(1)
    expect(redenominateTickets(444)).toBe(89)
    expect(redenominateTickets(500)).toBe(100)
  })
})

describe('cards', () => {
  const template = (era: number, uniqueRaceBonus = false) => ({
    id: 'c', type: 'speed', era,
    effectProfile: { raceBonus: 1 },
    uniqueEffect: uniqueRaceBonus ? { level: 30, effects: [{ type: 15, value: 5 }] } : null,
  }) as unknown as Parameters<typeof cardRaceBonus>[0]

  it('holds 0★ to 5★ (D147)', () => {
    expect(MAX_STARS).toBe(5)
  })

  it('pays Race Bonus from 1★ on the node curve, reaching the old max-limit-break value at 5★', () => {
    expect(cardRaceBonus(template(1), 0)).toBe(0)
    expect(cardRaceBonus(template(1), 1)).toBeCloseTo(0.03 * 1.5 * 1.08 * 0.68)
    expect(cardRaceBonus(template(1), 5)).toBeCloseTo(0.03 * 1.5 * 1.08)
    expect(cardRaceBonus(template(11), 5)).toBeCloseTo(0.03 * 1.8 * 1.5 * 1.08)
  })

  it('adds the unique bonus at 5★ only', () => {
    expect(cardRaceBonus(template(1, true), 4)).toBeCloseTo(cardRaceBonus(template(1), 4))
    expect(cardRaceBonus(template(1, true), 5)).toBeCloseTo(cardRaceBonus(template(1), 5) * 1.25)
  })
})
