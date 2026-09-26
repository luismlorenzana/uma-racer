// Race engine milestone R1 (docs/design/racing.md#race-engine-milestones):
// phases/sections, strategy target speeds, accel/decel, start delay + start dash, HP drain with the late-race guts
// modifier, minimum speed, Wit section randomness, the final-leg spurt decision, R2.5 skills, and the R3 pack.
// Not yet modelled: dueling/slopes/rushed (R4) and advanced skills (R5).
import {
  STAMINA_CONTEST_COEF,
  STAMINA_CONTEST_DISTANCE_FACTOR,
  STAMINA_CONTEST_RANDOM,
  STAMINA_CONTEST_THRESHOLD,
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
  COURSE_WIDTH,
  DIRT_GRADE_TRACKS,
  DOWNHILL_ENTER_PER_WIT,
  DOWNHILL_EXIT_CHANCE,
  DOWNHILL_HP_MODIFIER,
  DUEL_DISTANCE,
  DUEL_EXIT_DISTANCE,
  DUEL_EXIT_HP,
  DUEL_LANE_SHARE,
  DUEL_MIN_HP,
  DUEL_SPEED_GAP,
  DUEL_WINDOW_SECONDS,
  FIXED_GROUND_CONDITION,
  FIXED_MOTIVATION,
  FIXED_WEATHER,
  HORSE_LANE,
  LAST_STRAIGHT_ONETIME_METERS,
  NEAR_DISTANCE,
  NEAR_LANES,
  PACE_DOWN_DECEL,
  PACE_DOWN_HP_MODIFIER,
  UPHILL_BASE_ACCEL,
} from './constants'
import {
  GATE_EFFECT_KINDS,
  RANDOM_COURSE_VARIABLES,
  RANDOM_PHASE_VARIABLES,
  SKILL_ACTIVATION_MIN,
  SKILL_ACTIVATION_WIT_DIVISOR,
  evaluateRaceCondition,
  raceSkillSupported,
  type CompiledRaceSkill,
  type RaceCondition,
  type RaceSkillEffectKind,
  type Stats,
  type Strategy,
} from '@racer/domain'
import { createRng, type Rng } from './rng'
import { phaseTurns, raceTurns, tuningFor, turnSpeedTerm } from './turn-clock'
import {
  createPackState,
  nearCount,
  resolveOverlaps,
  updatePackRunner,
  type PackDecision,
  type PackRunnerSnapshot,
  type PackState,
} from './pack'
import type { RaceCourse, RaceEvent, RaceInput, RaceRunnerInput, RaceTimeline, RunnerResult } from './types'
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

export interface RunnerState {
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
  pack: PackState | null
  packRng: Rng
  /** Race-start stamina after gate skills, unhalved: what the stamina contest reads (engine v5). */
  rawStamina: number
  /** Engine v5: where the planned spurt begins, and whether she has reached it. */
  spurtStart: number
  spurting: boolean
  /** Engine v5 hills: the slope underfoot (0 on the flat), downhill accel mode, and a separate stream per hill. */
  hill: number
  slope: number
  downhill: boolean
  hillTicks: number
  hillRngs: Rng[]
  /** Engine v5 final-straight duels. */
  duelTarget: number | null
  duelSince: number
  dueling: boolean
  dueled: boolean
  duelCount: number
  /** Engine v5 counters and timers read by skill conditions. */
  activations: { all: number; start: number; middle: number; endAfter: number; laterHalf: number; heal: number }
  overtakeTicks: number
  blockedTicks: number
  infrontNearTicks: number
  behindNearTicks: number
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
  /** Engine v6: a phase-random trigger fires on this turn rather than at a share of the distance. */
  turn?: number
  consumed: boolean
}

interface ActiveEffect {
  kind: Exclude<RaceSkillEffectKind, 'recovery'>
  amount: number
  untilTick: number
}

export type RulesVersion = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const hpPerSecond = (v: number, baseSpeed: number, lateRace: boolean, gutsMod: number): number =>
  ((20 * (v - baseSpeed + 12) ** 2) / 144) * (lateRace ? gutsMod : 1)

const phaseBounds = (phase: number): readonly [number, number] => [
  PHASE_STARTS[phase as 0 | 1 | 2 | 3],
  phase === 3 ? 1 : PHASE_STARTS[(phase + 1) as 1 | 2 | 3],
]

type Span = readonly [number, number]

/** Where on this course a random-point condition may fire (engine v5). Empty means it never can. */
function randomCourseSpans(variable: string, value: number, course: RaceCourse): Span[] {
  const { distance } = course
  const layout = course.layout ?? { corners: [], straights: [{ start: 0, end: distance }] }
  const phase = (index: number): Span => {
    const [start, end] = phaseBounds(index)
    return [start * distance, end * distance]
  }
  const clip = (spans: readonly Span[], [low, high]: Span): Span[] => spans.flatMap(([start, end]) => {
    const from = Math.max(start, low)
    const to = Math.min(end, high)
    return to > from ? [[from, to] as const] : []
  })
  const corners = layout.corners.map((corner): Span => [corner.start, corner.end])
  const straights = layout.straights.map((straight): Span => [straight.start, straight.end])
  const slopes = layout.slopes ?? []
  const validPhase = Number.isInteger(value) && value >= 0 && value <= 3
  switch (variable) {
    case 'all_corner_random': return value === 1 ? corners : []
    case 'corner_random': return layout.corners.filter((corner) => corner.number === value).map((corner): Span => [corner.start, corner.end])
    case 'straight_random': return value === 1 ? straights : []
    case 'phase_corner_random': return validPhase ? clip(corners, phase(value)) : []
    case 'phase_straight_random': return validPhase ? clip(straights, phase(value)) : []
    case 'phase_firstquarter_random': {
      if (!validPhase) return []
      const [start, end] = phase(value)
      return [[start, start + (end - start) / 4]]
    }
    case 'is_finalcorner_random': {
      const finalCorner = layout.corners.at(-1)
      return value === 1 && finalCorner ? [[finalCorner.start, finalCorner.end]] : []
    }
    case 'distance_rate_after_random': return value >= 0 && value < 100 ? [[(distance * value) / 100, distance]] : []
    case 'up_slope_random': return value === 1 ? slopes.filter((slope) => slope.slope > 0).map((slope): Span => [slope.start, slope.end]) : []
    case 'down_slope_random': return value === 1 ? slopes.filter((slope) => slope.slope < 0).map((slope): Span => [slope.start, slope.end]) : []
    default: return []
  }
}

