// Guards the numbers in docs/design against drift. If a doc changes, change the matching expectation here.
import { describe, expect, it } from 'vitest'
import {
  addTrainingExp,
  APTITUDE_REFS,
  CARD_FOCUS_MIN_SHARE,
  CARD_FOCUS_MIN_SKILLS,
  LINEAGE_SLOT_COUNT,
  lineageSteps,
  upgradedGrade,
  trainingExpToNext,
  TRAINING_EXP_PER_LEVEL,
  TRAINING_EXP_TO_MAX,
  relevelLegacyTraining,
  depositTrainingExp,
  capProfile,
  capBudget,
  treeBudget,
  nodeValue,
  SPARK_MATCH_TICKET_COST,
  FRIENDSHIP_TRAINING_TICKET_COST,
  DAILY_TICKETS,
  TICKET_STORAGE_CAP,
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
  fieldTrainedStat,
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
  SPARK_RIVAL_BOARD_WIDTH,
  SPARK_RIVAL_BOARD_HEIGHT,
  SPARK_RIVAL_ACTION_LIMIT,
  SPARK_RIVAL_PATH_LIMIT,
  SPARK_RIVAL_CASCADE_LIMIT,
  SPARK_RIVAL_MOVEMENT_MS,
  SPARK_RIVAL_MAX_DRIVE,
  SPARK_RIVAL_TURNS_PER_WAVE,
  SPARK_RIVAL_ADVANTAGE_MULTIPLIER,
  SPARK_RIVAL_RESISTED_MULTIPLIER,
  SPARK_RIVAL_STYLE_ATTACK,
  SPARK_RIVAL_NEUTRAL_ATTACK,
  SPARK_RIVAL_RECOVERY_PER_ORB,
  SPARK_RIVAL_MATCH_SHAPE_PER_ORB,
  SPARK_RIVAL_COMBO_PER_MATCH,
  SPARK_RIVAL_APTITUDE_MULTIPLIERS,
  SPARK_RIVAL_SHIFT_CHARGE,
  SPARK_RIVAL_SHIFT_DELAY,
  SPARK_RIVAL_SHIFT_CHARGE_CAP,
  SPARK_RIVAL_RECIPE_COUNTDOWNS,
  SPARK_RIVAL_PHASE_RESOLVE_PERCENT,
  SPARK_RIVAL_GUARD_REDUCTION,
  SPARK_RIVAL_GUARD_COMBOS,
  SPARK_RIVAL_CONVERT_MAXIMUM,
  SPARK_RIVAL_PRESSURE_MULTIPLIER,
  SPARK_RIVAL_WAVE_RESOLVE,
  SPARK_RIVAL_WAVE_PRESSURE,
  SPARK_RIVAL_WAVE_EXP,
  SPARK_RIVAL_CLEAR_BONUS,
  SPARK_RIVAL_COMBO_BONUS_CAP,
  SPARK_RIVAL_DRIVE_BONUS_CAP,
  SPARK_RIVAL_LOSS_EXP_SHARE,
  sparkRivalDifficulty,
  FARM_BASE_GROWTH_MINUTES,
  FARM_CROP_YIELD,
  FARM_FASTEST_GROWTH_MINUTES,
  FARM_GROWTH_STEP_MINUTES,
  FARM_GROWTH_STEPS,
  FARM_LEVELS_PER_CROP_TIER,
  FARM_PLOT_STEP_FACTOR,
  FARM_PLOTS_PER_SECTION,
  FARM_SECTIONS,
  MAX_FARM_PLOTS,
  FARMING_EXP_PER_LEVEL,
  FARMING_EXP_PER_HARVEST,
  farmPlotRequirement,
  farmingXpToReachLevel,
  FT_EARNING_TARGET_MULT,
  FT_STAGES,
  FT_STRENGTH_PER_STAR,
  TYPICAL_CARD_STARS,
  starNodePct,
  RPG_TIER_MAX_LEVEL,
  RPG_TREE_POINTS_PER_EVEN_LEVEL,
  RPG_SKILL_MAX_LEVEL,
  RPG_DEPTH_GATES,
  RPG_B_MAX_DEPTH,
  RPG_ACTIVE_SLOT_GATES,
  RPG_MAX_LEGACY_SLOTS,
  RPG_SIGNATURE_MULTIPLIER,
  RPG_ADVANTAGE,
  RPG_RESISTANCE,
  RPG_DEFENSE_FACTOR,
  RPG_GUARD_FACTOR,
  RPG_FOLLOW_UP_FACTOR,
  RPG_WEAK_FOLLOW_UP_LIMIT,
  RPG_MAX_ROUNDS,
  RPG_STATUS_TURNS,
  RPG_STATUS_STACK_CAP,
  RPG_BURN_PERCENT,
  RPG_REGEN_PERCENT,
  RPG_MARK_PERCENT,
  RPG_POWER_PERCENT,
  RPG_WARD_PERCENT,
  RPG_SLOW_PERCENT,
  RPG_SKILL_LEVEL_STEP,
  RPG_BASIC_ATTACK_FACTOR,
  RPG_SKILL_DEPTH_STEP,
  RPG_AREA_FACTOR,
  RPG_MULTI_HIT_FACTOR,
  RPG_PHYSICAL_BASE_SHARE,
  RPG_ROLE_HEAL_BASE,
  RPG_ROLE_HEAL_DEPTH_STEP,
  RPG_HYBRID_HEAL_FACTOR,
  RPG_SKILL_MP_BASE,
  RPG_SKILL_MP_PER_DEPTH,
  RPG_SKILL_MP_AREA_ADD,
  RPG_ENEMY_MOVE_DENOMINATOR,
  RPG_WEAPON_POWER,
  RPG_SKILL_CATALOG,
  RPG_BASIC_ACTION_CATALOG,
  RPG_SAVE_SCHEMA_VERSION,
  RPG_PARTY_SIZE,
  RPG_PRESET_COUNT,
  RPG_MAX_TREE_NODES,
  RPG_MAX_SELECTED_PATH,
  RPG_MAX_ENEMY_KIT_CHARS,
  RPG_MAX_GROUP_OPERATIONS,
  rpgExpToNext,
  projectRpgStats,
  rpgTreePointsEarned,
  rpgActiveSlots,
  rpgSignatureMagnitude,
} from './index'

