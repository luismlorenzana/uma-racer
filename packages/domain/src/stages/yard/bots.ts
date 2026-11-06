// Training Yard's bots (docs/game/08-training-yard.md §6, D384): what `sim:stages` plays to hold the grade bands.
// - **Novice:** a random empty cell, never holding.
// - **Competent:** greedy on the immediate merge value: the placement that pays the most now, a random one among equals
//   (so with nothing to merge, a random cell). It never holds.
// - **Expert:** one ply ahead with the next piece and the hold: every placement of the piece in hand, or of the next
//   one after holding, worth what it pays now plus the most the following piece can then pay; a random one among
//   equals, preferring the hand.
// Pure: the bots read the state and their own dice, never the stage's seed.
import type { BotLevel, StageBot, StageInput, StageRng } from '../contract'
import {
  cellColour, emptyCells, FATIGUE_PIECE, holdInput, isPartnerPiece, isPieceCell, ORTHOGONAL, PARTNER_BASE, placeInput, stepYard, yardDone,
  type YardState,
} from './rules'

/** What a move paid: its drills (a Rest clearing pays nothing, D391). */
const paid = (before: YardState, after: YardState): number => after.score - before.score

/** Whether the piece in hand could merge at `cell`: some neighbour shares its colour (any piece, for a wild Partner). */
function couldMerge(state: YardState, cell: number): boolean {
  const piece = state.hand
  if (piece === FATIGUE_PIECE) return false
  const colour = isPartnerPiece(piece) ? state.partners[piece - PARTNER_BASE]!.colour : piece
  return ORTHOGONAL[cell]!.some((next) => isPieceCell(state.board[next]!) && (colour < 0 || cellColour(state.board[next]!) === colour))
}

/** The most the piece in hand can pay now, anywhere. */
function bestNow(state: YardState): number {
  let top = 0
  for (const cell of emptyCells(state.board)) {
    if (!couldMerge(state, cell)) continue
    const after = stepYard(state, placeInput(state.moves, cell))
    if (after !== null) top = Math.max(top, paid(state, after))
  }
  return top
}

/** The highest-valued choices' indexes, a random one among equals. */
function pickTop<T>(options: readonly T[], value: (option: T) => number, rng: StageRng): T {
  let top = Number.NEGATIVE_INFINITY
  let ties: T[] = []
  for (const option of options) {
    const v = value(option)
    if (v > top) {
      top = v
      ties = [option]
    } else if (v === top) {
      ties.push(option)
    }
  }
  if (ties.length === 0) throw new RangeError('A bot has nowhere to place')
  return ties[ties.length === 1 ? 0 : rng.below(ties.length)]!
}

const novice: StageBot<YardState> = (state: YardState, rng: StageRng): StageInput => {
  const cells = emptyCells(state.board)
  return placeInput(state.moves, cells[rng.below(cells.length)]!)
}

const competent: StageBot<YardState> = (state: YardState, rng: StageRng): StageInput => {
  const options = emptyCells(state.board).map((cell) => {
    const after = stepYard(state, placeInput(state.moves, cell))
    return { cell, value: after === null ? Number.NEGATIVE_INFINITY : paid(state, after) }
  })
  return placeInput(state.moves, pickTop(options, (option) => option.value, rng).cell)
}

interface Plan {
  readonly held: boolean
  readonly cell: number
  readonly value: number
}

function plans(state: YardState, held: boolean, from: YardState): Plan[] {
  return emptyCells(state.board).map((cell) => {
    const after = stepYard(state, placeInput(state.moves, cell))
    if (after === null) return { held, cell, value: Number.NEGATIVE_INFINITY }
    const ahead = yardDone(after) ? 0 : bestNow(after)
    // Twice the move's own pay, so a merge now beats the same merge a move later; a hold breaks no tie.
    return { held, cell, value: 4 * paid(from, after) + 2 * ahead - (held ? 1 : 0) }
  })
}

const expert: StageBot<YardState> = (state: YardState, rng: StageRng): StageInput => {
  const options = plans(state, false, state)
  const swapped = state.held ? null : stepYard(state, holdInput(state.moves))
  if (swapped !== null) options.push(...plans(swapped, true, state))
  const pick = pickTop(options, (option) => option.value, rng)
  return pick.held ? holdInput(state.moves) : placeInput(state.moves, pick.cell)
}

export const YARD_BOTS: Readonly<Record<BotLevel, StageBot<YardState>>> = Object.freeze({ novice, competent, expert })
