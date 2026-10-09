// Synced projections and protected frozen reset pages; no cutover action here (implementation §3).
import { SCENARIOS } from '../../scenarios'
import { parseFarmCycle, type FarmCycle } from '../types'
import { parseFarmKitchenState, parseFarmKitchenWorker, parseFarmBlockRecipes, isFarmGeneration } from './parsers'
import { parseFarmExtraBlock } from './extra-map'
import { farmExactKeys, farmRecord, farmSafeId, farmSafeInteger, isFarmStationId, type FarmStationId } from './rules'
import { farmArchiveDigest, farmBytes, farmData, farmExpectedKind, farmPlain, farmRowId, FARM_SYNC_LIMITS, type FarmStoredEntity } from './wire'

export interface FarmCutoverControlV1 {
  schemaVersion: 1; generation: string; phase: 'preparing' | 'resetting' | 'active';
  cohortDigest: string; archiveDigest: string; outfitCount: number; pageCount: number; nextOutfitIndex: number;
  createdAt: number; activatedAt: number | null
}
export interface FarmLegacyStationV1 { stationId: FarmStationId; outfitId: string | null; attempt: number; cycle: FarmCycle | null }
export type FarmCutoverPageV1 =
  | { schemaVersion: 1; generation: string; type: 'cohort'; index: number; outfits: { outfitId: string; sourceVersion: number; tiers: number[] }[] }
  | { schemaVersion: 1; generation: string; type: 'legacy'; stations: FarmLegacyStationV1[] }
export const farmLegacyPageId = (generation: string): string => `${generation}:legacy`
export const farmCohortPageId = (generation: string, index: number): string => `${generation}:${index}`
export const farmExtraRowId = (outfitId: string, block: number): string => `${outfitId}:b${block}`

