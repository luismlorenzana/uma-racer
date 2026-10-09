// Guards the numbers in docs/design against drift. If a doc changes, change the matching expectation here.
import { describe, expect, it } from 'vitest'
import * as Kitchen from './farm/kitchen'
import {
  PUZZLE_RULES_VERSION, PUZZLE_SCHEMA_VERSION, PUZZLE_STAT_GROWTH, PUZZLE_STAT_BASE,
  PUZZLE_EXP_BASE, PUZZLE_EXP_STEP, PUZZLE_EXP_WEIGHTS, PUZZLE_EXP_WEIGHTS_V1, PUZZLE_RELATIVE_EXP,
  PUZZLE_CL_MAX, PUZZLE_EXCHANGE_RATIO, PUZZLE_LEGACY_EXP_PER_TICKET, PUZZLE_PARSE_LIMITS,
  PUZZLE_ENGINE_VERSION, PUZZLE_BOARD_WIDTH, PUZZLE_BOARD_HEIGHT, PUZZLE_BOARD_SIZE, PUZZLE_PARTY_SIZE, PUZZLE_PARTY_IDS,
  PUZZLE_TURN_LIMIT, PUZZLE_ACTION_LIMIT, PUZZLE_PATH_LIMIT, PUZZLE_MOVEMENT_MS, PUZZLE_CASCADE_LIMIT,
  PUZZLE_OPENING_ATTEMPTS, PUZZLE_RNG_REJECTION_ATTEMPTS, PUZZLE_MATCH_MIN, PUZZLE_MASS_MIN,
  PUZZLE_SHAPE_PER_ORB, PUZZLE_COMBO_PER_GROUP, PUZZLE_MATCHUP, PUZZLE_DAMAGE_FLOOR,
  PUZZLE_SKILL_RULES, PUZZLE_LEADER_RULES, PUZZLE_PATTERN_RULES, PUZZLE_ENEMY_GUARD, PUZZLE_RAGE_THRESHOLD,
  PUZZLE_BATTLE_LIMITS, PUZZLE_BOT_SEARCH, PUZZLE_ORBS, PUZZLE_ACTIVES, PUZZLE_LEADERS, PUZZLE_PATTERNS, PUZZLE_ENEMY_RECIPES,
  PUZZLE_CAMPAIGN_VERSION, PUZZLE_CHAPTER_LEVELS, PUZZLE_REGULAR_LEVELS, PUZZLE_GUARDIAN_LEVELS, PUZZLE_CHAMPION_LEVEL,
  PUZZLE_MAP_NODES, PUZZLE_DROP_COUNTS, PUZZLE_FULL_GROSS, PUZZLE_CAMPAIGN_V1, PUZZLE_RETIRED_NODES, PUZZLE_SECTION_NAMES,
  PUZZLE_DARK_VARIANTS, PUZZLE_FOE_ROLES, PUZZLE_FOE_REFERENCE, PUZZLE_FOE_SCALING, PUZZLE_FOE_ROLE_MULTIPLIERS,
  PUZZLE_FOE_MECHANICS, PUZZLE_SQUAD_MIXES, PUZZLE_ALLOCATION_RECIPIENT_LIMIT, PUZZLE_CONTENT_LIMITS, PUZZLE_SYNC_LIMITS,
  PUZZLE_PRESERVATION_LIMITS, CONSTELLATION_SAVE_SCHEMA_VERSION,
} from './minigames/uma-puzzles'

