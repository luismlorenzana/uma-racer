// Where an Uma finishes in the loop simulation (T132's "The win table", "Racing"): the committed
// win table's place counts per scenario T, grade and build share, interpolated between the shares it holds, and one
// seeded draw from them. Pure: the RNG is the caller's.
import type { RaceGrade } from '../types'
import { WIN_SHARES } from './build'

/** The grades the table holds: a career's G3, G2s and G1s (03 §4). */
export const WIN_GRADES = Object.freeze(['g3', 'g2', 'g1'] as const)
export type WinGrade = (typeof WIN_GRADES)[number]
/** Places it counts: 1st to 5th, then 6th and below together (the prize table's rows, 09 §2.1). */
export const WIN_PLACES = Object.freeze([1, 2, 3, 4, 5, 6] as const)

/** One cell: how many of `racesPerCell` races ended in each of `WIN_PLACES`, and the running style it raced. */
export interface WinCell {
  readonly places: readonly number[]
  readonly strategy: string
}

/** The generated table: per T (1–14), per grade, one cell per `WIN_SHARES` entry. */
export interface WinTable {
  readonly seed: number
  readonly racesPerCell: number
  readonly engine: string
  readonly course: string
  readonly cells: Readonly<Record<string, Readonly<Record<WinGrade, readonly WinCell[]>>>>
}

/** The grade a race is looked up at: G3, G2 or G1; anything lower reads as G3 (careers hold only these, D137). */
export const winGrade = (grade: RaceGrade): WinGrade => (grade === 'g1' || grade === 'g2' ? grade : 'g3')

/** Place shares (summing to 1) at T, grade and build share, linear between the table's shares. */
export function placeShares(table: WinTable, T: number, grade: RaceGrade, share: number): readonly number[] {
  const row = table.cells[String(T)]?.[winGrade(grade)]
  if (!row || row.length !== WIN_SHARES.length) throw new RangeError(`The win table has no T${T} ${grade}`)
  const s = Math.min(1, Math.max(0, share))
  let i = 0
  while (i < WIN_SHARES.length - 2 && s > WIN_SHARES[i + 1]!) i += 1
  const lo = WIN_SHARES[i]!, hi = WIN_SHARES[i + 1]!
  const w = (s - lo) / (hi - lo)
  const total = table.racesPerCell
  return WIN_PLACES.map((_, k) => ((1 - w) * row[i]!.places[k]! + w * row[i + 1]!.places[k]!) / total)
}

/** Her place, drawn once from `shares` with the race's seeded RNG: 1–5, or 6 for 6th and below. */
export function drawPlace(shares: readonly number[], rng: { next(): number }): number {
  const roll = rng.next()
  let sum = 0
  for (let k = 0; k < shares.length; k += 1) {
    sum += shares[k]!
    if (roll < sum) return k + 1
  }
  return shares.length
}

/** A place other than 1st, drawn from the cell's non-win shares (an Expedition race she doesn't win, T132). */
export function drawLoss(shares: readonly number[], rng: { next(): number }): number {
  const rest = shares.slice(1)
  const total = rest.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return WIN_PLACES.length
  return 1 + drawPlace(rest.map((value) => value / total), rng)
}
