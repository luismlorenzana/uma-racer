// Deterministic R3 pack, position-keeping, lane, and blocking rules (docs/design/racing.md#pack-racing-r3).

import type { Strategy } from '@racer/domain'
import {
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
  PACE_DOWN_MIDDLE_COEF,
  PACE_DOWN_OPENING_COEF,
  PACE_UP_COEF,
  PACE_UP_EX_COEF,
  POSITION_KEEP_CHECK_SECONDS,
  POSITION_KEEP_COOLDOWN_SECONDS,
  POSITION_KEEP_LAST_SECTION,
  SIDE_BLOCK_DISTANCE,
  SIDE_BLOCK_LANES,
  SOLO_FRONT_LEAD_METERS,
  TICK_RATE,
  TICK_SECONDS,
  VISIBLE_DISTANCE,
} from './constants'
import type { Rng } from './rng'
import type { PositionMode, RunnerPackMetrics } from './types'

export interface PackRunnerSnapshot {
  index: number
  distance: number
  speed: number
  targetSpeed: number
  power: number
  wit: number
  strategy: Strategy
  lane: number
  hpEmpty: boolean
  hasSpeedEffect: boolean
}

export interface PackState {
  mode: PositionMode
  modeStartDistance: number
  modeExitGap: number
  nextModeCheckTick: number
  lane: number
  targetLane: number
  laneSpeed: number
  blockedFrontTicks: number
  blockedSideTicks: number
  frontBlocker: number | null
  overtakeTarget: number | null
  overtakeStartOrder: number
  order: number
  orderDelta: number
  passesAfterFinalLeg: number
  metrics: RunnerPackMetrics
}

export interface PackDecision {
  positionCoefficient: number
  speedCap: number | null
  frontBlocker: number | null
  sideBlocked: boolean
  overtakeTarget: number | null
  modeChanged: boolean
  blockChanged: boolean
  overtakeChanged: boolean
  laneChanged: boolean
  overtakeCompleted: boolean
}

const emptyModeSeconds = (): Record<PositionMode, number> => ({
  normal: 0,
  'front-speed-up': 0,
  'front-overtake': 0,
  'pace-up': 0,
  'pace-down': 0,
  'pace-up-ex': 0,
})

export function createPackState(gate: number): PackState {
  const lane = Math.min(COURSE_WIDTH, Math.max(0, gate * HORSE_LANE))
  return {
    mode: 'normal',
    modeStartDistance: 0,
    modeExitGap: 0,
    nextModeCheckTick: Math.round(POSITION_KEEP_CHECK_SECONDS * TICK_RATE),
    lane,
    targetLane: lane,
    laneSpeed: 0,
    blockedFrontTicks: 0,
    blockedSideTicks: 0,
    frontBlocker: null,
    overtakeTarget: null,
    overtakeStartOrder: gate + 1,
    order: gate + 1,
    orderDelta: 0,
    passesAfterFinalLeg: 0,
    metrics: { modeSeconds: emptyModeSeconds(), blockedSeconds: 0, overtakeAttempts: 0, overtakeSuccesses: 0 },
  }
}

export const positionKeepWitChance = (wit: number, multiplier: 15 | 20): number =>
  Math.max(0, Math.min(1, (multiplier * Math.log10(Math.max(1, wit) * 0.1)) / 100))

export function positionThresholds(strategy: Exclude<Strategy, 'front'>, courseDistance: number): readonly [number, number] {
  const factor = 0.0008 * (courseDistance - 1_000) + 1
  if (strategy === 'pace') return [3, 5 * factor]
  if (strategy === 'late') return [6.5 * factor, 7 * factor]
  return [7.5 * factor, 8 * factor]
}

export function frontBlocker(runner: PackRunnerSnapshot, field: readonly PackRunnerSnapshot[]): PackRunnerSnapshot | null {
  let result: PackRunnerSnapshot | null = null
  let bestGap = Infinity
  for (const other of field) {
    if (other.index === runner.index) continue
    const gap = other.distance - runner.distance
    if (gap <= 0 || gap >= FRONT_BLOCK_DISTANCE) continue
    const laneLimit = (1 - 0.6 * gap / FRONT_BLOCK_DISTANCE) * FRONT_BLOCK_LANE_FACTOR * HORSE_LANE
    if (Math.abs(other.lane - runner.lane) > laneLimit) continue
    if (gap < bestGap || (gap === bestGap && other.index < (result?.index ?? Infinity))) {
      result = other
      bestGap = gap
    }
  }
  return result
}

