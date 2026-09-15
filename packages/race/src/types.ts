import type { Grade, Stats, Strategy, Surface } from '@racer/domain'

export interface RaceCourse {
  /** Meters. */
  distance: number
  surface: Surface
}

export interface RaceRunnerInput {
  id: string
  label: string
  /** Final race stats — Race Form (and later mood) already applied by the caller. */
  stats: Stats
  strategy: Strategy
  aptitude: { distance: Grade; surface: Grade; strategy: Grade }
  /** 0-based gate, also used as the lane until pack mechanics (R3) exist. */
  gate: number
}

export interface RaceInput {
  course: RaceCourse
  runners: readonly RaceRunnerInput[]
  seed: number
}

export type RaceEventType = 'late-start' | 'start-dash-end' | 'phase' | 'spurt' | 'hp-empty' | 'finish'

export interface RaceEvent {
  tick: number
  /** Runner index into `input.runners`; -1 for race-wide events (phase changes of the leader). */
  runner: number
  type: RaceEventType
  value?: number
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
  events: RaceEvent[]
  /** Sorted by placement. */
  results: RunnerResult[]
}
