// Engines v6 and v7 (M021, D154, D158): the race as a sequence of one-second turns. Speed, acceleration, HP, the spurt
// plan, hills, duels and skills keep v5's rules with a one-second step; phases start on fixed turns for the whole field;
// and passing resolves every turn, front to back, as overtake and blocked events. v6 (frozen) keeps position with style
// bands on its own tuning. v7 runs the original's physics and field mechanics: position keeping on Wit rolls, Spot
// Struggle, the competitions before the spurt, and lane changes as fast as her Power (turn-rules.ts).
import {
  ACCEL_COEF,
  BASE_ACCEL,
  COURSE_WIDTH,
  DECEL,
  DISTANCE_APT_ACCEL,
  DOWNHILL_ENTER_PER_WIT,
  DOWNHILL_EXIT_CHANCE,
  DOWNHILL_HP_MODIFIER,
  HORSE_LANE,
  HP_EMPTY_DECEL,
  LAST_STRAIGHT_ONETIME_METERS,
  LATE_START_THRESHOLD,
  MAX_RACE_SECONDS,
  MAX_TARGET_SPEED,
  METERS_PER_LENGTH,
  PACE_DOWN_DECEL,
  PACE_DOWN_HP_MODIFIER,
  SPOT_STRUGGLE_HP_MODIFIER,
  START_DASH_ACCEL,
  START_DASH_UNTIL,
  SURFACE_APT_ACCEL,
  UPHILL_BASE_ACCEL,
} from './constants'
import {
  activateSkills,
  activeModifier,
  actualSpeed,
  baseSpeedFor,
  expireActiveEffects,
  hpPerSecond,
  initRunner,
  planSpurt,
  rankRunners,
  resolveGateSkills,
  scaleActiveEffects,
  skillContext,
  targetSpeed,
  updateFieldStateV5,
  type RunnerState,
  type SkillFieldFacts,
} from './engine'
import type { PackRunnerSnapshot } from './pack'
import { createRng } from './rng'
import { mapStats } from '@racer/domain'
import { phaseStartTurns, phaseTurns, raceTurns, tuningFor, turnPhase, turnSection, type TurnTuning } from './turn-clock'
import {
  competeTurn,
  createTurnRunnerState,
  fieldBonus,
  positionKeepTurn,
  spotStruggleTurn,
  swingLanes,
  type TurnField,
} from './turn-rules'
import { NEAR_DISTANCE, NEAR_LANES, VISIBLE_DISTANCE } from './constants'
import type { PositionMode, RaceCourse, RaceEvent, RaceInput, RaceTimeline } from './types'
import { assertRaceInput } from './validation'

/** A runner may not end a turn within this of another in her lane: one length. */
export const PASS_GAP = METERS_PER_LENGTH
/** Lanes are one horse wide. */
export const LANE_STEP = HORSE_LANE
/** Engine v7: how close ahead, in her lane, a slower runner makes her start round. */
export const OVERTAKE_LOOKAHEAD = 2 * METERS_PER_LENGTH

interface Move {
  index: number
  from: number
  to: number
  speed: number
  lane: number
  blockedBy: number | null
  /** Engine v8: progress along the course per meter she runs (below 1 off the rail on a corner). */
  ratio: number
}

/**
 * Exact speed and distance over `dt` seconds moving from `v0` toward `target` at `rate` (positive accelerating, negative
 * slowing), stopping at the target: engine v8's step, where v6–v7 averaged the turn's two ends.
 */
function stepTowards(v0: number, target: number, rate: number, dt: number): [number, number] {
  if (dt <= 0) return [v0, 0]
  if (rate === 0 || (rate > 0 ? v0 >= target : v0 <= target)) return [v0, v0 * dt]
  const reach = (target - v0) / rate
  if (reach >= dt) return [v0 + rate * dt, v0 * dt + 0.5 * rate * dt * dt]
  return [target, v0 * reach + 0.5 * rate * reach * reach + target * (dt - reach)]
}

/**
 * Engine v8: progress per meter run for a runner `lane` meters off the rail on a corner of `length` meters turning
 * `angle` radians. Off the rail she runs the arc of radius R + lane for the rail's R, so she covers R / (R + lane) of it.
 */
