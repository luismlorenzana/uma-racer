// Engine v7's field mechanics (D158), after the original (docs/research/race-engine-v7-findings.md): position keeping
// on Wit rolls, Spot Struggle, and the competitions before the spurt (Repositioning, Secure Lead, Stamina keep). Each
// reads the start-of-turn field, and every roll comes from the runner's own stream, so none shifts another roll.
import type { Strategy } from '@racer/domain'
import {
  COMPETE_COOLDOWN_SECONDS,
  COMPETE_FIRST_SECTION,
  COMPETE_HP_DISTANCE_FACTOR,
  COMPETE_LAST_SECTION,
  COMPETE_SECONDS,
  COURSE_WIDTH,
  FRONT_LEAD_METERS,
  FRONT_OVERTAKE_EXIT_METERS,
  HORSE_LANE,
  NEAR_DISTANCE,
  NEAR_LANES,
  POSITION_KEEP_CHECK_SECONDS,
  POSITION_KEEP_COOLDOWN_SECONDS,
  POSITION_KEEP_LAST_SECTION,
  REPOSITION_FAR_METERS,
  REPOSITION_HP_COEF,
  REPOSITION_NEAR_HP,
  REPOSITION_SOLO_FRONT,
  REPOSITION_SPEED_COEF,
  SECURE_LEAD_CHANCE,
  SECURE_LEAD_HP_COEF,
  SECURE_LEAD_MARGIN,
  SECURE_LEAD_SOLO_FRONT,
  SECURE_LEAD_SPEED_COEF,
  SOLO_FRONT_LEAD_METERS,
  SOLO_FRONT_METERS,
  SPOT_STRUGGLE_DISTANCE,
  SPOT_STRUGGLE_END_SECTION,
  SPOT_STRUGGLE_EXIT_DISTANCE,
  SPOT_STRUGGLE_EXIT_LANE_SHARE,
  SPOT_STRUGGLE_LANE_SHARE,
  SPOT_STRUGGLE_LAST_START_SECTION,
  SPOT_STRUGGLE_UNLOCK_METERS,
  SPURT_BUFFER_METERS,
  STAMINA_KEEP_MARGIN,
  STRATEGY_APT_WIT,
  VISIBLE_DISTANCE,
} from './constants'
import { baseSpeedFor, hpPerSecond, spurtCeiling, type RunnerState } from './engine'
import { modeCoefficient, positionKeepWitChance, positionThresholds, type PackRunnerSnapshot } from './pack'
import type { PositionMode, RaceEvent } from './types'

const PRIORITY: Record<Strategy, number> = { front: 1, pace: 2, late: 3, end: 4 }

/** What engine v7 tracks for each runner beyond the shared runner state. */
export interface TurnRunnerState {
  /** Position keeping: the mode, where it began, the gap that ends it, and the turn of the next check. */
  keepMode: PositionMode
  keepStart: number
  keepExitGap: number
  keepNextCheck: number
  /** Spot Struggle: the turn it ends on and its target speed, while it lasts. */
  struggleUntil: number | null
  struggleBonus: number
  /** Competing before the spurt: the push, its target speed, the turn it ends on, and the turn of the next check. */
  compete: 'secure-lead' | 'reposition' | null
  competeBonus: number
  competeUntil: number
  competeNextCheck: number
  /** Stamina keep: she has noticed she is short and sits the competitions out. The margin she wants is rolled once. */
  staminaKeep: boolean
  keepMargin: number
}

/** The start-of-turn field every rule reads. */
export interface TurnField {
  snapshots: readonly PackRunnerSnapshot[]
  /** Runner indices, leader first. */
  order: readonly number[]
  strategies: readonly Strategy[]
  distance: number
  turn: number
  section: number
  phase: number
  /** The first turn of the final leg, and the engine's HP rate. */
  legTurn: number
  hpScale: number
}

export function createTurnRunnerState(r: RunnerState): TurnRunnerState {
  const [low, high] = STAMINA_KEEP_MARGIN
  return {
    keepMode: 'normal',
    keepStart: 0,
    keepExitGap: 0,
    keepNextCheck: POSITION_KEEP_CHECK_SECONDS,
    struggleUntil: null,
    struggleBonus: 0,
    compete: null,
    competeBonus: 0,
    competeUntil: 0,
    competeNextCheck: 0,
    staminaKeep: false,
    keepMargin: r.packRng.range(low, high),
  }
}

