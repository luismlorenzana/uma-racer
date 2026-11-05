// What a stage pays into the career's wallet at grade A (docs/game/12-pacing.md, D383): the shared numbers the stage
// settle (T155, T156) scales by its grade's multiplier. Training Yard pays Drills (split by colour from the merges) and a
// little SP; Furlong Hand pays Bond and SP. Set by `sim:careers` so a career played once at A buys about 60% of the
// tree, brings about three of six cards to bond 80 and earns SP for four to six skills, and one replay of each Training
// Yard season fills the tree. Pure.
import type { CareerGame } from './season'

export interface StagePay {
  /** Drills in all, split across the five colours by the stage. */
  readonly drills: number
  readonly bond: number
  readonly sp: number
}

/** Each game's pay at grade A, a play. */
export const STAGE_PAY_AT_A: Readonly<Record<CareerGame, StagePay>> = Object.freeze({
  'training-yard': Object.freeze({ drills: 200, bond: 0, sp: 30 }),
  'furlong-hand': Object.freeze({ drills: 0, bond: 25, sp: 20 }),
})

/** Pay at a grade's multiplier (D 0.25 … S 1.2, T155's ladder), rounded half up per resource. */
export function stagePay(game: CareerGame, multiplier: number): StagePay {
  if (!Number.isFinite(multiplier) || multiplier < 0) throw new RangeError('A pay multiplier is a non-negative number')
  const at = STAGE_PAY_AT_A[game]
  const scale = (n: number) => Math.round(n * multiplier)
  return { drills: scale(at.drills), bond: scale(at.bond), sp: scale(at.sp) }
}