export function cornerRatio(length: number, angle: number, lane: number): number {
  if (angle <= 0 || length <= 0 || lane <= 0) return 1
  const radius = length / angle
  return radius / (radius + lane)
}

/** Engine v6 hills: which slope she is on, and once a turn on a descent whether downhill accel mode starts or ends. */
function updateHillTurn(r: RunnerState, course: RaceCourse): void {
  const slopes = course.layout?.slopes ?? []
  const index = slopes.findIndex((slope) => r.d >= slope.start && r.d < slope.end)
  if (index !== r.hill) {
    r.hill = index
    r.slope = index === -1 ? 0 : slopes[index]!.slope
    r.downhill = index !== -1 && r.slope < 0 && r.hillRngs[index]!.next() < r.wit * DOWNHILL_ENTER_PER_WIT
    return
  }
  if (index === -1) return
  const roll = r.hillRngs[index]!.next()
  if (r.downhill) {
    if (roll < DOWNHILL_EXIT_CHANCE) r.downhill = false
  } else if (r.slope < 0 && roll < r.wit * DOWNHILL_ENTER_PER_WIT) {
    r.downhill = true
  }
}

/**
 * Engine v6: her style band's pull on her target speed this turn, and the matching v5 position mode for cues and
 * metrics. Through the opening and middle legs each style runs in a band of lengths behind the leader (the tuning's
 * bands, at 2,000 m): ahead of it she eases, behind it she presses. From the final leg everyone races.
 */
function bandPull(r: RunnerState, leaderDistance: number, phase: number, distance: number, tuning: TurnTuning): { coefficient: number; mode: PositionMode } {
  if (phase >= 2 || r.hpEmpty) return { coefficient: 1, mode: 'normal' }
  const [near, far] = tuning.bands[r.input.strategy]
  // Bands are set for 2,000 m and scale with the course as the original's position keeping does.
  const scale = (0.0008 * (distance - 1000) + 1) / 1.8
  const behind = (leaderDistance - r.d) / METERS_PER_LENGTH / scale
  if (behind < near) return { coefficient: tuning.ease, mode: 'pace-down' }
  if (behind > far) return { coefficient: tuning.press, mode: 'pace-up' }
  return { coefficient: 1, mode: 'normal' }
}

/** Engine v6 (D154–D155), frozen: races run on it replay exactly. */
export const simulateRaceV6 = (input: RaceInput): RaceTimeline => simulateTurns(input, 6)

/** Engine v7 (D158), frozen: races run on it replay exactly. */
export const simulateRaceV7 = (input: RaceInput): RaceTimeline => simulateTurns(input, 7)

/** Engine v8 (D231), frozen: v7 with the original's start, corners, final straight and exact turn physics. */
export const simulateRaceV8 = (input: RaceInput): RaceTimeline => simulateTurns(input, 8)

/** Engine v9 (D240): v8, and a speed skill speeds her up even while she is still accelerating. */
export const simulateRaceV9 = (input: RaceInput): RaceTimeline => simulateTurns(input, 9)

