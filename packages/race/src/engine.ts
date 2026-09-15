// Race engine milestone R1 (docs/design/racing.md#race-engine-milestones):
// phases/sections, strategy target speeds, accel/decel, start delay + start dash, HP drain with the late-race guts
// modifier, minimum speed, Wit section randomness, and the final-leg spurt decision.
// Not yet modelled: lanes/blocking/position keeping (R3), dueling/slopes/rushed (R4), skills (R2.5/R5).
import {
  ACCEL_COEF,
  BASE_ACCEL,
  DECEL,
  DISTANCE_APT_ACCEL,
  DISTANCE_APT_SPEED,
  HP_COEF,
  HP_EMPTY_DECEL,
  LATE_START_THRESHOLD,
  MAX_RACE_SECONDS,
  MAX_START_DELAY,
  METERS_PER_LENGTH,
  PHASE_STARTS,
  SPEED_COEF,
  SPURT_BUFFER_METERS,
  SPURT_CANDIDATE_STEP,
  START_DASH_ACCEL,
  START_DASH_UNTIL,
  START_SPEED,
  STRATEGY_APT_WIT,
  SURFACE_APT_ACCEL,
  TICK_RATE,
  TICK_SECONDS,
} from './constants'
import { createRng, type Rng } from './rng'
import type { RaceEvent, RaceInput, RaceRunnerInput, RaceTimeline, RunnerResult } from './types'

/** Stats above 1200 count at half value, as in the original game (confirmed, see research doc). */
export const effectiveStat = (value: number): number => (value <= 1200 ? value : 1200 + (value - 1200) / 2)

export const baseSpeedFor = (distance: number): number => 20 - (distance - 2000) / 1000

export function phaseAt(distanceCovered: number, courseDistance: number): 0 | 1 | 2 | 3 {
  const share = distanceCovered / courseDistance
  if (share >= PHASE_STARTS[3]) return 3
  if (share >= PHASE_STARTS[2]) return 2
  if (share >= PHASE_STARTS[1]) return 1
  return 0
}

export const sectionAt = (distanceCovered: number, courseDistance: number): number =>
  Math.min(23, Math.floor(distanceCovered / (courseDistance / 24)))

interface RunnerState {
  input: RaceRunnerInput
  speedStat: number
  stamina: number
  power: number
  guts: number
  wit: number
  maxHp: number
  hp: number
  startDelay: number
  v: number
  d: number
  startDash: boolean
  sectionRandom: number
  lastSection: number
  spurt: number | null
  spurtMaxed: boolean
  hpEmpty: boolean
  finishTime: number | null
  minSpeed: number
  gutsMod: number
  lastPhase: number
}

const hpPerSecond = (v: number, baseSpeed: number, lateRace: boolean, gutsMod: number): number =>
  ((20 * (v - baseSpeed + 12) ** 2) / 144) * (lateRace ? gutsMod : 1)

function initRunner(input: RaceRunnerInput, distance: number, rng: Rng): RunnerState {
  const guts = Math.max(1, effectiveStat(input.stats.guts))
  const stamina = effectiveStat(input.stats.stamina)
  const baseSpeed = baseSpeedFor(distance)
  const maxHp = 0.8 * HP_COEF[input.strategy] * stamina + distance
  return {
    input,
    speedStat: effectiveStat(input.stats.speed),
    stamina,
    power: Math.max(1, effectiveStat(input.stats.power)),
    guts,
    wit: Math.max(1, effectiveStat(input.stats.wit) * STRATEGY_APT_WIT[input.aptitude.strategy]),
    maxHp,
    hp: maxHp,
    startDelay: rng.range(0, MAX_START_DELAY),
    v: START_SPEED,
    d: 0,
    startDash: true,
    sectionRandom: 0,
    lastSection: -1,
    spurt: null,
    spurtMaxed: false,
    hpEmpty: false,
    finishTime: null,
    minSpeed: 0.85 * baseSpeed + Math.sqrt(200 * guts) * 0.001,
    gutsMod: 1 + 200 / Math.sqrt(600 * guts),
    lastPhase: 0,
  }
}