describe('Global Uma RPG — D229 combat pins', () => {
  it('pins the damage, matchup, protection and bounded round contract', () => {
    expect([RPG_ADVANTAGE, RPG_RESISTANCE, RPG_DEFENSE_FACTOR, RPG_GUARD_FACTOR,
      RPG_FOLLOW_UP_FACTOR, RPG_WEAK_FOLLOW_UP_LIMIT, RPG_MAX_ROUNDS])
      .toEqual([1.5, 0.75, 0.45, 0.5, 0.25, 1, 40])
    expect([RPG_STATUS_TURNS, RPG_STATUS_STACK_CAP, RPG_BURN_PERCENT, RPG_REGEN_PERCENT,
      RPG_MARK_PERCENT, RPG_POWER_PERCENT, RPG_WARD_PERCENT, RPG_SLOW_PERCENT])
      .toEqual([2, 3, 0.02, 0.04, 0.1, 0.15, 0.15, 0.15])
  })

  it('pins the six-weapon, five-element, eight-branch catalog math', () => {
    expect(RPG_WEAPON_POWER).toEqual({ greatsword: 1.2, spear: 1.05, 'sword-shield': 0.82,
      'wizard-staff': 1.12, 'cleric-staff': 0.78, tome: 1.15 })
    expect([RPG_SKILL_LEVEL_STEP, RPG_BASIC_ATTACK_FACTOR, RPG_SKILL_DEPTH_STEP,
      RPG_AREA_FACTOR, RPG_MULTI_HIT_FACTOR, RPG_PHYSICAL_BASE_SHARE,
      RPG_ROLE_HEAL_BASE, RPG_ROLE_HEAL_DEPTH_STEP, RPG_HYBRID_HEAL_FACTOR,
      RPG_SKILL_MP_BASE, RPG_SKILL_MP_PER_DEPTH, RPG_SKILL_MP_AREA_ADD,
      RPG_ENEMY_MOVE_DENOMINATOR, RPG_SKILL_CATALOG.length, RPG_BASIC_ACTION_CATALOG.length])
      .toEqual([0.08, 1.5, 0.16, 0.62, 0.58, 0.72, 1.25, 0.2, 0.45, 4, 3, 3, 100, 240, 12])
  })
})

