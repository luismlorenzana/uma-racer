// Pure replay engine for Spark Rival Circuit (docs/design/minigames.md#determinism-journal-and-commit, D171).
import {
  SPARK_RIVAL_ACTION_LIMIT,
  SPARK_RIVAL_MAX_DRIVE,
  SPARK_RIVAL_SHIFT_CHARGE,
  SPARK_RIVAL_SHIFT_CHARGE_CAP,
  SPARK_RIVAL_TURNS_PER_WAVE,
} from '@racer/domain'
import { applySparkPath, createSparkRivalBoard, resolveSparkBoard } from './board'
import { bestSparkStrategy, sparkOutcome, sparkTurnTotals } from './combat'
import { sparkSeed, sparkShuffle } from './rng'
import {
  parseSparkRivalAction,
  parseSparkRivalActions,
  parseSparkRivalEncounter,
  type RivalPhaseIntent,
  type RivalTurnIntent,
  type SparkPresentationStep,
  type SparkRivalAction,
  type SparkRivalDefinition,
  type SparkRivalEncounterV1,
  type SparkRivalOutcome,
  type SparkRivalReplay,
  type SparkRivalResolution,
  type SparkRivalRuntime,
  type SparkRivalState,
} from './types'

export class SparkRivalEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SparkRivalEngineError'
  }
}

function runtimeFor(rival: SparkRivalDefinition): SparkRivalRuntime {
  return {
    strategy: rival.strategy,
    resolve: rival.maxResolve,
    maxResolve: rival.maxResolve,
    countdown: rival.openingCountdown,
    intentIndex: 0,
    pressureMultiplier: 1,
    guard: null,
    firedPhases: [],
  }
}

function checkedEncounter(encounter: SparkRivalEncounterV1): SparkRivalEncounterV1 {
  const parsed = parseSparkRivalEncounter(encounter)
  if (!parsed) throw new SparkRivalEngineError('Spark Rival encounter is invalid')
  return parsed
}

function checkedAction(action: SparkRivalAction): SparkRivalAction {
  const parsed = parseSparkRivalAction(action)
  if (!parsed) throw new SparkRivalEngineError('Spark Rival action is invalid')
  return parsed
}

export function createSparkRivalState(encounter: SparkRivalEncounterV1, seed: string): SparkRivalState {
  const parsed = checkedEncounter(encounter)
  const initial = createSparkRivalBoard(sparkSeed(seed, 'board'))
  return {
    board: initial.board,
    boardRngState: initial.rngState,
    rivalRngState: sparkSeed(seed, 'rival'),
    waveIndex: 0,
    waveTurn: 0,
    drive: SPARK_RIVAL_MAX_DRIVE,
    maxDrive: SPARK_RIVAL_MAX_DRIVE,
    sparkCharge: 0,
    sparkTarget: SPARK_RIVAL_SHIFT_CHARGE,
    totalDrags: 0,
    totalCombos: 0,
    waveDamage: [0, 0, 0],
    rival: runtimeFor(parsed.waves[0]),
    outcome: null,
  }
}

export function currentSparkRivalIntent(encounter: SparkRivalEncounterV1, state: SparkRivalState): RivalTurnIntent {
  const rival = encounter.waves[state.waveIndex]
  if (!rival) throw new SparkRivalEngineError('Spark Rival wave index is invalid')
  return rival.intents[state.rival.intentIndex % rival.intents.length]!
}

function waveResolve(encounter: SparkRivalEncounterV1): [number, number, number] {
  return encounter.waves.map((wave) => wave.maxResolve) as [number, number, number]
}

function terminalOutcome(
  encounter: SparkRivalEncounterV1,
  state: SparkRivalState,
  kind: 'clear' | 'loss',
  reason: SparkRivalOutcome['reason'],
): SparkRivalOutcome {
  return sparkOutcome(
    kind,
    reason,
    state.waveDamage,
    waveResolve(encounter),
    state.totalCombos,
    state.totalDrags,
    state.drive,
    state.maxDrive,
  )
}

function phaseSteps(
  definition: SparkRivalDefinition,
  rival: SparkRivalRuntime,
  board: readonly SparkRivalState['board'][number][],
  drive: number,
): { rival: SparkRivalRuntime; steps: SparkPresentationStep[] } {
  let next = rival
  const steps: SparkPresentationStep[] = []
  definition.phases.forEach((phase, index) => {
    if (next.firedPhases.includes(index) || next.resolve * 100 > next.maxResolve * phase.atResolvePercent) return
    const firedPhases = [...next.firedPhases, index].sort((left, right) => left - right)
    if (phase.intent.type === 'enrage') next = { ...next, pressureMultiplier: next.pressureMultiplier * phase.intent.multiplier, firedPhases }
    else next = { ...next, strategy: phase.intent.strategy, firedPhases }
    steps.push({ type: 'rival-intent', intent: phase.intent, driveBefore: drive, driveAfter: drive, converted: [], boardAfter: board })
  })
  return { rival: next, steps }
}

