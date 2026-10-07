// Invented Puzzle fixtures only — no catalogue rows or account data.
import { expect } from 'vitest'
import { STRATEGIES, type Aptitudes, type Strategy } from '../../types'
import { createPuzzleSource } from './identity'
import { PuzzleRuleError, type PuzzleErrorCode } from './validation'

export const syntheticPuzzleSource = (styles: readonly Strategy[] = ['front'], dirt = false, id = 'invented-outfit') => createPuzzleSource({
  id, baseStats: { speed: 101, stamina: 203, power: 87, guts: 59, wit: 113 },
  growthRates: { speed: 0.2, stamina: 0.1, power: 0, guts: 0.3, wit: 0.05 },
  aptitudes: { surface: { turf: 'A', dirt: dirt ? 'A' : 'B' }, distance: { sprint: 'C', mile: 'A', medium: 'B', long: 'G' },
    strategy: Object.fromEntries(STRATEGIES.map(style => [style, styles.includes(style) ? 'A' : 'B'])) as Aptitudes['strategy'] },
}, 'synthetic-content-v1')
export function puzzleError(fn: () => unknown, code: PuzzleErrorCode): void {
  let error: unknown
  try { fn() } catch (caught) { error = caught }
  expect(error).toBeInstanceOf(PuzzleRuleError)
  expect(error).toMatchObject({ code })
}
