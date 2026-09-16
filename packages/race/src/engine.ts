// Race engine milestone R1 (docs/design/racing.md#race-engine-milestones):
// phases/sections, strategy target speeds, accel/decel, start delay + start dash, HP drain with the late-race guts
// modifier, minimum speed, Wit section randomness, the final-leg spurt decision, and basic R2.5 skills.
// Not yet modelled: lanes/blocking/position keeping (R3), dueling/slopes/rushed (R4), and advanced skills (R5).
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
import {
  RANDOM_PHASE_VARIABLES,
  SKILL_ACTIVATION_MIN,
  SKILL_ACTIVATION_WIT_DIVISOR,
  evaluateRaceCondition,
  raceSkillSupported,
  type CompiledRaceSkill,
  type RaceCondition,
  type RaceSkillEffectKind,
  type Strategy,
} from '@racer/domain'
import { createRng, type Rng } from './rng'
import type { RaceEvent, RaceInput, RaceRunnerInput, RaceTimeline, RunnerResult } from './types'
import { assertRaceInput } from './validation'

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
  skills: SkillRuntime[]
  activeEffects: ActiveEffect[]
}

interface SkillRuntime {
  skill: CompiledRaceSkill
  resolved: boolean
  rng: Rng
  groups: SkillGroupRuntime[]
}

interface SkillGroupRuntime {
  armed: boolean
  randomTriggers: RandomPhaseTrigger[]
}

interface RandomPhaseTrigger {
  variable: string
  value: number
  distanceShare: number
  consumed: boolean
}

interface ActiveEffect {
  kind: Exclude<RaceSkillEffectKind, 'recovery' | 'current-speed'>
  amount: number
  untilTick: number
}

const hpPerSecond = (v: number, baseSpeed: number, lateRace: boolean, gutsMod: number): number =>
  ((20 * (v - baseSpeed + 12) ** 2) / 144) * (lateRace ? gutsMod : 1)

const phaseBounds = (phase: number): readonly [number, number] => [
  PHASE_STARTS[phase as 0 | 1 | 2 | 3],
  phase === 3 ? 1 : PHASE_STARTS[(phase + 1) as 1 | 2 | 3],
]

function randomPhaseTriggers(condition: RaceCondition | null, rng: Rng): RandomPhaseTrigger[] {
  const seen = new Set<string>()
  return (condition ?? []).flatMap((alternative) => alternative.flatMap((atom) => {
    if (!RANDOM_PHASE_VARIABLES.has(atom.variable)) return []
    const key = `${atom.variable}:${atom.value}`
    if (seen.has(key)) return []
    seen.add(key)
    const [phaseStart, phaseEnd] = phaseBounds(atom.value)
    const middle = (phaseStart + phaseEnd) / 2
    const start = atom.variable === 'phase_laterhalf_random' ? middle : phaseStart
    const end = atom.variable === 'phase_firsthalf_random' ? middle : phaseEnd
    return [{ variable: atom.variable, value: atom.value, distanceShare: rng.range(start, end), consumed: false }]
  }))
}