/** The target speed engine v7's field mechanics add to hers this turn. */
export const fieldBonus = (state: TurnRunnerState): number =>
  (state.struggleUntil === null ? 0 : state.struggleBonus) + (state.compete === null ? 0 : state.competeBonus)

/**
 * How many lanes a blocked runner can swing out in one turn: the original's lane-change speed, 0.02 × (0.3 + 0.001 ×
 * Power), scaled so 1,200 Power reaches the most the engine allows.
 */
export const swingLanes = (power: number, most: number): number =>
  Math.max(1, Math.min(most, Math.round((most * (0.3 + 0.001 * power)) / 1.5)))

/** A later style running ahead of where hers should be: pace-up Ex, which outranks every other mode. */
function outOfPlace(index: number, field: TurnField): boolean {
  const { order, strategies } = field
  const strategy = strategies[index]!
  if (strategy !== 'front') return PRIORITY[strategies[order[0]!]!] > PRIORITY[strategy]
  return order.slice(0, order.indexOf(index)).some((other) => PRIORITY[strategies[other]!] > PRIORITY[strategy])
}

/**
 * Engine v7 position keeping: the original's modes through section 10. In normal mode she checks every 2 s; front
 * runners go for the lead (overtake, speed up) and the others press up to their distance from the leader, each on a
 * Wit roll, while easing off when too close needs none. A mode ends when its goal is met or after one section.
 */
export function positionKeepTurn(r: RunnerState, index: number, state: TurnRunnerState, field: TurnField): { coefficient: number; mode: PositionMode } {
  const { snapshots, order, strategies, distance, turn, section, phase } = field
  const self = snapshots[index]!
  const strategy = strategies[index]!
  const gap = snapshots[order[0]!]!.distance - self.distance
  const place = order.indexOf(index)
  const behind = order[place + 1] === undefined ? undefined : snapshots[order[place + 1]!]!
  const same = order.filter((other) => strategies[other] === strategy)
  const leadThreshold = strategies.filter((other) => other === 'front').length === 1 ? SOLO_FRONT_LEAD_METERS : FRONT_LEAD_METERS
  const over = section > POSITION_KEEP_LAST_SECTION || phase >= 2 || r.hpEmpty
  const misplaced = outOfPlace(index, field)
  const enter = (mode: PositionMode, exitGap = 0) => {
    state.keepMode = mode
    state.keepStart = self.distance
    state.keepExitGap = exitGap
  }

  if (state.keepMode !== 'normal') {
    let exit = over || self.distance - state.keepStart >= Math.floor(distance / 24)
    if (state.keepMode === 'front-speed-up') exit ||= !behind || self.distance - behind.distance > leadThreshold
    if (state.keepMode === 'front-overtake') {
      const next = same.find((other) => other !== index)
      exit ||= next === undefined || self.distance - snapshots[next]!.distance >= FRONT_OVERTAKE_EXIT_METERS
    }
    if (state.keepMode === 'pace-up') exit ||= gap <= state.keepExitGap
    if (state.keepMode === 'pace-down') exit ||= gap >= state.keepExitGap || self.hasSpeedEffect
    if (state.keepMode === 'pace-up-ex') exit ||= !misplaced
    if (exit) {
      enter('normal')
      state.keepNextCheck = turn + POSITION_KEEP_COOLDOWN_SECONDS + POSITION_KEEP_CHECK_SECONDS
    }
  }
  if (state.keepMode === 'normal' && !over && turn >= state.keepNextCheck) {
    state.keepNextCheck = turn + POSITION_KEEP_CHECK_SECONDS
    const rng = r.packRng
    if (misplaced) {
      enter('pace-up-ex')
    } else if (strategy === 'front') {
      if (same.indexOf(index) > 0 && rng.next() < positionKeepWitChance(r.wit, 20)) {
        enter('front-overtake')
      } else if (place === 0 && behind && self.distance - behind.distance < leadThreshold && rng.next() < positionKeepWitChance(r.wit, 20)) {
        enter('front-speed-up')
      }
    } else {
      const [min, max] = positionThresholds(strategy, distance)
      if (gap > max && rng.next() < positionKeepWitChance(r.wit, 15)) {
        enter('pace-up', rng.range(min, max))
      } else if (gap < min && !self.hasSpeedEffect) {
        enter('pace-down', rng.range(min, phase === 1 ? (min + max) / 2 : max))
      }
    }
  }
  return { coefficient: modeCoefficient(state.keepMode, phase), mode: state.keepMode }
}

