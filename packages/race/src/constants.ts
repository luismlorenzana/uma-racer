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

/** Pack/lane constants are owned and pinned by the pure domain package. */
export {
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
  VISIBLE_DISTANCE,
} from '@racer/domain'

/**
 * Stamina contest (スタミナ勝負), added to the original game at its JP 2.5th anniversary (2023-08-24): stamina above
 * 1,200 at the start of a race adds target speed once a runner reaches max spurt. The stamina used is the race-start
 * value and is **not** halved above 1,200. Factors are the post-2024 values measured by the JP community
 * (docs/research/race-mechanics.md#stamina-contest). Engine v4 (D135).
 */
export const STAMINA_CONTEST_THRESHOLD = 1200
export const STAMINA_CONTEST_COEF = 0.0085
export const STAMINA_CONTEST_RANDOM = [0.98, 1.02] as const
/** [inclusive upper distance in meters, factor]; nothing at 2,100 m or shorter. */
export const STAMINA_CONTEST_DISTANCE_FACTOR: readonly (readonly [number, number])[] = [
  [2100, 0],
  [2200, 0.5],
  [2400, 1.0],
  [2600, 1.5],
  [Number.POSITIVE_INFINITY, 1.8],
]

// --- Engine v5 (M018) ------------------------------------------------------------------------------------------
// Verified against uma-skill-tools and the torena-sim mechanics notes (docs/research/race-engine-v5-findings.md).

/** Base acceleration while climbing. */
export const UPHILL_BASE_ACCEL = 0.0004
/** Deceleration while position keeping has her in Pace Down. */
export const PACE_DOWN_DECEL = -0.5
/** HP drain multipliers: Pace Down, and downhill accel mode. */
export const PACE_DOWN_HP_MODIFIER = 0.6
export const DOWNHILL_HP_MODIFIER = 0.4
/** Each second on a descent: Wit × this chance of entering downhill accel mode; once in it, this chance of leaving. */
export const DOWNHILL_ENTER_PER_WIT = 0.0004
export const DOWNHILL_EXIT_CHANCE = 0.2
/** Final-straight duels (競り合い). */
export const DUEL_DISTANCE = 3
export const DUEL_LANE_SHARE = 0.25
export const DUEL_WINDOW_SECONDS = 2
export const DUEL_SPEED_GAP = 0.6
export const DUEL_MIN_HP = 0.15
export const DUEL_EXIT_HP = 0.05
export const DUEL_EXIT_DISTANCE = 5
/** `is_last_straight_onetime` holds for the first 10 m of the final straight. */
export const LAST_STRAIGHT_ONETIME_METERS = 10
/** Local dirt venues the original tags as dirt-grade tracks. */
export const DIRT_GRADE_TRACKS: readonly number[] = [10101, 10103, 10104, 10105]
/** Conditions the game does not model yet read these fixed values: Good ground, sunny, normal mood. */
export const FIXED_GROUND_CONDITION = 1
export const FIXED_WEATHER = 1
export const FIXED_MOTIVATION = 3

// --- Engine v7 (D158) ------------------------------------------------------------------------------------------
// The original's field mechanics, from the torena-sim mechanics notes (docs/research/race-engine-v7-findings.md).
// Sections are 0-based here: the original's section 1 is our 0.

/** The original caps target speed here. */
export const MAX_TARGET_SPEED = 30

/** Spot Struggle (位置取り争い): front runners bunched at the front fight for the lead early on. */
export const SPOT_STRUGGLE_UNLOCK_METERS = 150
/** It can start up to the end of the original's section 6, and always ends when section 9 begins. */
export const SPOT_STRUGGLE_LAST_START_SECTION = 5
export const SPOT_STRUGGLE_END_SECTION = 8
export const SPOT_STRUGGLE_DISTANCE = 3.75
export const SPOT_STRUGGLE_LANE_SHARE = 0.165
export const SPOT_STRUGGLE_EXIT_DISTANCE = 5
export const SPOT_STRUGGLE_EXIT_LANE_SHARE = 0.416
export const SPOT_STRUGGLE_HP_MODIFIER = 1.4

/**
 * Competing before the spurt (位置取り調整 Repositioning, リード確保 Secure Lead): the original's sections 11–15, a check
 * every 2 s, a 2 s push, then a 1 s cooldown.
 */
export const COMPETE_FIRST_SECTION = 10
export const COMPETE_LAST_SECTION = 14
export const COMPETE_CHECK_SECONDS = 2
export const COMPETE_SECONDS = 2
export const COMPETE_COOLDOWN_SECONDS = 1
/** [inclusive upper distance in meters, factor] on a competition's HP cost. */
export const COMPETE_HP_DISTANCE_FACTOR: readonly (readonly [number, number])[] = [
  [1400, 0.3],
  [1800, 0.3],
  [2100, 0.5],
  [2200, 0.8],
  [2400, 1.0],
  [2600, 1.1],
  [Number.POSITIVE_INFINITY, 1.2],
]
/** Repositioning: how far behind the leader counts as far (scaled like position keeping), and its coefficients. */
export const REPOSITION_FAR_METERS: Record<Strategy, number> = { front: 0, pace: 2.5, late: 5, end: 10 }
export const REPOSITION_SPEED_COEF: Record<Strategy, number> = { front: 0.8, pace: 1, late: 1, end: 1 }
export const REPOSITION_HP_COEF: Record<Strategy, number> = { front: 1.2, pace: 1, late: 1, end: 1 }
/** Added to the HP factor when she competes only because others are near. */
export const REPOSITION_NEAR_HP = 0.5
/** A front runner with no other front runner within this many meters pushes harder: Repositioning ×1.1, Secure Lead ×2. */
export const SOLO_FRONT_METERS = 10
export const REPOSITION_SOLO_FRONT = 1.1
export const SECURE_LEAD_SOLO_FRONT = 2
/** Secure Lead: a flat chance per check (the original's Wit scaling is unknown). End closers never try. */
export const SECURE_LEAD_CHANCE = 0.2
export const SECURE_LEAD_SPEED_COEF: Record<Strategy, number> = { front: 1, pace: 1, late: 0.8, end: 0 }
export const SECURE_LEAD_HP_COEF: Record<Strategy, number> = { front: 1, pace: 0.8, late: 0.8, end: 0 }
/** The lead each style wants over each later style, before the course term 0.0003 × (distance + 1,000) m. */
export const SECURE_LEAD_MARGIN: Record<Strategy, Partial<Record<Strategy, number>>> = {
  front: { pace: 4, late: 8, end: 8 },
  pace: { late: 5, end: 6 },
  late: { end: 3 },
  end: {},
}
/** Stamina keep (持久力温存): the HP she wants in hand, as a multiple of what finishing at full spurt costs. */
export const STAMINA_KEEP_MARGIN = [1.035, 1.04] as const
