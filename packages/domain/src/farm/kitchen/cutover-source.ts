// Minimal authoritative freeze input and exact reset whitelist; never freezes a whole Uma for later replacement.
import { migrateFarmStateToCurrent } from '../legacy'
import { parseFarmHarvestMovement } from '../types'
import { DISTANCE_CATEGORIES, STATS } from '../../types'
import { farmRecord, farmSafeId, farmSafeInteger, FARM_STATION_IDS } from './rules'
import { farmBytes, farmData, FARM_SYNC_LIMITS, type FarmStoredEntity, type FarmStoredLog } from './wire'
import { FARM_CUTOVER_LIMITS } from './cutover-records'
import type { FarmCutoverPageV1, FarmLegacyStationV1 } from './records'

export function farmRetiredExtra(data: Record<string, unknown>): Record<string, unknown>[] {
  if (![15, 16].includes(Number(data.schemaVersion)) || !Array.isArray(data.scenarios) || data.scenarios.length > 14)
    throw new Error('Update/recovery required: unsupported Uma scenario schema')
  if (data.scenarios.some(unit => !farmRecord(unit))) throw new Error('Malformed Uma scenario; keep the save')
  let last = 0
  return [...data.scenarios as Record<string, unknown>[]].sort((a, b) => Number(a.tier) - Number(b.tier)).map(unit => {
    if (!farmRecord(unit) || !farmSafeInteger(unit.tier, last + 1) || unit.tier > 14 || !farmRecord(unit.extraStatsUnlocked) ||
      !farmRecord(unit.presets)) throw new Error('Malformed Uma scenario; keep the save')
    last = unit.tier
    const active: Record<string, unknown> = {}
    for (const distance of DISTANCE_CATEGORIES) {
      const preset = unit.presets[distance]
      if (!farmRecord(preset) || !Array.isArray(preset.activeExtraStats)) throw new Error('Malformed Uma preset; keep the save')
      active[distance] = structuredClone(preset.activeExtraStats)
    }
    return { tier: unit.tier, unlocked: structuredClone(unit.extraStatsUnlocked), active }
  })
}
export function clearFarmRetiredExtra(data: Record<string, unknown>): Record<string, unknown> {
  farmRetiredExtra(data)
  const next = structuredClone(data)
  for (const unit of next.scenarios as Record<string, unknown>[]) {
    unit.extraStatsUnlocked = Object.fromEntries(STATS.map(stat => [stat, 0]))
    for (const preset of Object.values(unit.presets as Record<string, Record<string, unknown>>)) preset.activeExtraStats = []
  }
  return next
}
export function farmCutoverSource(accountId: string, entities: ReadonlyMap<string, FarmStoredEntity>, logs: ReadonlyMap<string, FarmStoredLog>) {
  const profile = entities.get('profile/main')
  if (!profile || profile.deleted || !farmSafeInteger(profile.version, 1) || !farmSafeInteger(profile.data.createdAt)) throw new Error('Canonical profile is missing/malformed; keep the save')
  const owned = [...entities.values()].filter(r => r.kind === 'umas' && !r.deleted).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  if (owned.length > FARM_CUTOVER_LIMITS.outfits) throw new Error('Farm cohort exceeds 4096 outfits; export and recover')
  if (farmBytes(owned) > FARM_CUTOVER_LIMITS.freezeBytes) throw new Error('Farm freeze exceeds 8 MiB; export and recover without resetting')
  const outfits = owned.map(r => {
    if (!farmSafeId(r.id) || r.data.templateId !== r.id || !farmSafeInteger(r.version, 1) || farmBytes(r) > FARM_SYNC_LIMITS.receiptBytes)
      throw new Error('Invalid/oversized owned outfit; keep the save')
    return { outfitId: r.id, sourceVersion: r.version, tiers: farmRetiredExtra(r.data).map(unit => Number(unit.tier)) }
  })
  const raw = entities.get('farm/main'), farm = raw && !raw.deleted ? migrateFarmStateToCurrent(raw.data) : null
  if (raw && (raw.deleted || !farmSafeInteger(raw.version, 1) || !farm)) throw new Error('Unsupported/malformed legacy Farm; export and recover')
  const ownedIds = new Set(outfits.map(r => r.outfitId)), stations: FarmLegacyStationV1[] = [], evidence: FarmStoredLog[] = []
  if (Object.keys(farm?.workers ?? {}).some(id => !ownedIds.has(id))) throw new Error('Unknown legacy Farm worker; preserve for recovery')
  for (const plot of farm?.plots ?? []) {
    if (plot.templateId !== null && !ownedIds.has(plot.templateId)) throw new Error('Legacy worker is not owned; keep the save')
    const number = Number(plot.id.slice(5)), stationId = FARM_STATION_IDS[number - 1]!
    // The first eighteen station ids are Garden, Orchard and Barnyard in old plot order.
    let cycle = plot.cycle
    const old = cycle && logs.get(`itemLedger/${cycle.id}`)
    if (old) {
      const movement = parseFarmHarvestMovement(old.data)
      if (!movement || movement.id !== cycle!.id || movement.itemId !== cycle!.cropId || movement.source.templateId !== plot.templateId ||
        movement.source.plotId !== plot.id || old.createdAt !== movement.createdAt) throw new Error('Divergent legacy harvest evidence; keep the save')
      evidence.push(old); cycle = null
    }
    stations.push({ stationId, outfitId: plot.templateId, attempt: plot.attempt, cycle })
  }
  return { schemaVersion: 1, accountId, profile: { version: profile.version, createdAt: profile.data.createdAt },
    farm: raw ? { version: raw.version, data: farmData(farm!) } : null, outfits, stations, evidence }
}
export function farmCutoverSourceLogKeys(entities: ReadonlyMap<string, FarmStoredEntity>): string[] {
  const raw = entities.get('farm/main')
  if (!raw) return []
  const farm = migrateFarmStateToCurrent(raw.data)
  if (!farm) throw new Error('Malformed legacy Farm; keep the save')
  return farm.plots.flatMap(p => p.cycle ? [`itemLedger/${p.cycle.id}`] : [])
}
export const farmCutoverPages = (source: ReturnType<typeof farmCutoverSource>, generation: string): FarmCutoverPageV1[] =>
  Array.from({ length: Math.ceil(source.outfits.length / FARM_CUTOVER_LIMITS.page) }, (_, index) => ({ schemaVersion: 1,
    generation, type: 'cohort', index, outfits: source.outfits.slice(index * 32, (index + 1) * 32) }))