describe('Global Uma RPG — D228 save wire pins', () => {
  it('bounds synced account rows and grouped commands', () => {
    expect([RPG_SAVE_SCHEMA_VERSION, RPG_PARTY_SIZE, RPG_PRESET_COUNT, RPG_MAX_TREE_NODES,
      RPG_MAX_SELECTED_PATH, RPG_MAX_ENEMY_KIT_CHARS, RPG_MAX_GROUP_OPERATIONS])
      .toEqual([1, 5, 5, 25, 64, 16_384, 20])
  })
})

describe('Global Uma RPG — D227 progression pins', () => {
  it('keeps a repeatable 50-level tier with a linear 25,480 EXP climb', () => {
    expect(RPG_TIER_MAX_LEVEL).toBe(50)
    expect([rpgExpToNext(1), rpgExpToNext(10), rpgExpToNext(49)]).toEqual([136, 280, 904])
    expect(Array.from({ length: 49 }, (_, index) => rpgExpToNext(index + 1))
      .reduce((sum, value) => sum + value, 0)).toBe(25_480)
  })

  it('pins the frozen-stat conversion, HP/MP and promotion carry-forward', () => {
    const baseStats = { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 }
    const growthRates = { speed: 0.2, stamina: 0.1, power: 0, guts: 0, wit: 0.3 }
    expect(projectRpgStats({ baseStats, growthRates, tier: 1, level: 1 }))
      .toMatchObject({ speed: 20, atk: 20, matk: 20, stamina: 18, power: 16,
        guts: 14, wit: 12, hp: 240, mp: 56, mdef: 14 })
    expect(projectRpgStats({ baseStats, growthRates, tier: 1, level: 50 }).speed).toBe(108)
    expect(projectRpgStats({ baseStats, growthRates, tier: 2, level: 1 }).speed).toBe(110)
  })

  it('pins the 25-point, five-depth tree and bounded loadout ladder', () => {
    expect([RPG_TREE_POINTS_PER_EVEN_LEVEL, RPG_SKILL_MAX_LEVEL, RPG_B_MAX_DEPTH,
      RPG_MAX_LEGACY_SLOTS, RPG_SIGNATURE_MULTIPLIER]).toEqual([1, 5, 3, 2, 1.1])
    expect(RPG_DEPTH_GATES).toEqual([2, 10, 20, 34, 50])
    expect(RPG_ACTIVE_SLOT_GATES).toEqual([1, 10, 20, 35, 50])
    expect([rpgTreePointsEarned(1), rpgTreePointsEarned(2), rpgTreePointsEarned(50)])
      .toEqual([0, 1, 25])
    expect([rpgActiveSlots(1), rpgActiveSlots(10), rpgActiveSlots(50)]).toEqual([3, 4, 7])
    const profile = { weapon: 'spear' as const, affinities: { fire: 'A' as const, ice: 'B' as const } }
    expect(rpgSignatureMagnitude(105, profile, { kind: 'damage', weapon: 'spear', element: 'fire' }, 'fire'))
      .toBe(116)
    expect(rpgSignatureMagnitude(105, profile, { kind: 'healing', weapon: 'spear', element: 'ice' }, 'fire'))
      .toBe(105)
  })
})

describe('Card focus', () => {
  it('pins the D201 rule: at least two skills and 30% of them', () => {
    expect([CARD_FOCUS_MIN_SKILLS, CARD_FOCUS_MIN_SHARE]).toEqual([2, 0.3])
  })
})

