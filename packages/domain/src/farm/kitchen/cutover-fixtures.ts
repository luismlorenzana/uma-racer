// Generated invented accounts only. No original rows or owner files; excluded from both production adapters.
import synthetic from '../../minigames/uma-puzzles/protocol.synthetic.json'
import { createPlayerProfile, createScenarioTraining, parseUmaSave } from '../../save'
import { DISTANCE_CATEGORIES } from '../../types'
import { farmData, type FarmStoredEntity, type FarmStoredLog } from './wire'
export function farmCutoverFixture(count = 20, tiers = 14, legacy: 'absent' | 'v1' | 'v2' = 'v2') {
  const entities = new Map<string, FarmStoredEntity>(), logs = new Map<string, FarmStoredLog>()
  const put = (kind: string, id: string, data: object, version = 1) => entities.set(`${kind}/${id}`, { kind, id, data: farmData(data), version, deleted: false, updatedAt: 1 })
  put('profile', 'main', createPlayerProfile('invented-content', 1))
  for (let i = 0; i < count; i++) {
    const templateId = `invented-${String(i).padStart(4, '0')}`, uma = { ...structuredClone(synthetic.uma), templateId,
      level: (tiers - 1) * 10 + 1, unlockedTier: tiers, scenarios: Array.from({ length: tiers }, (_, t) => {
        const unit = createScenarioTraining(t + 1)
        unit.extraStatsUnlocked = { speed: 4, stamina: 3, power: 2, guts: 1, wit: 4 }
        for (const [j, distance] of DISTANCE_CATEGORIES.entries()) unit.presets[distance].activeExtraStats = ['speed-1', 'speed-2', 'speed-3', 'speed-4'].slice(0, j + 1) as typeof unit.presets.sprint.activeExtraStats
        return unit
      }) }
    if (!parseUmaSave(uma)) throw new Error('Malformed invented Farm Uma')
    put('umas', templateId, uma)
  }
  if (legacy !== 'absent' && count >= 6) {
    const slots = Math.min(count, legacy === 'v1' ? 6 : 18)
    const plots = Array.from({ length: slots }, (_, i) => ({ id: `plot-${i + 1}`, templateId: `invented-${String(i).padStart(4, '0')}`,
      lastCropId: 'produce:t1:speed', attempt: i + 1, cycle: i % 3 === 0 ? null : { id: `farm:plot-${i + 1}:${i + 1}`,
        cropId: 'produce:t1:speed', plantedAt: 0, readyAt: (legacy === 'v1' ? 720 : 600 - 15 * (i % 11)) * 60_000 } }))
    const workers = legacy === 'v1' ? Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`invented-${String(i).padStart(4, '0')}`, { level: 20, exp: 0 }]))
      : { 'invented-0000': { level: 4000, exp: 12 }, 'invented-0001': { level: 7, exp: 0 } }
    put('farm', 'main', { schemaVersion: legacy === 'v1' ? 1 : 2, plots, workers })
  }
  put('items', 'produce:t1:speed', { itemId: 'produce:t1:speed', quantity: 123, updatedAt: 1 })
  put('items', 'invented-global-item', { itemId: 'invented-global-item', quantity: 77, updatedAt: 1 })
  return { entities, logs, put }
}