/** One uniform point along the spans, or Infinity when there are none. */
function samplePoint(spans: readonly Span[], rng: Rng): number {
  const total = spans.reduce((sum, [start, end]) => sum + (end - start), 0)
  if (total <= 0) return Number.POSITIVE_INFINITY
  let offset = rng.range(0, total)
  for (const [start, end] of spans) {
    if (offset <= end - start) return start + offset
    offset -= end - start
  }
  return spans.at(-1)![1]
}

function randomPhaseTriggers(condition: RaceCondition | null, rng: Rng, course: RaceCourse, turns?: number): RandomPhaseTrigger[] {
  const seen = new Set<string>()
  return (condition ?? []).flatMap((alternative) => alternative.flatMap((atom) => {
    const phaseRandom = RANDOM_PHASE_VARIABLES.has(atom.variable)
    if (!phaseRandom && !RANDOM_COURSE_VARIABLES.has(atom.variable)) return []
    const key = `${atom.variable}:${atom.value}`
    if (seen.has(key)) return []
    seen.add(key)
    if (!phaseRandom) {
      const point = samplePoint(randomCourseSpans(atom.variable, atom.value, course), rng)
      return [{ variable: atom.variable, value: atom.value, distanceShare: point / course.distance, consumed: false }]
    }
    if (turns !== undefined) {
      // Engine v6: a random turn inside the phase's turns (or the half the variable names).
      if (!Number.isInteger(atom.value) || atom.value < 0 || atom.value > 3) return [{ variable: atom.variable, value: atom.value, distanceShare: Infinity, turn: Infinity, consumed: false }]
      const [first, last] = phaseTurns(atom.value, turns)
      const half = Math.floor((first + last) / 2)
      const low = atom.variable === 'phase_laterhalf_random' ? half + 1 : first
      const high = atom.variable === 'phase_firsthalf_random' ? half : last
      const turn = low + Math.floor(rng.next() * (Math.max(low, high) - low + 1))
      return [{ variable: atom.variable, value: atom.value, distanceShare: Infinity, turn, consumed: false }]
    }
    const [phaseStart, phaseEnd] = phaseBounds(atom.value)
    const middle = (phaseStart + phaseEnd) / 2
    const start = atom.variable === 'phase_laterhalf_random' ? middle : phaseStart
    const end = atom.variable === 'phase_firsthalf_random' ? middle : phaseEnd
    return [{ variable: atom.variable, value: atom.value, distanceShare: rng.range(start, end), consumed: false }]
  }))
}

/** The race-facing numbers a runner's stats produce. */
function runnerStats(stats: Stats, input: RaceRunnerInput, distance: number) {
  const guts = Math.max(1, effectiveStat(stats.guts))
  const stamina = effectiveStat(stats.stamina)
  const maxHp = 0.8 * HP_COEF[input.strategy] * stamina + distance
  return {
    speedStat: effectiveStat(stats.speed),
    stamina,
    power: Math.max(1, effectiveStat(stats.power)),
    guts,
    wit: Math.max(1, effectiveStat(stats.wit) * STRATEGY_APT_WIT[input.aptitude.strategy]),
    maxHp,
    hp: maxHp,
    minSpeed: 0.85 * baseSpeedFor(distance) + Math.sqrt(200 * guts) * 0.001,
    gutsMod: 1 + 200 / Math.sqrt(600 * guts),
  }
}

export function initRunner(input: RaceRunnerInput, course: RaceCourse, rng: Rng, raceSeed: number, rulesVersion: RulesVersion): RunnerState {
  const { distance } = course
  const derived = runnerStats(input.stats, input, distance)
  const turns = rulesVersion >= 6 ? raceTurns(distance) : undefined
  return {
    input,
    speedStat: derived.speedStat,
    stamina: derived.stamina,
    power: derived.power,
    guts: derived.guts,
    wit: derived.wit,
    maxHp: derived.maxHp,
    hp: derived.hp,
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
    minSpeed: derived.minSpeed,
    gutsMod: derived.gutsMod,
    lastPhase: 0,
    skills: rulesVersion >= 2 ? (input.skills ?? []).filter(raceSkillSupported).map((skill, skillIndex) => {
      const skillRng = createRng((raceSeed ^ Math.imul(input.gate + 1, 0x9e3779b9) ^ Math.imul(skillIndex + 1, 0x85ebca6b)) >>> 0)
      return {
        skill,
        resolved: false,
        rng: skillRng,
        groups: skill.groups.map((group) => ({
          armed: false,
          randomTriggers: [
            ...randomPhaseTriggers(group.precondition, skillRng, course, turns),
            ...randomPhaseTriggers(group.condition, skillRng, course, turns),
          ],
        })),
      }
    }) : [],
    activeEffects: [],
    pack: rulesVersion >= 3 ? createPackState(input.gate) : null,
    packRng: createRng((raceSeed ^ Math.imul(input.gate + 1, 0x27d4eb2d) ^ 0x165667b1) >>> 0),
    rawStamina: input.stats.stamina,
    spurtStart: Number.POSITIVE_INFINITY,
    spurting: false,
    hill: -1,
    slope: 0,
    downhill: false,
    hillTicks: 0,
    hillRngs: rulesVersion >= 5
      ? (course.layout?.slopes ?? []).map((_, hill) =>
        createRng((raceSeed ^ Math.imul(input.gate + 1, 0x632be5ab) ^ Math.imul(hill + 1, 0x1b873593)) >>> 0))
      : [],
    duelTarget: null,
    duelSince: 0,
    dueling: false,
    dueled: false,
    duelCount: 0,
    activations: { all: 0, start: 0, middle: 0, endAfter: 0, laterHalf: 0, heal: 0 },
    overtakeTicks: 0,
    blockedTicks: 0,
    infrontNearTicks: 0,
    behindNearTicks: 0,
  }
}

