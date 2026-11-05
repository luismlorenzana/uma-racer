// Grades and the pay ladder (docs/game/07-stages.md §2, D384; 02 §2): a stage reports its score over its target, `p`,
// and its bonus tasks; the framework grades them. D under 0.5 (not cleared), C from 0.5, B from 0.75, A from 1, and S
// from 1.2 or at A with every task. Every play pays its game's resources × its grade's multiplier. Pure.

export type StageGrade = 'D' | 'C' | 'B' | 'A' | 'S'
export const STAGE_GRADES: readonly StageGrade[] = Object.freeze(['D', 'C', 'B', 'A', 'S'] as const)

/** The lowest `p` of each grade above D. */
export const GRADE_FLOORS: Readonly<Record<Exclude<StageGrade, 'D'>, number>> = Object.freeze({ C: 0.5, B: 0.75, A: 1, S: 1.2 })

/** What each grade pays, × the game's pay at A. */
export const PAY_MULTIPLIERS: Readonly<Record<StageGrade, number>> = Object.freeze({ D: 0.25, C: 0.6, B: 0.8, A: 1, S: 1.2 })

/** The grade of a report: `p` against the floors, and S for an A with every task done (a game with no tasks has none). */
export function grade(p: number, tasks: readonly boolean[]): StageGrade {
  if (!(p >= GRADE_FLOORS.C)) return 'D' // NaN too
  if (p >= GRADE_FLOORS.S) return 'S'
  if (p >= GRADE_FLOORS.A) return tasks.length > 0 && tasks.every(Boolean) ? 'S' : 'A'
  return p >= GRADE_FLOORS.B ? 'B' : 'C'
}

export const payMultiplier = (of: StageGrade): number => PAY_MULTIPLIERS[of]