/** Picks the final-leg target speed: max spurt if HP allows, otherwise Wit-gated slower candidates. */
function decideSpurt(r: RunnerState, distance: number, rng: Rng): void {
  const baseSpeed = baseSpeedFor(distance)
  const aptSpeed = DISTANCE_APT_SPEED[r.input.aptitude.distance]
  const speedTerm = Math.sqrt(500 * r.speedStat) * aptSpeed * 0.002
  const base2 = baseSpeed * SPEED_COEF[r.input.strategy][2] + speedTerm
  const max = (base2 + 0.01 * baseSpeed) * 1.05 + speedTerm + (450 * r.guts) ** 0.597 * 0.0001
  const remaining = Math.max(0, distance - r.d - SPURT_BUFFER_METERS)
  const hpNeeded = (v: number) => (hpPerSecond(v, baseSpeed, true, r.gutsMod) * remaining) / v

  if (r.hp >= hpNeeded(max)) {
    r.spurt = max
    r.spurtMaxed = true
    return
  }
  const candidates: number[] = []
  for (let v = max - SPURT_CANDIDATE_STEP; v > base2; v -= SPURT_CANDIDATE_STEP) {
    if (r.hp >= hpNeeded(v)) candidates.push(v)
  }
  const accept = (15 + 0.05 * r.wit) / 100
  r.spurt = candidates.find(() => rng.next() < accept) ?? candidates[candidates.length - 1] ?? base2
  r.spurtMaxed = false
}

function targetSpeed(r: RunnerState, phase: number, distance: number): number {
  const baseSpeed = baseSpeedFor(distance)
  if (r.hpEmpty) return r.minSpeed
  const target =
    phase >= 2 && r.spurt !== null
      ? r.spurt
      : baseSpeed * SPEED_COEF[r.input.strategy][Math.min(phase, 2) as 0 | 1 | 2] + baseSpeed * r.sectionRandom
  return r.startDash ? target : Math.max(target, r.minSpeed)
}

