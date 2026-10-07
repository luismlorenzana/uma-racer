// Initial battle candidates and transport limits (docs/design/uma-puzzles.md §5; D270).
export const PUZZLE_ENGINE_VERSION = 1 as const
export const PUZZLE_BOARD_WIDTH = 6
export const PUZZLE_BOARD_HEIGHT = 5
export const PUZZLE_BOARD_SIZE = PUZZLE_BOARD_WIDTH * PUZZLE_BOARD_HEIGHT
export const PUZZLE_PARTY_SIZE = 5
export const PUZZLE_TURN_LIMIT = 30
export const PUZZLE_ACTION_LIMIT = PUZZLE_TURN_LIMIT * (1 + PUZZLE_PARTY_SIZE) + 1
export const PUZZLE_PATH_LIMIT = 256
export const PUZZLE_MOVEMENT_MS = 7000
export const PUZZLE_CASCADE_LIMIT = 64
export const PUZZLE_OPENING_ATTEMPTS = 2048
export const PUZZLE_RNG_REJECTION_ATTEMPTS = 32
export const PUZZLE_MATCH_MIN = 3
export const PUZZLE_MASS_MIN = 5
export const PUZZLE_SHAPE_PER_ORB = 0.25
export const PUZZLE_COMBO_PER_GROUP = 0.25
export const PUZZLE_MATCHUP = { advantage: 2, disadvantage: 0.5, neutral: 1 } as const
export const PUZZLE_DAMAGE_FLOOR = 0.25
export const PUZZLE_SKILL_RULES = { frontCount: 4, frontCharge: 5, paceShield: 0.35, paceCharge: 6,
  lateCount: 6, lateCharge: 6, endDelay: 1, endCharge: 7 } as const
export const PUZZLE_LEADER_RULES = { comboThreshold: 4, comboAtk: 1.2, durableHp: 1.15, recoveryRcv: 1.2 } as const
export const PUZZLE_PATTERN_RULES = { fourLevel: 5, fourCount: 4, rowLevel: 10, multiplier: 1.25 } as const
export const PUZZLE_ENEMY_GUARD = 0.5
export const PUZZLE_RAGE_THRESHOLD = 50
// Bounded authored enemy transport, not a lifetime PL cap.
export const PUZZLE_BATTLE_LIMITS = { enemies: 5, intents: 4, countdown: 30, statusDrags: 3,
  enemyValue: 1_000_000_000, converterCount: 4, comboThreshold: 30, rageMultiplier: 4 } as const
