// Data-only Spark Rival Circuit contract (docs/design/minigames.md#spark-match--rival-circuit, D169–D172).
import {
  GRADES,
  SPARK_RIVAL_ACTION_LIMIT,
  SPARK_RIVAL_BOARD_HEIGHT,
  SPARK_RIVAL_BOARD_WIDTH,
  SPARK_RIVAL_MOVEMENT_MS,
  SPARK_RIVAL_PATH_LIMIT,
  STRATEGIES,
  type Grade,
  type Strategy,
} from '@racer/domain'

export const SPARK_ORBS = ['front', 'pace', 'late', 'end', 'spark', 'recovery'] as const
export type SparkOrb = (typeof SPARK_ORBS)[number]

export interface SparkCell {
  row: number
  column: number
}

export type SparkRivalAction =
  | { type: 'drag'; path: readonly SparkCell[]; movementMs: number }
  | { type: 'spark-shift' }

export type RivalTurnIntent =
  | { type: 'pressure'; amount: number }
  | { type: 'guard'; reduction: number; comboThreshold: number }
  | { type: 'convert'; source: SparkOrb; target: SparkOrb; maximum: number }
  | { type: 'delay'; amount: number }

export type RivalPhaseIntent =
  | { type: 'enrage'; multiplier: number }
  | { type: 'change-style'; strategy: Strategy }

export interface RivalPhase {
  atResolvePercent: number
  intent: RivalPhaseIntent
}

export interface SparkRivalDefinition {
  id: string
  label: string
  strategy: Strategy
  maxResolve: number
  openingCountdown: number
  intents: readonly RivalTurnIntent[]
  phases: readonly RivalPhase[]
}

export interface SparkRivalEncounterV1 {
  version: 1
  scenarioTier: number
  trainingLevel: number
  trainee: {
    templateId: string
    label: string
    strategyAptitudes: Readonly<Record<Strategy, Grade>>
  }
  waves: readonly [SparkRivalDefinition, SparkRivalDefinition, SparkRivalDefinition]
}

export interface SparkMatchGroup {
  orb: SparkOrb
  indices: readonly number[]
}

export interface SparkCascade {
  index: number
  before: readonly SparkOrb[]
  groups: readonly SparkMatchGroup[]
  cleared: readonly number[]
  after: readonly SparkOrb[]
}

export interface SparkAttackTotal {
  orb: SparkOrb
  orbs: number
  groups: number
  rawAmount: number
  appliedAmount: number
  matchup: 'advantaged' | 'neutral' | 'resisted'
}

export type SparkPresentationStep =
  | { type: 'path'; path: readonly SparkCell[] }
  | { type: 'cascade'; cascade: SparkCascade }
  | { type: 'totals'; combos: number; cleared: Readonly<Record<SparkOrb, number>> }
  | { type: 'attack'; attack: SparkAttackTotal; resolveBefore: number; resolveAfter: number }
  | { type: 'recovery'; amount: number; driveBefore: number; driveAfter: number }
  | { type: 'charge'; amount: number; chargeBefore: number; chargeAfter: number; target: number }
  | { type: 'countdown'; before: number; after: number }
  | { type: 'rival-intent'; intent: RivalTurnIntent | RivalPhaseIntent; driveBefore: number; driveAfter: number; converted: readonly number[]; boardAfter: readonly SparkOrb[] }
  | { type: 'wave-clear'; wave: number }
  | { type: 'run-end'; outcome: SparkRivalOutcome }
  | { type: 'spark-shift'; converted: readonly number[]; strategy: Strategy }

export interface SparkRivalResolution {
  actionIndex: number
  action: SparkRivalAction
  turnConsumed: boolean
  cascades: readonly SparkCascade[]
  combos: number
  steps: readonly SparkPresentationStep[]
}

export interface SparkGuardState {
  reduction: number
  comboThreshold: number
}

export interface SparkRivalRuntime {
  strategy: Strategy
  resolve: number
  maxResolve: number
  countdown: number
  intentIndex: number
  pressureMultiplier: number
  guard: SparkGuardState | null
  firedPhases: readonly number[]
}

