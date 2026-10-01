// Engine v6's clock (docs/design/racing.md#engine-v6-turns-m021, D154): a race is a fixed number of one-second turns, and its
// phases start on fixed turns shared by the whole field.

/** A course's turn count: its distance over its base speed, `20 − (distance − 2000) / 1000` m/s, rounded up. */
export const raceTurns = (distance: number): number => Math.ceil(distance / (20 - (distance - 2000) / 1000))

/** The first turn of each phase: Opening 1, Middle ⌈T/6⌉ + 1, Final leg ⌈2T/3⌉ + 1, Last spurt ⌈5T/6⌉ + 1. */
export const phaseStartTurns = (total: number): readonly [number, number, number, number] =>
  [1, Math.ceil(total / 6) + 1, Math.ceil((2 * total) / 3) + 1, Math.ceil((5 * total) / 6) + 1]

/** The race-wide phase on a turn; turns past the last stay in the last spurt. */
export function turnPhase(turn: number, total: number): 0 | 1 | 2 | 3 {
  const starts = phaseStartTurns(total)
  if (turn >= starts[3]) return 3
  if (turn >= starts[2]) return 2
  if (turn >= starts[1]) return 1
  return 0
}

/** First and last turn of a phase. */
export function phaseTurns(phase: number, total: number): readonly [number, number] {
  const starts = phaseStartTurns(total)
  const index = Math.max(0, Math.min(3, phase)) as 0 | 1 | 2 | 3
  return [starts[index], index === 3 ? total : starts[(index + 1) as 1 | 2 | 3] - 1]
}

/** The section (0–23) a turn falls in: the turns split into the original's 24 sections. */
export const turnSection = (turn: number, total: number): number => Math.max(0, Math.min(23, Math.floor(((turn - 1) * 24) / total)))

/** How a turn engine is tuned: the numbers `pnpm sim:turns` sets. v6's are frozen; v7's are the current engine's. */
export interface TurnTuning {
  /** Lengths behind the leader each style runs in through the opening and middle legs, set at 2,000 m. */
  bands: Record<'front' | 'pace' | 'late' | 'end', readonly [number, number]>
  /** The band's pull on target speed: ahead of it she eases, behind it she presses. */
  ease: number
  press: number
  /** The Speed term: the original's at `speedReference`, with `speedCoef` scaling the √(500 × Speed) gap from it. */
  speedCoef: number
  /** The first phase the Speed term counts in (the original: 2, the final leg). */
  speedFromPhase: number
  speedReference: number
  /** Acceleration, as a share of the original's. */
  accelScale: number
  /** HP spent per second, as a share of the original's rate. */
  hpScale: number
  /** How many lanes a blocked runner may swing out in one turn (v7 scales it with Power, up to this). */
  swing: number
  /** Lanes an unblocked runner drifts toward the rail per turn when the way is clear. */
  railDrift: number
  /** Engine v8: from the final corner on she holds her lane instead of drifting back to the rail (the original's). */
  finalCornerHold: boolean
  /** Engine v8: each corner's turn, in radians, so a runner off the rail covers more ground for the same progress. 0 is v6–v7's free running wide. */
  cornerAngle: number
  /**
   * Engine v8: scales the original's position-keeping bands (how far behind the leader Pace, Late and End settle) so
   * the styles stay balanced once the start no longer hands front runners a free lead (D231). 1 is the original's.
   */
  bandScale: number
  /** Width, in % of base speed, of each section's Wit roll (the original's is 0.65). */
  sectionLuck: number
  /** The original's mood: each level from Awful (−2) to Great (+2) moves every stat by this much. */
  moodStep: number
}

/**
 * Engine v6 (M021, D155), frozen so its races replay exactly: a Speed term with 2.5× the original's slope from the
 * middle leg, doubled acceleration and a lighter HP rate.
 */
export const V6_TUNING: Readonly<TurnTuning> = Object.freeze<TurnTuning>({
  bands: { front: [0, 2], pace: [2, 5], late: [5, 8], end: [7, 11] },
  ease: 0.985,
  press: 1.015,
  speedCoef: 0.005,
  speedFromPhase: 1,
  speedReference: 600,
  accelScale: 2,
  hpScale: 0.85,
  swing: 3,
  railDrift: 0.2,
  finalCornerHold: false,
  cornerAngle: 0,
  bandScale: 1,
  sectionLuck: 0.65,
  moodStep: 0.02,
})

/**
 * Engine v7 (D158): the original's physics — Speed counts from the final leg on the original's slope, acceleration and
 * HP at the original's rates — so every stat and every skill weighs what it does in the original. The sims may adjust
 * it between runs (`V7='{…}' pnpm sim:turns`); the game treats it as constant.
 */
export const V7_TUNING: Readonly<TurnTuning> = Object.freeze<TurnTuning>({
  bands: { front: [0, 2], pace: [2, 5], late: [5, 8], end: [7, 11] },
  ease: 0.985,
  press: 1.015,
  speedCoef: 0.002,
  speedFromPhase: 2,
  speedReference: 600,
  accelScale: 1,
  hpScale: 1,
  swing: 3,
  railDrift: 0.2,
  finalCornerHold: false,
  cornerAngle: 0,
  bandScale: 1,
  sectionLuck: 0.65,
  moodStep: 0.02,
})

/**
 * Engine v8 (D231): v7 with the original's start dash and exact physics inside each turn, the ground a runner off the
 * rail gives up on a corner, holding her lane from the final corner, and exact skill durations. The sims may adjust it
 * between runs (`V8='{…}' pnpm sim:turns`); the game treats it as constant.
 */
export const V8_TUNING: TurnTuning = {
  ...V7_TUNING,
  bands: { ...V7_TUNING.bands },
  finalCornerHold: true,
  cornerAngle: Math.PI / 2,
  // Set with `pnpm sim:turns` (2026-10-01): wins by style stay within 13–37% at every distance, as under v7.
  bandScale: 1.9,
}

/** The tuning a turn engine version runs on. */
export const tuningFor = (rulesVersion: number): TurnTuning =>
  rulesVersion >= 8 ? V8_TUNING : rulesVersion >= 7 ? V7_TUNING : V6_TUNING

/** A turn engine's Speed term for an effective Speed stat and a distance-aptitude multiplier. */
export function turnSpeedTerm(speed: number, aptitude: number, tuning: TurnTuning): number {
  const anchor = Math.sqrt(500 * tuning.speedReference)
  return (0.002 * anchor + tuning.speedCoef * (Math.sqrt(500 * speed) - anchor)) * aptitude
}
