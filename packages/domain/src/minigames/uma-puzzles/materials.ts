// Scenario/style CL items and pure atomic projections (docs/design/uma-puzzles.md §§2, 7).
import { TRAINING_LEVEL_UP_TICKET_ID } from '../../farm/types'
import { SCENARIOS, type ScenarioDef } from '../../scenarios'
import { STRATEGIES, type Strategy } from '../../types'
import { eligiblePuzzleStyles } from './identity'
import { repayPuzzleMaterial, type PuzzleBankV1 } from './bank'
import { PUZZLE_CL_MAX, PUZZLE_EXCHANGE_RATIO, PUZZLE_PARSE_LIMITS } from './rules'
import type { PuzzleSourceV1 } from './types'
import { puzzleArray, puzzleId, puzzleInteger, puzzleRecord, puzzleSafe, requirePuzzle } from './validation'

export type PuzzleScenarioRegistry = readonly Pick<ScenarioDef, 'id' | 'tier' | 'name'>[]
export type PuzzleMaterialId = `constellation:${string}:${Strategy}`
export interface PuzzleMaterialDefinition { id: PuzzleMaterialId; scenarioId: string; scenarioTier: number; style: Strategy; name: string }
export interface PuzzleMaterialInput { itemId: PuzzleMaterialId | typeof TRAINING_LEVEL_UP_TICKET_ID; quantity: number }
const styleNames: Record<Strategy, string> = { front: 'Front', pace: 'Pace', late: 'Late', end: 'End' }
export function validatePuzzleRegistry(registry: PuzzleScenarioRegistry): void {
  requirePuzzle(puzzleArray(registry, PUZZLE_PARSE_LIMITS.scenarios) && registry.length > 0,
    'invalid', 'Invalid scenario registry size')
  requirePuzzle(registry.every(s => puzzleRecord(s) && typeof s.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id) &&
    s.id.length <= 64 && puzzleId(s.id) && puzzleInteger(s.tier, 1) && typeof s.name === 'string' && s.name.length > 0 && s.name.length <= 120) &&
    new Set(registry.map(s => s.id)).size === registry.length && new Set(registry.map(s => s.tier)).size === registry.length,
  'invalid', 'Ambiguous scenario registry')
}
export function puzzleScenarioIdForTier(tier: number, registry: PuzzleScenarioRegistry = SCENARIOS): string {
  validatePuzzleRegistry(registry)
  const scenario = registry.find(s => s.tier === tier)
  requirePuzzle(scenario, 'unknown', 'Unknown racing scenario tier')
  return scenario.id
}
export function puzzleMaterialId(scenarioId: string, style: Strategy, registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleMaterialId {
  validatePuzzleRegistry(registry)
  requirePuzzle(registry.some(s => s.id === scenarioId), 'unknown', 'Unknown material scenario')
  requirePuzzle(STRATEGIES.includes(style), 'unknown', 'Unknown material style')
  return `constellation:${scenarioId}:${style}`
}
export function parsePuzzleMaterialId(v: unknown, registry: PuzzleScenarioRegistry = SCENARIOS): { scenarioId: string; style: Strategy } | null {
  validatePuzzleRegistry(registry)
  if (typeof v !== 'string' || v.length > PUZZLE_PARSE_LIMITS.id) return null
  const parts = v.split(':')
  if (parts.length !== 3 || parts[0] !== 'constellation' || !registry.some(s => s.id === parts[1]) || !STRATEGIES.includes(parts[2] as Strategy)) return null
  return { scenarioId: parts[1]!, style: parts[2] as Strategy }
}
export function puzzleMaterialCatalogue(registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleMaterialDefinition[] {
  validatePuzzleRegistry(registry)
  return registry.flatMap(s => STRATEGIES.map(style => ({ id: puzzleMaterialId(s.id, style, registry), scenarioId: s.id,
    scenarioTier: s.tier, style, name: `${s.name} · ${styleNames[style]} Constellation Ticket` })))
}
function checkedStocks(stocks: Readonly<Record<string, number>>, registry: PuzzleScenarioRegistry): Record<string, number> {
  requirePuzzle(puzzleRecord(stocks) && Object.keys(stocks).length <= registry.length * STRATEGIES.length + 1,
    'invalid', 'Invalid material stocks')
  for (const [id, quantity] of Object.entries(stocks)) {
    requirePuzzle(id === TRAINING_LEVEL_UP_TICKET_ID || parsePuzzleMaterialId(id, registry), 'unknown', 'Unknown inventory material')
    requirePuzzle(puzzleInteger(quantity), 'invalid', 'Invalid inventory quantity')
  }
  return { ...stocks }
}
const revision = (current: number, expected: number): number => {
  requirePuzzle(puzzleInteger(current) && puzzleInteger(expected), 'invalid', 'Invalid revision')
  requirePuzzle(current === expected, 'stale', 'Material preview is stale')
  return puzzleSafe(current + 1, 'Next economic revision')
}
export interface PuzzleClSpendInput {
  scenarioId: string
  level: number
  source: PuzzleSourceV1
  unlockedScenarioIds: readonly string[]
  inputs: readonly PuzzleMaterialInput[]
  stocks: Readonly<Record<string, number>>
  revision: number
  expectedRevision: number
}
/** Also the preview implementation. Call it again with fresh state inside the eventual transaction. */
export function resolvePuzzleClSpend(input: PuzzleClSpendInput, registry: PuzzleScenarioRegistry = SCENARIOS):
  { before: number; after: number; debits: PuzzleMaterialInput[]; stocksAfter: Record<string, number>; revisionAfter: number } {
  validatePuzzleRegistry(registry)
  const revisionAfter = revision(input.revision, input.expectedRevision)
  requirePuzzle(registry.some(s => s.id === input.scenarioId), 'unknown', 'Unknown CL scenario')
  requirePuzzle(Array.isArray(input.unlockedScenarioIds) && input.unlockedScenarioIds.length <= registry.length &&
    new Set(input.unlockedScenarioIds).size === input.unlockedScenarioIds.length && input.unlockedScenarioIds.every(id => registry.some(s => s.id === id)),
  'invalid', 'Invalid unlocked scenarios')
  requirePuzzle(input.unlockedScenarioIds.includes(input.scenarioId), 'locked', 'Unlock this scenario through racing first')
  requirePuzzle(puzzleInteger(input.level, 1, PUZZLE_CL_MAX), 'invalid', 'Invalid CL')
  const styles = eligiblePuzzleStyles(input.source)
  requirePuzzle(styles.length, 'locked', 'No original A style for CL spending')
  requirePuzzle(Array.isArray(input.inputs) && input.inputs.length > 0 && input.inputs.length <= STRATEGIES.length + 1 &&
    input.inputs.every(row => puzzleRecord(row) && typeof row.itemId === 'string') &&
    new Set(input.inputs.map(row => row.itemId)).size === input.inputs.length, 'invalid', 'Invalid or duplicate spend vector')
  const stocksAfter = checkedStocks(input.stocks, registry), debits: PuzzleMaterialInput[] = []
  let count = 0
  for (const row of input.inputs) {
    requirePuzzle(puzzleRecord(row) && Object.keys(row).length === 2 && typeof row.itemId === 'string' && puzzleInteger(row.quantity, 1), 'invalid', 'Choose a positive ticket count')
    if (row.itemId !== TRAINING_LEVEL_UP_TICKET_ID) {
      const material = parsePuzzleMaterialId(row.itemId, registry)
      requirePuzzle(material, 'unknown', 'Unknown CL ticket')
      requirePuzzle(material.scenarioId === input.scenarioId && styles.includes(material.style), 'invalid', 'Ineligible CL ticket')
    }
    requirePuzzle((stocksAfter[row.itemId] ?? 0) >= row.quantity, 'insufficient', 'Not enough CL tickets')
    count = puzzleSafe(count + row.quantity, 'Ticket batch')
    stocksAfter[row.itemId] = stocksAfter[row.itemId]! - row.quantity
    debits.push({ itemId: row.itemId as PuzzleMaterialInput['itemId'], quantity: row.quantity })
  }
  requirePuzzle(count <= PUZZLE_CL_MAX - input.level, 'invalid', 'CL10 overspend is not allowed')
  return { before: input.level, after: input.level + count, debits, stocksAfter, revisionAfter }
}
export const previewPuzzleClSpend = resolvePuzzleClSpend

export interface PuzzleExchangeInput {
  from: PuzzleMaterialId
  to: PuzzleMaterialId
  quantity: number
  /** Stable ids of chapters whose Opening guardian has been first-cleared account-wide. */
  openingGuardianClears: readonly string[]
  stocks: Readonly<Record<string, number>>
  bank: PuzzleBankV1 | null
  revision: number
  expectedRevision: number
}
export function resolvePuzzleExchange(input: PuzzleExchangeInput, registry: PuzzleScenarioRegistry = SCENARIOS):
  { from: PuzzleMaterialId; to: PuzzleMaterialId; input: number; gross: number; debtPaid: number; net: number;
    irreversible: boolean; stocksAfter: Record<string, number>; bankAfter: PuzzleBankV1 | null; revisionAfter: number } {
  validatePuzzleRegistry(registry)
  const revisionAfter = revision(input.revision, input.expectedRevision)
  const from = parsePuzzleMaterialId(input.from, registry), to = parsePuzzleMaterialId(input.to, registry)
  requirePuzzle(from && to, 'unknown', 'Unknown exchange material')
  const a = registry.findIndex(s => s.id === from.scenarioId), b = registry.findIndex(s => s.id === to.scenarioId)
  requirePuzzle(from.style === to.style && Math.abs(a - b) === 1, 'invalid', 'Exchange needs adjacent scenarios and the same style')
  requirePuzzle(Array.isArray(input.openingGuardianClears) && input.openingGuardianClears.length <= registry.length &&
    new Set(input.openingGuardianClears).size === input.openingGuardianClears.length &&
    input.openingGuardianClears.every(id => registry.some(s => s.id === id)), 'invalid', 'Invalid exchange edge access')
  requirePuzzle(input.openingGuardianClears.includes(registry[Math.max(a, b)]!.id), 'locked', 'Clear the higher Opening guardian first')
  requirePuzzle(puzzleInteger(input.quantity, 1), 'invalid', 'Choose a positive exchange count')
  requirePuzzle(a > b || input.quantity % PUZZLE_EXCHANGE_RATIO === 0, 'invalid', 'Up-conversion requires an even input count')
  const stocksAfter = checkedStocks(input.stocks, registry)
  requirePuzzle((stocksAfter[input.from] ?? 0) >= input.quantity, 'insufficient', 'Not enough exchange input')
  const gross = puzzleSafe(a > b ? input.quantity * PUZZLE_EXCHANGE_RATIO : input.quantity / PUZZLE_EXCHANGE_RATIO, 'Exchange output')
  const repayment = repayPuzzleMaterial(input.bank, input.to, gross, registry)
  stocksAfter[input.from] = stocksAfter[input.from]! - input.quantity
  stocksAfter[input.to] = puzzleSafe((stocksAfter[input.to] ?? 0) + repayment.net, 'Output inventory')
  return { from: input.from, to: input.to, input: input.quantity, ...repayment, irreversible: repayment.debtPaid > 0, stocksAfter, revisionAfter }
}
export const previewPuzzleExchange = resolvePuzzleExchange
