// Spark Rival Circuit's player-facing tuning and private-content contract
// (docs/design/minigames.md#spark-match--rival-circuit, D169–D172, D187).

import { GRADES, STRATEGIES, type Grade, type Strategy } from './types'

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
export const SPARK_RIVAL_STYLE_ATTACK = 52
export const SPARK_RIVAL_NEUTRAL_ATTACK = 40
export const SPARK_RIVAL_RECOVERY_PER_ORB = 3
export const SPARK_RIVAL_MATCH_SHAPE_PER_ORB = 0.25
export const SPARK_RIVAL_COMBO_PER_MATCH = 0.2

export const SPARK_RIVAL_SHIFT_CHARGE = 9
export const SPARK_RIVAL_SHIFT_DELAY = 3
export const SPARK_RIVAL_SHIFT_CHARGE_CAP = 15

export const SPARK_RIVAL_RECIPE_COUNTDOWNS = {
  'rush-pressure': 3,
  'tracker-guard': 3,
  'surge-convert': 2,
  'finisher-delay': 3,
  'adaptive-duel': 3,
  'circuit-boss': 2,
} as const
export const SPARK_RIVAL_RECIPES = Object.keys(SPARK_RIVAL_RECIPE_COUNTDOWNS) as SparkRivalRecipeId[]
export type SparkRivalRecipeId = keyof typeof SPARK_RIVAL_RECIPE_COUNTDOWNS

export const SPARK_RIVAL_STYLE_RECIPES: Readonly<Partial<Record<SparkRivalRecipeId, Strategy>>> = {
  'rush-pressure': 'front',
  'tracker-guard': 'pace',
  'surge-convert': 'late',
  'finisher-delay': 'end',
}

/** Stable strategy tie-break used by import, fallback selection, and the battle engine. */
export function sparkRivalBestStrategy(aptitudes: Readonly<Record<Strategy, Grade>>): Strategy {
  return STRATEGIES.reduce((best, strategy) =>
    GRADES.indexOf(aptitudes[strategy]) < GRADES.indexOf(aptitudes[best]) ? strategy : best,
  'front')
}

export interface SparkRivalRosterCandidate {
  templateId: string
  charaId: string
  strategy: Strategy
  recipe: SparkRivalRecipeId
}

export interface SparkRivalScenarioRoster {
  id: string
  tier: number
  ordinary: SparkRivalRosterCandidate[]
  bosses: SparkRivalRosterCandidate[]
}

export interface SparkRivalContentPackV1 {
  version: '1'
  items: SparkRivalScenarioRoster[]
}

const SPARK_RIVAL_CANDIDATE_LIMIT = 64
const CONTENT_ID = /^[A-Za-z0-9_.:-]{1,120}$/

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort()
  const sorted = [...expected].sort()
  return keys.length === sorted.length && keys.every((key, index) => key === sorted[index])
}

function parseRosterCandidate(value: unknown, tier: number, role: 'ordinary' | 'bosses', index: number): SparkRivalRosterCandidate {
  const location = `tier ${tier} ${role}[${index}]`
  if (!record(value) || !exactKeys(value, ['charaId', 'recipe', 'strategy', 'templateId'])) {
    throw new Error(`Invalid Spark rival candidate shape at ${location}`)
  }
  if (typeof value.templateId !== 'string' || !CONTENT_ID.test(value.templateId) ||
    typeof value.charaId !== 'string' || !CONTENT_ID.test(value.charaId)) {
    throw new Error(`Invalid Spark rival candidate identity at ${location}`)
  }
  if (!STRATEGIES.includes(value.strategy as Strategy) || !SPARK_RIVAL_RECIPES.includes(value.recipe as SparkRivalRecipeId)) {
    throw new Error(`Invalid Spark rival candidate behavior at ${location}`)
  }
  const recipe = value.recipe as SparkRivalRecipeId
  if ((role === 'bosses') !== (recipe === 'circuit-boss')) {
    throw new Error(`Invalid Spark rival recipe role at ${location}`)
  }
  const requiredStrategy = SPARK_RIVAL_STYLE_RECIPES[recipe]
  if (requiredStrategy && value.strategy !== requiredStrategy) {
    throw new Error(`Invalid Spark rival recipe strategy at ${location}`)
  }
  return {
    templateId: value.templateId,
    charaId: value.charaId,
    strategy: value.strategy as Strategy,
    recipe,
  }
}