export function nearCount(runner: PackRunnerSnapshot, field: readonly PackRunnerSnapshot[]): number {
  return field.filter((other) => other.index !== runner.index &&
    Math.abs(other.distance - runner.distance) < NEAR_DISTANCE &&
    Math.abs(other.lane - runner.lane) < NEAR_LANES * HORSE_LANE).length
}

function sideBlocked(runner: PackRunnerSnapshot, direction: -1 | 1, field: readonly PackRunnerSnapshot[]): boolean {
  return field.some((other) => {
    if (other.index === runner.index || Math.abs(other.distance - runner.distance) >= SIDE_BLOCK_DISTANCE) return false
    const laneGap = other.lane - runner.lane
    return Math.sign(laneGap) === direction && Math.abs(laneGap) < SIDE_BLOCK_LANES * HORSE_LANE
  })
}

function visible(runner: PackRunnerSnapshot, other: PackRunnerSnapshot): boolean {
  const gap = other.distance - runner.distance
  if (gap < 0 || gap > VISIBLE_DISTANCE) return false
  const laneLimit = ((gap / VISIBLE_DISTANCE) * 11.5 * HORSE_LANE + 2 * HORSE_LANE) / 2
  return Math.abs(other.lane - runner.lane) <= laneLimit
}

export function overtakeTarget(
  runner: PackRunnerSnapshot,
  field: readonly PackRunnerSnapshot[],
  blocker: PackRunnerSnapshot | null,
): PackRunnerSnapshot | null {
  const candidates = field.filter((other) => {
    if (other.index === runner.index) return false
    const gap = other.distance - runner.distance
    if (gap < 1 || gap > VISIBLE_DISTANCE || !visible(runner, other)) return false
    const closing = runner.speed - other.speed
    return (closing > 0 && gap / closing < 15 && other.targetSpeed < runner.targetSpeed) || blocker?.index === other.index
  })
  return candidates.sort((left, right) =>
    left.distance - right.distance || Math.abs(left.lane - runner.lane) - Math.abs(right.lane - runner.lane) || left.index - right.index,
  )[0] ?? blocker
}

function laneClear(candidate: number, runner: PackRunnerSnapshot, target: PackRunnerSnapshot, field: readonly PackRunnerSnapshot[]): boolean {
  if (candidate < 0 || candidate > COURSE_WIDTH) return false
  return !field.some((other) => other.index !== runner.index && other.index !== target.index &&
    other.distance >= runner.distance && other.distance <= target.distance + 0.5 &&
    Math.abs(other.lane - candidate) <= 0.8 * HORSE_LANE)
}

export function chooseTargetLane(
  runner: PackRunnerSnapshot,
  target: PackRunnerSnapshot | null,
  phase: number,
  mode: PositionMode,
  field: readonly PackRunnerSnapshot[],
): number {
  if (runner.hpEmpty) return runner.lane
  if (!target) {
    if (mode === 'pace-down') return 0.18
    return phase <= 1 ? Math.max(0, runner.lane - 0.05) : runner.lane
  }
  const candidates = [target.lane - HORSE_LANE, target.lane + HORSE_LANE]
    .filter((lane) => laneClear(lane, runner, target, field))
    .map((lane) => ({
      lane,
      score: Math.abs(lane - runner.lane) * (lane < runner.lane ? 1 : phase === 0 ? 100 : phase >= 2 ? 1.15 : 1),
    }))
    .sort((left, right) => left.score - right.score || left.lane - right.lane)
  return candidates[0]?.lane ?? runner.lane
}

function wrongStrategyAhead(runner: PackRunnerSnapshot, field: readonly PackRunnerSnapshot[]): boolean {
  const priority: Record<Strategy, number> = { front: 1, pace: 2, late: 3, end: 4 }
  return field.some((other) => other.distance > runner.distance && priority[other.strategy] > priority[runner.strategy])
}

function setMode(state: PackState, mode: PositionMode, runner: PackRunnerSnapshot, exitGap: number): void {
  state.mode = mode
  state.modeStartDistance = runner.distance
  state.modeExitGap = exitGap
}