export function simulateRace(input: RaceInput): RaceTimeline {
  const { distance } = input.course
  const rng = createRng(input.seed)
  const runners = input.runners.map((runner) => initRunner(runner, distance, rng))
  const count = runners.length
  const baseSpeed = baseSpeedFor(distance)
  const events: RaceEvent[] = []

  const distances: number[] = []
  const speeds: number[] = []
  const hps: number[] = []
  const record = () => {
    for (const r of runners) {
      distances.push(r.d)
      speeds.push(r.finishTime === null && r.d > 0 ? r.v : 0)
      hps.push(Math.max(0, r.hp / r.maxHp))
    }
  }

  runners.forEach((r, i) => {
    if (r.startDelay >= LATE_START_THRESHOLD) events.push({ tick: 0, runner: i, type: 'late-start', value: r.startDelay })
  })
  record()

  const maxTicks = MAX_RACE_SECONDS * TICK_RATE
  let leaderPhase = 0
  let tick = 0
  while (tick < maxTicks && runners.some((r) => r.finishTime === null)) {
    const time = tick * TICK_SECONDS
    tick += 1
    runners.forEach((r, i) => {
      if (r.finishTime !== null) return
      // The gate opens at `startDelay`; only the remainder of this tick counts as running time.
      const runStart = Math.max(time, r.startDelay)
      const dt = time + TICK_SECONDS - runStart
      if (dt <= 0) return

      const phase = phaseAt(r.d, distance)
      const section = sectionAt(r.d, distance)
      if (section !== r.lastSection) {
        const max = (r.wit / 5500) * Math.log10(r.wit * 0.1)
        r.sectionRandom = rng.range(max - 0.65, max) / 100
        r.lastSection = section
      }
      if (phase >= 2 && r.spurt === null) {
        decideSpurt(r, distance, rng)
        events.push({ tick, runner: i, type: 'spurt', value: r.spurt ?? 0 })
      }

      const target = targetSpeed(r, phase, distance)
      if (r.v < target) {
        const p = Math.min(phase, 2) as 0 | 1 | 2
        let accel =
          BASE_ACCEL *
          Math.sqrt(500 * r.power) *
          ACCEL_COEF[r.input.strategy][p] *
          SURFACE_APT_ACCEL[r.input.aptitude.surface] *
          DISTANCE_APT_ACCEL[r.input.aptitude.distance]
        if (r.startDash) accel += START_DASH_ACCEL
        r.v = Math.min(target, r.v + accel * dt)
      } else if (r.v > target) {
        const decel = r.hpEmpty ? HP_EMPTY_DECEL : DECEL[Math.min(phase, 2)]!
        r.v = Math.max(target, r.v + decel * dt)
      }
      if (r.startDash && r.v >= START_DASH_UNTIL * baseSpeed) {
        r.startDash = false
        events.push({ tick, runner: i, type: 'start-dash-end' })
      }

      const before = r.d
      r.d += r.v * dt
      r.hp -= hpPerSecond(r.v, baseSpeed, phase >= 2, r.gutsMod) * dt
      if (!r.hpEmpty && r.hp <= 0) {
        r.hp = 0
        r.hpEmpty = true
        events.push({ tick, runner: i, type: 'hp-empty' })
      }
      const nowPhase = phaseAt(r.d, distance)
      if (nowPhase > leaderPhase) {
        leaderPhase = nowPhase
        events.push({ tick, runner: -1, type: 'phase', value: nowPhase })
      }
      r.lastPhase = nowPhase
      if (r.d >= distance) {
        r.finishTime = runStart + (distance - before) / Math.max(r.v, 0.001)
        r.d = distance
        events.push({ tick, runner: i, type: 'finish', value: r.finishTime })
      }
    })
    record()
  }

  return {
    tickRate: TICK_RATE,
    ticks: distances.length / count,
    runnerCount: count,
    courseDistance: distance,
    distance: Float32Array.from(distances),
    speed: Float32Array.from(speeds),
    hp: Float32Array.from(hps),
    events,
    results: rankRunners(runners),
  }
}

function rankRunners(runners: RunnerState[]): RunnerResult[] {
  const order = runners
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.finishTime ?? Infinity) - (b.r.finishTime ?? Infinity) || b.r.d - a.r.d || a.i - b.i)
  return order.map(({ r, i }, place) => {
    const ahead = order[place - 1]?.r
    const gapSeconds = ahead ? (r.finishTime ?? MAX_RACE_SECONDS) - (ahead.finishTime ?? MAX_RACE_SECONDS) : 0
    return {
      runner: i,
      id: r.input.id,
      placement: place + 1,
      finishTime: r.finishTime ?? MAX_RACE_SECONDS,
      marginLengths: (Math.max(0, gapSeconds) * r.v) / METERS_PER_LENGTH,
      startDelay: r.startDelay,
      spurtSpeed: r.spurt ?? 0,
      spurtMaxed: r.spurtMaxed,
    }
  })
}

/** Japanese-style margin wording used on results screens. */
export function formatMargin(lengths: number): string {
  if (lengths <= 0) return ''
  if (lengths < 0.05) return 'Nose'
  if (lengths < 0.15) return 'Head'
  if (lengths < 0.35) return 'Neck'
  if (lengths > 10) return 'Big margin'
  const quarters = Math.round(lengths * 4)
  const whole = Math.floor(quarters / 4)
  const frac = ['', '¼', '½', '¾'][quarters % 4]
  return whole === 0 ? `${frac} length` : `${whole}${frac ? ' ' + frac : ''} length${whole === 1 && !frac ? '' : 's'}`
}