/** Target speed the stamina contest adds on reaching max spurt; 0 below the threshold or at 2,100 m and under. */
export function staminaContestBonus(stamina: number, distance: number, rng: Rng): number {
  const factor = STAMINA_CONTEST_DISTANCE_FACTOR.find(([upTo]) => distance <= upTo)![1]
  if (factor === 0 || stamina <= STAMINA_CONTEST_THRESHOLD) return 0
  const [low, high] = STAMINA_CONTEST_RANDOM
  return Math.sqrt(stamina - STAMINA_CONTEST_THRESHOLD) * STAMINA_CONTEST_COEF * factor * rng.range(low, high)
}

/** Picks the final-leg target speed: max spurt if HP allows, otherwise Wit-gated slower candidates. */
function decideSpurt(r: RunnerState, distance: number, rng: Rng, rulesVersion: RulesVersion): void {
  const baseSpeed = baseSpeedFor(distance)
  const aptSpeed = DISTANCE_APT_SPEED[r.input.aptitude.distance]
  const speedTerm = Math.sqrt(500 * r.speedStat) * aptSpeed * 0.002
  const base2 = baseSpeed * SPEED_COEF[r.input.strategy][2] + speedTerm
  const max = (base2 + 0.01 * baseSpeed) * 1.05 + speedTerm + (450 * r.guts) ** 0.597 * 0.0001
  const remaining = Math.max(0, distance - r.d - SPURT_BUFFER_METERS)
  const hpNeeded = (v: number) => (hpPerSecond(v, baseSpeed, true, r.gutsMod) * remaining) / v

  if (r.hp >= hpNeeded(max)) {
    // Engine v4: surplus stamina turns into last-spurt speed, from the raw race-start stat (D135).
    r.spurt = max + (rulesVersion >= 4 ? staminaContestBonus(r.input.stats.stamina, distance, rng) : 0)
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

/** Her final-leg pace and her maximum last-spurt speed (engine v5 and later). */
export function spurtCeiling(r: RunnerState, distance: number, rulesVersion: RulesVersion): { legPace: number; max: number } {
  const baseSpeed = baseSpeedFor(distance)
  const speedTerm = rulesVersion >= 6
    ? turnSpeedTerm(r.speedStat, DISTANCE_APT_SPEED[r.input.aptitude.distance], tuningFor(rulesVersion))
    : Math.sqrt(500 * r.speedStat) * DISTANCE_APT_SPEED[r.input.aptitude.distance] * 0.002
  const legPace = baseSpeed * SPEED_COEF[r.input.strategy][2] + speedTerm
  return { legPace, max: (legPace + 0.01 * baseSpeed) * 1.05 + speedTerm + (450 * r.guts) ** 0.597 * 0.0001 }
}

/**
 * Engine v5's last-spurt plan (verified against uma-skill-tools' HP policy; our own implementation). If her HP holds
 * the maximum spurt from here, she spurts now. Otherwise every slower speed is paired with the latest point she can
 * start it and still finish on her HP, holding her final-leg pace until then; the pairs are tried fastest finish
 * first, and Wit decides whether she settles for each one.
 */
export function planSpurt(r: RunnerState, distance: number, rng: Rng, rulesVersion: RulesVersion = 5): void {
  const baseSpeed = baseSpeedFor(distance)
  const { legPace, max } = spurtCeiling(r, distance, rulesVersion)
  const remaining = Math.max(0, distance - r.d - SPURT_BUFFER_METERS)
  const drain = (v: number) => hpPerSecond(v, baseSpeed, true, r.gutsMod) * (rulesVersion >= 6 ? tuningFor(rulesVersion).hpScale : 1)
  if (r.hp >= (drain(max) * remaining) / max) {
    r.spurt = max + staminaContestBonus(r.rawStamina, distance, rng)
    r.spurtStart = r.d
    r.spurtMaxed = true
    return
  }
  const plans: { start: number; speed: number }[] = []
  for (let v = max - SPURT_CANDIDATE_STEP; v >= legPace; v -= SPURT_CANDIDATE_STEP) {
    // Seconds at spurt speed, s, so that s·v + t·legPace covers the distance and the HP spent is exactly what is left.
    const seconds = Math.min(remaining / v, Math.max(0,
      (legPace * r.hp - drain(legPace) * remaining) / (legPace * drain(v) - drain(legPace) * v)))
    plans.push({ start: distance - (seconds * v + SPURT_BUFFER_METERS), speed: v })
  }
  r.spurtMaxed = false
  if (plans.length === 0) {
    // Her maximum is at or below her final-leg pace (a very low Speed): she never spurts.
    r.spurt = max
    r.spurtStart = distance
    return
  }
  const finish = (plan: { start: number; speed: number }) => (plan.start - r.d) / legPace + (distance - plan.start) / plan.speed
  plans.sort((left, right) => finish(left) - finish(right))
  const accept = (15 + 0.05 * r.wit) / 100
  const chosen = plans.find(() => rng.next() < accept) ?? plans[plans.length - 1]!
  r.spurt = chosen.speed
  r.spurtStart = Math.max(r.d, chosen.start)
}

export function activeModifier(r: RunnerState, kind: ActiveEffect['kind']): number {
  return r.activeEffects.filter((effect) => effect.kind === kind).reduce((sum, effect) => sum + effect.amount, 0)
}

export function expireActiveEffects(r: RunnerState, tick: number, rulesVersion: RulesVersion): void {
  const expired = r.activeEffects.filter((effect) => effect.untilTick <= tick)
  if (rulesVersion >= 3) {
    for (const effect of expired) if (effect.kind === 'current-speed-natural') r.v = Math.max(0, r.v + effect.amount)
  }
  r.activeEffects = r.activeEffects.filter((effect) => effect.untilTick > tick)
}

export function targetSpeed(r: RunnerState, phase: number, distance: number, positionCoefficient = 1, rulesVersion: RulesVersion = 4): number {
  const baseSpeed = baseSpeedFor(distance)
  if (r.hpEmpty) return r.minSpeed
  if (rulesVersion >= 5) {
    // Before her spurt point she holds the final-leg pace, which counts her Speed as the original does.
    const turnTuning = rulesVersion >= 6 ? tuningFor(rulesVersion) : null
    const aptitude = DISTANCE_APT_SPEED[r.input.aptitude.distance]
    const speedTerm = phase < (turnTuning ? turnTuning.speedFromPhase : 2) ? 0
      : turnTuning ? turnSpeedTerm(r.speedStat, aptitude, turnTuning) : Math.sqrt(500 * r.speedStat) * aptitude * 0.002
    const base = r.spurting && r.spurt !== null
      ? r.spurt
      : baseSpeed * SPEED_COEF[r.input.strategy][Math.min(phase, 2) as 0 | 1 | 2] + speedTerm + baseSpeed * r.sectionRandom
    let target = base * positionCoefficient + activeModifier(r, 'target-speed')
    if (r.dueling) target += (200 * r.guts) ** 0.708 * 0.0001
    if (r.downhill) target += 0.3 + Math.abs(r.slope) / 100_000
    else if (r.slope > 0) target -= (r.slope / 10_000) * 200 / r.power
    return r.startDash ? target : Math.max(target, r.minSpeed)
  }
  const baseTarget =
    phase >= 2 && r.spurt !== null
      ? r.spurt
      : baseSpeed * SPEED_COEF[r.input.strategy][Math.min(phase, 2) as 0 | 1 | 2] + baseSpeed * r.sectionRandom
  const modified = baseTarget * positionCoefficient + activeModifier(r, 'target-speed')
  return r.startDash ? modified : Math.max(modified, r.minSpeed)
}

export const actualSpeed = (r: RunnerState): number =>
  Math.max(0, r.v + activeModifier(r, 'current-speed') + activeModifier(r, 'current-speed-natural'))

const strategyNumber = (strategy: Strategy): number => ({ front: 1, pace: 2, late: 3, end: 4 })[strategy]
const distanceType = (distance: number): number => distance <= 1400 ? 1 : distance <= 1800 ? 2 : distance <= 2400 ? 3 : 4

/** Original-style Wit roll, clamped to the documented minimum activation chance. */
export const skillActivationChance = (wit: number): number =>
  Math.max(SKILL_ACTIVATION_MIN, Math.min(1, 1 - SKILL_ACTIVATION_WIT_DIVISOR / Math.max(1, wit)))

export function skillContext(
  r: RunnerState,
  course: RaceInput['course'],
  order: number,
  runnerCount: number,
  time: number,
  field: readonly PackRunnerSnapshot[] | null,
  runnerIndex: number,
  strategies: readonly Strategy[],
): Record<string, number> {
  const { distance } = course
  const phase = phaseAt(r.d, distance)
  const share = r.d / distance
  const phaseShare = phase === 0 ? share * 6 : phase === 1 ? (share - 1 / 6) * 2 : phase === 2 ? (share - 2 / 3) * 6 : (share - 5 / 6) * 6
  const layout = course.layout ?? { corners: [], straights: [{ start: 0, end: distance }] }
  const corner = layout.corners.find((segment) => r.d >= segment.start && r.d < segment.end)
  const finalCorner = layout.corners.at(-1)
  const finalCornerStarted = finalCorner ? r.d >= finalCorner.start : false
  const pack = r.pack
  const self = field?.find((snapshot) => snapshot.index === runnerIndex)
  const sorted = field ? [...field].sort((left, right) => right.distance - left.distance || left.index - right.index) : []
  const leader = sorted[0]
  const tail = sorted.at(-1)
  const ahead = self ? sorted.filter((other) => other.distance > self.distance).at(-1) : undefined
  const behind = self ? sorted.find((other) => other.distance < self.distance) : undefined
  const spread = leader && tail ? leader.distance - tail.distance : 0
  const lastStraight = layout.straights.at(-1)
  const styleCount = (style: Strategy) => strategies.filter((strategy) => strategy === style).length
  const sameOthers = styleCount(r.input.strategy) - 1
  return {
    // Engine v5 (M018): course facts, the clock, counters, and conditions the game fixes for now.
    accumulatetime: time,
    activate_count_all: r.activations.all,
    activate_count_end_after: r.activations.endAfter,
    activate_count_heal: r.activations.heal,
    activate_count_later_half: r.activations.laterHalf,
    activate_count_middle: r.activations.middle,
    activate_count_start: r.activations.start,
    behind_near_lane_time: r.behindNearTicks / TICK_RATE,
    blocked_front_continuetime: r.blockedTicks / TICK_RATE,
    compete_fight_count: r.duelCount,
    corner_count: layout.corners.length,
    distance_diff_top: self && leader ? leader.distance - self.distance : 0,
    distance_diff_top_float: self && leader ? leader.distance - self.distance : 0,
    ground_condition: FIXED_GROUND_CONDITION,
    infront_near_lane_time: r.infrontNearTicks / TICK_RATE,
    is_basis_distance: distance % 400 === 0 ? 1 : 0,
    is_dirtgrade: DIRT_GRADE_TRACKS.includes(course.trackId ?? 0) ? 1 : 0,
    is_last_straight: lastStraight && r.d >= lastStraight.start && r.d < lastStraight.end ? 1 : 0,
    is_last_straight_onetime: lastStraight && r.d >= lastStraight.start && r.d < lastStraight.start + LAST_STRAIGHT_ONETIME_METERS ? 1 : 0,
    motivation: FIXED_MOTIVATION,
    overtake_target_time: r.overtakeTicks / TICK_RATE,
    rotation: course.rotation ?? 0,
    running_style_count_nige_otherself: styleCount('front'),
    running_style_count_oikomi_otherself: styleCount('end'),
    running_style_count_sashi_otherself: styleCount('late'),
    running_style_count_same: sameOthers,
    running_style_count_same_rate: strategies.length > 1 ? (sameOthers / (strategies.length - 1)) * 100 : 0,
    running_style_count_senko_otherself: styleCount('pace'),
    slope: r.slope > 0 ? 1 : r.slope < 0 ? 2 : 0,
    track_id: course.trackId ?? 0,
    weather: FIXED_WEATHER,
    always: 1,
    bashin_diff_behind: self && behind ? (self.distance - behind.distance) / METERS_PER_LENGTH : 999,
    bashin_diff_infront: self && ahead ? (ahead.distance - self.distance) / METERS_PER_LENGTH : 999,
    base_guts: r.guts,
    base_power: r.power,
    base_speed: r.speedStat,
    base_stamina: r.stamina,
    base_wiz: r.wit,
    course_distance: distance,
    corner: corner?.number ?? 0,
    distance_diff_rate: self && leader && spread > 0 ? ((leader.distance - self.distance) / spread) * 100 : 0,
    distance_rate: share * 100,
    distance_type: distanceType(distance),
    furlong: Math.floor(r.d / 200),
    ground_type: course.surface === 'turf' ? 1 : 2,
    hp_per: (r.hp / r.maxHp) * 100,
    blocked_front: pack?.frontBlocker === null || pack === null ? 0 : 1,
    blocked_side_continuetime: (pack?.blockedSideTicks ?? 0) / TICK_RATE,
    change_order_onetime: pack?.orderDelta ?? 0,
    change_order_up_end_after: pack?.passesAfterFinalLeg ?? 0,
    is_badstart: r.startDelay >= LATE_START_THRESHOLD ? 1 : 0,
    is_goodstart: r.startDelay < LATE_START_THRESHOLD ? 1 : 0,
    is_finalcorner: finalCornerStarted ? 1 : 0,
    is_finalcorner_laterhalf: finalCorner && r.d >= (finalCorner.start + finalCorner.end) / 2 && r.d < finalCorner.end ? 1 : 0,
    is_lastspurt: phase === 3 ? 1 : 0,
    is_overtake: pack?.overtakeTarget === null || pack === null ? 0 : 1,
    lastspurt: r.spurt === null ? 0 : r.spurtMaxed ? 2 : 1,
    order,
    order_rate: (order / runnerCount) * 100,
    near_count: self && field ? nearCount(self, field) : 0,
    phase,
    phase_firsthalf: phaseShare < 0.5 ? 1 : 0,
    phase_laterhalf: phaseShare >= 0.5 ? 1 : 0,
    post_number: r.input.gate + 1,
    remain_distance: Math.max(0, distance - r.d),
    running_style: strategyNumber(r.input.strategy),
    season: course.season ?? 0,
    temptation_count: 0,
    time,
  }
}

export function activateSkills(
  r: RunnerState,
  runner: number,
  tick: number,
  context: Readonly<Record<string, number>>,
  events: RaceEvent[],
  rulesVersion: RulesVersion,
  courseDistance: number,
  /** Engine v6: the turn and its race-wide phase. Durations then count whole turns. */
  turn?: { turn: number; phase: number },
): void {
  for (const runtime of r.skills) {
    if (runtime.resolved) continue
    for (const [groupIndex, group] of runtime.skill.groups.entries()) {
      const state = runtime.groups[groupIndex]!
      if (group.effects.length === 0 || group.unsupportedVariables.length || group.unsupportedEffects.length) continue
      // Gate-only groups resolved (or failed) at the gate; they never fire mid-race.
      if (group.effects.every((effect) => GATE_EFFECT_KINDS.has(effect.kind))) continue
      const groupContext = { ...context }
      const crossed = state.randomTriggers.filter((trigger) => !trigger.consumed && (trigger.turn !== undefined
        ? turn !== undefined && turn.turn >= trigger.turn
        : context.distance_rate! / 100 >= trigger.distanceShare))
      for (const trigger of state.randomTriggers) groupContext[trigger.variable] = -1
      for (const trigger of crossed) groupContext[trigger.variable] = trigger.value
      if (!state.armed && evaluateRaceCondition(group.precondition, groupContext)) state.armed = true
      const matches = state.armed && evaluateRaceCondition(group.condition, groupContext)
      for (const trigger of crossed) trigger.consumed = true
      if (!matches) continue
      runtime.resolved = true
      if (runtime.skill.activation === 'wit' && runtime.rng.next() >= skillActivationChance(r.wit)) break
      const duration = rulesVersion >= 3 && group.duration >= 0 ? group.duration * courseDistance / 1_000 : group.duration
      const untilTick = duration === -1
        ? Number.MAX_SAFE_INTEGER
        : tick + Math.max(1, Math.round(duration * (turn ? 1 : TICK_RATE)))
      if (rulesVersion >= 5) {
        const phase = turn ? turn.phase : phaseAt(r.d, courseDistance)
        r.activations.all += 1
        if (phase === 0) r.activations.start += 1
        else if (phase === 1) r.activations.middle += 1
        else r.activations.endAfter += 1
        if (r.d >= courseDistance / 2) r.activations.laterHalf += 1
        if (group.effects.some((effect) => effect.kind === 'recovery')) r.activations.heal += 1
      }
      for (const effect of group.effects) {
        if (GATE_EFFECT_KINDS.has(effect.kind)) continue
        if (effect.kind === 'recovery') {
          r.hp = Math.min(r.maxHp, r.hp + r.maxHp * effect.amount)
          if (r.hp > 0) r.hpEmpty = false
          // A heal in the final leg before her spurt point re-plans the spurt (engine v5). From v7, as in the original, a
          // heal during a spurt short of her maximum re-plans it too, and she holds the leg's pace until the new point.
          if (rulesVersion >= 5 && r.spurt !== null && !r.spurting) {
            planSpurt(r, courseDistance, runtime.rng, rulesVersion)
          } else if (rulesVersion >= 7 && r.spurting && !r.spurtMaxed) {
            planSpurt(r, courseDistance, runtime.rng, rulesVersion)
            r.spurting = r.d >= r.spurtStart
          }
        } else if (effect.kind === 'current-speed' && rulesVersion < 3) {
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

/**
 * Engine v5 gate: green skills add to her stats and gate skills scale her start delay, before the doors open. Their
 * conditions read the race as it stands at the gate.
 */
export function resolveGateSkills(r: RunnerState, runner: number, context: Readonly<Record<string, number>>, events: RaceEvent[], distance: number): void {
  const gains: Stats = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
  const statFor: Partial<Record<RaceSkillEffectKind, keyof Stats>> = {
    'passive-speed': 'speed', 'passive-stamina': 'stamina', 'passive-power': 'power', 'passive-guts': 'guts', 'passive-wit': 'wit',
  }
  let delay = 1
  for (const runtime of r.skills) {
    for (const [groupIndex, group] of runtime.skill.groups.entries()) {
      if (group.effects.length === 0 || group.unsupportedVariables.length || group.unsupportedEffects.length) continue
      if (!group.effects.every((effect) => GATE_EFFECT_KINDS.has(effect.kind))) continue
      if (!evaluateRaceCondition(group.precondition, context) || !evaluateRaceCondition(group.condition, context)) continue
      runtime.resolved = true
      if (runtime.skill.activation === 'wit' && runtime.rng.next() >= skillActivationChance(r.wit)) break
      for (const effect of group.effects) {
        const stat = statFor[effect.kind]
        if (stat) gains[stat] += effect.amount
        else if (effect.kind === 'start-delay') delay *= effect.amount
      }
      r.activations.all += 1
      r.activations.start += 1
      events.push({
        tick: 0, runner, type: 'skill-activated', skillId: runtime.skill.id, skillGroup: groupIndex,
        skillEffects: group.effects.map((effect) => effect.kind), value: group.effects[0]?.amount,
      })
      break
    }
  }
  if (Object.values(gains).some((gain) => gain !== 0)) {
    const stats: Stats = {
      speed: r.input.stats.speed + gains.speed,
      stamina: r.input.stats.stamina + gains.stamina,
      power: r.input.stats.power + gains.power,
      guts: r.input.stats.guts + gains.guts,
      wit: r.input.stats.wit + gains.wit,
    }
    Object.assign(r, runnerStats(stats, r.input, distance))
    r.rawStamina = stats.stamina
  }
  r.startDelay *= delay
}

/** Engine v5 hills: which slope she is on, and each second on a descent whether downhill accel mode starts or ends. */
function updateHill(r: RunnerState, course: RaceCourse): void {
  const slopes = course.layout?.slopes ?? []
  const index = slopes.findIndex((slope) => r.d >= slope.start && r.d < slope.end)
  if (index !== r.hill) {
    r.hill = index
    r.slope = index === -1 ? 0 : slopes[index]!.slope
    r.downhill = false
    r.hillTicks = 0
    if (index !== -1 && r.slope < 0 && r.hillRngs[index]!.next() < r.wit * DOWNHILL_ENTER_PER_WIT) r.downhill = true
    return
  }
  if (index === -1) return
  r.hillTicks += 1
  if (r.hillTicks < TICK_RATE) return
  r.hillTicks = 0
  const roll = r.hillRngs[index]!.next()
  if (r.downhill) {
    if (roll < DOWNHILL_EXIT_CHANCE) r.downhill = false
  } else if (r.slope < 0 && roll < r.wit * DOWNHILL_ENTER_PER_WIT) {
    r.downhill = true
  }
}

/**
 * Engine v5 duels (競り合い) and the timers skill conditions read, from the start-of-tick field. A duel needs a rival
 * within 3 m and a quarter of the course width for 2 s, on the final straight, one of the pair in the top half, both
 * above 15% HP and within 0.6 m/s; it ends below 5% HP or once 5 m clear of every duelist. Former duelists never
 * duel again or become targets.
 */
export function updateFieldStateV5(
  runners: RunnerState[],
  snapshots: readonly PackRunnerSnapshot[],
  places: ReadonlyMap<number, number>,
  course: RaceCourse,
  tick: number,
  events: RaceEvent[],
  ticksPerSecond: number = TICK_RATE,
): void {
  const lastStraight = course.layout?.straights.at(-1)
  const onLastStraight = (d: number) => lastStraight !== undefined && d >= lastStraight.start && d < lastStraight.end
  const count = runners.length
  const running = (index: number) => runners[index]!.finishTime === null && runners[index]!.d > 0
  runners.forEach((r, i) => {
    if (!running(i)) return
    const self = snapshots[i]!
    const pack = r.pack!
    r.overtakeTicks = pack.overtakeTarget === null ? 0 : r.overtakeTicks + 1
    r.blockedTicks = pack.frontBlocker === null ? 0 : r.blockedTicks + 1
    const near = (other: PackRunnerSnapshot) => other.index !== i && Math.abs(other.lane - self.lane) < NEAR_LANES * HORSE_LANE
    r.infrontNearTicks = snapshots.some((other) => near(other) && other.distance > self.distance && other.distance - self.distance <= NEAR_DISTANCE)
      ? r.infrontNearTicks + 1 : 0
    r.behindNearTicks = snapshots.some((other) => near(other) && other.distance < self.distance && self.distance - other.distance <= NEAR_DISTANCE)
      ? r.behindNearTicks + 1 : 0
  })
  if (!lastStraight) return
  const hpShare = (r: RunnerState) => r.hp / r.maxHp
  runners.forEach((r, i) => {
    if (!running(i)) return
    const self = snapshots[i]!
    if (r.dueling) {
      const clear = runners.every((other, j) => j === i || !other.dueled || Math.abs(snapshots[j]!.distance - self.distance) >= DUEL_EXIT_DISTANCE)
      if (hpShare(r) < DUEL_EXIT_HP || clear) {
        r.dueling = false
        events.push({ tick, runner: i, type: 'duel', value: 0 })
      }
      return
    }
    if (r.dueled || r.hpEmpty) return
    const candidate = snapshots
      .filter((other) => other.index !== i && running(other.index) && !(runners[other.index]!.dueled && !runners[other.index]!.dueling) &&
        onLastStraight(other.distance) && Math.abs(other.distance - self.distance) < DUEL_DISTANCE &&
        Math.abs(other.lane - self.lane) < DUEL_LANE_SHARE * COURSE_WIDTH)
      .sort((left, right) => Math.abs(left.distance - self.distance) - Math.abs(right.distance - self.distance) || left.index - right.index)[0]
    if (!candidate) {
      r.duelTarget = null
      return
    }
    if (r.duelTarget !== candidate.index) {
      r.duelTarget = candidate.index
      r.duelSince = tick
      return
    }
    const rival = runners[candidate.index]!
    if (tick - r.duelSince >= DUEL_WINDOW_SECONDS * ticksPerSecond && onLastStraight(self.distance) &&
      (places.get(i)! <= count / 2 || places.get(candidate.index)! <= count / 2) &&
      hpShare(r) >= DUEL_MIN_HP && hpShare(rival) >= DUEL_MIN_HP && Math.abs(self.speed - candidate.speed) < DUEL_SPEED_GAP) {
      r.dueling = true
      r.dueled = true
      r.duelCount += 1
      events.push({ tick, runner: i, type: 'duel', value: 1, targetRunner: candidate.index })
    }
  })
}

function simulateRaceRules(input: RaceInput, rulesVersion: RulesVersion): RaceTimeline {
  assertRaceInput(input)
  const { distance } = input.course
  const rng = createRng(input.seed)
  const runners = input.runners.map((runner) => initRunner(runner, input.course, rng, input.seed, rulesVersion))
  const count = runners.length
  const baseSpeed = baseSpeedFor(distance)
  const events: RaceEvent[] = []
  const strategies = input.runners.map((runner) => runner.strategy)
  if (rulesVersion >= 5) {
    runners.forEach((r, i) => {
      if (r.skills.length > 0) resolveGateSkills(r, i, skillContext(r, input.course, i + 1, count, 0, null, i, strategies), events, distance)
    })
  }

  const distances: number[] = []
  const speeds: number[] = []
  const hps: number[] = []
  const lanes: number[] = []
  const record = () => {
    for (const r of runners) {
      distances.push(r.d)
      speeds.push(r.finishTime === null && r.d > 0 ? (rulesVersion >= 3 ? actualSpeed(r) : r.v) : 0)
      hps.push(Math.max(0, r.hp / r.maxHp))
      if (rulesVersion >= 3) lanes.push(r.pack!.lane)
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
    runners.forEach((runner) => expireActiveEffects(runner, tick, rulesVersion))
    const snapshots: PackRunnerSnapshot[] | null = rulesVersion >= 3
      ? runners.map((runner, index) => {
        const phase = phaseAt(runner.d, distance)
        return {
          index,
          distance: runner.d,
          speed: actualSpeed(runner),
          targetSpeed: targetSpeed(runner, phase, distance, 1, rulesVersion),
          power: runner.power,
          wit: runner.wit,
          strategy: runner.input.strategy,
          lane: runner.pack!.lane,
          hpEmpty: runner.hpEmpty,
          hasSpeedEffect: activeModifier(runner, 'target-speed') > 0 || activeModifier(runner, 'current-speed') > 0 ||
            activeModifier(runner, 'current-speed-natural') > 0,
        }
      })
      : null
    if (rulesVersion >= 5 && snapshots) updateFieldStateV5(runners, snapshots, places, input.course, tick, events)
    const packDecisions: (PackDecision | null)[] = runners.map(() => null)
    if (snapshots) {
      const orderedIndexes = order.map((entry) => entry.index)
      runners.forEach((runner, index) => {
        if (runner.finishTime !== null || time + TICK_SECONDS <= runner.startDelay) return
        const state = runner.pack!
        const decision = updatePackRunner(
          state,
          snapshots[index]!,
          snapshots,
          orderedIndexes,
          sectionAt(runner.d, distance),
          phaseAt(runner.d, distance),
          distance,
          tick,
          runner.packRng,
        )
        packDecisions[index] = decision
        if (decision.modeChanged) events.push({ tick, runner: index, type: 'position-mode', positionMode: state.mode })
        if (decision.blockChanged) events.push({
          tick,
          runner: index,
          type: 'blocked',
          value: decision.frontBlocker === null ? 0 : 1,
          targetRunner: decision.frontBlocker ?? undefined,
        })
        if (decision.overtakeChanged || decision.overtakeCompleted) events.push({
          tick,
          runner: index,
          type: 'overtake',
          value: decision.overtakeCompleted ? 2 : decision.overtakeTarget === null ? 0 : 1,
          targetRunner: decision.overtakeTarget ?? undefined,
        })
        if (decision.laneChanged) events.push({ tick, runner: index, type: 'lane-change', value: state.targetLane })
      })
    }
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
      if (rulesVersion >= 5) updateHill(r, input.course)
      if (phase >= 2 && r.spurt === null) {
        if (rulesVersion >= 5) {
          planSpurt(r, distance, rng)
        } else {
          decideSpurt(r, distance, rng, rulesVersion)
          events.push({ tick, runner: i, type: 'spurt', value: r.spurt ?? 0 })
        }
      }
      // Engine v5 marks the spurt where it begins, which can be after the final leg starts.
      if (rulesVersion >= 5 && r.spurt !== null && !r.spurting && r.d >= r.spurtStart) {
        r.spurting = true
        events.push({ tick, runner: i, type: 'spurt', value: r.spurt })
      }

      // Most synthetic/baseline fields are skillless. Avoid building the comparatively rich R3 context when there is
      // nothing to activate; this keeps precomputation inside the existing full-field performance budget.
      if (rulesVersion >= 2 && r.skills.length > 0) {
        activateSkills(
          r,
          i,
          tick,
          skillContext(r, input.course, places.get(i)!, count, time, snapshots, i, strategies),
          events,
          rulesVersion,
          distance,
        )
      }

      const decision = packDecisions[i]
      const target = targetSpeed(r, phase, distance, decision?.positionCoefficient ?? 1, rulesVersion)
      if (r.v < target) {
        const p = Math.min(phase, 2) as 0 | 1 | 2
        let accel =
          (rulesVersion >= 5 && r.slope > 0 ? UPHILL_BASE_ACCEL : BASE_ACCEL) *
          Math.sqrt(500 * r.power) *
          ACCEL_COEF[r.input.strategy][p] *
          SURFACE_APT_ACCEL[r.input.aptitude.surface] *
          DISTANCE_APT_ACCEL[r.input.aptitude.distance]
        accel += activeModifier(r, 'acceleration')
        if (rulesVersion >= 5 && r.dueling) accel += (160 * r.guts) ** 0.59 * 0.0001
        if (r.startDash) accel += START_DASH_ACCEL
        r.v = Math.min(target, r.v + accel * dt)
      } else if (r.v > target) {
        const decel = r.hpEmpty
          ? HP_EMPTY_DECEL
          : rulesVersion >= 5 && r.pack?.mode === 'pace-down' ? PACE_DOWN_DECEL : DECEL[Math.min(phase, 2)]!
        r.v = Math.max(target, r.v + decel * dt)
      }
      if (r.startDash && r.v >= START_DASH_UNTIL * baseSpeed) {
        r.startDash = false
        events.push({ tick, runner: i, type: 'start-dash-end' })
      }

      if (decision?.speedCap !== null && decision?.speedCap !== undefined && actualSpeed(r) > decision.speedCap) {
        const currentModifier = activeModifier(r, 'current-speed') + activeModifier(r, 'current-speed-natural')
        r.v = Math.max(0, decision.speedCap - currentModifier)
      }

      const before = r.d
      const traveledSpeed = rulesVersion >= 3 ? actualSpeed(r) : r.v
      r.d += traveledSpeed * dt
      const packHpModifier = r.pack?.mode === 'pace-down' ? PACE_DOWN_HP_MODIFIER : 1
      const hillHpModifier = rulesVersion >= 5 && r.downhill ? DOWNHILL_HP_MODIFIER : 1
      r.hp -= hpPerSecond(r.v, baseSpeed, phase >= 2, r.gutsMod) * packHpModifier * hillHpModifier * dt
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
        r.finishTime = runStart + (distance - before) / Math.max(traveledSpeed, 0.001)
        r.d = distance
        events.push({ tick, runner: i, type: 'finish', value: r.finishTime })
      }
    })
    if (snapshots) resolveOverlaps(runners.map((runner) => runner.pack!), snapshots)
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
    ...(rulesVersion >= 3 ? { lane: Float32Array.from(lanes) } : {}),
    events,
    results: rankRunners(runners),
  }
}

/** Engine v5 race rules (M018): v4 plus the spurt plan, hills, final-straight duels, gate and green skills. */
export const simulateRace = (input: RaceInput): RaceTimeline => simulateRaceRules(input, 5)

/** Engine v5 by name, for replaying the races run under it once v6 is the current engine (M021). */
export const simulateRaceV5 = simulateRace

/** Engine v4, before v5's spurt plan, hills, duels and gate skills (M018): its replays keep their exact outcome. */
export const simulateRaceV4 = (input: RaceInput): RaceTimeline => simulateRaceRules(input, 4)

/** Engine v3, before the stamina contest: replays recorded under it must keep their exact outcome. */
export const simulateRaceV3 = (input: RaceInput): RaceTimeline => simulateRaceRules(input, 3)

/** Frozen T006 skill rules for append-only engine-v2 result replay. */
export const simulateRaceV2 = (input: RaceInput): RaceTimeline => simulateRaceRules(input, 2)

/** Frozen T005 skillless rules for append-only engine-v1 result replay. */
export const simulateRaceV1 = (input: RaceInput): RaceTimeline => simulateRaceRules(input, 1)

export function rankRunners(runners: RunnerState[]): RunnerResult[] {
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
      ...(r.pack ? { pack: r.pack.metrics } : {}),
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