export function modeCoefficient(mode: PositionMode, phase: number): number {
  if (mode === 'front-speed-up') return FRONT_SPEED_UP_COEF
  if (mode === 'front-overtake') return FRONT_OVERTAKE_COEF
  if (mode === 'pace-up') return PACE_UP_COEF
  if (mode === 'pace-up-ex') return PACE_UP_EX_COEF
  if (mode === 'pace-down') return phase === 1 ? PACE_DOWN_MIDDLE_COEF : PACE_DOWN_OPENING_COEF
  return 1
}

function updateMode(
  state: PackState,
  runner: PackRunnerSnapshot,
  field: readonly PackRunnerSnapshot[],
  places: readonly number[],
  section: number,
  phase: number,
  courseDistance: number,
  tick: number,
  rng: Rng,
): void {
  const leader = field[places[0]!]!
  const gapFromLeader = leader.distance - runner.distance
  const sectionDistance = courseDistance / 24
  const sameStrategy = places.map((index) => field[index]!).filter((other) => other.strategy === runner.strategy)
  const sameRank = sameStrategy.findIndex((other) => other.index === runner.index)
  const runnerPlace = places.indexOf(runner.index) + 1
  const behind = places[runnerPlace]
  const onlyFront = runner.strategy === 'front' && field.filter((other) => other.strategy === 'front').length === 1
  const leadThreshold = onlyFront ? SOLO_FRONT_LEAD_METERS : FRONT_LEAD_METERS

  let exit = section > POSITION_KEEP_LAST_SECTION || runner.distance - state.modeStartDistance >= sectionDistance
  if (state.mode === 'front-speed-up') exit ||= !behind || runner.distance - field[behind]!.distance > leadThreshold
  if (state.mode === 'front-overtake') {
    const nextSame = sameStrategy.find((other) => other.index !== runner.index)
    exit ||= !nextSame || runner.distance - nextSame.distance >= FRONT_OVERTAKE_EXIT_METERS
  }
  if (state.mode === 'pace-up') exit ||= gapFromLeader <= state.modeExitGap
  if (state.mode === 'pace-down') exit ||= gapFromLeader >= state.modeExitGap || runner.hasSpeedEffect
  if (state.mode === 'pace-up-ex') exit ||= !wrongStrategyAhead(runner, field)
  if (state.mode !== 'normal' && exit) {
    setMode(state, 'normal', runner, 0)
    state.nextModeCheckTick = tick + Math.round((POSITION_KEEP_COOLDOWN_SECONDS + POSITION_KEEP_CHECK_SECONDS) * TICK_RATE)
  }
  if (state.mode !== 'normal' || section > POSITION_KEEP_LAST_SECTION || tick < state.nextModeCheckTick) return
  state.nextModeCheckTick = tick + Math.round(POSITION_KEEP_CHECK_SECONDS * TICK_RATE)
  if (wrongStrategyAhead(runner, field)) {
    setMode(state, 'pace-up-ex', runner, 0)
  } else if (runner.strategy === 'front') {
    if (sameRank > 0 && rng.next() < positionKeepWitChance(runner.wit, 20)) {
      setMode(state, 'front-overtake', runner, 0)
    } else if (runnerPlace === 1 && behind && runner.distance - field[behind]!.distance < leadThreshold &&
      rng.next() < positionKeepWitChance(runner.wit, 20)) {
      setMode(state, 'front-speed-up', runner, 0)
    }
  } else {
    const [min, max] = positionThresholds(runner.strategy, courseDistance)
    if (gapFromLeader > max && rng.next() < positionKeepWitChance(runner.wit, 15)) {
      setMode(state, 'pace-up', runner, rng.range(min, max))
    } else if (gapFromLeader < min && !runner.hasSpeedEffect) {
      setMode(state, 'pace-down', runner, rng.range(min, phase === 1 ? (min + max) / 2 : max))
    }
  }
}

