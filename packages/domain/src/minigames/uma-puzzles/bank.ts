// Frozen one-time CL cohort, NOT Inspiration or negative Items (docs/design/uma-puzzles.md §8).
import { SCENARIOS } from '../../scenarios'
import { STRATEGIES, type Strategy } from '../../types'
import { eligiblePuzzleStyles, parsePuzzleSource } from './identity'
import { parsePuzzleMaterialId, puzzleMaterialId, validatePuzzleRegistry, type PuzzleMaterialId, type PuzzleScenarioRegistry } from './materials'
import { PUZZLE_CL_MAX, PUZZLE_PARSE_LIMITS } from './rules'
import type { PuzzleSourceV1 } from './types'
import { puzzleExact, puzzleId, puzzleInteger, puzzleRecord, puzzleSafe, requirePuzzle } from './validation'

export interface PuzzleLegacyUnit { outfitId: string; scenarioId: string; level: number; preferredStyle: Strategy | null }
export interface PuzzleCohortV1 { schemaVersion: 1; receiptId: string; units: PuzzleLegacyUnit[] }
export interface PuzzleBankAllocation {
  outfitId: string
  scenarioId: string
  contentVersion: string
  sourceRulesVersion: 1
  eligibleStyles: Strategy[]
  style: Strategy
}
export interface PuzzleBankV1 {
  schemaVersion: 1
  receiptId: string
  phase: 'preparing' | 'active'
  cohort: PuzzleCohortV1
  allocations: PuzzleBankAllocation[]
  unresolvedOutfits: string[]
  /** Include zero rows forever: the receipt cannot be forgotten after repayment. */
  balances: Record<string, number>
}
const unitKey = (unit: Pick<PuzzleLegacyUnit, 'outfitId' | 'scenarioId'>) => JSON.stringify([unit.outfitId, unit.scenarioId])
export function parsePuzzleCohort(v: unknown, registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleCohortV1 | null {
  validatePuzzleRegistry(registry)
  if (!puzzleRecord(v) || !puzzleExact(v, ['schemaVersion', 'receiptId', 'units']) || v.schemaVersion !== 1 || !puzzleId(v.receiptId) ||
    !Array.isArray(v.units) || v.units.length > PUZZLE_PARSE_LIMITS.units) return null
  const units: PuzzleLegacyUnit[] = []
  for (const row of v.units) {
    if (!puzzleRecord(row) || !puzzleExact(row, ['outfitId', 'scenarioId', 'level', 'preferredStyle']) || !puzzleId(row.outfitId) ||
      typeof row.scenarioId !== 'string' || !registry.some(s => s.id === row.scenarioId) || !puzzleInteger(row.level, 1, PUZZLE_CL_MAX) ||
      !(row.preferredStyle === null || STRATEGIES.includes(row.preferredStyle as Strategy))) return null
    units.push({ outfitId: row.outfitId, scenarioId: row.scenarioId, level: row.level, preferredStyle: row.preferredStyle as Strategy | null })
  }
  if (new Set(units.map(unitKey)).size !== units.length) return null
  return { schemaVersion: 1, receiptId: v.receiptId, units }
}
/** A retry reuses the existing authoritative snapshot, not whatever units were acquired since it was frozen. */
export function freezePuzzleCohort(receiptId: string, units: readonly PuzzleLegacyUnit[], existing: PuzzleCohortV1 | null = null,
  registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleCohortV1 {
  if (existing) {
    const parsed = parsePuzzleCohort(existing, registry)
    requirePuzzle(parsed, 'invalid', 'Invalid frozen cohort')
    requirePuzzle(parsed.receiptId === receiptId, 'stale', 'Different legacy cohort receipt')
    return parsed
  }
  const cohort = parsePuzzleCohort({ schemaVersion: 1, receiptId, units }, registry)
  requirePuzzle(cohort, 'invalid', 'Invalid legacy cohort')
  return cohort
}
function allocationLimits(cohort: PuzzleCohortV1, allocations: readonly PuzzleBankAllocation[], registry: PuzzleScenarioRegistry): Record<string, number> {
  const limits: Record<string, number> = {}
  for (let i = 0; i < allocations.length; i++) {
    const allocation = allocations[i]!, unit = cohort.units[i]!
    const id = puzzleMaterialId(unit.scenarioId, allocation.style, registry)
    limits[id] = puzzleSafe((limits[id] ?? 0) + unit.level - 1, 'Legacy debt')
  }
  return limits
}
export function parsePuzzleBank(v: unknown, registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleBankV1 | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['schemaVersion', 'receiptId', 'phase', 'cohort', 'allocations', 'unresolvedOutfits', 'balances']) ||
    v.schemaVersion !== 1 || !puzzleId(v.receiptId) || !['preparing', 'active'].includes(v.phase as string) ||
    !Array.isArray(v.allocations) || v.allocations.length > PUZZLE_PARSE_LIMITS.units || !Array.isArray(v.unresolvedOutfits) ||
    v.unresolvedOutfits.length > PUZZLE_PARSE_LIMITS.units || !puzzleRecord(v.balances)) return null
  const cohort = parsePuzzleCohort(v.cohort, registry)
  if (!cohort || cohort.receiptId !== v.receiptId || !v.unresolvedOutfits.every(puzzleId) ||
    new Set(v.unresolvedOutfits).size !== v.unresolvedOutfits.length ||
    v.unresolvedOutfits.some(id => !cohort.units.some(u => u.outfitId === id))) return null
  const allocations: PuzzleBankAllocation[] = []
  if (v.phase === 'preparing') {
    if (!v.unresolvedOutfits.length || v.allocations.length || Object.keys(v.balances).length) return null
  } else {
    if (v.unresolvedOutfits.length || v.allocations.length !== cohort.units.length) return null
    for (let i = 0; i < v.allocations.length; i++) {
      const row = v.allocations[i], unit = cohort.units[i]!
      if (!puzzleRecord(row) || !puzzleExact(row, ['outfitId', 'scenarioId', 'contentVersion', 'sourceRulesVersion', 'eligibleStyles', 'style']) ||
        row.outfitId !== unit.outfitId || row.scenarioId !== unit.scenarioId || !Array.isArray(row.eligibleStyles) ||
        !puzzleId(row.contentVersion) || row.sourceRulesVersion !== 1 ||
        !row.eligibleStyles.length || row.eligibleStyles.length > STRATEGIES.length || !row.eligibleStyles.every(s => STRATEGIES.includes(s as Strategy)) ||
        row.eligibleStyles.join(',') !== STRATEGIES.filter(s => (row.eligibleStyles as unknown[]).includes(s)).join(',')) return null
      const styles = row.eligibleStyles as Strategy[], style = unit.preferredStyle && styles.includes(unit.preferredStyle) ? unit.preferredStyle : styles[0]!
      if (row.style !== style) return null
      const previous = allocations.find(a => a.outfitId === unit.outfitId)
      if (previous && (previous.contentVersion !== row.contentVersion || previous.eligibleStyles.join(',') !== styles.join(','))) return null
      allocations.push({ outfitId: unit.outfitId, scenarioId: unit.scenarioId, contentVersion: row.contentVersion,
        sourceRulesVersion: 1, eligibleStyles: [...styles], style })
    }
    const limits = allocationLimits(cohort, allocations, registry)
    if (!puzzleExact(v.balances, Object.keys(limits)) || Object.entries(v.balances).some(([id, n]) => !puzzleInteger(n, -limits[id]!, 0))) return null
  }
  return { schemaVersion: 1, receiptId: v.receiptId, phase: v.phase as PuzzleBankV1['phase'], cohort, allocations,
    unresolvedOutfits: [...v.unresolvedOutfits] as string[], balances: { ...v.balances } as Record<string, number> }
}
/** Invalid/missing sources leave the same cohort preparing. No partial debit and no guessed style. */
export function preparePuzzleBank(cohort: PuzzleCohortV1, sources: ReadonlyMap<string, PuzzleSourceV1>, existing: PuzzleBankV1 | null = null,
  registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleBankV1 {
  const frozen = parsePuzzleCohort(cohort, registry)
  requirePuzzle(frozen, 'invalid', 'Invalid legacy cohort')
  if (existing) {
    const parsed = parsePuzzleBank(existing, registry)
    requirePuzzle(parsed, 'invalid', 'Invalid existing bank')
    requirePuzzle(JSON.stringify(parsed.cohort) === JSON.stringify(frozen), 'stale', 'Cohort receipt payload changed')
    if (parsed.phase === 'active') return parsed
  }
  const allocations: PuzzleBankAllocation[] = [], unresolved = new Set<string>()
  for (const unit of frozen.units) {
    const source = parsePuzzleSource(sources.get(unit.outfitId)), styles = source ? eligiblePuzzleStyles(source) : []
    if (!source || source.templateId !== unit.outfitId || !styles.length) { unresolved.add(unit.outfitId); continue }
    allocations.push({ outfitId: unit.outfitId, scenarioId: unit.scenarioId, contentVersion: source.contentVersion,
      sourceRulesVersion: source.rulesVersion, eligibleStyles: styles,
      style: unit.preferredStyle && styles.includes(unit.preferredStyle) ? unit.preferredStyle : styles[0]! })
  }
  if (unresolved.size) return { schemaVersion: 1, receiptId: frozen.receiptId, phase: 'preparing', cohort: frozen,
    allocations: [], unresolvedOutfits: [...unresolved], balances: {} }
  const limits = allocationLimits(frozen, allocations, registry)
  return { schemaVersion: 1, receiptId: frozen.receiptId, phase: 'active', cohort: frozen, allocations, unresolvedOutfits: [],
    balances: Object.fromEntries(Object.entries(limits).map(([id, n]) => [id, n ? -n : 0])) }
}
export function repayPuzzleMaterial(bank: PuzzleBankV1 | null, itemId: PuzzleMaterialId, gross: number,
  registry: PuzzleScenarioRegistry = SCENARIOS): { gross: number; debtPaid: number; net: number; bankAfter: PuzzleBankV1 | null } {
  requirePuzzle(parsePuzzleMaterialId(itemId, registry), 'unknown', 'Unknown repayment material')
  requirePuzzle(puzzleInteger(gross), 'invalid', 'Invalid gross material reward')
  const parsed = bank ? parsePuzzleBank(bank, registry) : null
  requirePuzzle(!bank || parsed, 'invalid', 'Invalid Constellation bank')
  requirePuzzle(!parsed || parsed.phase === 'active', 'locked', 'Finish legacy bank preparation before acquiring tickets')
  const debtPaid = Math.min(gross, Math.max(0, -(parsed?.balances[itemId] ?? 0))), net = gross - debtPaid
  return { gross, debtPaid, net, bankAfter: parsed && debtPaid ? { ...parsed, balances: { ...parsed.balances,
    [itemId]: parsed.balances[itemId]! + debtPaid } } : parsed }
}