function performIntent(
  intent: RivalTurnIntent,
  state: SparkRivalState,
): { state: SparkRivalState; step: SparkPresentationStep } {
  const driveBefore = state.drive
  let drive = driveBefore
  let board = [...state.board]
  let rivalRngState = state.rivalRngState
  let rival = state.rival
  let sparkTarget = state.sparkTarget
  let converted: number[] = []

  switch (intent.type) {
    case 'pressure':
      drive = Math.max(0, drive - Math.round(intent.amount * rival.pressureMultiplier))
      break
    case 'guard':
      rival = { ...rival, guard: { reduction: intent.reduction, comboThreshold: intent.comboThreshold } }
      break
    case 'convert': {
      const candidates = board.flatMap((orb, index) => orb === intent.source ? [index] : [])
      const shuffled = sparkShuffle(candidates, rivalRngState)
      rivalRngState = shuffled.state
      converted = shuffled.items.slice(0, intent.maximum).sort((left, right) => left - right)
      for (const index of converted) board[index] = intent.target
      break
    }
    case 'delay':
      sparkTarget = Math.min(SPARK_RIVAL_SHIFT_CHARGE_CAP, Math.max(sparkTarget, state.sparkCharge) + intent.amount)
      break
  }

  const next = { ...state, board, rivalRngState, rival, drive, sparkTarget }
  return {
    state: next,
    step: { type: 'rival-intent', intent, driveBefore, driveAfter: drive, converted, boardAfter: board },
  }
}

function applySparkShift(
  encounter: SparkRivalEncounterV1,
  state: SparkRivalState,
  action: SparkRivalAction & { type: 'spark-shift' },
  actionIndex: number,
): { state: SparkRivalState; resolution: SparkRivalResolution } {
  if (state.sparkCharge < state.sparkTarget) throw new SparkRivalEngineError('Spark Shift is not charged')
  const converted = state.board.flatMap((orb, index) => orb === 'spark' ? [index] : [])
  if (converted.length === 0) throw new SparkRivalEngineError('Spark Shift requires at least one Spark orb')
  const strategy = bestSparkStrategy(encounter.trainee.strategyAptitudes)
  const board = state.board.map((orb) => orb === 'spark' ? strategy : orb)
  const next = {
    ...state,
    board,
    sparkCharge: Math.max(0, state.sparkCharge - SPARK_RIVAL_SHIFT_CHARGE),
    sparkTarget: SPARK_RIVAL_SHIFT_CHARGE,
  }
  return {
    state: next,
    resolution: {
      actionIndex,
      action,
      turnConsumed: false,
      cascades: [],
      combos: 0,
      steps: [{ type: 'spark-shift', converted, strategy }],
    },
  }
}