export type SparkLossReason = 'drive-depleted' | 'turn-limit'

export interface SparkRivalOutcome {
  kind: 'clear' | 'loss'
  reason: 'circuit-cleared' | SparkLossReason
  trainingExp: number
  waveExp: readonly [number, number, number]
  clearBonus: number
  comboBonus: number
  driveBonus: number
}

export interface SparkRivalState {
  board: readonly SparkOrb[]
  boardRngState: number
  rivalRngState: number
  waveIndex: number
  waveTurn: number
  drive: number
  maxDrive: number
  sparkCharge: number
  sparkTarget: number
  totalDrags: number
  totalCombos: number
  waveDamage: readonly [number, number, number]
  rival: SparkRivalRuntime
  outcome: SparkRivalOutcome | null
}

export interface SparkRivalReplay {
  state: SparkRivalState
  turns: readonly SparkRivalResolution[]
  outcome: SparkRivalOutcome | null
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function exactKeys(value: UnknownRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index])
}

function boundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum
}

function boundedNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function parseCell(value: unknown): SparkCell | null {
  if (!isRecord(value) || !exactKeys(value, ['column', 'row'])) return null
  if (!boundedInteger(value.row, 0, SPARK_RIVAL_BOARD_HEIGHT - 1) ||
    !boundedInteger(value.column, 0, SPARK_RIVAL_BOARD_WIDTH - 1)) return null
  return { row: value.row, column: value.column }
}

export function cellsAreAdjacent(left: SparkCell, right: SparkCell): boolean {
  const row = Math.abs(left.row - right.row)
  const column = Math.abs(left.column - right.column)
  return row <= 1 && column <= 1 && row + column > 0
}

export function parseSparkRivalAction(value: unknown): SparkRivalAction | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  if (value.type === 'spark-shift') return exactKeys(value, ['type']) ? { type: 'spark-shift' } : null
  if (value.type !== 'drag' || !exactKeys(value, ['movementMs', 'path', 'type']) || !Array.isArray(value.path) ||
    !boundedInteger(value.movementMs, 1, SPARK_RIVAL_MOVEMENT_MS) || value.path.length < 2 || value.path.length > SPARK_RIVAL_PATH_LIMIT) return null
  const path = value.path.map(parseCell)
  if (path.some((cell) => cell === null)) return null
  const checked = path as SparkCell[]
  if (checked.some((cell, index) => index > 0 && !cellsAreAdjacent(checked[index - 1]!, cell))) return null
  return { type: 'drag', path: checked, movementMs: value.movementMs }
}

function parseTurnIntent(value: unknown): RivalTurnIntent | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  if (value.type === 'pressure' && exactKeys(value, ['amount', 'type']) && boundedInteger(value.amount, 1, 10_000)) {
    return { type: 'pressure', amount: value.amount }
  }
  if (value.type === 'guard' && exactKeys(value, ['comboThreshold', 'reduction', 'type']) &&
    boundedNumber(value.reduction, 0.01, 0.95) && boundedInteger(value.comboThreshold, 1, 20)) {
    return { type: 'guard', reduction: value.reduction, comboThreshold: value.comboThreshold }
  }
  if (value.type === 'convert' && exactKeys(value, ['maximum', 'source', 'target', 'type']) &&
    SPARK_ORBS.includes(value.source as SparkOrb) && SPARK_ORBS.includes(value.target as SparkOrb) && value.source !== value.target &&
    boundedInteger(value.maximum, 1, 12)) {
    return { type: 'convert', source: value.source as SparkOrb, target: value.target as SparkOrb, maximum: value.maximum }
  }
  if (value.type === 'delay' && exactKeys(value, ['amount', 'type']) && boundedInteger(value.amount, 1, 6)) {
    return { type: 'delay', amount: value.amount }
  }
  return null
}

