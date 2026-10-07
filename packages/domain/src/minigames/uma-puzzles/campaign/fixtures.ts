// Tiny invented cast/tag fixtures, never original-game rows or production fallback content.
import { syntheticPuzzleBattle } from '../battle-fixtures'
import { puzzleStats } from '../progression'
import { PUZZLE_ELEMENTS, type PuzzleElement } from '../types'
import { PUZZLE_FOE_ROLES } from './rules'
import type { PuzzleCastV1 } from './types'

export const syntheticPuzzleCast = (): PuzzleCastV1 => ({ schemaVersion: 1, manifestVersion: 'invented-cast-v1',
  members: PUZZLE_ELEMENTS.map(element => ({ id: `invented-${element}-actor`, elements: [element], roles: [...PUZZLE_FOE_ROLES] })) })
export function syntheticPuzzleEntrants(level: number, elements: readonly PuzzleElement[] = PUZZLE_ELEMENTS) {
  return syntheticPuzzleBattle('invented-campaign', 'ordinary', 'starter-shaped', level).entrants.map((e, i) => ({ ...e,
    element: elements[i]!, level, stats: puzzleStats(e.source, level) }))
}