function applyDrag(
  encounter: SparkRivalEncounterV1,
  state: SparkRivalState,
  action: SparkRivalAction & { type: 'drag' },
  actionIndex: number,
): { state: SparkRivalState; resolution: SparkRivalResolution } {
  const definition = encounter.waves[state.waveIndex]
  if (!definition) throw new SparkRivalEngineError('Spark Rival wave index is invalid')
  const moved = applySparkPath(state.board, action.path)
  const boardResult = resolveSparkBoard(moved, state.boardRngState)
  const totals = sparkTurnTotals(boardResult.cascades, encounter.trainee.strategyAptitudes, state.rival.strategy, state.rival.guard)
  const steps: SparkPresentationStep[] = [
    { type: 'path', path: action.path },
    ...boardResult.cascades.map((cascade): SparkPresentationStep => ({ type: 'cascade', cascade })),
    { type: 'totals', combos: totals.combos, cleared: totals.cleared },
  ]

  let resolve = state.rival.resolve
  for (const attack of totals.attacks) {
    if (attack.appliedAmount <= 0 || resolve <= 0) continue
    const before = resolve
    resolve = Math.max(0, resolve - attack.appliedAmount)
    steps.push({ type: 'attack', attack, resolveBefore: before, resolveAfter: resolve })
  }
  const damage = state.rival.resolve - resolve
  const waveDamage = [...state.waveDamage] as [number, number, number]
  waveDamage[state.waveIndex] = Math.min(state.rival.maxResolve, waveDamage[state.waveIndex]! + damage)
  const drive = Math.min(state.maxDrive, state.drive + totals.recovery)
  if (totals.recovery > 0) steps.push({ type: 'recovery', amount: drive - state.drive, driveBefore: state.drive, driveAfter: drive })
  const sparkCharge = state.sparkCharge + totals.charge
  if (totals.charge > 0) steps.push({ type: 'charge', amount: totals.charge, chargeBefore: state.sparkCharge, chargeAfter: sparkCharge, target: state.sparkTarget })

  let next: SparkRivalState = {
    ...state,
    board: boardResult.board,
    boardRngState: boardResult.rngState,
    waveTurn: state.waveTurn + 1,
    drive,
    sparkCharge,
    totalDrags: state.totalDrags + 1,
    totalCombos: state.totalCombos + totals.combos,
    waveDamage,
    rival: { ...state.rival, resolve, guard: null },
  }

  if (resolve <= 0) {
    steps.push({ type: 'wave-clear', wave: state.waveIndex + 1 })
    if (state.waveIndex === encounter.waves.length - 1) {
      const outcome = terminalOutcome(encounter, next, 'clear', 'circuit-cleared')
      next = { ...next, outcome }
      steps.push({ type: 'run-end', outcome })
    } else {
      const nextWave = state.waveIndex + 1
      next = { ...next, waveIndex: nextWave, waveTurn: 0, rival: runtimeFor(encounter.waves[nextWave]!) }
    }
  } else {
    const phased = phaseSteps(definition, next.rival, next.board, next.drive)
    next = { ...next, rival: phased.rival }
    steps.push(...phased.steps)
    const countdownBefore = next.rival.countdown
    const countdownAfter = countdownBefore - 1
    steps.push({ type: 'countdown', before: countdownBefore, after: Math.max(0, countdownAfter) })
    if (countdownAfter <= 0) {
      const intent = currentSparkRivalIntent(encounter, next)
      const performed = performIntent(intent, next)
      next = {
        ...performed.state,
        rival: {
          ...performed.state.rival,
          countdown: definition.openingCountdown,
          intentIndex: (performed.state.rival.intentIndex + 1) % definition.intents.length,
        },
      }
      steps.push(performed.step)
    } else next = { ...next, rival: { ...next.rival, countdown: countdownAfter } }

    if (next.drive <= 0) {
      const outcome = terminalOutcome(encounter, next, 'loss', 'drive-depleted')
      next = { ...next, outcome }
      steps.push({ type: 'run-end', outcome })
    } else if (next.waveTurn >= SPARK_RIVAL_TURNS_PER_WAVE) {
      const outcome = terminalOutcome(encounter, next, 'loss', 'turn-limit')
      next = { ...next, outcome }
      steps.push({ type: 'run-end', outcome })
    }
  }

  return {
    state: next,
    resolution: { actionIndex, action, turnConsumed: true, cascades: boardResult.cascades, combos: totals.combos, steps },
  }
}

export function reduceSparkRival(
  encounter: SparkRivalEncounterV1,
  state: SparkRivalState,
  action: SparkRivalAction,
  actionIndex = 0,
): { state: SparkRivalState; resolution: SparkRivalResolution } {
  const parsedEncounter = checkedEncounter(encounter)
  const parsedAction = checkedAction(action)
  if (state.outcome) throw new SparkRivalEngineError('Spark Rival run is already complete')
  return parsedAction.type === 'spark-shift'
    ? applySparkShift(parsedEncounter, state, parsedAction, actionIndex)
    : applyDrag(parsedEncounter, state, parsedAction, actionIndex)
}

export function replaySparkRival(
  encounter: SparkRivalEncounterV1,
  seed: string,
  actions: readonly SparkRivalAction[],
): SparkRivalReplay {
  const parsedEncounter = checkedEncounter(encounter)
  const parsedActions = parseSparkRivalActions(actions)
  if (!parsedActions) throw new SparkRivalEngineError(`Spark Rival actions must contain at most ${SPARK_RIVAL_ACTION_LIMIT} valid entries`)
  let state = createSparkRivalState(parsedEncounter, seed)
  const turns: SparkRivalResolution[] = []
  parsedActions.forEach((action, index) => {
    if (state.outcome) throw new SparkRivalEngineError('Spark Rival action follows a terminal result')
    const reduced = reduceSparkRival(parsedEncounter, state, action, index)
    state = reduced.state
    turns.push(reduced.resolution)
  })
  return { state, turns, outcome: state.outcome }
}

/** Stable FNV-1a digest for diagnostics and the future authoritative journal claim (T073). */
export function sparkRivalStateHash(state: SparkRivalState): string {
  const encoded = JSON.stringify(state)
  let hash = 0x811c9dc5
  for (let index = 0; index < encoded.length; index += 1) {
    hash ^= encoded.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