import {
  addTrainingExp,
  APTITUDE_REFS,
  CARD_FOCUS_MIN_SHARE,
  CARD_FOCUS_MIN_SKILLS,
  LINEAGE_SLOT_COUNT,
  INSPIRATION_GOLDS_PER_SLOT,
  INSPIRATION_ADVANCE_SLOTS,
  INSPIRATION_ADVANCE_SKILLS,
  INSPIRATION_UNLOCK_COST,
  GRANDPARENT_SP_MULTIPLIER,
  RPG_SLOT_TOKEN_REWARD,
  RPG_SKILL_TOKEN_BUDGET,
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
  STAT_NODE_POOL,
  SPARK_MATCH_TICKET_COST,
  FRIENDSHIP_TRAINING_TICKET_COST,
  DAILY_TICKETS,
  TICKET_STORAGE_CAP,
  redenominateTickets,
  MAX_STARS,
  CARD_SAVE_SCHEMA_VERSION,
  migrateCardSaveToCurrent,
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
  RPG_TREE_POINTS_PER_LEVEL,
  RPG_TREE_POINT_MAX_LEVEL,
  RPG_TREE_POINTS_PER_DEPTH,
  RPG_DEPTH_GATES,
  RPG_ACTIVE_SLOT_GATES,
  RPG_MAX_LEGACY_SLOTS,
  RPG_SAVE_SCHEMA_VERSION,
  RPG_PARTY_SIZE,
  RPG_PRESET_COUNT,
  RPG_MAX_TREE_NODES,
  RPG_MAX_SELECTED_PATH,
  RPG_MAX_ENEMY_KIT_CHARS,
  RPG_MAX_GROUP_OPERATIONS,
  RPG_SKILL_POWER, RPG_SKILL_MP, RPG_AOE_SHARE, RPG_RANDOM_BONUS, RPG_VARIANTS_PER_TREE, RPG_NODES, RPG_CLASS_WEAPONS,
  RPG_CLASS_STATS, RPG_FOE_TUNING, rpgClassTrees, rpgTreeNodes,
  BATTLE_WEAK, BATTLE_UNBROKEN_FACTOR, BATTLE_ULTIMA, BATTLE_DEFENSE_SHARE, BATTLE_GUARD_FACTOR, BATTLE_MAX_ROUNDS,
  BATTLE_STATUS_TURNS, BATTLE_STATUS_STACK_CAP, BATTLE_BURN_PERCENT, BATTLE_STATUS_STEP, BATTLE_FOE_STATUS_STEP,
  BATTLE_BARRIER_PERCENT, BATTLE_BARRIER_CAP, BATTLE_REGEN_PERCENT, BATTLE_CURE_PERCENT, BATTLE_CLARITY_PERCENT,
  BATTLE_REBIRTH_PERCENT, BATTLE_LIMIT_MAX, BATTLE_LIMIT_CHARGE, BATTLE_LIMIT_POWER,
  rpgExpToNext,
  projectRpgStats,
  rpgTreePointsEarned,
  rpgActiveSlots,
} from './index'

