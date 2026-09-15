// Coefficients from community research of the original race simulation.
// Source and confidence markers: docs/research/race-mechanics.md (⚠️ = verify before relying on it).
import type { Grade, Strategy } from '@racer/domain'

export const TICK_RATE = 15
export const TICK_SECONDS = 1 / TICK_RATE
export const MAX_RACE_SECONDS = 600

export const START_SPEED = 3
export const START_DASH_ACCEL = 24
export const START_DASH_UNTIL = 0.85 // × base speed
export const MAX_START_DELAY = 0.1
export const LATE_START_THRESHOLD = 0.08

export const BASE_ACCEL = 0.0006
/** Spurt HP check ignores this final stretch (⚠️ community docs mention ~60 m). */
export const SPURT_BUFFER_METERS = 60
export const SPURT_CANDIDATE_STEP = 0.1

/** Phase index by share of the race: 0 opening · 1 middle · 2 final leg · 3 last spurt. */
export const PHASE_STARTS = [0, 1 / 6, 2 / 3, 5 / 6] as const

/** [phase 0, phase 1, phase 2+] */
export const SPEED_COEF: Record<Strategy, readonly [number, number, number]> = {
  front: [1.0, 0.98, 0.962],
  pace: [0.978, 0.991, 0.975],
  late: [0.938, 0.998, 0.994],
  end: [0.931, 1.0, 1.0],
}

export const ACCEL_COEF: Record<Strategy, readonly [number, number, number]> = {
  front: [1.0, 1.0, 0.996],
  pace: [0.985, 1.0, 0.996],
  late: [0.975, 1.0, 1.0],
  end: [0.945, 1.0, 0.997],
}

/** ⚠️ HP coefficients come from memory of community docs. */
export const HP_COEF: Record<Strategy, number> = {
  front: 0.95,
  pace: 0.89,
  late: 1.0,
  end: 0.995,
}

/** Deceleration when above target speed, by phase [0, 1, 2+]. */
export const DECEL = [-1.2, -0.8, -1.0] as const
export const HP_EMPTY_DECEL = -1.2

export const DISTANCE_APT_SPEED: Record<Grade, number> = { S: 1.05, A: 1.0, B: 0.9, C: 0.8, D: 0.6, E: 0.4, F: 0.2, G: 0.1 }
export const DISTANCE_APT_ACCEL: Record<Grade, number> = { S: 1.0, A: 1.0, B: 1.0, C: 1.0, D: 1.0, E: 0.6, F: 0.5, G: 0.4 }
export const SURFACE_APT_ACCEL: Record<Grade, number> = { S: 1.05, A: 1.0, B: 0.9, C: 0.8, D: 0.7, E: 0.5, F: 0.3, G: 0.1 }
/** ⚠️ B–F values from memory. */
export const STRATEGY_APT_WIT: Record<Grade, number> = { S: 1.1, A: 1.0, B: 0.85, C: 0.75, D: 0.6, E: 0.4, F: 0.2, G: 0.1 }

/** Meters per horse length, for margins. */
export const METERS_PER_LENGTH = 2.5
