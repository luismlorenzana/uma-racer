import type { CompiledRaceSkill, Grade, RaceCourseLayout, RaceSkillEffectKind, Stats, Strategy, Surface } from '@racer/domain'

export interface RaceCourse {
  /** Meters. */
  distance: number
  surface: Surface
  /** Imported source season code used by simple skill conditions. */
  season?: number
  /** Immutable engine-v3 course geometry (v5 adds slopes). Missing uses the documented whole-course straight fallback. */
  layout?: RaceCourseLayout
  /** Engine v5 course facts for skill conditions: the imported track id and the original's rotation code. */
  trackId?: number
  rotation?: number
  /** Engine v8: the original's grade code (G1 100, G2 200, G3 300, OP 400 …) for the `grade` condition. */
  grade?: number
}

export interface RaceRunnerInput {
  id: string
  label: string
  /** Final race stats — the trained stats, with any later race-time modifier (mood) already applied by the caller. */
  stats: Stats
  strategy: Strategy
  aptitude: { distance: Grade; surface: Grade; strategy: Grade }
  /** 0-based gate. Engine v3 derives a continuous initial lane from it. */
  gate: number
  /** Immutable, content-compiled R2.5 skills. Missing means the legacy skillless input. */
  skills?: readonly CompiledRaceSkill[]
}

export interface RaceInput {
  course: RaceCourse
  runners: readonly RaceRunnerInput[]
  seed: number
}

export type PositionMode = 'normal' | 'front-speed-up' | 'front-overtake' | 'pace-up' | 'pace-down' | 'pace-up-ex'

export type RaceEventType =
  | 'late-start' | 'start-dash-end' | 'phase' | 'spurt' | 'hp-empty' | 'skill-activated' | 'finish'
  | 'position-mode' | 'blocked' | 'overtake' | 'lane-change'
  /** Engine v5: a final-straight duel starts (value 1, `targetRunner` the rival) or ends (value 0). */
  | 'duel'
  /** Engine v6: a runner's mood for the race, at the gate: −2 (Awful) to +2 (Great). */
  | 'mood'
  /** Engine v7: Spot Struggle among the front runners starts (value 1) or ends (value 0) for this runner. */
  | 'spot-struggle'
  /** Engine v7: a two-second push before the spurt — Secure Lead (value 1) or Repositioning (value 2). */
  | 'compete'
  /** Engine v7: she notices she is short of HP and sits the competitions out. */
  | 'stamina-keep'

export interface RaceEvent {
  tick: number
  /** Runner index into `input.runners`; -1 for race-wide events (phase changes of the leader). */
  runner: number
  type: RaceEventType
  value?: number
  skillId?: string
  skillGroup?: number
  skillEffects?: readonly RaceSkillEffectKind[]
  skillExpiresTick?: number
  positionMode?: PositionMode
  targetRunner?: number
}

export interface RunnerResult {
  runner: number
  id: string
  placement: number
  /** Seconds from the gate opening. */
  finishTime: number
  /** Lengths behind the runner one place ahead (0 for the winner). */
  marginLengths: number
  startDelay: number
  /** Spurt target speed chosen at the final leg, and whether it was the maximum. */
  spurtSpeed: number
  spurtMaxed: boolean
  pack?: RunnerPackMetrics
}

export interface RunnerPackMetrics {
  modeSeconds: Record<PositionMode, number>
  blockedSeconds: number
  overtakeAttempts: number
  overtakeSuccesses: number
}

export interface RaceTimeline {
  tickRate: number
  /** Number of recorded ticks (frames). */
  ticks: number
  runnerCount: number
  courseDistance: number
  /** Distance covered, indexed `tick * runnerCount + runner`. */
  distance: Float32Array
  /** Current speed in m/s, same indexing. */
  speed: Float32Array
  /** Remaining HP as a 0–1 fraction, same indexing. */
  hp: Float32Array
  /** Continuous meters from the inner fence. Present on engine-v3 timelines. */
  lane?: Float32Array
  events: RaceEvent[]
  /** Sorted by placement. */
  results: RunnerResult[]
}
