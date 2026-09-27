// Spark Rival Circuit's player-facing tuning contract (docs/design/minigames.md#spark-match--rival-circuit, D169–D172).

export const SPARK_RIVAL_BOARD_WIDTH = 6
export const SPARK_RIVAL_BOARD_HEIGHT = 5
export const SPARK_RIVAL_BOARD_SIZE = SPARK_RIVAL_BOARD_WIDTH * SPARK_RIVAL_BOARD_HEIGHT
export const SPARK_RIVAL_PATH_LIMIT = 256
export const SPARK_RIVAL_ACTION_LIMIT = 64
export const SPARK_RIVAL_CASCADE_LIMIT = 64
export const SPARK_RIVAL_MOVEMENT_MS = 7_000
export const SPARK_RIVAL_MAX_DRIVE = 100
export const SPARK_RIVAL_TURNS_PER_WAVE = 8

export const SPARK_RIVAL_ADVANTAGE_MULTIPLIER = 1.5
export const SPARK_RIVAL_RESISTED_MULTIPLIER = 0.67
export const SPARK_RIVAL_STYLE_ATTACK = 40
export const SPARK_RIVAL_NEUTRAL_ATTACK = 30
export const SPARK_RIVAL_RECOVERY_PER_ORB = 6
export const SPARK_RIVAL_MATCH_SHAPE_PER_ORB = 0.25
export const SPARK_RIVAL_COMBO_PER_MATCH = 0.2

export const SPARK_RIVAL_SHIFT_CHARGE = 9
export const SPARK_RIVAL_SHIFT_DELAY = 3
export const SPARK_RIVAL_SHIFT_CHARGE_CAP = 15

export const SPARK_RIVAL_RECIPE_COUNTDOWNS = {
  'rush-pressure': 2,
  'tracker-guard': 3,
  'surge-convert': 2,
  'finisher-delay': 3,
  'adaptive-duel': 2,
  'circuit-boss': 2,
} as const
export const SPARK_RIVAL_PHASE_RESOLVE_PERCENT = 50
export const SPARK_RIVAL_GUARD_REDUCTION = 0.5
export const SPARK_RIVAL_GUARD_COMBOS = 4
export const SPARK_RIVAL_CONVERT_MAXIMUM = 4
export const SPARK_RIVAL_PRESSURE_MULTIPLIER = 1.5

export const SPARK_RIVAL_WAVE_RESOLVE = [500, 650, 900] as const
export const SPARK_RIVAL_WAVE_PRESSURE = [12, 16, 24] as const
export const SPARK_RIVAL_WAVE_EXP = [500, 650, 800] as const
export const SPARK_RIVAL_CLEAR_BONUS = 50
export const SPARK_RIVAL_COMBO_BONUS_CAP = 100
export const SPARK_RIVAL_DRIVE_BONUS_CAP = 100
export const SPARK_RIVAL_LOSS_EXP_SHARE = 0.45

export const SPARK_RIVAL_APTITUDE_MULTIPLIERS = {
  S: 1.1,
  A: 1,
  B: 0.95,
  C: 0.9,
  D: 0.85,
  E: 0.8,
  F: 0.75,
  G: 0.7,
} as const

/** Tier and Training Level scaling shared by Resolve and Pressure. */
export function sparkRivalDifficulty(scenarioTier: number, trainingLevel: number): number {
  return 1 + 0.01 * (scenarioTier - 1) + 0.015 * (trainingLevel - 1)
}