describe('Farm kitchen additive baseline — D304', () => {
  it('pins additive protocol bounds without raising shared economic sync limits', () => {
    expect(Kitchen.FARM_SYNC_LIMITS).toEqual({ groups: 16, bytes: 262144, documents: 200, documentBytes: 131072, receiptBytes: 921600, responseBytes: 14745600 })
    expect(Kitchen.FARM_CUTOVER_LIMITS).toEqual({ outfits: 4096, page: 32, freezeBytes: 8388608, archiveBytes: 67108864 })
    expect(Kitchen.FARM_CUTOVER_GENERATION).toBe('farm-kitchen-v1')
  })
  it('pins versions, jobs, gates, stations, Energy and the bounded map without changing live Farm', () => {
    expect([Kitchen.FARM_KITCHEN_RULES_VERSION, Kitchen.FARM_KITCHEN_SCHEMA_VERSION,
      Kitchen.FARM_KITCHEN_ROW_VERSION, Kitchen.FARM_EXTRA_TEMPLATE_VERSION]).toEqual([1, 3, 1, 1])
    expect([Kitchen.FARM_KITCHEN_EXP_PER_LEVEL, Kitchen.FARM_KITCHEN_EXP_PER_JOB,
      Kitchen.FARM_KITCHEN_JOB_MS, Kitchen.FARM_KITCHEN_RAW_YIELD, Kitchen.FARM_KITCHEN_PROCESS_BATCH,
      Kitchen.FARM_KITCHEN_MAX_MEALS, Kitchen.FARM_KITCHEN_ENERGY_MS, Kitchen.FARM_KITCHEN_ENERGY_GRANT])
      .toEqual([24, 12, 21_600_000, 6, 6, 4, 1_800_000, 50])
    expect([Kitchen.FARM_KITCHEN_SCENARIOS_PER_BLOCK, Kitchen.FARM_KITCHEN_LEVELS_PER_BLOCK,
      Kitchen.FARM_KITCHEN_LEVELS_PER_FLAVOUR, Kitchen.FARM_KITCHEN_PROCESS_LEVEL, Kitchen.FARM_KITCHEN_COOK_LEVEL,
      Kitchen.FARM_KITCHEN_STATIONS_PER_DISTRICT, Kitchen.FARM_KITCHEN_MAX_INPUTS]).toEqual([5, 50, 10, 6, 9, 6, 10])
    expect([Kitchen.FARM_EXTRA_PURE_PER_STAT, Kitchen.FARM_EXTRA_SUNS, Kitchen.FARM_EXTRA_NODE_TOTAL,
      Kitchen.FARM_EXTRA_INITIAL_CAPACITY, Kitchen.FARM_EXTRA_CAPACITY_STEP, Kitchen.FARM_EXTRA_NODE_COUNT]).toEqual([10, 5, 20, 18, 2, 65])
    expect(Kitchen.FARM_KITCHEN_ENERGY_ID).toBe('farm:energy')
    expect(Kitchen.FARM_DISTRICTS).toEqual(['garden', 'orchard', 'barn', 'workshop', 'kitchen'])
    expect(Kitchen.FARM_STATION_IDS).toHaveLength(30)
    expect(Kitchen.FARM_RAW_FAMILIES).toEqual(['vegetable', 'fruit', 'milk', 'egg', 'chicken', 'beef', 'pork'])
    expect(Kitchen.FARM_PROCESSES.map(p => p.id)).toEqual(['canned-vegetable', 'vegetable-juice', 'canned-fruit',
      'fruit-juice', 'cheese', 'mayonnaise', 'chicken-stock', 'beef-stock', 'cured-ham'])
    expect(SCENARIOS.map(s => Kitchen.farmExtraCapacity(s.tier))).toEqual([18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44])
    expect(Kitchen.FARM_KITCHEN_CATALOGUE.foods).toHaveLength(1_169)
    expect(STAT_NODE_POOL).toBe(240)
  })
})

describe('Global card stars — D255', () => {
  it('pins the independent schema, maximum-not-sum policy and unchanged three-star cap', () => {
    expect(CARD_SAVE_SCHEMA_VERSION).toBe(1)
    expect(MAX_STARS).toBe(3)
    expect(migrateCardSaveToCurrent({ templateId: 'pin-card', bonds: { '1': 2, '14': 1 }, maxCouponGranted: true }))
      .toEqual({ schemaVersion: 1, templateId: 'pin-card', stars: 2, maxCouponGranted: true })
  })
})

describe('Global Uma RPG — engine v5 pins (D279, D281, D310)', () => {
  it('pins damage, breaks and the protection contract', () => {
    expect([BATTLE_WEAK, BATTLE_UNBROKEN_FACTOR, BATTLE_ULTIMA, BATTLE_DEFENSE_SHARE, BATTLE_GUARD_FACTOR, BATTLE_MAX_ROUNDS])
      .toEqual([1.3, 0.5, 1.2, 0.5, 0.5, 40])
    expect([BATTLE_STATUS_TURNS, BATTLE_STATUS_STACK_CAP, BATTLE_BURN_PERCENT, BATTLE_STATUS_STEP, BATTLE_FOE_STATUS_STEP,
      BATTLE_BARRIER_PERCENT, BATTLE_BARRIER_CAP, BATTLE_REGEN_PERCENT, BATTLE_CURE_PERCENT, BATTLE_CLARITY_PERCENT,
      BATTLE_REBIRTH_PERCENT]).toEqual([2, 3, 0.04, 0.1, 0.15, 0.08, 0.3, 0.04, 0.1, 0.04, 0.1])
    expect([RPG_FOE_TUNING.regularShield, RPG_FOE_TUNING.lateRegularShield, RPG_FOE_TUNING.subBossShield, RPG_FOE_TUNING.bossShield])
      .toEqual([2, 3, 6, 8])
  })
  it('pins the Limit Break: a 12-point bar, 1 an attack and 2 a skill (×2 for one action), about twice a turn (D311)', () => {
    expect([BATTLE_LIMIT_MAX, BATTLE_LIMIT_CHARGE, BATTLE_LIMIT_POWER]).toEqual([12, { attack: 1, skill: 2 }, { turn: 2, mage: 2.4, cleric: 1.5, triad: 2 }])
  })
  it('pins the skill rules and the 396-node catalog (D280, D310)', () => {
    expect([RPG_SKILL_POWER, RPG_SKILL_MP, RPG_AOE_SHARE, RPG_RANDOM_BONUS, RPG_VARIANTS_PER_TREE])
      .toEqual([[1.6, 2.2, 2.9, 3.7, 4.6], [10, 14, 18, 22, 26], 0.55, 1.05, 3])
    // Twelve trees (the retired Short Sword follow-ups still read) × three branches × (five core nodes + three forks of two).
    expect(RPG_NODES.length).toBe(396)
  })
})