/**
 * Spot Struggle (位置取り争い), once a race: once anyone passes 150 m and until section 6 ends, the front runners bunched
 * within 3.75 m and 0.165 of the course width of the frontmost one fight for the lead together. Each gains
 * (500 × Guts)^0.6 × 0.0001 m/s for (700 × Guts)^0.5 × 0.012 s, scaled by her style aptitude, and spends HP 1.4× as
 * fast. It ends at section 9, or for one who falls 5 m behind (or 0.416 of the width away from) all the others.
 */
export function spotStruggleTurn(
  runners: readonly RunnerState[],
  states: readonly TurnRunnerState[],
  field: TurnField,
  events: RaceEvent[],
  struggle: { started: boolean; expired: boolean },
): void {
  const { snapshots, order, strategies, turn, section } = field
  const active = states.flatMap((state, index) => state.struggleUntil === null ? [] : [index])
  if (active.length > 0) {
    const leaving = new Set<number>()
    for (const index of active) {
      const expired = turn >= states[index]!.struggleUntil!
      if (expired) struggle.expired = true
      if (section >= SPOT_STRUGGLE_END_SECTION || expired || runners[index]!.hpEmpty) leaving.add(index)
    }
    const staying = active.filter((index) => !leaving.has(index))
    for (const index of staying) {
      const self = snapshots[index]!
      const others = staying.filter((other) => other !== index).map((other) => snapshots[other]!)
      if (others.length > 0 && (others.every((other) => other.distance - self.distance >= SPOT_STRUGGLE_EXIT_DISTANCE) ||
        others.every((other) => Math.abs(other.lane - self.lane) >= SPOT_STRUGGLE_EXIT_LANE_SHARE * COURSE_WIDTH))) leaving.add(index)
    }
    // Once everyone else has fallen away, the last one stops too; a struggle that simply ran its time does not cascade.
    const left = active.filter((index) => !leaving.has(index))
    if (left.length === 1 && !struggle.expired) leaving.add(left[0]!)
    for (const index of leaving) {
      states[index]!.struggleUntil = null
      events.push({ tick: turn, runner: index, type: 'spot-struggle', value: 0 })
    }
  }

  if (struggle.started || section > SPOT_STRUGGLE_LAST_START_SECTION) return
  if (!snapshots.some((snapshot) => snapshot.distance >= SPOT_STRUGGLE_UNLOCK_METERS)) return
  const fronts = order.filter((index) => strategies[index] === 'front' && !runners[index]!.hpEmpty)
  const head = fronts[0] === undefined ? undefined : snapshots[fronts[0]]!
  if (!head) return
  const group = fronts.filter((index) => head.distance - snapshots[index]!.distance < SPOT_STRUGGLE_DISTANCE &&
    Math.abs(snapshots[index]!.lane - head.lane) < SPOT_STRUGGLE_LANE_SHARE * COURSE_WIDTH)
  if (group.length < 2) return
  struggle.started = true
  for (const index of group) {
    const r = runners[index]!
    const seconds = (700 * r.guts) ** 0.5 * 0.012 * STRATEGY_APT_WIT[r.input.aptitude.strategy]
    states[index]!.struggleUntil = turn + Math.max(1, Math.round(seconds))
    states[index]!.struggleBonus = (500 * r.guts) ** 0.6 * 0.0001
    events.push({ tick: turn, runner: index, type: 'spot-struggle', value: 1 })
  }
}

/** HP she needs from here: the middle leg at her pace, then the final leg at full spurt, less the 60 m buffer. */
function hpToFinish(r: RunnerState, field: TurnField): number {
  const { distance, turn, legTurn, hpScale } = field
  const base = baseSpeedFor(distance)
  const pace = Math.max(1, r.v)
  const turnsToLeg = Math.max(0, legTurn - turn)
  const { max } = spurtCeiling(r, distance, 7)
  const spurtDistance = Math.max(0, distance - (r.d + turnsToLeg * pace) - SPURT_BUFFER_METERS)
  return (hpPerSecond(pace, base, false, r.gutsMod) * turnsToLeg + (hpPerSecond(max, base, true, r.gutsMod) * spurtDistance) / max) * hpScale
}

/**
 * The chance she notices she is short of HP, on the original's parameters 30%, 1,000 and 0.03 (the community's formula
 * is marked speculative): 30% × (Wit / 1,000 + Wit^0.03), about 54% at 600 Wit and 67% at 1,000.
 */
export const staminaKeepChance = (wit: number): number => Math.min(1, 0.3 * (wit / 1000 + Math.max(1, wit) ** 0.03))

