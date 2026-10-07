// Value-preserving legacy EXP credit, deliberately bypassing new-reward debt (docs/design/uma-puzzles.md §8).
import { SCENARIOS } from '../../scenarios'
import { validatePuzzleRegistry, type PuzzleScenarioRegistry } from './materials'
import { PUZZLE_LEGACY_EXP_PER_TICKET, PUZZLE_PARSE_LIMITS } from './rules'
import { puzzleExact, puzzleId, puzzleInteger, puzzleRecord, puzzleSafe, requirePuzzle } from './validation'

export interface PuzzleLegacyExpUnit { outfitId: string; scenarioId: string; unappliedExp: number; alreadyConverted: boolean }
export interface PuzzleLegacyCreditInput { preservedStock: number; accountExp: number; units: readonly PuzzleLegacyExpUnit[] }
export interface PuzzleLegacyCreditV1 {
  schemaVersion: 1
  receiptId: string
  preservedStock: number
  accountExp: number
  units: PuzzleLegacyExpUnit[]
  pooledExp: number
  wholeTickets: number
  remainderExp: number
  roundUpTickets: 0 | 1
  compensationExp: number
  stockAfter: number
}
function creditInput(v: unknown, registry: PuzzleScenarioRegistry): PuzzleLegacyCreditInput | null {
  validatePuzzleRegistry(registry)
  if (!puzzleRecord(v) || !puzzleExact(v, ['preservedStock', 'accountExp', 'units']) || !puzzleInteger(v.preservedStock) ||
    !puzzleInteger(v.accountExp) || !Array.isArray(v.units) || v.units.length > PUZZLE_PARSE_LIMITS.units) return null
  const units: PuzzleLegacyExpUnit[] = []
  for (const u of v.units) {
    if (!puzzleRecord(u) || !puzzleExact(u, ['outfitId', 'scenarioId', 'unappliedExp', 'alreadyConverted']) || !puzzleId(u.outfitId) ||
      typeof u.scenarioId !== 'string' || !registry.some(s => s.id === u.scenarioId) || !puzzleInteger(u.unappliedExp) || typeof u.alreadyConverted !== 'boolean') return null
    units.push({ outfitId: u.outfitId, scenarioId: u.scenarioId, unappliedExp: u.unappliedExp, alreadyConverted: u.alreadyConverted })
  }
  return new Set(units.map(u => JSON.stringify([u.outfitId, u.scenarioId]))).size === units.length ?
    { preservedStock: v.preservedStock, accountExp: v.accountExp, units } : null
}
export function summarizePuzzleLegacyCredit(input: PuzzleLegacyCreditInput, registry: PuzzleScenarioRegistry = SCENARIOS):
  Omit<PuzzleLegacyCreditV1, 'schemaVersion' | 'receiptId'> {
  const parsed = creditInput(input, registry)
  requirePuzzle(parsed, 'invalid', 'Invalid unapplied Training EXP credit')
  let pooledExp = parsed.accountExp
  for (const u of parsed.units) if (!u.alreadyConverted) pooledExp = puzzleSafe(pooledExp + u.unappliedExp, 'Legacy EXP pool')
  const wholeTickets = Math.floor(pooledExp / PUZZLE_LEGACY_EXP_PER_TICKET), remainderExp = pooledExp % PUZZLE_LEGACY_EXP_PER_TICKET
  const roundUpTickets = remainderExp > 0 ? 1 : 0
  return { ...parsed, units: [...parsed.units], pooledExp, wholeTickets, remainderExp, roundUpTickets,
    compensationExp: roundUpTickets ? PUZZLE_LEGACY_EXP_PER_TICKET - remainderExp : 0,
    stockAfter: puzzleSafe(parsed.preservedStock + wholeTickets + roundUpTickets, 'Legacy universal stock') }
}
export function parsePuzzleLegacyCredit(v: unknown, registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleLegacyCreditV1 | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['schemaVersion', 'receiptId', 'preservedStock', 'accountExp', 'units', 'pooledExp',
    'wholeTickets', 'remainderExp', 'roundUpTickets', 'compensationExp', 'stockAfter']) || v.schemaVersion !== 1 || !puzzleId(v.receiptId)) return null
  try {
    const summary = summarizePuzzleLegacyCredit({ preservedStock: v.preservedStock as number, accountExp: v.accountExp as number,
      units: v.units as PuzzleLegacyExpUnit[] }, registry)
    if (['pooledExp', 'wholeTickets', 'remainderExp', 'roundUpTickets', 'compensationExp', 'stockAfter'].some(k => v[k] !== summary[k as keyof typeof summary])) return null
    return { schemaVersion: 1, receiptId: v.receiptId, ...summary }
  } catch { return null }
}
export function resolvePuzzleLegacyCredit(receiptId: string, input: PuzzleLegacyCreditInput, existing: PuzzleLegacyCreditV1 | null = null,
  registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleLegacyCreditV1 {
  requirePuzzle(puzzleId(receiptId), 'invalid', 'Invalid legacy credit receipt id')
  if (existing) {
    const parsed = parsePuzzleLegacyCredit(existing, registry)
    requirePuzzle(parsed, 'invalid', 'Invalid existing legacy credit receipt')
    requirePuzzle(parsed.receiptId === receiptId, 'stale', 'Different legacy credit receipt')
    return parsed
  }
  return { schemaVersion: 1, receiptId, ...summarizePuzzleLegacyCredit(input, registry) }
}