describe('Global Uma RPG — save wire pins (D282, D310)', () => {
  it('bounds synced account rows and grouped commands', () => {
    expect([RPG_SAVE_SCHEMA_VERSION, RPG_PARTY_SIZE, RPG_PRESET_COUNT, RPG_MAX_TREE_NODES,
      RPG_MAX_SELECTED_PATH, RPG_MAX_ENEMY_KIT_CHARS, RPG_MAX_GROUP_OPERATIONS])
      .toEqual([4, 5, 10, 40, 64, 16_384, 20])
  })
})

describe('Global Uma RPG — progression pins (D264, D277, D280)', () => {
  it('keeps a repeatable 50-level tier with a linear 25,480 EXP climb', () => {
    expect(RPG_TIER_MAX_LEVEL).toBe(50)
    expect([rpgExpToNext(1), rpgExpToNext(10), rpgExpToNext(49)]).toEqual([136, 280, 904])
    expect(Array.from({ length: 49 }, (_, index) => rpgExpToNext(index + 1))
      .reduce((sum, value) => sum + value, 0)).toBe(25_480)
  })

  it('pins the frozen-stat conversion and each class lean', () => {
    const baseStats = { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 }
    const growthRates = { speed: 0.2, stamina: 0.1, power: 0, guts: 0, wit: 0.3 }
    expect(projectRpgStats({ baseStats, growthRates, tier: 1, level: 1, classId: 'summoner' }))
      .toMatchObject({ speed: 20, atk: 20, matk: 20, stamina: 18, power: 16, guts: 14, wit: 12, hp: 240, mp: 42, mdef: 14 })
    expect(projectRpgStats({ baseStats, growthRates, tier: 1, level: 1, classId: 'mage' })).toMatchObject({ hp: 216, atk: 18, matk: 23, mp: 49 })
    expect(projectRpgStats({ baseStats, growthRates, tier: 1, level: 1, classId: 'brawler' })).toMatchObject({ hp: 276, atk: 22, matk: 18, mp: 30 })
    expect(projectRpgStats({ baseStats, growthRates, tier: 1, level: 1, classId: 'spellblade' })).toMatchObject({ hp: 240, atk: 21, matk: 21, mp: 38 })
    expect(RPG_CLASS_WEAPONS.mage).toEqual([['mage-staff', 'arcane-staff']])
    expect(RPG_CLASS_WEAPONS.spellblade).toEqual([['short-sword']])
    expect(projectRpgStats({ baseStats, growthRates, tier: 1, level: 50, classId: 'summoner' }).speed).toBe(108)
    expect(projectRpgStats({ baseStats, growthRates, tier: 2, level: 1, classId: 'summoner' }).speed).toBe(110)
    expect(RPG_CLASS_STATS.cleric).toEqual({ hp: 1, atk: 0.8, matk: 1, pdef: 1, mdef: 1.15, mp: 1.3 })
  })

  it('pins 115 points, every core node by Lv40 and three variants per tree by Lv45', () => {
    expect([RPG_TREE_POINTS_PER_LEVEL, RPG_TREE_POINT_MAX_LEVEL, RPG_TREE_POINTS_PER_DEPTH, RPG_MAX_LEGACY_SLOTS]).toEqual([2, 45, 5, 2])
    expect(RPG_DEPTH_GATES).toEqual([1, 10, 20, 30, 40])
    expect(RPG_ACTIVE_SLOT_GATES).toEqual([10, 15, 20, 25, 30, 35, 40])
    expect([rpgTreePointsEarned(1), rpgTreePointsEarned(40), rpgTreePointsEarned(45), rpgTreePointsEarned(50)]).toEqual([7, 105, 115, 115])
    for (const [classId, sets] of Object.entries(RPG_CLASS_WEAPONS)) {
      for (const weapons of sets) {
        const nodes = rpgClassTrees(classId as keyof typeof RPG_CLASS_WEAPONS, weapons).flatMap(rpgTreeNodes)
        const core = nodes.filter((n) => n.variant === null).reduce((sum, n) => sum + n.cost, 0)
        expect(core).toBe(90)
        // The dearest legal variants: one per fork, three per tree, at depth 4 then 3 → 4 + 4 + 4 per tree.
        expect(core + 2 * 12).toBeLessThanOrEqual(rpgTreePointsEarned(45))
      }
    }
    expect([rpgActiveSlots(1), rpgActiveSlots(10), rpgActiveSlots(39), rpgActiveSlots(40), rpgActiveSlots(50)]).toEqual([3, 4, 9, 10, 10])
  })
})

