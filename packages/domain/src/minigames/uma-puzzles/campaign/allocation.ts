// Bounded integer-flow planning, not auto-spending or conversion (docs/design/uma-puzzles.md §11).
import { STRATEGIES, type Strategy } from '../../../types'
import { PUZZLE_CL_MAX } from '../rules'
import { puzzleArray, puzzleExact, puzzleId, puzzleInteger, puzzleRecord, puzzleSafe, requirePuzzle } from '../validation'
import { PUZZLE_DROP_COUNTS } from './rules'

export type PuzzleStyleStock = Record<Strategy, number>
export interface PuzzleAllocationRecipient { id: string; eligible: Strategy[]; needed: number }
export const PUZZLE_ALLOCATION_RECIPIENT_LIMIT = 6 // Report work bound, not a roster/party/account cap.
export const puzzleEmptyStyleStock = (): PuzzleStyleStock => ({ front: 0, pace: 0, late: 0, end: 0 })
function checked(stock: PuzzleStyleStock, recipients: readonly PuzzleAllocationRecipient[]) {
  requirePuzzle(puzzleRecord(stock) && puzzleExact(stock, STRATEGIES) && STRATEGIES.every(s => puzzleInteger(stock[s])), 'invalid', 'Invalid style stock')
  requirePuzzle(puzzleArray(recipients, PUZZLE_ALLOCATION_RECIPIENT_LIMIT) && recipients.length > 0, 'invalid', 'Invalid allocation report cohort')
  const ids = new Set<string>()
  for (const r of recipients) {
    requirePuzzle(puzzleRecord(r) && puzzleExact(r, ['id', 'eligible', 'needed']) && puzzleId(r.id) && !ids.has(r.id) &&
      puzzleInteger(r.needed, 0, PUZZLE_CL_MAX - 1) && puzzleArray(r.eligible, STRATEGIES.length) && r.eligible.length > 0 &&
      new Set(r.eligible).size === r.eligible.length && r.eligible.every(s => STRATEGIES.includes(s)), 'invalid', 'Invalid recipient/style eligibility')
    ids.add(r.id)
  }
}
/** Integral max flow handles overlapping original-A eligibility without greedy stranded-stock mistakes. */
export function allocatePuzzleMaterials(stock: PuzzleStyleStock, recipients: readonly PuzzleAllocationRecipient[]) {
  checked(stock, recipients)
  const source = 0, firstStyle = 1, firstRecipient = firstStyle + STRATEGIES.length, sink = firstRecipient + recipients.length
  const capacity = Array.from({ length: sink + 1 }, () => Array<number>(sink + 1).fill(0))
  STRATEGIES.forEach((s, i) => {
    capacity[source]![firstStyle + i] = stock[s]
    recipients.forEach((r, j) => { if (r.eligible.includes(s)) capacity[firstStyle + i]![firstRecipient + j] = r.needed })
  })
  recipients.forEach((r, j) => { capacity[firstRecipient + j]![sink] = r.needed })
  const residual = capacity.map(row => [...row]); let usable = 0
  while (true) {
    const previous = Array<number>(sink + 1).fill(-1), queue = [source]; previous[source] = source
    for (let i = 0; i < queue.length && previous[sink] === -1; i++) {
      const from = queue[i]!
      for (let to = 0; to <= sink; to++) if (previous[to] === -1 && residual[from]![to]! > 0) { previous[to] = from; queue.push(to) }
    }
    if (previous[sink] === -1) break
    let amount = Number.MAX_SAFE_INTEGER
    for (let to = sink; to !== source; to = previous[to]!) amount = Math.min(amount, residual[previous[to]!]![to]!)
    for (let to = sink; to !== source; to = previous[to]!) {
      const from = previous[to]!; residual[from]![to]! -= amount; residual[to]![from]! += amount
    }
    usable += amount
  }
  const stranded = puzzleEmptyStyleStock(), allocations = recipients.map(r => ({ id: r.id, byStyle: puzzleEmptyStyleStock(), missing: r.needed }))
  STRATEGIES.forEach((s, i) => {
    stranded[s] = residual[source]![firstStyle + i]!
    recipients.forEach((_, j) => { const amount = capacity[firstStyle + i]![firstRecipient + j]! - residual[firstStyle + i]![firstRecipient + j]!
      allocations[j]!.byStyle[s] = amount; allocations[j]!.missing -= amount })
  })
  return { usable, stranded, allocations, missing: allocations.reduce((n, a) => n + a.missing, 0) }
}
/** Minimum additional targeted champion wins; deterministic tie-break is front→pace→late→end. No cross-style exchange. */
export function planPuzzleTargetedWins(stock: PuzzleStyleStock, recipients: readonly PuzzleAllocationRecipient[]) {
  const initial = allocatePuzzleMaterials(stock, recipients), wins = puzzleEmptyStyleStock()
  for (let count = 0; count <= recipients.length; count++) {
    const search = (index: number, left: number): ReturnType<typeof allocatePuzzleMaterials> | null => {
      if (index === STRATEGIES.length) {
        if (left !== 0) return null
        const increased = puzzleEmptyStyleStock()
        for (const s of STRATEGIES) {
          const reward = wins[s] * PUZZLE_DROP_COUNTS.champion
          // Skip an overflowing candidate, not a valid later plan targeting a different family.
          if (stock[s] > Number.MAX_SAFE_INTEGER - reward) return null
          increased[s] = puzzleSafe(stock[s] + reward, 'Targeted stock')
        }
        const report = allocatePuzzleMaterials(increased, recipients)
        return report.missing === 0 ? report : null
      }
      const style = STRATEGIES[index]!
      for (let n = left; n >= 0; n--) { wins[style] = n; const found = search(index + 1, left - n); if (found) return found }
      wins[style] = 0; return null
    }
    const final = search(0, count)
    if (final) return { initial, extraWins: count, wins: { ...wins }, final }
  }
  requirePuzzle(false, 'invalid', 'No feasible targeted allocation')
}