function parseRosterCandidates(value: unknown, tier: number, role: 'ordinary' | 'bosses'): SparkRivalRosterCandidate[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > SPARK_RIVAL_CANDIDATE_LIMIT) {
    throw new Error(`Invalid Spark rival ${role} count at tier ${tier}`)
  }
  const candidates = value.map((candidate, index) => parseRosterCandidate(candidate, tier, role, index))
  if (new Set(candidates.map((candidate) => candidate.templateId)).size !== candidates.length) {
    throw new Error(`Duplicate Spark rival template in ${role} at tier ${tier}`)
  }
  return [...candidates].sort((left, right) =>
    left.charaId.localeCompare(right.charaId) || left.templateId.localeCompare(right.templateId))
}

function parseScenarioRoster(value: unknown, index: number): SparkRivalScenarioRoster {
  if (!record(value) || !exactKeys(value, ['bosses', 'id', 'ordinary', 'tier']) ||
    !Number.isSafeInteger(value.tier) || (value.tier as number) < 1 || (value.tier as number) > 14) {
    throw new Error(`Invalid Spark rival scenario at index ${index}`)
  }
  const tier = value.tier as number
  if (value.id !== `tier:${tier}`) throw new Error(`Invalid Spark rival scenario id at tier ${tier}`)
  const ordinary = parseRosterCandidates(value.ordinary, tier, 'ordinary')
  const bosses = parseRosterCandidates(value.bosses, tier, 'bosses')
  const ordinaryCharacters = new Set(ordinary.map((candidate) => candidate.charaId))
  const bossCharacters = new Set(bosses.map((candidate) => candidate.charaId))
  const allCharacters = new Set([...ordinaryCharacters, ...bossCharacters])
  if (ordinaryCharacters.size < 4 || bossCharacters.size < 2 || allCharacters.size < 4) {
    throw new Error(`Insufficient Spark rival character coverage at tier ${tier}`)
  }
  return { id: `tier:${tier}`, tier, ordinary, bosses }
}

/** Strict parser shared by publishing and the authenticated runtime. Errors never include private ids or names. */
export function parseSparkRivalContentPack(value: unknown): SparkRivalContentPackV1 {
  if (!record(value) || !exactKeys(value, ['items', 'version']) || value.version !== '1' || !Array.isArray(value.items) || value.items.length !== 14) {
    throw new Error('Invalid Spark rival content pack header')
  }
  const items = value.items.map(parseScenarioRoster).sort((left, right) => left.tier - right.tier)
  if (new Set(items.map((item) => item.tier)).size !== 14 || items.some((item, index) => item.tier !== index + 1)) {
    throw new Error('Spark rival content pack must cover tiers 1 through 14 exactly once')
  }
  return { version: '1', items }
}
export const SPARK_RIVAL_PHASE_RESOLVE_PERCENT = 50
export const SPARK_RIVAL_GUARD_REDUCTION = 0.5
export const SPARK_RIVAL_GUARD_COMBOS = 4
export const SPARK_RIVAL_CONVERT_MAXIMUM = 4
export const SPARK_RIVAL_PRESSURE_MULTIPLIER = 1.25

export const SPARK_RIVAL_WAVE_RESOLVE = [500, 650, 900] as const
export const SPARK_RIVAL_WAVE_PRESSURE = [40, 50, 62] as const
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
  return 1 + 0.003 * (scenarioTier - 1) + 0.005 * (trainingLevel - 1)
}