/**
 * Competing before the spurt, the original's sections 11–15. Every 2 s she may push for 2 s, then rests 1 s:
 * - **Stamina keep** first: if her HP is short of what a full spurt needs (with a small margin) and she notices, on Wit,
 *   she sits every competition out until a heal.
 * - **Secure Lead** (リード確保): a front, pace or late runner too close to one whose style belongs behind hers, on a 20%
 *   roll, gains (Guts / 2,000)^0.5 × 0.3 m/s.
 * - **Repositioning** (位置取り調整): too far behind the leader (on a Wit roll) or boxed in by others (on a Guts roll that
 *   rises with company), she gains ((Power / 1,500)^0.5 × 2 + (Guts / 3,000)^0.2) × 0.1 m/s.
 * Each costs 20 HP scaled by style and course.
 */
export function competeTurn(r: RunnerState, index: number, state: TurnRunnerState, field: TurnField, events: RaceEvent[]): void {
  const { snapshots, order, strategies, distance, turn, section, hpScale } = field
  if (state.compete !== null && turn >= state.competeUntil) {
    state.compete = null
    state.competeBonus = 0
  }
  if (state.compete !== null || section < COMPETE_FIRST_SECTION || section > COMPETE_LAST_SECTION || r.hpEmpty ||
    turn < state.competeNextCheck) return
  state.competeNextCheck = turn + 2
  const rng = r.packRng
  if (!state.staminaKeep && r.hp < hpToFinish(r, field) * state.keepMargin && rng.next() < staminaKeepChance(r.wit)) {
    state.staminaKeep = true
    events.push({ tick: turn, runner: index, type: 'stamina-keep' })
  }
  if (state.staminaKeep) return

  const self = snapshots[index]!
  const strategy = strategies[index]!
  const courseHp = COMPETE_HP_DISTANCE_FACTOR.find(([upTo]) => distance <= upTo)![1]
  const soloFront = strategy === 'front' && !snapshots.some((other) =>
    other.index !== index && strategies[other.index] === 'front' && Math.abs(other.distance - self.distance) <= SOLO_FRONT_METERS)
  const start = (kind: 'secure-lead' | 'reposition', bonus: number, cost: number) => {
    state.compete = kind
    state.competeBonus = bonus
    state.competeUntil = turn + COMPETE_SECONDS
    state.competeNextCheck = state.competeUntil + COMPETE_COOLDOWN_SECONDS
    r.hp -= cost * hpScale
    events.push({ tick: turn, runner: index, type: 'compete', value: kind === 'secure-lead' ? 1 : 2 })
  }

  const courseLead = 0.0003 * (distance + 1000)
  const crowded = snapshots.some((other) => {
    const margin = SECURE_LEAD_MARGIN[strategy][strategies[other.index]!]
    const lead = self.distance - other.distance
    return margin !== undefined && lead < margin + courseLead && lead > -VISIBLE_DISTANCE
  })
  if (crowded && rng.next() < SECURE_LEAD_CHANCE) {
    const bonus = (r.guts / 2000) ** 0.5 * 0.3 * SECURE_LEAD_SPEED_COEF[strategy] * (soloFront ? SECURE_LEAD_SOLO_FRONT : 1)
    start('secure-lead', bonus, 20 * SECURE_LEAD_HP_COEF[strategy] * courseHp)
    return
  }

  const courseFactor = 0.0008 * (distance - 1000) + 1
  const far = snapshots[order[0]!]!.distance - self.distance > REPOSITION_FAR_METERS[strategy] * courseFactor
  const near = snapshots.filter((other) => other.index !== index && Math.abs(other.distance - self.distance) <= NEAR_DISTANCE &&
    Math.abs(other.lane - self.lane) < NEAR_LANES * HORSE_LANE)
  const nearSame = near.filter((other) => strategies[other.index] === strategy).length
  const pushes = (far && rng.next() < positionKeepWitChance(r.wit, 20)) ||
    (near.length > 0 && rng.next() < positionKeepWitChance(r.guts, 20) * Math.min(1, (near.length + nearSame) / 3))
  if (!pushes) return
  const bonus = ((r.power / 1500) ** 0.5 * 2 + (r.guts / 3000) ** 0.2) * 0.1 * REPOSITION_SPEED_COEF[strategy] *
    (soloFront ? REPOSITION_SOLO_FRONT : 1)
  start('reposition', bonus, 20 * (REPOSITION_HP_COEF[strategy] * courseHp + (far ? 0 : REPOSITION_NEAR_HP)))
}