function parsePhase(value: unknown): RivalPhase | null {
  if (!isRecord(value) || !exactKeys(value, ['atResolvePercent', 'intent']) ||
    !boundedInteger(value.atResolvePercent, 1, 99) || !isRecord(value.intent) || typeof value.intent.type !== 'string') return null
  const intent = value.intent
  if (intent.type === 'enrage' && exactKeys(intent, ['multiplier', 'type']) && boundedNumber(intent.multiplier, 1.01, 5)) {
    return { atResolvePercent: value.atResolvePercent, intent: { type: 'enrage', multiplier: intent.multiplier } }
  }
  if (intent.type === 'change-style' && exactKeys(intent, ['strategy', 'type']) && STRATEGIES.includes(intent.strategy as Strategy)) {
    return { atResolvePercent: value.atResolvePercent, intent: { type: 'change-style', strategy: intent.strategy as Strategy } }
  }
  return null
}

function parseRival(value: unknown): SparkRivalDefinition | null {
  if (!isRecord(value) || !exactKeys(value, ['id', 'intents', 'label', 'maxResolve', 'openingCountdown', 'phases', 'strategy']) ||
    !boundedText(value.id, 64) || !boundedText(value.label, 80) || !STRATEGIES.includes(value.strategy as Strategy) ||
    !boundedInteger(value.maxResolve, 1, 1_000_000) || !boundedInteger(value.openingCountdown, 1, 8) ||
    !Array.isArray(value.intents) || value.intents.length < 1 || value.intents.length > 8 ||
    !Array.isArray(value.phases) || value.phases.length > 2) return null
  const intents = value.intents.map(parseTurnIntent)
  const phases = value.phases.map(parsePhase)
  if (intents.some((intent) => intent === null) || phases.some((phase) => phase === null)) return null
  const checkedPhases = phases as RivalPhase[]
  if (new Set(checkedPhases.map((phase) => phase.atResolvePercent)).size !== checkedPhases.length) return null
  return {
    id: value.id,
    label: value.label,
    strategy: value.strategy as Strategy,
    maxResolve: value.maxResolve,
    openingCountdown: value.openingCountdown,
    intents: intents as RivalTurnIntent[],
    phases: [...checkedPhases].sort((left, right) => right.atResolvePercent - left.atResolvePercent),
  }
}

export function parseSparkRivalEncounter(value: unknown): SparkRivalEncounterV1 | null {
  if (!isRecord(value) || !exactKeys(value, ['scenarioTier', 'trainee', 'trainingLevel', 'version', 'waves']) || value.version !== 1 ||
    !boundedInteger(value.scenarioTier, 1, 14) || !boundedInteger(value.trainingLevel, 1, 10) ||
    !Array.isArray(value.waves) || value.waves.length !== 3 || !isRecord(value.trainee) ||
    !exactKeys(value.trainee, ['label', 'strategyAptitudes', 'templateId']) ||
    !boundedText(value.trainee.templateId, 64) || !boundedText(value.trainee.label, 80) || !isRecord(value.trainee.strategyAptitudes) ||
    !exactKeys(value.trainee.strategyAptitudes, STRATEGIES)) return null
  const aptitudes = value.trainee.strategyAptitudes
  if (STRATEGIES.some((strategy) => !GRADES.includes(aptitudes[strategy] as Grade))) return null
  const waves = value.waves.map(parseRival)
  if (waves.some((wave) => wave === null) || new Set((waves as SparkRivalDefinition[]).map((wave) => wave.id)).size !== 3) return null
  return {
    version: 1,
    scenarioTier: value.scenarioTier,
    trainingLevel: value.trainingLevel,
    trainee: {
      templateId: value.trainee.templateId,
      label: value.trainee.label,
      strategyAptitudes: Object.fromEntries(STRATEGIES.map((strategy) => [strategy, aptitudes[strategy]])) as Record<Strategy, Grade>,
    },
    waves: waves as unknown as [SparkRivalDefinition, SparkRivalDefinition, SparkRivalDefinition],
  }
}

export function parseSparkRivalActions(value: unknown): readonly SparkRivalAction[] | null {
  if (!Array.isArray(value) || value.length > SPARK_RIVAL_ACTION_LIMIT) return null
  const actions = value.map(parseSparkRivalAction)
  return actions.some((action) => action === null) ? null : actions as SparkRivalAction[]
}
