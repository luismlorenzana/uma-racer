// Guards the numbers in docs/design against drift. If a doc changes, change the matching expectation here.
import { describe, expect, it } from 'vitest'
import {
  APTITUDE_REFS,
  CARD_FOCUS_MIN_SHARE,
  CARD_FOCUS_MIN_SKILLS,
  LINEAGE_SLOT_COUNT,
  INSPIRATION_GOLDS_PER_SLOT,
  GRANDPARENT_SP_MULTIPLIER,
  lineageSteps,
  upgradedGrade,
  capProfile,
  capBudget,
  treeBudget,
  nodeValue,
  STAT_NODE_POOL,
  HISTORICAL_CARD_NORMALIZATION,
  cardRaceBonus,
  skillPointCap,
  averageCap,
  MAX_UMA_LEVEL,
  SCENARIOS,
  distanceCategory,
  eraOf,
  GRADE_HANDICAP,
  NPC_PROFILE,
  isGateLevel,
  levelsIntoScenario,
  raceExp,
  progressionFieldSize,
  GATE_SHARD_REWARD,
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
  trainedStat,
  fieldTrainedStat,
  compileRaceSkill,
  BADGE_THRESHOLDS,
  BADGE_TIER_POINTS,
  BADGE_ONE_OFF_POINTS,
  FLAIR_HALL_OF_FAME_SCENARIO,
  FLAIR_PROMOTION_SCENARIOS,
  HALL_OF_FAME_POINTS,
  GOAL_RIBBON_POINTS,
  HONORS_POINTS,
  TITLE_POINTS,
  PRESTIGE_FRAME_THRESHOLDS,
  FLAIR_SERIES_REQUIRED_LEGS,
  TRAINER_ACHIEVEMENT_THRESHOLDS,
  TYPICAL_CARD_STARS,
  starNodePct,
} from './index'
import { UMA_SHARDS_PER_TICKET } from './rework/tiers'

describe('Inspiration (D250)', () => {
  it('pins two golds a slot and the doubled grandparent SP', () => {
    expect(INSPIRATION_GOLDS_PER_SLOT).toBe(2)
    expect(GRANDPARENT_SP_MULTIPLIER).toBe(2)
  })
})

describe('Card focus', () => {
  it('pins the D201 rule: at least two skills and 30% of them', () => {
    expect([CARD_FOCUS_MIN_SKILLS, CARD_FOCUS_MIN_SHARE]).toEqual([2, 0.3])
  })
})

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
      cardPartners: [10, 25, 50, 100, 200],
      promotions: [1, 5, 15, 30, 50],
      hallOfFame: [1, 3, 10, 25, 50],
    })
    // The tier awards (04 §9): the promoted badges are ordinary one-offs; the Hall of Fame is worth 16.
    expect(HALL_OF_FAME_POINTS).toBe(16)
    expect([FLAIR_PROMOTION_SCENARIOS, FLAIR_HALL_OF_FAME_SCENARIO]).toEqual([{ 2: 5, 3: 10 }, 14])
  })
})