describe('Inspiration reward budget (D250)', () => {
  it('pins the one-time advance per scenario, not per distance preset (D256)', () => {
    expect([INSPIRATION_ADVANCE_SLOTS, INSPIRATION_ADVANCE_SKILLS]).toEqual([6, 12])
  })
  it('funds five full six-slot/twelve-gold builds per scenario', () => {
    expect(INSPIRATION_GOLDS_PER_SLOT).toBe(2)
    expect(INSPIRATION_UNLOCK_COST).toBe(1)
    expect(GRANDPARENT_SP_MULTIPLIER).toBe(2)
    expect(RPG_SLOT_TOKEN_REWARD).toBe(30)
    expect(RPG_SKILL_TOKEN_BUDGET).toBe(60)
    expect(RPG_SLOT_TOKEN_REWARD).toBe(5 * LINEAGE_SLOT_COUNT)
    expect(RPG_SKILL_TOKEN_BUDGET).toBe(5 * LINEAGE_SLOT_COUNT * INSPIRATION_GOLDS_PER_SLOT)
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

describe('Uma Puzzles initial candidates, not balance closure (D269)', () => {
  it('pins ten independent parties without changing five-member battle size (D293)', () => {
    expect(PUZZLE_PARTY_IDS).toEqual(Array.from({ length: 10 }, (_, i) => `puzzle-party-${i + 1}`))
    expect(PUZZLE_PARTY_SIZE).toBe(5)
  })
  it('pins dormant preservation bounds and the explicit zero-EXP storage schema', () => {
    expect(CONSTELLATION_SAVE_SCHEMA_VERSION).toBe(16)
    expect(PUZZLE_PRESERVATION_LIMITS).toEqual({ units: 4096, pageUnits: 32, batchUnits: 16, documentBytes: 262144, freezeBytes: 8388608 })
  })
  it('pins atomic transport limits, not gameplay progression caps (D273)', () => {
    expect(PUZZLE_SYNC_LIMITS).toEqual({ groups: 16, bytes: 262144, documents: 200, receiptBytes: 921600 })
  })
  it('pins bounded private content and alpha-safe presentation, not combat numbers', () => {
    expect(PUZZLE_CONTENT_LIMITS).toEqual({ members: 512, packs: 64, pages: 32, frame: 256, gutter: 2, page: 2048,
      jsonBytes: 2_097_152, imageBytes: 8_388_608, inputPixels: 16_777_216, timeoutMs: 10_000, attempts: 2, cachedPacks: 4, cachedPages: 8 })
  })
  it('pins the independent stat and EXP formulas', () => {
    expect(PUZZLE_RULES_VERSION).toBe(1)
    expect(PUZZLE_SCHEMA_VERSION).toBe(1)
    expect(PUZZLE_STAT_GROWTH).toEqual({ atk: 12, hp: 36, rcv: 4, guard: 6, resilience: 6 })
    expect(PUZZLE_STAT_BASE).toEqual({ atk: 1, hp: 4, rcv: 0.5, guardDivisor: 20, resilienceDivisor: 20 })
    expect([PUZZLE_EXP_BASE, PUZZLE_EXP_STEP]).toEqual([100, 10])
    expect(PUZZLE_EXP_WEIGHTS).toEqual({ ordinary: 0.28, guardian: 0.8, champion: 0.5 }) // D301 full-clear pacing.
    expect(PUZZLE_EXP_WEIGHTS_V1).toEqual({ ordinary: 0.5, guardian: 1, champion: 1.5 }) // D271, frozen v1 fights.
    expect(PUZZLE_RELATIVE_EXP).toEqual({ min: 0.25, max: 2, perLevel: 0.1 })
  })
  it('pins material value, preserved legacy value and distinct work bounds', () => {
    expect(PUZZLE_CL_MAX).toBe(10)
    expect(PUZZLE_EXCHANGE_RATIO).toBe(2)
    expect(PUZZLE_LEGACY_EXP_PER_TICKET).toBe(1250)
    expect(PUZZLE_PARSE_LIMITS).toEqual({ id: 120, scenarios: 256, units: 4096, levelPage: 256 })
  })
})

describe('Uma Puzzles battle v1 initial candidates and transport (D270)', () => {
  it('pins board, action and deterministic work limits', () => {
    expect(PUZZLE_ENGINE_VERSION).toBe(1)
    expect([PUZZLE_BOARD_WIDTH, PUZZLE_BOARD_HEIGHT, PUZZLE_BOARD_SIZE, PUZZLE_PARTY_SIZE]).toEqual([6, 5, 30, 5])
    expect([PUZZLE_TURN_LIMIT, PUZZLE_ACTION_LIMIT, PUZZLE_PATH_LIMIT, PUZZLE_MOVEMENT_MS]).toEqual([30, 181, 256, 7000])
    expect([PUZZLE_CASCADE_LIMIT, PUZZLE_OPENING_ATTEMPTS, PUZZLE_RNG_REJECTION_ATTEMPTS]).toEqual([64, 2048, 32])
    expect(PUZZLE_ORBS).toEqual(['fire', 'water', 'wood', 'light', 'dark', 'heart'])
    expect(PUZZLE_BOT_SEARCH).toEqual({ depth: 6, width: 8 })
    expect(PUZZLE_BATTLE_LIMITS).toEqual({ enemies: 5, intents: 4, countdown: 30, statusDrags: 3,
      enemyValue: 1_000_000_000, converterCount: 4, comboThreshold: 30, rageMultiplier: 4 })
  })
  it('pins combat, finite skill recipes and unlocks without claiming tuned production balance', () => {
    expect([PUZZLE_MATCH_MIN, PUZZLE_MASS_MIN, PUZZLE_SHAPE_PER_ORB, PUZZLE_COMBO_PER_GROUP, PUZZLE_DAMAGE_FLOOR]).toEqual([3, 5, 0.25, 0.25, 0.25])
    expect(PUZZLE_MATCHUP).toEqual({ advantage: 2, disadvantage: 0.5, neutral: 1 })
    expect(PUZZLE_SKILL_RULES).toEqual({ frontCount: 4, frontCharge: 5, paceShield: 0.35, paceCharge: 6,
      lateCount: 6, lateCharge: 6, endDelay: 1, endCharge: 7 })
    expect(PUZZLE_LEADER_RULES).toEqual({ comboThreshold: 4, comboAtk: 1.2, durableHp: 1.15, recoveryRcv: 1.2 })
    expect(PUZZLE_PATTERN_RULES).toEqual({ fourLevel: 5, fourCount: 4, rowLevel: 10, multiplier: 1.25 })
    expect([PUZZLE_ENEMY_GUARD, PUZZLE_RAGE_THRESHOLD]).toEqual([0.5, 50])
    expect(PUZZLE_ACTIVES.map(a => a.id)).toEqual(['puzzle:front-convert', 'puzzle:pace-shield', 'puzzle:late-convert', 'puzzle:end-delay'])
    expect(PUZZLE_LEADERS.map(l => l.id)).toEqual(['puzzle:combo-leader', 'puzzle:durable-leader', 'puzzle:recovery-leader'])
    expect(PUZZLE_PATTERNS.map(p => p.id)).toEqual(['puzzle:four', 'puzzle:row'])
    expect(PUZZLE_ENEMY_RECIPES).toEqual(['puzzle:striker', 'puzzle:ally-healer', 'puzzle:guard', 'puzzle:converter', 'puzzle:combo-ward', 'puzzle:guardian', 'puzzle:champion'])
  })
})

describe('Uma Puzzles campaign coefficients and economy (D271)', () => {
  it('pins generated map bands, vectors, gross budgets and separate report bounds', () => {
    // D301: one line of six stages per section, each closed by its Guardian, then five Champions; a full clear pays 132.
    expect([PUZZLE_CAMPAIGN_VERSION, PUZZLE_CHAPTER_LEVELS, PUZZLE_MAP_NODES]).toEqual([2, 10, 26])
    expect(PUZZLE_SECTION_NAMES).toEqual(['Debut', 'Classic', 'Senior', 'Finals'])
    expect(PUZZLE_REGULAR_LEVELS).toEqual([[1, 1, 2, 2, 3, 3], [4, 4, 5, 5, 6, 6], [7, 7, 8, 8, 9, 9]])
    expect(PUZZLE_GUARDIAN_LEVELS).toEqual([3, 6, 9]); expect(PUZZLE_CHAMPION_LEVEL).toBe(10)
    expect(PUZZLE_DROP_COUNTS).toEqual({ ordinary: 3, guardian: 6, champion: 12 })
    expect(18 * PUZZLE_DROP_COUNTS.ordinary + 3 * PUZZLE_DROP_COUNTS.guardian + 5 * PUZZLE_DROP_COUNTS.champion).toBe(PUZZLE_FULL_GROSS)
    expect(PUZZLE_FULL_GROSS).toBe(132)
    // D271's map, kept for fights frozen under it: 28 nodes, Guardians 4; its tenth pair is retired.
    expect(PUZZLE_CAMPAIGN_V1).toEqual({ regularLevels: [[1, 2, 3], [4, 5, 6], [7, 8, 9, 9]], branches: 2, nodes: 28,
      drops: { ordinary: 3, guardian: 4, champion: 12 } })
    expect(PUZZLE_RETIRED_NODES).toEqual(['o10a', 'o10b'])
    expect(PUZZLE_DARK_VARIANTS).toEqual(['pace', 'late']); expect(PUZZLE_ALLOCATION_RECIPIENT_LIMIT).toBe(6)
    expect(PUZZLE_SQUAD_MIXES).toEqual([['light', 'fire', 'water'], ['dark', 'fire', 'wood'], ['light', 'water', 'wood'],
      ['dark', 'fire', 'water'], ['light', 'fire', 'wood'], ['dark', 'water', 'wood']])
  })
  it('pins fixed invented reference and level/kind/role coefficients, not entering-party scaling', () => {
    expect(PUZZLE_FOE_ROLES).toEqual(['striker', 'healer', 'guard', 'converter', 'ward', 'champion'])
    expect(PUZZLE_FOE_REFERENCE).toEqual({ speed: 110, stamina: 100, power: 110, guts: 110, wit: 110, growth: 0.1, partySize: 5 })
    expect(PUZZLE_FOE_SCALING).toEqual({ ordinary: { hpAtk: 6, damageHp: 0.30, opening: 1, attackCountdown: 2 },
      guardian: { hpAtk: 32, damageHp: 0.66, opening: 1, attackCountdown: 2 },
      champion: { hpAtk: 48, damageHp: 0.58, opening: 2, attackCountdown: 2 } })
    expect(PUZZLE_FOE_ROLE_MULTIPLIERS).toEqual({ striker: { hp: 1, damage: 1 }, healer: { hp: 0.8, damage: 0.8 },
      guard: { hp: 1.1, damage: 0.95 }, converter: { hp: 0.9, damage: 0.9 }, ward: { hp: 1, damage: 0.9 }, champion: { hp: 1, damage: 1 } })
    expect(PUZZLE_FOE_MECHANICS).toEqual({ defenseBase: 5, defensePerLevel: 2, healHp: 0.15, supportCountdown: 1,
      guardCombos: 3, wardCombos: 4, wardDuration: 1, converterCount: 4, rageMultiplier: 1.4, rageCountdown: 1 })
  })
})