export function updatePackRunner(
  state: PackState,
  runner: PackRunnerSnapshot,
  field: readonly PackRunnerSnapshot[],
  places: readonly number[],
  section: number,
  phase: number,
  courseDistance: number,
  tick: number,
  rng: Rng,
): PackDecision {
  const previousMode = state.mode
  const previousBlocker = state.frontBlocker
  const previousTarget = state.overtakeTarget
  const previousLaneTarget = state.targetLane
  const order = places.indexOf(runner.index) + 1
  state.orderDelta = order - state.order
  if (phase >= 2 && state.orderDelta < 0) state.passesAfterFinalLeg += -state.orderDelta
  state.order = order
  updateMode(state, runner, field, places, section, phase, courseDistance, tick, rng)

  const blocker = frontBlocker(runner, field)
  state.frontBlocker = blocker?.index ?? null
  state.blockedFrontTicks = blocker ? state.blockedFrontTicks + 1 : 0
  const target = overtakeTarget(runner, field, blocker)
  state.overtakeTarget = target?.index ?? null
  if (previousTarget === null && state.overtakeTarget !== null) {
    state.overtakeStartOrder = order
    state.metrics.overtakeAttempts += 1
  }
  const overtakeCompleted = previousTarget !== null && state.overtakeTarget !== previousTarget && order < state.overtakeStartOrder
  if (overtakeCompleted) state.metrics.overtakeSuccesses += 1

  state.targetLane = chooseTargetLane(runner, target, phase, state.mode, field)
  const direction = Math.sign(state.targetLane - state.lane) as -1 | 0 | 1
  const blockedSide = direction !== 0 && sideBlocked(runner, direction, field)
  state.blockedSideTicks = blockedSide ? state.blockedSideTicks + 1 : 0
  if (direction === 0 || Math.abs(state.targetLane - state.lane) < 0.001) {
    state.lane = state.targetLane
    state.laneSpeed = 0
  } else {
    const targetSpeed = 0.02 * (0.3 + 0.001 * runner.power) * (phase >= 2 ? 1 + order * 0.01 : 1 + state.lane / COURSE_WIDTH * 0.05)
    state.laneSpeed = Math.min(targetSpeed, state.laneSpeed + LANE_ACCELERATION * TICK_SECONDS)
    if (!blockedSide) {
      const directionModifier = direction < 0 ? 1 + state.lane : 1
      const movement = Math.min(MAX_LANE_SPEED, state.laneSpeed) * directionModifier * TICK_SECONDS
      state.lane = Math.max(0, Math.min(COURSE_WIDTH, state.lane + direction * Math.min(movement, Math.abs(state.targetLane - state.lane))))
    }
  }
  state.metrics.modeSeconds[state.mode] += TICK_SECONDS
  if (blocker || blockedSide) state.metrics.blockedSeconds += TICK_SECONDS
  const gap = blocker ? blocker.distance - runner.distance : 0
  return {
    positionCoefficient: modeCoefficient(state.mode, phase),
    speedCap: blocker ? (0.988 + 0.012 * gap / FRONT_BLOCK_DISTANCE) * blocker.speed : null,
    frontBlocker: state.frontBlocker,
    sideBlocked: blockedSide,
    overtakeTarget: state.overtakeTarget,
    modeChanged: previousMode !== state.mode,
    blockChanged: (previousBlocker === null) !== (state.frontBlocker === null),
    overtakeChanged: previousTarget !== state.overtakeTarget,
    laneChanged: Math.abs(previousLaneTarget - state.targetLane) >= 0.5 * HORSE_LANE,
    overtakeCompleted,
  }
}

/** Resolve impossible visual overlaps in stable inner-to-outer/index order. */
export function resolveOverlaps(states: PackState[], snapshots: readonly PackRunnerSnapshot[]): void {
  for (let left = 0; left < states.length; left += 1) {
    for (let right = left + 1; right < states.length; right += 1) {
      if (Math.abs(snapshots[left]!.distance - snapshots[right]!.distance) >= OVERLAP_DISTANCE) continue
      if (Math.abs(states[left]!.lane - states[right]!.lane) >= OVERLAP_LANES * HORSE_LANE) continue
      const outside = states[left]!.lane > states[right]!.lane ? left : states[left]!.lane < states[right]!.lane ? right : right
      states[outside]!.lane = Math.min(COURSE_WIDTH, states[outside]!.lane + OVERLAP_LANES * HORSE_LANE)
      states[outside]!.targetLane = Math.max(states[outside]!.targetLane, states[outside]!.lane)
    }
  }
}
