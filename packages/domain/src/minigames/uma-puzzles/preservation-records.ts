// Bounded frozen migration evidence, not a second inventory (implementation §8).
import { SCENARIOS } from '../../scenarios'
import { STRATEGIES, type Strategy } from '../../types'
import { eligiblePuzzleStyles, parsePuzzleSource } from './identity'
import type { PuzzleSourceV1 } from './types'
import { puzzleArray, puzzleExact, puzzleId, puzzleInteger, puzzleRecord } from './validation'

/** Transport ceilings, not progression caps. Refuse oversized work before freezing anything. */
export const PUZZLE_PRESERVATION_LIMITS = { units: 4096, pageUnits: 32, batchUnits: 16, documentBytes: 262144, freezeBytes: 8388608 } as const
export const CONSTELLATION_SAVE_SCHEMA_VERSION = 16 as const
export interface FrozenPuzzleUnit {
  outfitId: string; scenarioId: string; tier: number; umaVersion: number; level: number; exp: number;
  preferredStyle: Strategy | null; debtStyle: Strategy; source: PuzzleSourceV1
}
export interface PuzzlePreservationHeader {
  schemaVersion: 1; type: 'header'; cutoverId: string; catalogueVersion: string; contentHash: string;
  pageCount: number; unitCount: number; cursor: number; phase: 'preparing' | 'active';
  profileVersion: number; stockVersion: number; originalStock: number; accountExp: number; unitExp: number; transferredExp: number;
  receipt: null | { rawExp: number; remainder: number; wholeTickets: number; compensation: 0 | 1; credited: number; stockAfter: number }
}
export interface PuzzlePreservationPage {
  schemaVersion: 1; type: 'page'; cutoverId: string; index: number; units: FrozenPuzzleUnit[]
}
export interface PuzzleSparkRetirementReceipt {
  schemaVersion: 1; type: 'spark'; runId: string; disposition: 'committed' | 'refunded';
  proof: string; refundId: string | null; refunded: number
}
export type PuzzlePreservationRecord = PuzzlePreservationHeader | PuzzlePreservationPage | PuzzleSparkRetirementReceipt
export const preservationPageId = (index: number) => `page-${index}`
export function parseFrozenPuzzleUnit(v: unknown): FrozenPuzzleUnit | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['outfitId', 'scenarioId', 'tier', 'umaVersion', 'level', 'exp', 'preferredStyle', 'debtStyle', 'source']) ||
    !puzzleId(v.outfitId) || !puzzleInteger(v.tier, 1, SCENARIOS.length) || SCENARIOS.find(s => s.tier === v.tier)?.id !== v.scenarioId ||
    !puzzleInteger(v.umaVersion, 1) || !puzzleInteger(v.level, 1, 10) || !puzzleInteger(v.exp, 0, v.level === 10 ? 0 : 1249) ||
    !(v.preferredStyle === null || STRATEGIES.includes(v.preferredStyle as never))) return null
  const source = parsePuzzleSource(v.source), styles = source && eligiblePuzzleStyles(source)
  if (!source || source.templateId !== v.outfitId || !styles?.length ||
    v.debtStyle !== (styles.includes(v.preferredStyle as Strategy) ? v.preferredStyle : styles[0])) return null
  return structuredClone(v) as unknown as FrozenPuzzleUnit
}
export function parsePuzzlePreservationRecord(v: unknown): PuzzlePreservationRecord | null {
  if (!puzzleRecord(v) || v.schemaVersion !== 1) return null
  if (v.type === 'spark') {
    if (!puzzleExact(v, ['schemaVersion', 'type', 'runId', 'disposition', 'proof', 'refundId', 'refunded']) || !puzzleId(v.runId) ||
      !v.runId.startsWith('spark-match:') || !['committed', 'refunded'].includes(v.disposition as string) ||
      typeof v.proof !== 'string' || !v.proof.length || new TextEncoder().encode(v.proof).byteLength > PUZZLE_PRESERVATION_LIMITS.documentBytes / 2 ||
      !puzzleInteger(v.refunded) || (v.disposition === 'committed' ? v.refundId !== null || v.refunded !== 0 : v.refundId !== `${v.runId}:refund` || v.refunded < 1)) return null
    return structuredClone(v) as unknown as PuzzleSparkRetirementReceipt
  }
  if (!puzzleId(v.cutoverId)) return null
  if (v.type === 'page') {
    if (!puzzleExact(v, ['schemaVersion', 'type', 'cutoverId', 'index', 'units']) || !puzzleInteger(v.index, 0, 127) ||
      !puzzleArray(v.units, PUZZLE_PRESERVATION_LIMITS.pageUnits) || !v.units.length) return null
    const units = v.units.map(parseFrozenPuzzleUnit)
    if (units.some(u => !u) || new Set(units.map(u => `${u!.outfitId}/${u!.scenarioId}`)).size !== units.length) return null
    return { schemaVersion: 1, type: 'page', cutoverId: v.cutoverId, index: v.index, units: units as FrozenPuzzleUnit[] }
  }
  if (v.type !== 'header' || !puzzleExact(v, ['schemaVersion', 'type', 'cutoverId', 'catalogueVersion', 'contentHash', 'pageCount',
    'unitCount', 'cursor', 'phase', 'profileVersion', 'stockVersion', 'originalStock', 'accountExp', 'unitExp', 'transferredExp', 'receipt']) ||
    !puzzleId(v.catalogueVersion) || typeof v.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(v.contentHash) ||
    !puzzleInteger(v.unitCount, 0, PUZZLE_PRESERVATION_LIMITS.units) || v.pageCount !== Math.ceil(v.unitCount / PUZZLE_PRESERVATION_LIMITS.pageUnits) ||
    !puzzleInteger(v.cursor, 0, v.unitCount) || !puzzleInteger(v.profileVersion, 1) || !puzzleInteger(v.stockVersion) ||
    ![v.originalStock, v.accountExp, v.unitExp, v.transferredExp].every(n => puzzleInteger(n)) || (v.transferredExp as number) > (v.unitExp as number) ||
    !['preparing', 'active'].includes(v.phase as string)) return null
  if (v.phase === 'preparing' ? v.receipt !== null : v.cursor !== v.unitCount || v.transferredExp !== v.unitExp || !puzzleRecord(v.receipt)) return null
  if (v.receipt !== null) {
    const r = v.receipt
    if (!puzzleRecord(r) || !puzzleExact(r, ['rawExp', 'remainder', 'wholeTickets', 'compensation', 'credited', 'stockAfter']) ||
      !puzzleInteger(r.rawExp) || r.rawExp !== (v.accountExp as number) + (v.transferredExp as number) || r.remainder !== r.rawExp % 1250 ||
      r.wholeTickets !== Math.floor(r.rawExp / 1250) || r.compensation !== (r.remainder > 0 ? 1 : 0) ||
      r.credited !== (r.wholeTickets as number) + (r.compensation as number) ||
      !puzzleInteger(r.stockAfter) || r.stockAfter !== (v.originalStock as number) + (r.credited as number)) return null
  }
  return structuredClone(v) as unknown as PuzzlePreservationHeader
}