describe('Stable Farm', () => {
  it('pins the D234 field, crop, and progression contract', () => {
    expect([FARM_CROP_YIELD, FARMING_EXP_PER_HARVEST, FARM_PLOTS_PER_SECTION, FARM_LEVELS_PER_CROP_TIER]).toEqual([1, 12, 6, 10])
    expect([FARM_BASE_GROWTH_MINUTES, FARM_GROWTH_STEP_MINUTES, FARM_GROWTH_STEPS, FARM_FASTEST_GROWTH_MINUTES]).toEqual([600, 15, 10, 450])
    expect([FARM_SECTIONS, MAX_FARM_PLOTS]).toEqual([3, 18])
    expect([FARM_PLOT_STEP_FACTOR, FARMING_EXP_PER_LEVEL]).toEqual([2, 24])
    expect([2, 6, 7, 12, 13, 18].map(farmPlotRequirement)).toEqual([3, 111, 183, 1_013, 1_301, 3_571])
    expect([1, 10, 20, 130].map(farmingXpToReachLevel)).toEqual([0, 216, 456, 3_096])
  })
})

describe('Spark Rival Circuit', () => {
  it('pins the D169–D172 and D187 board, touch, combat, and reward contract', () => {
    expect([SPARK_RIVAL_BOARD_WIDTH, SPARK_RIVAL_BOARD_HEIGHT]).toEqual([6, 5])
    expect([SPARK_RIVAL_ACTION_LIMIT, SPARK_RIVAL_PATH_LIMIT, SPARK_RIVAL_CASCADE_LIMIT, SPARK_RIVAL_MOVEMENT_MS]).toEqual([64, 256, 64, 7_000])
    expect([SPARK_RIVAL_MAX_DRIVE, SPARK_RIVAL_TURNS_PER_WAVE]).toEqual([100, 8])
    expect([SPARK_RIVAL_ADVANTAGE_MULTIPLIER, SPARK_RIVAL_RESISTED_MULTIPLIER]).toEqual([1.5, 0.67])
    expect([SPARK_RIVAL_STYLE_ATTACK, SPARK_RIVAL_NEUTRAL_ATTACK, SPARK_RIVAL_RECOVERY_PER_ORB]).toEqual([52, 40, 3])
    expect([SPARK_RIVAL_MATCH_SHAPE_PER_ORB, SPARK_RIVAL_COMBO_PER_MATCH]).toEqual([0.25, 0.2])
    expect(SPARK_RIVAL_APTITUDE_MULTIPLIERS).toEqual({ S: 1.1, A: 1, B: 0.95, C: 0.9, D: 0.85, E: 0.8, F: 0.75, G: 0.7 })
    expect([SPARK_RIVAL_SHIFT_CHARGE, SPARK_RIVAL_SHIFT_DELAY, SPARK_RIVAL_SHIFT_CHARGE_CAP]).toEqual([9, 3, 15])
    expect(SPARK_RIVAL_RECIPE_COUNTDOWNS).toEqual({
      'rush-pressure': 3, 'tracker-guard': 3, 'surge-convert': 2,
      'finisher-delay': 3, 'adaptive-duel': 3, 'circuit-boss': 2,
    })
    expect([SPARK_RIVAL_PHASE_RESOLVE_PERCENT, SPARK_RIVAL_GUARD_REDUCTION, SPARK_RIVAL_GUARD_COMBOS, SPARK_RIVAL_CONVERT_MAXIMUM, SPARK_RIVAL_PRESSURE_MULTIPLIER])
      .toEqual([50, 0.5, 4, 4, 1.25])
    expect(SPARK_RIVAL_WAVE_RESOLVE).toEqual([500, 650, 900])
    expect(SPARK_RIVAL_WAVE_PRESSURE).toEqual([40, 50, 62])
    expect(SPARK_RIVAL_WAVE_EXP).toEqual([500, 650, 800])
    expect([SPARK_RIVAL_CLEAR_BONUS, SPARK_RIVAL_COMBO_BONUS_CAP, SPARK_RIVAL_DRIVE_BONUS_CAP, SPARK_RIVAL_LOSS_EXP_SHARE])
      .toEqual([50, 100, 100, 0.45])
    expect(sparkRivalDifficulty(1, 1)).toBe(1)
    expect(sparkRivalDifficulty(14, 9)).toBeCloseTo(1.079)
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
      diligent: [6, 15, 30, 60, 84],
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
  it('pins inherited unique strength: the inherited record races at its own values (D174)', () => {
    const inherited = compileRaceSkill({
      id: 'synthetic-gene', kind: 'inherited-unique', name: 'Synthetic', description: '', costSp: 100, iconId: null,
      inheritedSkillId: null, normalSkillId: null, conditions: [{ precondition: null, condition: 'always==1', baseTime: 10_000, cooldown: 0, effects: [{ type: 22, value: 10_000 }] }],
    })
    expect(inherited.groups[0]?.effects[0]?.amount).toBe(1)
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

describe('training levels', () => {
  it('pins the linear Training curve: 1,250 a level, 11,250 to TL10, today\'s TL1→7 cost (D211)', () => {
    expect([1, 2, 5, 9].map(trainingExpToNext)).toEqual([1250, 1250, 1250, 1250])
    expect(TRAINING_EXP_PER_LEVEL).toBe(1250)
    expect(TRAINING_EXP_TO_MAX).toBe(11_250)
    expect(1000 + 1350 + 1700 + 2050 + 2400 + 2750).toBe(TRAINING_EXP_TO_MAX)
  })

  it('carries surplus over and can cross more than one level in a run', () => {
    expect(addTrainingExp(1, 0, 1300)).toEqual({ trainingLevel: 2, trainingExp: 50, levelsGained: 1, overflowExp: 0 })
    expect(addTrainingExp(1, 0, 2600)).toEqual({ trainingLevel: 3, trainingExp: 100, levelsGained: 2, overflowExp: 0 })
  })

  it('overflows past TL10 instead of accumulating (D212)', () => {
    expect(addTrainingExp(9, 1000, 2200)).toEqual({ trainingLevel: 10, trainingExp: 0, levelsGained: 1, overflowExp: 1950 })
    expect(addTrainingExp(10, 0, 500)).toEqual({ trainingLevel: 10, trainingExp: 0, levelsGained: 0, overflowExp: 500 })
  })

  it('reaches TL10 in about six good runs', () => {
    let state = { trainingLevel: 1, trainingExp: 0 }
    let runs = 0
    while (state.trainingLevel < 10 && runs < 40) {
      state = addTrainingExp(state.trainingLevel, state.trainingExp, 2200)
      runs += 1
    }
    expect(state.trainingLevel).toBe(10)
    expect(runs).toBe(6)
  })

  it('re-levels a unit once through its total earned EXP, never demoting it (D211)', () => {
    expect(relevelLegacyTraining(1, 600)).toEqual({ trainingLevel: 1, trainingExp: 600, surplusExp: 0 })
    expect(relevelLegacyTraining(2, 0)).toEqual({ trainingLevel: 2, trainingExp: 0, surplusExp: 0 })
    expect(relevelLegacyTraining(3, 1000)).toEqual({ trainingLevel: 3, trainingExp: 850, surplusExp: 0 })
    expect(relevelLegacyTraining(6, 0)).toEqual({ trainingLevel: 7, trainingExp: 1000, surplusExp: 0 })
    expect(relevelLegacyTraining(7, 0)).toEqual({ trainingLevel: 10, trainingExp: 0, surplusExp: 0 })
    expect(relevelLegacyTraining(9, 3799)).toEqual({ trainingLevel: 10, trainingExp: 0, surplusExp: 10_349 })
    expect(relevelLegacyTraining(10, 0)).toEqual({ trainingLevel: 10, trainingExp: 0, surplusExp: 10_350 })
  })

  it('converts every full level in the bank into one Level-Up Ticket (D212)', () => {
    expect(depositTrainingExp(0, 0)).toEqual({ bank: 0, tickets: 0 })
    expect(depositTrainingExp(0, 1249)).toEqual({ bank: 1249, tickets: 0 })
    expect(depositTrainingExp(1249, 1)).toEqual({ bank: 0, tickets: 1 })
    expect(depositTrainingExp(850, 62_100 - 850)).toEqual({ bank: 850, tickets: 49 })
  })

  it('pins the cap profiles and tree budgets from docs/design/scenarios.md', () => {
    expect(capProfile(2).stamina).toBe(1300)
    expect(capProfile(3).power).toBe(1350)
    expect([1, 2, 3, 4].map(capBudget)).toEqual([6000, 6250, 6500, 6750])
    expect(treeBudget(1)).toBe(3606)
    // D134: card nodes share what the 240-point stat pool leaves of the tree.
    expect([1, 2, 3, 4].map(nodeValue)).toEqual([187, 176, 215, 181])
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
    expect(UMA_LEVEL_TICKET_REWARD).toBe(1)
    expect(GATE_SHARD_REWARD).toBe(1)
    expect(progressionFieldSize({ fieldSize: 5 })).toBe(8)
    expect(progressionFieldSize({ fieldSize: 18 })).toBe(18)
  })

  it('prices every run at one ticket, and scenario unlocks at a fifth of their old price (D148); cards take coupons only (D198)', () => {
    expect(SPARK_MATCH_TICKET_COST).toBe(1)
    expect(FRIENDSHIP_TRAINING_TICKET_COST).toBe(1)
    expect(umaPromotionCost(1)).toBe(5)
    expect(umaPromotionCost(10)).toBe(50)
  })

  it('grants fifteen a day and banks four days, capping only the grant', () => {
    expect(DAILY_TICKETS).toBe(15)
    expect(TICKET_STORAGE_CAP).toBe(4 * DAILY_TICKETS)
    expect(grantDailyTickets(45, 1)).toBe(60)
    expect(grantDailyTickets(70, 3)).toBe(70)
    expect(grantDailyTickets(0, 20)).toBe(60)
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

  it('holds 0★ to 3★ (D200)', () => {
    expect(MAX_STARS).toBe(3)
  })

  it('earns 1★ · 2★ · 3★ in runs of one · two · three stages, the old 1★ · 3★ · 5★ runs, and keeps rivals at 84% a node (D200)', () => {
    expect(FT_STAGES).toEqual({ 1: 1, 2: 2, 3: 3 })
    expect(FT_EARNING_TARGET_MULT).toEqual({ 1: 1, 2: 1.18, 3: 1.12 })
    expect(1 + FT_STRENGTH_PER_STAR * MAX_STARS).toBeCloseTo(1.5)
    expect(starNodePct(TYPICAL_CARD_STARS)).toBe(84)
  })

  it('pays Race Bonus from 1★ on the node curve, reaching the old max-limit-break value at 3★', () => {
    expect(cardRaceBonus(template(1), 0)).toBe(0)
    expect(cardRaceBonus(template(1), 1)).toBeCloseTo(0.03 * 1.5 * 1.08 * 0.68)
    expect(cardRaceBonus(template(1), 2)).toBeCloseTo(0.03 * 1.5 * 1.08 * 0.84)
    expect(cardRaceBonus(template(1), 3)).toBeCloseTo(0.03 * 1.5 * 1.08)
    expect(cardRaceBonus(template(11), 3)).toBeCloseTo(0.03 * 1.8 * 1.5 * 1.08)
  })

  it('adds the unique bonus at 3★ only', () => {
    expect(cardRaceBonus(template(1, true), 2)).toBeCloseTo(cardRaceBonus(template(1), 2))
    expect(cardRaceBonus(template(1, true), 3)).toBeCloseTo(cardRaceBonus(template(1), 3) * 1.25)
  })
})
