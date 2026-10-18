// The rework's one time factor (docs/game/README.md "Time model", D338). Every duration is a base formula in minutes
// × TIME_FACTOR, held as whole seconds, then divided by a building's speed (docs/game/architecture.md#the-rework-modules).

/**
 * Every base duration (gather, craft, cook, session) is multiplied by this. The loop simulation tunes it (D338): 1.8
 * since D374 made bonds, inherited uniques and golds item-free, so the tier keeps its ~21 weeks.
 */
export const TIME_FACTOR = 1.8
export const SECONDS_PER_MINUTE = 60
export const MS_PER_SECOND = 1000

/**
 * Real seconds for `baseMinutes` of work at `speed` (1, or 1.25 at a Lv 3 building): the base × TIME_FACTOR, rounded
 * to a whole second once, then divided by the speed and rounded once more.
 */
export function workSeconds(baseMinutes: number, speed = 1): number {
  if (!Number.isFinite(baseMinutes) || baseMinutes < 0) throw new RangeError(`Base minutes must be finite and ≥ 0: ${baseMinutes}`)
  if (!Number.isFinite(speed) || speed <= 0) throw new RangeError(`Speed must be finite and > 0: ${speed}`)
  const atSpeedOne = Math.round(baseMinutes * TIME_FACTOR * SECONDS_PER_MINUTE)
  return speed === 1 ? atSpeedOne : Math.round(atSpeedOne / speed)
}

export const secondsToMs = (seconds: number): number => seconds * MS_PER_SECOND