export function parseFarmCutoverControl(value: unknown): FarmCutoverControlV1 | null {
  if (!farmRecord(value) || !farmExactKeys(value, ['schemaVersion', 'generation', 'phase', 'cohortDigest', 'archiveDigest',
    'outfitCount', 'pageCount', 'nextOutfitIndex', 'createdAt', 'activatedAt']) || value.schemaVersion !== 1 ||
    !isFarmGeneration(value.generation) || !['preparing', 'resetting', 'active'].includes(value.phase as string) ||
    !farmArchiveDigest(value.cohortDigest) || !farmArchiveDigest(value.archiveDigest) || !farmSafeInteger(value.outfitCount) ||
    value.outfitCount > 4096 || value.pageCount !== Math.ceil(value.outfitCount / 32) || !farmSafeInteger(value.nextOutfitIndex) ||
    value.nextOutfitIndex > value.outfitCount || !farmSafeInteger(value.createdAt) ||
    (value.phase === 'active' ? !farmSafeInteger(value.activatedAt) || value.activatedAt < value.createdAt || value.nextOutfitIndex !== value.outfitCount
      : value.activatedAt !== null) || value.phase === 'preparing' && value.nextOutfitIndex !== 0) return null
  return structuredClone(value) as unknown as FarmCutoverControlV1
}
export function parseFarmCutoverPage(value: unknown): FarmCutoverPageV1 | null {
  if (!farmRecord(value) || value.schemaVersion !== 1 || !isFarmGeneration(value.generation) || !farmPlain(value) ||
    farmBytes(value) > FARM_SYNC_LIMITS.documentBytes) return null
  if (value.type === 'cohort') {
    if (!farmExactKeys(value, ['schemaVersion', 'generation', 'type', 'index', 'outfits']) || !farmSafeInteger(value.index) || value.index >= 128 ||
      !Array.isArray(value.outfits) || !value.outfits.length || value.outfits.length > 32) return null
    let last = ''
    for (const row of value.outfits) {
      if (!farmRecord(row) || !farmExactKeys(row, ['outfitId', 'sourceVersion', 'tiers']) || !farmSafeId(row.outfitId) || row.outfitId <= last ||
        !farmSafeInteger(row.sourceVersion, 1) || !Array.isArray(row.tiers) || row.tiers.length > SCENARIOS.length ||
        row.tiers.some((tier, i) => !farmSafeInteger(tier, 1) || tier > SCENARIOS.length || i > 0 && tier <= Number((row.tiers as unknown[])[i - 1]))) return null
      last = row.outfitId
    }
  } else if (value.type === 'legacy') {
    if (!farmExactKeys(value, ['schemaVersion', 'generation', 'type', 'stations']) || !Array.isArray(value.stations) || value.stations.length > 18) return null
    const workers = new Set<string>(), stations = new Set<string>()
    for (const row of value.stations) {
      if (!farmRecord(row) || !farmExactKeys(row, ['stationId', 'outfitId', 'attempt', 'cycle']) || !isFarmStationId(row.stationId) ||
        !/^(garden|orchard|barn)-/.test(row.stationId) || !(row.outfitId === null || farmSafeId(row.outfitId)) || !farmSafeInteger(row.attempt) ||
        row.outfitId !== null && workers.has(row.outfitId) || stations.has(row.stationId) || row.outfitId === null && row.cycle !== null) return null
      const [district, number] = row.stationId.split('-'), plot = `plot-${Number(number) + (district === 'garden' ? 0 : district === 'orchard' ? 6 : 12)}`
      if (row.cycle !== null && !parseFarmCycle(row.cycle, plot as import('../constants').FarmPlotId, row.attempt)) return null
      if (row.outfitId !== null) workers.add(row.outfitId)
      stations.add(row.stationId)
    }
  } else return null
  return structuredClone(value) as unknown as FarmCutoverPageV1
}
export function parseFarmEntity(kind: string, value: unknown): Record<string, unknown> | null {
  const parsed = kind === 'farm' ? parseFarmKitchenState(value) : kind === 'farmWorkers' ? parseFarmKitchenWorker(value)
    : kind === 'farmRecipes' ? parseFarmBlockRecipes(value) : kind === 'farmExtra' ? parseFarmExtraBlock(value)
      : kind === 'farmCutover' ? parseFarmCutoverControl(value) : kind === 'farmCutoverPages' ? parseFarmCutoverPage(value) : null
  return parsed && farmBytes(parsed) <= FARM_SYNC_LIMITS.documentBytes ? farmData(parsed) : null
}
export function farmEntityIdMatches(kind: string, id: string, data: Record<string, unknown>): boolean {
  return kind === 'farm' || kind === 'farmCutover' ? id === 'main' : kind === 'farmWorkers' ? id === data.outfitId
    : kind === 'farmRecipes' ? id === `b${data.block}` : kind === 'farmExtra' ? id === farmExtraRowId(String(data.outfitId), Number(data.block))
      : kind === 'farmCutoverPages' && id === (data.type === 'legacy' ? farmLegacyPageId(String(data.generation)) : farmCohortPageId(String(data.generation), Number(data.index)))
}
/** Uma/Constellation-bank full schemas are validated by the common save parser at adoption/API boundaries. */
export function parseFarmStoredEntity(value: unknown): FarmStoredEntity | null {
  if (!farmRecord(value) || !farmExactKeys(value, ['kind', 'id', 'version', 'data', 'deleted', 'updatedAt']) || !farmExpectedKind(value.kind) ||
    !farmRowId(value.id) || !farmSafeInteger(value.version, 1) || typeof value.deleted !== 'boolean' || !farmSafeInteger(value.updatedAt) ||
    !farmRecord(value.data) || !farmPlain(value.data) || farmBytes(value) >
      (value.kind === 'umas' ? FARM_SYNC_LIMITS.receiptBytes : FARM_SYNC_LIMITS.documentBytes)) return null
  if (value.kind.startsWith('farm')) {
    const data = parseFarmEntity(value.kind, value.data)
    if (!data || !farmEntityIdMatches(value.kind, value.id, data)) return null
  } else if (value.kind === 'items') {
    if (!farmExactKeys(value.data, ['itemId', 'quantity', 'updatedAt']) || value.data.itemId !== value.id ||
      !farmSafeInteger(value.data.quantity) || !farmSafeInteger(value.data.updatedAt)) return null
  } else if (value.kind === 'umas' && value.data.templateId !== value.id || value.kind === 'constellationBank' && value.id !== 'main') return null
  return structuredClone(value) as unknown as FarmStoredEntity
}
