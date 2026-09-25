// Engine v6's clock (docs/tasks/M021-turn-based-races.md, D154): a race is a fixed number of one-second turns, and its
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

/**
 * Engine v6's tuning table (M021, T070): style bands in lengths behind the leader, the band's pull on target speed,
 * the Speed term (the original's at `speedReference`, with `speedCoef` scaling the √(500 × Speed) gap from it, counted
 * from `speedFromPhase`), acceleration and the HP rate. `pnpm sim:turns` may adjust it
 * between runs; the game treats it as constant.
 */
export const V6_TUNING = {
  bands: { front: [0, 2], pace: [2, 5], late: [5, 8], end: [7, 11] } as Record<'front' | 'pace' | 'late' | 'end', readonly [number, number]>,
  ease: 0.985,
  press: 1.015,
  speedCoef: 0.005,
  speedFromPhase: 1,
  /** The Speed the term is anchored at: a runner here gets the original's term, and `speedCoef` scales the gap. */
  speedReference: 600,
  /** Acceleration, as a share of the original's. */
  accelScale: 2,
  /** HP spent per second, as a share of the original's rate. */
  hpScale: 0.85,
  /** How many lanes a blocked runner may swing out in one turn to get around; she comes back in one at a time. */
  swing: 3,
  /** Lanes an unblocked runner drifts toward the rail per turn when the way is clear. */
  railDrift: 0.2,
  /** Width, in % of base speed, of each section's Wit roll (the original's is 0.65). */
  sectionLuck: 0.65,
  /**
   * The original's mood, rolled per runner per race: each level from Awful (−2) to Great (+2) is equally likely and
   * moves every stat by `moodStep` a level. It is what lets a slightly weaker runner win on her day.
   */
  moodStep: 0.02,
}

/** Engine v6's Speed term for an effective Speed stat and a distance-aptitude multiplier. */
export function v6SpeedTerm(speed: number, aptitude: number): number {
  const anchor = Math.sqrt(500 * V6_TUNING.speedReference)
  return (0.002 * anchor + V6_TUNING.speedCoef * (Math.sqrt(500 * speed) - anchor)) * aptitude
}