function simulateTurns(input: RaceInput, version: 6 | 7 | 8 | 9): RaceTimeline {
  assertRaceInput(input)
  const { distance } = input.course
  const total = raceTurns(distance)
  const tuning = tuningFor(version)
  const v7 = version >= 7
  const v8 = version >= 8
  const v9 = version >= 9
  const finalCorner = input.course.layout?.corners.at(-1)
  const corners = input.course.layout?.corners ?? []
  const straights = input.course.layout?.straights ?? []
  const lastStraight = input.course.layout?.straights.at(-1)
  const rng = createRng(input.seed)
  // Mood (the original's motivation), from each runner's own stream so it never shifts the race's other rolls.
  const moods = input.runners.map((runner) =>
    Math.floor(createRng((input.seed ^ Math.imul(runner.gate + 1, 0x7feb352d) ^ 0x4c957f2d) >>> 0).next() * 5) - 2)
  const runners = input.runners.map((runner, index) => initRunner({
    ...runner,
    stats: mapStats(runner.stats, (value) => value * (1 + tuning.moodStep * moods[index]!)),
  }, input.course, rng, input.seed, version))
  const count = runners.length
  const baseSpeed = baseSpeedFor(distance)
  const events: RaceEvent[] = moods.map((mood, runner) => ({ tick: 0, runner, type: 'mood' as const, value: mood }))
  const strategies = input.runners.map((runner) => runner.strategy)
  runners.forEach((r, i) => {
    if (r.skills.length > 0) resolveGateSkills(r, i, skillContext(r, input.course, i + 1, count, 0, null, i, strategies), events, distance)
  })
  // Engine v8 field facts: how many runners carry each skill; the favourites, ranked on their raced stats (the original
  // ranks its odds; stats stand in); and whether each runner has kept to a place band since the start settled.
  const sameSkillCounts = new Map<string, number>()
  const facts: SkillFieldFacts = { sameSkillCounts }
  const popularity: number[] = []
  // Place bands held since the start settled: inside the top X% (`order_rate_inX_continue`), and outside it (`…outX…`).
  const IN_BANDS = [20, 40, 50, 80] as const
  const OUT_BANDS = [20, 40, 50, 70] as const
  const bands = runners.map(() => ({
    in: Object.fromEntries(IN_BANDS.map((band) => [band, true])) as Record<number, boolean>,
    out: Object.fromEntries(OUT_BANDS.map((band) => [band, true])) as Record<number, boolean>,
  }))
  if (v8) {
    for (const runner of input.runners) {
      for (const id of new Set((runner.skills ?? []).map((skill) => skill.id))) sameSkillCounts.set(id, (sameSkillCounts.get(id) ?? 0) + 1)
    }
    const strength = (r: RunnerState) => r.speedStat + r.stamina + r.power + r.guts + r.wit
    runners.map((r, index) => ({ index, value: strength(r) }))
      .sort((left, right) => right.value - left.value || left.index - right.index)
      .forEach((entry, rank) => { popularity[entry.index] = rank + 1 })
  }

  const distances: number[] = []
  const speeds: number[] = []
  const hps: number[] = []
  const lanes: number[] = []
  const record = () => {
    for (const r of runners) {
      distances.push(r.d)
      speeds.push(r.finishTime === null && r.d > 0 ? actualSpeed(r) + r.lift : 0)
      hps.push(Math.max(0, r.hp / r.maxHp))
      lanes.push(r.pack!.lane)
    }
  }
  runners.forEach((r, i) => {
    if (r.startDelay >= LATE_START_THRESHOLD) events.push({ tick: 0, runner: i, type: 'late-start', value: r.startDelay })
  })
  record()

  // Engine v7's field state: each runner's position keeping and competitions, and the once-a-race Spot Struggle.
  const turnStates = v7 ? runners.map(createTurnRunnerState) : []
  const struggle = { started: false, expired: false }
  const legTurn = phaseStartTurns(total)[2]

  let leaderPhase = 0
  for (let turn = 1; turn <= MAX_RACE_SECONDS && runners.some((r) => r.finishTime === null); turn += 1) {
    const time = turn - 1
    const phase = turnPhase(turn, total)
    if (phase > leaderPhase) {
      leaderPhase = phase
      events.push({ tick: turn, runner: -1, type: 'phase', value: phase })
    }
    const section = turnSection(turn, total)
    const order = runners
      .map((runner, index) => ({ index, distance: runner.d }))
      .sort((left, right) => right.distance - left.distance || left.index - right.index)
    const places = new Map(order.map((item, index) => [item.index, index + 1]))
    const leaderDistance = order[0]!.distance
    runners.forEach((runner) => {
      expireActiveEffects(runner, turn, version)
      if (v8) scaleActiveEffects(runner, turn)
    })
    const snapshots: PackRunnerSnapshot[] = runners.map((runner, index) => ({
      index,
      distance: runner.d,
      speed: actualSpeed(runner) + runner.lift,
      targetSpeed: targetSpeed(runner, phase, distance, 1, version),
      power: runner.power,
      wit: runner.wit,
      strategy: runner.input.strategy,
      lane: runner.pack!.lane,
      hpEmpty: runner.hpEmpty,
      hasSpeedEffect: activeModifier(runner, 'target-speed') > 0 || activeModifier(runner, 'current-speed') > 0,
    }))
    // Near-lane, blocked and overtake timers (in turns) and final-straight duels read the start-of-turn field; a
    // duel's two-second window is two turns.
    updateFieldStateV5(runners, snapshots, places, input.course, turn, events, 1)
    runners.forEach((r, index) => {
      const pack = r.pack!
      const order = places.get(index)!
      pack.orderDelta = order - pack.order
      if (phase >= 2 && pack.orderDelta < 0) pack.passesAfterFinalLeg += -pack.orderDelta
      if (v8 && phase === 1 && pack.orderDelta < 0) pack.passesMiddle += -pack.orderDelta
      if (v8 && finalCorner && r.d >= finalCorner.start && pack.orderDelta < 0) pack.passesFinalCorner += -pack.orderDelta
      pack.order = order
      // v8: a place band held continuously from the second section on (the start's scramble excluded).
      if (v8 && section >= 1) {
        const rate = (order / count) * 100
        const band = bands[index]!
        for (const edge of IN_BANDS) if (rate > edge) band.in[edge] = false
        for (const edge of OUT_BANDS) if (rate <= edge) band.out[edge] = false
      }
    })
    const field: TurnField | null = v7
      ? { snapshots, order: order.map((item) => item.index), strategies, distance, turn, section, phase, legTurn, hpScale: tuning.hpScale, bandScale: tuning.bandScale }
      : null
    if (field) spotStruggleTurn(runners, turnStates, field, events, struggle)

    // 1–8: every runner's speed, HP and proposed move for the turn, from the same start-of-turn state.
    const moves: Move[] = []
    runners.forEach((r, i) => {
      if (r.finishTime !== null) return
      const dt = turn === 1 ? 1 - r.startDelay : 1
      if (section !== r.lastSection) {
        const max = (r.wit / 5500) * Math.log10(r.wit * 0.1)
        r.sectionRandom = rng.range(max - tuning.sectionLuck, max) / 100
        r.lastSection = section
      }
      updateHillTurn(r, input.course)
      if (phase >= 2 && r.spurt === null) planSpurt(r, distance, rng, version)
      if (r.spurt !== null && !r.spurting && r.d >= r.spurtStart) {
        r.spurting = true
        events.push({ tick: turn, runner: i, type: 'spurt', value: r.spurt })
      }
      if (r.skills.length > 0) {
        const [first, last] = phaseTurns(phase, total)
        const context = {
          ...skillContext(r, input.course, places.get(i)!, count, time, snapshots, i, strategies),
          // The phase is the race's, from the turn; timers count turns, which are seconds; motivation is 1–5.
          phase,
          motivation: moods[i]! + 3,
          phase_firsthalf: turn <= (first + last) / 2 ? 1 : 0,
          phase_laterhalf: turn > (first + last) / 2 ? 1 : 0,
          is_lastspurt: phase === 3 ? 1 : 0,
          behind_near_lane_time: r.behindNearTicks,
          infront_near_lane_time: r.infrontNearTicks,
          blocked_front_continuetime: r.blockedTicks,
          blocked_side_continuetime: r.pack!.blockedSideTicks,
          overtake_target_time: r.overtakeTicks,
          // v7: the first 10 m of the final straight is shorter than a turn's run, so the window is the turn she enters it.
          ...(v7 && lastStraight ? {
            is_last_straight_onetime: r.d >= lastStraight.start &&
              r.d < lastStraight.start + Math.max(LAST_STRAIGHT_ONETIME_METERS, actualSpeed(r)) ? 1 : 0,
          } : {}),
          ...(v8 ? {
            straight_front_type: straights.find((straight) => r.d >= straight.start && r.d < straight.end)?.frontType ?? 0,
            change_order_up_middle: r.pack!.passesMiddle,
            change_order_up_finalcorner_after: r.pack!.passesFinalCorner,
            ...Object.fromEntries(IN_BANDS.map((edge) => [`order_rate_in${edge}_continue`, bands[i]!.in[edge] ? 1 : 0])),
            ...Object.fromEntries(OUT_BANDS.map((edge) => [`order_rate_out${edge}_continue`, bands[i]!.out[edge] ? 1 : 0])),
            near_infront_count: snapshots.filter((other) => other.index !== i && other.distance > r.d && other.distance - r.d <= NEAR_DISTANCE &&
              Math.abs(other.lane - r.pack!.lane) < NEAR_LANES * HORSE_LANE).length,
            popularity: popularity[i]!,
            grade: input.course.grade ?? 0,
            visiblehorse: snapshots.filter((other) => other.index !== i && other.distance > r.d && other.distance - r.d <= VISIBLE_DISTANCE).length,
          } : {}),
        }
        const hpBefore = r.hp
        activateSkills(r, i, turn, context, events, version, distance, { turn, phase }, facts)
        // A heal resets stamina keep: she may compete again if her HP now covers the spurt.
        if (v7 && r.hp > hpBefore) turnStates[i]!.staminaKeep = false
      }
      let band: { coefficient: number; mode: PositionMode }
      if (field) {
        band = positionKeepTurn(r, i, turnStates[i]!, field)
        competeTurn(r, i, turnStates[i]!, field, events)
      } else {
        band = bandPull(r, leaderDistance, phase, distance, tuning)
      }
      if (band.mode !== r.pack!.mode) {
        r.pack!.mode = band.mode
        events.push({ tick: turn, runner: i, type: 'position-mode', positionMode: band.mode })
      }
      r.pack!.metrics.modeSeconds[band.mode] += dt
      let target = targetSpeed(r, phase, distance, band.coefficient, version)
      if (v7 && !r.hpEmpty) target = Math.min(MAX_TARGET_SPEED, target + fieldBonus(turnStates[i]!))
      const before = actualSpeed(r)
      // v8: off the rail on a corner she covers less of the course for the same running.
      const corner = v8 ? corners.find((segment) => r.d >= segment.start && r.d < segment.end) : undefined
      const ratio = corner ? cornerRatio(corner.end - corner.start, tuning.cornerAngle, r.pack!.lane) : 1
      if (v8) {
        // v8: the original's start dash, +24 m/s² only until 85% of base speed, then her own acceleration; and the
        // turn's speed and distance integrated exactly, piece by piece.
        const p = Math.min(phase, 2) as 0 | 1 | 2
        let accel = (r.slope > 0 ? UPHILL_BASE_ACCEL : BASE_ACCEL) * Math.sqrt(500 * r.power) * ACCEL_COEF[r.input.strategy][p] *
          SURFACE_APT_ACCEL[r.input.aptitude.surface] * DISTANCE_APT_ACCEL[r.input.aptitude.distance]
        accel = accel * tuning.accelScale + activeModifier(r, 'acceleration')
        if (r.dueling) accel += (160 * r.guts) ** 0.59 * 0.0001
        let run = 0
        let left = dt
        if (r.startDash && r.v < target) {
          const dashTo = Math.min(target, START_DASH_UNTIL * baseSpeed)
          const dashRate = accel + START_DASH_ACCEL
          const dashTime = Math.min(left, Math.max(0, (dashTo - r.v) / dashRate))
          const [v, covered] = stepTowards(r.v, dashTo, dashRate, dashTime)
          r.v = v
          run += covered
          left -= dashTime
          if (r.v >= dashTo - 1e-9) {
            r.startDash = false
            events.push({ tick: turn, runner: i, type: 'start-dash-end' })
          }
        }
        const decel = r.hpEmpty ? HP_EMPTY_DECEL : band.mode === 'pace-down' ? PACE_DOWN_DECEL : DECEL[Math.min(phase, 2)]!
        const [v, covered] = stepTowards(r.v, target, r.v < target ? accel : decel, left)
        r.v = v
        run += covered
        // v9: a target-speed skill only raises the pace she is heading for, so one that fires while she is still
        // accelerating did nothing in v8. Now its boost also lifts her running speed, never past that boosted target:
        // at cruise nothing changes, and below it she runs the boost faster for as long as it lasts (D240).
        r.lift = v9 ? Math.min(Math.max(0, activeModifier(r, 'target-speed')), Math.max(0, target - r.v)) : 0
        const bonus = actualSpeed(r) - r.v + r.lift
        moves.push({ index: i, from: r.d, to: r.d + (run + bonus * dt) * ratio, speed: actualSpeed(r) + r.lift, lane: r.pack!.lane, blockedBy: null, ratio })
        return
      }
      if (r.v < target) {
        const p = Math.min(phase, 2) as 0 | 1 | 2
        let accel = (r.slope > 0 ? UPHILL_BASE_ACCEL : BASE_ACCEL) * Math.sqrt(500 * r.power) * ACCEL_COEF[r.input.strategy][p] *
          SURFACE_APT_ACCEL[r.input.aptitude.surface] * DISTANCE_APT_ACCEL[r.input.aptitude.distance]
        accel = accel * tuning.accelScale + activeModifier(r, 'acceleration')
        if (r.dueling) accel += (160 * r.guts) ** 0.59 * 0.0001
        if (r.startDash) accel += START_DASH_ACCEL
        r.v = Math.min(target, r.v + accel * dt)
      } else if (r.v > target) {
        const decel = r.hpEmpty ? HP_EMPTY_DECEL : v7 && band.mode === 'pace-down' ? PACE_DOWN_DECEL : DECEL[Math.min(phase, 2)]!
        r.v = Math.max(target, r.v + decel * dt)
      }
      if (r.startDash && r.v >= START_DASH_UNTIL * baseSpeed) {
        r.startDash = false
        events.push({ tick: turn, runner: i, type: 'start-dash-end' })
      }
      const after = actualSpeed(r)
      moves.push({ index: i, from: r.d, to: r.d + ((before + after) / 2) * dt, speed: after, lane: r.pack!.lane, blockedBy: null, ratio: 1 })
    })

    // 9: passing, front to back by where each runner started the turn.
    moves.sort((left, right) => right.from - left.from || left.index - right.index)
    const resolved: Move[] = []
    const occupied = (lane: number, at: number, self: number) => resolved.some((other) =>
      other.index !== self && Math.abs(other.lane - lane) < HORSE_LANE && Math.abs(other.to - at) < PASS_GAP)
    const closing = (move: Move) => resolved.some((other) => Math.abs(other.lane - move.lane) < HORSE_LANE &&
      other.to > move.to && other.to - move.to < OVERTAKE_LOOKAHEAD && other.speed < move.speed)
    for (const move of moves) {
      const r = runners[move.index]!
      const pack = r.pack!
      const blocker = resolved
        .filter((other) => Math.abs(other.lane - move.lane) < HORSE_LANE && other.from >= move.from && other.to - move.to < PASS_GAP)
        .sort((left, right) => left.to - right.to || left.index - right.index)[0]
      if (blocker) {
        // Out first, as far as the swing allows (v7: as far as her Power carries her), then one lane in; the nearest
        // free lane wins.
        const swing = v7 ? swingLanes(r.power, tuning.swing) : tuning.swing
        const lanes = [
          ...Array.from({ length: swing }, (_, step) => move.lane + (step + 1) * LANE_STEP),
          move.lane - LANE_STEP,
        ].filter((lane) => lane >= 0 && lane <= COURSE_WIDTH)
        const free = lanes.find((lane) => !occupied(lane, move.to, move.index))
        if (free !== undefined) {
          move.lane = free
          events.push({ tick: turn, runner: move.index, type: 'lane-change', value: free })
        } else {
          move.to = Math.max(move.from, Math.min(move.to, blocker.to - PASS_GAP))
          move.speed = Math.min(move.speed, blocker.speed)
          move.blockedBy = blocker.index
        }
      } else if (v7 && closing(move)) {
        // v7: she steers round a slower runner she is closing on before she reaches her, as the original's overtake
        // lane mode does, one lane a turn.
        const out = move.lane + LANE_STEP
        if (out <= COURSE_WIDTH && !occupied(out, move.to, move.index)) {
          move.lane = out
          events.push({ tick: turn, runner: move.index, type: 'lane-change', value: out })
        }
      } else if (move.lane > 0 && tuning.railDrift > 0 &&
        // v8: from the final corner on she holds her lane, as the original's runners do, rather than return to the rail.
        !(tuning.finalCornerHold && finalCorner !== undefined && move.from >= finalCorner.start)) {
        const inside = Math.max(0, move.lane - tuning.railDrift * LANE_STEP)
        if (!occupied(inside, move.to, move.index)) move.lane = inside
      }
      const wasBlocked = pack.frontBlocker !== null
      pack.frontBlocker = move.blockedBy
      if (wasBlocked !== (move.blockedBy !== null)) {
        events.push({ tick: turn, runner: move.index, type: 'blocked', value: move.blockedBy === null ? 0 : 1, targetRunner: move.blockedBy ?? undefined })
      }
      if (move.blockedBy !== null) pack.metrics.blockedSeconds += 1
      resolved.push(move)
    }

    // Overtakes: every runner who ends the turn ahead of one she started behind. Two runners home on the same turn are
    // ordered by when in the turn each crossed the line, not by where they would have ended past it.
    const crossing = (move: Move) => move.to >= distance ? (distance - move.from) / Math.max(move.to - move.from, 0.001) : Infinity
    const ahead = (left: Move, right: Move) => left.to >= distance && right.to >= distance
      ? crossing(left) < crossing(right)
      : left.to > right.to
    for (const move of resolved) {
      const pack = runners[move.index]!.pack!
      pack.overtakeTarget = null
      for (const other of resolved) {
        if (other.index === move.index || other.from <= move.from || !ahead(move, other)) continue
        pack.overtakeTarget = other.index
        pack.metrics.overtakeAttempts += 1
        pack.metrics.overtakeSuccesses += 1
        events.push({ tick: turn, runner: move.index, type: 'overtake', value: 2, targetRunner: other.index })
      }
    }

    // 8 and 10: HP for the ground actually covered, and finishing inside the turn.
    for (const move of resolved) {
      const r = runners[move.index]!
      const dt = turn === 1 ? 1 - r.startDelay : 1
      const covered = move.to - move.from
      // v8: HP pays for the ground she ran, which off the rail on a corner is more than her progress.
      const speed = covered / move.ratio / Math.max(dt, 0.001)
      if (move.blockedBy !== null) r.v = Math.min(r.v, move.speed)
      r.pack!.lane = move.lane
      r.pack!.targetLane = move.lane
      // v7: Pace Down saves HP and a Spot Struggle burns it, as in the original.
      const fieldHp = v7
        ? (r.pack!.mode === 'pace-down' ? PACE_DOWN_HP_MODIFIER : 1) * (turnStates[move.index]!.struggleUntil === null ? 1 : SPOT_STRUGGLE_HP_MODIFIER)
        : 1
      // v7: the turn she finishes costs HP only for the ground up to the line.
      const toLine = v7 && move.to > distance ? (distance - move.from) / Math.max(covered, 0.001) : 1
      r.hp -= hpPerSecond(speed, baseSpeed, phase >= 2, r.gutsMod) * tuning.hpScale * (r.downhill ? DOWNHILL_HP_MODIFIER : 1) * fieldHp * dt * toLine
      if (!r.hpEmpty && r.hp <= 0) {
        r.hp = 0
        r.hpEmpty = true
        events.push({ tick: turn, runner: move.index, type: 'hp-empty' })
      }
      if (move.to >= distance) {
        const start = turn === 1 ? r.startDelay : time
        r.finishTime = start + ((distance - move.from) / Math.max(covered, 0.001)) * dt
        r.d = distance
        events.push({ tick: turn, runner: move.index, type: 'finish', value: r.finishTime })
      } else {
        r.d = move.to
      }
    }
    record()
  }

  return {
    tickRate: 1,
    ticks: distances.length / count,
    runnerCount: count,
    courseDistance: distance,
    distance: Float32Array.from(distances),
    speed: Float32Array.from(speeds),
    hp: Float32Array.from(hps),
    lane: Float32Array.from(lanes),
    events,
    results: rankRunners(runners),
  }
}