function initRunner(input: RaceRunnerInput, distance: number, rng: Rng, raceSeed: number, skillsEnabled: boolean): RunnerState {
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
    skills: skillsEnabled ? (input.skills ?? []).filter(raceSkillSupported).map((skill, skillIndex) => {
      const skillRng = createRng((raceSeed ^ Math.imul(input.gate + 1, 0x9e3779b9) ^ Math.imul(skillIndex + 1, 0x85ebca6b)) >>> 0)
      return {
        skill,
        resolved: false,
        rng: skillRng,
        groups: skill.groups.map((group) => ({
          armed: false,
          randomTriggers: [
            ...randomPhaseTriggers(group.precondition, skillRng),
            ...randomPhaseTriggers(group.condition, skillRng),
          ],
        })),
      }
    }) : [],
    activeEffects: [],
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

function activeModifier(r: RunnerState, kind: ActiveEffect['kind'], tick: number): number {
  r.activeEffects = r.activeEffects.filter((effect) => effect.untilTick > tick)
  return r.activeEffects.filter((effect) => effect.kind === kind).reduce((sum, effect) => sum + effect.amount, 0)
}

function targetSpeed(r: RunnerState, phase: number, distance: number, tick: number): number {
  const baseSpeed = baseSpeedFor(distance)
  if (r.hpEmpty) return r.minSpeed
  const target =
    phase >= 2 && r.spurt !== null
      ? r.spurt
      : baseSpeed * SPEED_COEF[r.input.strategy][Math.min(phase, 2) as 0 | 1 | 2] + baseSpeed * r.sectionRandom
  const modified = target + activeModifier(r, 'target-speed', tick)
  return r.startDash ? modified : Math.max(modified, r.minSpeed)
}

const strategyNumber = (strategy: Strategy): number => ({ front: 1, pace: 2, late: 3, end: 4 })[strategy]
const distanceType = (distance: number): number => distance <= 1400 ? 1 : distance <= 1800 ? 2 : distance <= 2400 ? 3 : 4

/** Original-style Wit roll, clamped to the documented minimum activation chance. */
export const skillActivationChance = (wit: number): number =>
  Math.max(SKILL_ACTIVATION_MIN, Math.min(1, 1 - SKILL_ACTIVATION_WIT_DIVISOR / Math.max(1, wit)))

function skillContext(
  r: RunnerState,
  course: RaceInput['course'],
  order: number,
  runnerCount: number,
  time: number,
): Record<string, number> {
  const { distance } = course
  const phase = phaseAt(r.d, distance)
  const share = r.d / distance
  const phaseShare = phase === 0 ? share * 6 : phase === 1 ? (share - 1 / 6) * 2 : phase === 2 ? (share - 2 / 3) * 6 : (share - 5 / 6) * 6
  return {
    always: 1,
    base_guts: r.guts,
    base_power: r.power,
    base_speed: r.speedStat,
    base_stamina: r.stamina,
    base_wiz: r.wit,
    course_distance: distance,
    distance_rate: share * 100,
    distance_type: distanceType(distance),
    furlong: Math.floor(r.d / 200),
    ground_type: course.surface === 'turf' ? 1 : 2,
    hp_per: (r.hp / r.maxHp) * 100,
    is_badstart: r.startDelay >= LATE_START_THRESHOLD ? 1 : 0,
    is_goodstart: r.startDelay < LATE_START_THRESHOLD ? 1 : 0,
    is_lastspurt: phase === 3 ? 1 : 0,
    lastspurt: r.spurt === null ? 0 : r.spurtMaxed ? 2 : 1,
    order,
    order_rate: (order / runnerCount) * 100,
    phase,
    phase_firsthalf: phaseShare < 0.5 ? 1 : 0,
    phase_laterhalf: phaseShare >= 0.5 ? 1 : 0,
    post_number: r.input.gate + 1,
    remain_distance: Math.max(0, distance - r.d),
    running_style: strategyNumber(r.input.strategy),
    season: course.season ?? 0,
    time,
  }
}

function activateSkills(
  r: RunnerState,
  runner: number,
  tick: number,
  context: Readonly<Record<string, number>>,
  events: RaceEvent[],
): void {
  for (const runtime of r.skills) {
    if (runtime.resolved) continue
    for (const [groupIndex, group] of runtime.skill.groups.entries()) {
      const state = runtime.groups[groupIndex]!
      if (group.effects.length === 0 || group.unsupportedVariables.length || group.unsupportedEffects.length) continue
      const groupContext = { ...context }
      const crossed = state.randomTriggers.filter((trigger) => !trigger.consumed && context.distance_rate! / 100 >= trigger.distanceShare)
      for (const trigger of state.randomTriggers) groupContext[trigger.variable] = -1
      for (const trigger of crossed) groupContext[trigger.variable] = trigger.value
      if (!state.armed && evaluateRaceCondition(group.precondition, groupContext)) state.armed = true
      const matches = state.armed && evaluateRaceCondition(group.condition, groupContext)
      for (const trigger of crossed) trigger.consumed = true
      if (!matches) continue
      runtime.resolved = true
      if (runtime.skill.activation === 'wit' && runtime.rng.next() >= skillActivationChance(r.wit)) break
      const untilTick = group.duration === -1
        ? Number.MAX_SAFE_INTEGER
        : tick + Math.max(1, Math.round(group.duration * TICK_RATE))
      for (const effect of group.effects) {
        if (effect.kind === 'recovery') {
          r.hp = Math.min(r.maxHp, r.hp + r.maxHp * effect.amount)
          if (r.hp > 0) r.hpEmpty = false
        } else if (effect.kind === 'current-speed') {
          r.v = Math.max(0, r.v + effect.amount)
        } else {
          r.activeEffects.push({ kind: effect.kind, amount: effect.amount, untilTick })
        }
      }
      events.push({
        tick,
        runner,
        type: 'skill-activated',
        skillId: runtime.skill.id,
        skillGroup: groupIndex,
        skillEffects: group.effects.map((effect) => effect.kind),
        skillExpiresTick: untilTick === Number.MAX_SAFE_INTEGER ? undefined : untilTick,
        value: group.effects[0]?.amount,
      })
      break
    }
  }
}

function simulateRaceRules(input: RaceInput, skillsEnabled: boolean): RaceTimeline {
  assertRaceInput(input)
  const { distance } = input.course
  const rng = createRng(input.seed)
  const runners = input.runners.map((runner) => initRunner(runner, distance, rng, input.seed, skillsEnabled))
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
    const order = runners
      .map((runner, index) => ({ index, distance: runner.d }))
      .sort((left, right) => right.distance - left.distance || left.index - right.index)
    const places = new Map(order.map((item, index) => [item.index, index + 1]))
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

      if (skillsEnabled) activateSkills(r, i, tick, skillContext(r, input.course, places.get(i)!, count, time), events)

      const target = targetSpeed(r, phase, distance, tick)
      if (r.v < target) {
        const p = Math.min(phase, 2) as 0 | 1 | 2
        let accel =
          BASE_ACCEL *
          Math.sqrt(500 * r.power) *
          ACCEL_COEF[r.input.strategy][p] *
          SURFACE_APT_ACCEL[r.input.aptitude.surface] *
          DISTANCE_APT_ACCEL[r.input.aptitude.distance]
        accel += activeModifier(r, 'acceleration', tick)
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

/** Current race rules. New mechanics belong here and must not mutate the legacy replay path. */
export const simulateRace = (input: RaceInput): RaceTimeline => simulateRaceRules(input, true)

/** Frozen T005 skillless rules for append-only engine-v1 result replay. */
export const simulateRaceV1 = (input: RaceInput): RaceTimeline => simulateRaceRules(input, false)

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
