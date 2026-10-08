// Authored map and release scaling (docs/design/uma-puzzles.md §§4,6,11; D290).
export const PUZZLE_CAMPAIGN_VERSION = 1 as const
export const PUZZLE_CHAPTER_LEVELS = 10
export const PUZZLE_REGULAR_LEVELS = [[1, 2, 3], [4, 5, 6], [7, 8, 9, 9]] as const
export const PUZZLE_GUARDIAN_LEVELS = [3, 6, 9] as const
export const PUZZLE_CHAMPION_LEVEL = 10
export const PUZZLE_MAP_BRANCHES = 2
export const PUZZLE_MAP_NODES = 28
export const PUZZLE_DROP_COUNTS = { ordinary: 3, guardian: 4, champion: 12 } as const
export const PUZZLE_PRIMARY_WINS = 14
export const PUZZLE_PRIMARY_GROSS = 54
export const PUZZLE_FULL_GROSS = 132
export const PUZZLE_DARK_VARIANTS = ['pace', 'late'] as const
export const PUZZLE_FOE_ROLES = ['striker', 'healer', 'guard', 'converter', 'ward', 'champion'] as const
export type PuzzleFoeRole = typeof PUZZLE_FOE_ROLES[number]
// Fixed invented reference, not a real catalogue row and NEVER derived from an entering party.
export const PUZZLE_FOE_REFERENCE = { speed: 110, stamina: 100, power: 110, guts: 110, wit: 110, growth: 0.1, partySize: 5 } as const
export const PUZZLE_FOE_SCALING = {
  ordinary: { hpAtk: 6, damageHp: 0.30, opening: 1, attackCountdown: 2 },
  guardian: { hpAtk: 32, damageHp: 0.66, opening: 1, attackCountdown: 2 },
  champion: { hpAtk: 48, damageHp: 0.58, opening: 2, attackCountdown: 2 },
} as const
export const PUZZLE_FOE_ROLE_MULTIPLIERS = {
  striker: { hp: 1, damage: 1 }, healer: { hp: 0.8, damage: 0.8 }, guard: { hp: 1.1, damage: 0.95 },
  converter: { hp: 0.9, damage: 0.9 }, ward: { hp: 1, damage: 0.9 }, champion: { hp: 1, damage: 1 },
} as const
export const PUZZLE_FOE_MECHANICS = { defenseBase: 5, defensePerLevel: 2, healHp: 0.15,
  supportCountdown: 1, guardCombos: 3, wardCombos: 4, wardDuration: 1, converterCount: 4,
  rageMultiplier: 1.4, rageCountdown: 1 } as const
// [rare side, first basic, second basic], canonical six combinations in each chapter.
export const PUZZLE_SQUAD_MIXES = [
  ['light', 'fire', 'water'], ['dark', 'fire', 'wood'], ['light', 'water', 'wood'],
  ['dark', 'fire', 'water'], ['light', 'fire', 'wood'], ['dark', 'water', 'wood'],
] as const
