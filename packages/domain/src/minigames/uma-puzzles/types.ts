// Data-only Puzzle v1 foundations; not fields in the current save (docs/technical/uma-puzzles-implementation.md §2).
import type { Aptitudes, Stats } from '../../types'
import type { PUZZLE_RULES_VERSION, PUZZLE_SCHEMA_VERSION } from './rules'

export const PUZZLE_ELEMENTS = ['fire', 'water', 'wood', 'light', 'dark'] as const
export type PuzzleElement = (typeof PUZZLE_ELEMENTS)[number]
export interface PuzzleSourceV1 {
  schemaVersion: typeof PUZZLE_SCHEMA_VERSION
  rulesVersion: typeof PUZZLE_RULES_VERSION
  templateId: string
  /** The caller supplies the already-verified catalogue version; no content I/O belongs here. */
  contentVersion: string
  baseStats: Stats
  /** Fractions, normalized exactly once by the enrollment adapter. */
  growthRates: Stats
  aptitudes: Aptitudes
}
export interface PuzzleEnrollmentV1 {
  schemaVersion: typeof PUZZLE_SCHEMA_VERSION
  source: PuzzleSourceV1
  eligibleElements: PuzzleElement[]
  element: PuzzleElement
  level: number
  exp: number
  /** First reservation, not first win: loss/abandon cannot unlock correction. */
  firstBattleId: string | null
}
export interface PuzzleStats { atk: number; hp: number; rcv: number; guard: number; resilience: number }
export interface PuzzleProgress { level: number; exp: number }
export interface PuzzleProgressGain {
  before: PuzzleProgress
  after: PuzzleProgress
  gainedExp: number
  levelsGained: number
  statDelta: PuzzleStats
  /** Compact complete range. Enumerate it with puzzleLevelChanges, without an unbounded allocation. */
  levelRange: { first: number; last: number } | null
}
export interface PuzzleLevelChange { level: number; before: PuzzleStats; after: PuzzleStats; delta: PuzzleStats }