describe('scenarios', () => {
  it('pins inherited unique strength: the inherited record races at its own values (D174)', () => {
    const inherited = compileRaceSkill({
      id: 'synthetic-gene', kind: 'inherited-unique', name: 'Synthetic', description: '', costSp: 100, iconId: null,
      inheritedSkillId: null, normalSkillId: null, conditions: [{ precondition: null, condition: 'always==1', baseTime: 10_000, cooldown: 0, effects: [{ type: 22, value: 10_000 }] }],
    })
    expect(inherited.groups[0]?.effects[0]?.amount).toBe(1)
  })

  it('pins the Uma shard exchange rate', () => {
    expect(UMA_SHARDS_PER_TICKET).toBe(5)
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

  it('pins all 14 JP scenarios, D244\'s +250 budget ladder, and the tier-14 SP cap', () => {
    expect(SCENARIOS.map((scenario) => [scenario.tier, scenario.jpRelease])).toEqual([
      [1, '2021-02-24'], [2, '2021-08-30'], [3, '2022-02-24'], [4, '2022-08-24'],
      [5, '2023-02-24'], [6, '2023-08-24'], [7, '2024-02-24'], [8, '2024-06-26'],
      [9, '2024-10-29'], [10, '2025-02-24'], [11, '2025-06-27'], [12, '2025-10-29'],
      [13, '2026-02-24'], [14, '2026-06-29'],
    ])
    expect(MAX_UMA_LEVEL).toBe(140)
    expect(averageCap(1)).toBe(1200)
    expect(averageCap(14)).toBe(1850)
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

describe('trees', () => {
  it('pins the cap profiles and tree budgets from docs/design/scenarios.md', () => {
    expect(capProfile(2).stamina).toBe(1300)
    expect(capProfile(3).power).toBe(1350)
    expect([1, 2, 3, 4].map(capBudget)).toEqual([6000, 6250, 6500, 6750])
    expect(treeBudget(1)).toBe(3606)
    // D134: card nodes share what the 240-point stat pool leaves of the tree.
    expect([1, 2, 3, 4].map(nodeValue)).toEqual([187, 176, 215, 181])
    expect(STAT_NODE_POOL).toBe(240)
    expect(HISTORICAL_CARD_NORMALIZATION).toBe(240)
    expect(skillPointCap(1)).toBe(2000)
  })
})

describe('rivals (D152)', () => {
  it('builds on a typical trained Uma: median base plus a fifth of a realistic set (D159) and its typical buff (D165)', () => {
    // D244: 15 stat-paying nodes × 187 × 84% + 240 = 2,596.2;
    // Foundation's typical 4% makes 2,700.048, 540.0096 a stat, on a base of 110.
    expect(trainedStat(1)).toBeCloseTo(650.0096)
    expect(trainedStat(14)).toBeGreaterThan(trainedStat(1))
  })

  it('never builds an earlier scenario\'s field above a later one\'s (D191)', () => {
    // D244 raises each budget by 250. D191 still smooths card-count/buff wobbles via the later-tier minimum.
    expect([1, 2, 3, 4, 5].map((tier) => Math.round(fieldTrainedStat(tier)))).toEqual([650, 650, 684, 688, 689])
    expect(fieldTrainedStat(9)).toBeCloseTo(trainedStat(10))
    expect(fieldTrainedStat(14)).toBe(trainedStat(14))
    for (let tier = 2; tier <= 14; tier += 1) expect(fieldTrainedStat(tier)).toBeGreaterThanOrEqual(fieldTrainedStat(tier - 1))
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
    expect(GATE_SHARD_REWARD).toBe(1)
    expect(progressionFieldSize({ fieldSize: 5 })).toBe(8)
    expect(progressionFieldSize({ fieldSize: 18 })).toBe(18)
  })
})

describe('cards', () => {
  const template = (era: number, uniqueRaceBonus = false) => ({
    id: 'c', type: 'speed', era,
    effectProfile: { raceBonus: 1 },
    uniqueEffect: uniqueRaceBonus ? { level: 30, effects: [{ type: 15, value: 5 }] } : null,
  }) as unknown as Parameters<typeof cardRaceBonus>[0]

  it('keeps rivals at 84% a node (D200)', () => {
    expect(starNodePct(TYPICAL_CARD_STARS)).toBe(84)
  })

  it('pays the old max-limit-break Race Bonus (D329)', () => {
    expect(cardRaceBonus(template(1))).toBeCloseTo(0.03 * 1.5 * 1.08)
    expect(cardRaceBonus(template(11))).toBeCloseTo(0.03 * 1.8 * 1.5 * 1.08)
  })

  it('adds the unique bonus', () => {
    expect(cardRaceBonus(template(1, true))).toBeCloseTo(cardRaceBonus(template(1)) * 1.25)
  })
})
