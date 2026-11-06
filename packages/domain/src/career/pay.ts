// What a stage pays into the career's wallet at grade A (docs/game/12-pacing.md, D383, D391): one bundle for every
// game, which the stage settle (T155, T156) scales by its grade's multiplier. A game decides only how its drills split
// across the five colours (its report's weights); it adds no pay of its own. Set by `sim:careers` so a career played
// once at A buys about 60% of the tree, brings about three of six cards to bond 80 and earns SP for four to six skills,
// and one replay of each season's play fills the tree. Pure.

export interface StagePay {
  /** Drills in all, split across the five colours by the stage. */
  readonly drills: number
  readonly bond: number
  readonly sp: number
}

/** Every game's pay at grade A, a play (D391). */
export const STAGE_PAY_AT_A: StagePay = Object.freeze({ drills: 110, bond: 12, sp: 25 })

/** Pay at a grade's multiplier (D 0.25 … S 1.2, T155's ladder), rounded half up per resource. */
export function stagePay(multiplier: number): StagePay {
  if (!Number.isFinite(multiplier) || multiplier < 0) throw new RangeError('A pay multiplier is a non-negative number')
  const scale = (n: number) => Math.round(n * multiplier)
  return { drills: scale(STAGE_PAY_AT_A.drills), bond: scale(STAGE_PAY_AT_A.bond), sp: scale(STAGE_PAY_AT_A.sp) }
}
