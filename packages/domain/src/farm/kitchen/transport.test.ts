// Generated bounded synthetic stress, never copied data or a large checked-in fixture.
import { describe, expect, it } from 'vitest'
import { farmProtocolFixture } from './protocol-fixtures'
import { farmBytes, FARM_SYNC_LIMITS } from './wire'
import { createFarmOperation, farmOperationReferences, partitionFarmOperations, parseFarmOperationBatch } from './operations'
import { parseFarmStoredEntity } from './records'
import { FARM_STATION_IDS, FARM_KITCHEN_JOB_MS } from './rules'
import { STATS, DISTANCE_CATEGORIES } from '../../types'
import { parseSyncRequest, parseSaveSnapshotOrThrow, parseUmaSave, type UmaSave } from '../../save'
import { constellationTemplate } from '../../constellation'
import { SCENARIOS } from '../../scenarios'
import { FARM_KITCHEN_CATALOGUE } from './catalogue'
import { createFarmKitchenWorker, emptyFarmRecipes } from './production'
import { parseFarmKitchenState } from './parsers'
import { resolveFarmOperations } from './resolver'
const request = (farmOperations: ReturnType<typeof createFarmOperation>[]) => ({ upserts: [], appends: [], farmProtocolVersion: 1, farmOperations })
function configuredUma(): UmaSave {
  const source = parseUmaSave(farmProtocolFixture().entities.get('umas/invented-0')!.data)!
  return { ...source, level: 131, unlockedTier: 14, scenarios: Array.from({ length: 14 }, (_, i) => {
    const unit = structuredClone(source.scenarios[0]!); unit.tier = i + 1
    for (const distance of DISTANCE_CATEGORIES) unit.presets[distance].assignments = Object.fromEntries(constellationTemplate(i + 1).nodes.map(n => [n.id, { kind: 'card' as const, cardId: `invented-${'c'.repeat(110)}` }]))
    return unit
  }) }
}
describe('Farm transport envelopes', () => {
  it('honors exactly 200 references including ordinary writes and rejects 201; never mixes Puzzle semantics', () => {
    const f = farmProtocolFixture(), op = f.operation({ kind: 'grant-energy' }), r = farmOperationReferences(op)
    const count = new Set([...r.entities, ...r.logs]).size
    const upserts = Array.from({ length: 200 - count }, (_, i) => ({ kind: 'items', id: `invented:${i}`, baseVersion: 0, data: { itemId: `invented:${i}`, quantity: 1, updatedAt: 1 } }))
    expect(typeof parseSyncRequest({ ...request([op]), upserts })).toBe('object')
    expect(parseSyncRequest({ ...request([op]), upserts: [...upserts, { ...upserts[0]!, id: 'invented:extra', data: { itemId: 'invented:extra', quantity: 1, updatedAt: 1 } }] })).toMatch(/bounds/)
    expect(parseSyncRequest({ ...request([op]), farmProtocolVersion: 2 })).toMatch(/protocol/)
    expect(parseFarmOperationBatch(Array.from({ length: 16 }, (_, i) => f.operation({ kind: 'grant-energy' }, `grant-${i}`)))).not.toBeNull()
    expect(() => partitionFarmOperations([createFarmOperation({ ...op, expected: op.expected }), { ...op, payloadDigest: 'bad' }])).toThrow(/single/)
  })
  it('fits four disjoint ten-stack banquets and partitions thirty claims by union, not roster size', () => {
    const f = farmProtocolFixture(), scenarios = ['ura-finale', 'unity-cup', 'grand-concert', 'trackblazer']
    const banquets = scenarios.map((id, i) => f.operation({ kind: 'start', stationId: `kitchen-${i + 1}` as 'kitchen-1', outfitId: `invented-${i}`, recipeId: 'farm:meal:b1:sun', quantity: 4,
      choices: Object.fromEntries(STATS.flatMap(stat => [[`raw-${stat}`, `farm:raw:${id}:vegetable:${stat}`], [`processed-${stat}`, `farm:processed:${id}:cheese:${stat}`]])) }, `banquet-${i}`))
    expect(parseFarmOperationBatch(banquets)).not.toBeNull()
    const refs = new Set(banquets.flatMap(op => { const r = farmOperationReferences(op); return [...r.entities, ...r.logs] }))
    expect(refs.size).toBe(101)
    const claims = FARM_STATION_IDS.map((stationId, i) => f.operation({ kind: 'claim', stationId, outfitId: `invented-${i}`, jobId: `farm-job:${f.generation}:${stationId}:1`, recipeId: 'farm:raw:ura-finale:vegetable:speed' }, `claim-${i}`))
    const batches = partitionFarmOperations(claims)
    expect(batches.map(b => b.length)).toEqual([16, 14]); expect(batches.flat()).toEqual(claims)
    for (let i = 2; i < 2000; i++) f.put('farmWorkers', `invented-${i}`, { schemaVersion: 1, generation: f.generation, outfitId: `invented-${i}`, totalExp: 0 })
    expect(farmOperationReferences(banquets[0]!).entities.filter(r => r.startsWith('farmWorkers/'))).toHaveLength(1)
    const maxRef = Math.max(...batches.map(b => new Set(b.flatMap(op => { const r = farmOperationReferences(op); return [...r.entities, ...r.logs] })).size))
    console.info('Farm transport witness', JSON.stringify({ fourBanquets: { references: refs.size, requestBytes: farmBytes(request(banquets)) }, thirtyClaims: { batchSizes: batches.map(b => b.length), maxReferences: maxRef, maxRequestBytes: Math.max(...batches.map(b => farmBytes(request(b)))) } }))
  })
  it('round-trips fourteen units/four configured presets and enforces exact 256 KiB request bytes', () => {
    const f = farmProtocolFixture(), uma = configuredUma()
    expect(parseUmaSave(uma)).not.toBeNull()
    const record = { ...f.entities.get('umas/invented-0')!, data: uma as unknown as Record<string, unknown> }
    expect(parseFarmStoredEntity(record)).not.toBeNull(); expect(parseSaveSnapshotOrThrow({ entities: [record], logs: [], serverTime: 1 }).entities).toHaveLength(1)
    const configuredUmaBytes = farmBytes(record)
    for (const unit of uma.scenarios) for (const distance of DISTANCE_CATEGORIES) for (const assignment of Object.values(unit.presets[distance].assignments))
      if (assignment.kind === 'card') assignment.cardId = `invented-${'c'.repeat(50)}`
    const op = f.operation({ kind: 'grant-energy' }), body = { ...request([op]), upserts: [{ kind: 'umas', id: uma.templateId, baseVersion: 1, data: uma }] }
    // Variable-length invented skill IDs exercise serialized bytes while remaining valid global save data.
    const ids = uma.scenarios[0]!.presets.sprint.loadoutSkillIds
    while (farmBytes(body) + 125 <= FARM_SYNC_LIMITS.bytes) ids.push(`i${ids.length.toString().padStart(5, '0')}${'x'.repeat(114)}`)
    const gap = FARM_SYNC_LIMITS.bytes - farmBytes(body)
    if (gap >= 4) ids.push(`z${'z'.repeat(gap - 4)}`)
    else if (gap > 0) ids[ids.length - 1] += 'z'.repeat(gap)
    expect(farmBytes(body)).toBe(FARM_SYNC_LIMITS.bytes); expect(typeof parseSyncRequest(body)).toBe('object')
    ids.push('over-boundary'); expect(parseSyncRequest(body)).toMatch(/bounds/)
    console.info('Farm large unit witness', JSON.stringify({ configuredUmaBytes, exactRequestBytes: FARM_SYNC_LIMITS.bytes }))
  })
  it('rejects an oversized full response before either adapter can commit staged effects', () => {
    const f = farmProtocolFixture(), uma = configuredUma(), record = { ...f.entities.get('umas/invented-0')!, data: uma as unknown as Record<string, unknown> }
    const slots = [uma.scenarios[0]!.presets.sprint.loadoutSkillIds, uma.scenarios[0]!.presets.medium.loadoutSkillIds]
    const n = Math.floor((FARM_SYNC_LIMITS.receiptBytes - farmBytes(record) - 256) / 123)
    for (let i = 0; i < n; i++) slots[i % 2]!.push(`i${i.toString().padStart(5, '0')}${'x'.repeat(114)}`)
    expect(parseUmaSave(uma)).not.toBeNull(); expect(parseFarmStoredEntity(record)).not.toBeNull()
    f.entities.set('umas/invented-0', record)
    const initial = { entities: new Map(f.entities), logs: new Map(f.logs) }, operations = Array.from({ length: 16 }, (_, i) => {
      const op = f.operation({ kind: 'assign', stationId: i % 2 ? 'garden-1' : 'garden-2', outfitId: 'invented-0' }, `large-${i}`)
      expect(f.apply(op).responses[0]!.status).toBe('applied'); return op
    })
    expect(() => resolveFarmOperations({ ...initial, enabled: true, now: 1000 }, operations)).toThrow(/response exceeds bounds/)
    expect(initial.entities.get('farm/main')!.version).toBe(1); expect(initial.logs.size).toBe(0)
  })
  it('measures thirty fully occupied stations, including six ten-input banquets, under lower document ceilings', () => {
    const f = farmProtocolFixture(), stations = FARM_STATION_IDS.map((id, i) => ({ id, outfitId: `invented-${i}`, attempt: 0, job: null }))
    f.put('farm', 'main', { schemaVersion: 3, generation: f.generation, stations })
    const scenario = SCENARIOS.at(-1)!, block = 3, milestone = { jobId: `farm-job:${f.generation}:garden-1:1`, outfitId: 'invented-0', level: 150 }
    f.put('farmRecipes', 'b3', { ...emptyFarmRecipes(f.generation, block), processing: milestone, cooking: milestone })
    const source = f.entities.get('umas/invented-0')!.data
    const receipts: number[] = []
    for (const [i, stationId] of FARM_STATION_IDS.entries()) {
      f.put('umas', `invented-${i}`, { ...structuredClone(source), templateId: `invented-${i}` })
      f.put('farmWorkers', `invented-${i}`, createFarmKitchenWorker(f.generation, `invented-${i}`, 150 * 24))
      const district = stationId.split('-')[0]!, family = district === 'garden' ? 'vegetable' : district === 'orchard' ? 'fruit' : district === 'barn' ? 'milk' : 'cheese'
      const recipeId = district === 'kitchen' ? 'farm:meal:b3:sun' : `farm:${district === 'workshop' ? 'processed' : 'raw'}:${scenario.id}:${family}:speed`
      const recipe = FARM_KITCHEN_CATALOGUE.recipesById.get(recipeId)!
      const choices = Object.fromEntries(recipe.inputs.map(slot => [slot.id, slot.fixedItemId ?? `farm:${slot.stage}:${scenario.id}:${slot.stage === 'raw' ? 'vegetable' : 'cheese'}:${slot.stat}`]))
      for (const id of Object.values(choices)) if (!f.entities.has(`items/${id}`)) f.put('items', id, { itemId: id, quantity: 500, updatedAt: 1 })
      const started = f.apply(f.operation({ kind: 'start', stationId, outfitId: `invented-${i}`, recipeId, quantity: recipe.maxQuantity, choices }))
      expect(started.responses[0]!.status).toBe('applied'); receipts.push(farmBytes(started.responses[0]!.receipt))
    }
    const thirtyStationBytes = farmBytes(f.entities.get('farm/main'))
    expect(thirtyStationBytes).toBeLessThan(FARM_SYNC_LIMITS.documentBytes)
    const original = { entities: new Map(f.entities), logs: new Map(f.logs) }, claims = FARM_STATION_IDS.map(stationId => {
      const job = parseFarmKitchenState(f.entities.get('farm/main')!.data)!.stations.find(s => s.id === stationId)!.job!
      const op = f.operation({ kind: 'claim', stationId, outfitId: job.outfitId, jobId: job.id, recipeId: job.recipeId }, `claim-${stationId}`, 1000 + FARM_KITCHEN_JOB_MS)
      expect(f.apply(op).responses[0]!.status).toBe('applied'); return op
    })
    let state = original, maxClaimReceiptBytes = 0, maxResponseBytes = 0, maxRequestBytes = 0, maxReferences = 0
    const batches = partitionFarmOperations(claims)
    expect(batches.map(b => b.length)).toEqual([16, 14])
    for (const batch of batches) {
      const result = resolveFarmOperations({ ...state, enabled: true, now: 1000 + FARM_KITCHEN_JOB_MS }, batch)
      expect(result.responses.every(r => r.status === 'applied')).toBe(true)
      state = result; maxClaimReceiptBytes = Math.max(maxClaimReceiptBytes, ...result.responses.map(r => farmBytes(r.receipt)))
      maxResponseBytes = Math.max(maxResponseBytes, farmBytes(result.responses)); maxRequestBytes = Math.max(maxRequestBytes, farmBytes(request(batch)))
      maxReferences = Math.max(maxReferences, new Set(batch.flatMap(op => { const r = farmOperationReferences(op); return [...r.entities, ...r.logs] })).size)
    }
    expect(maxClaimReceiptBytes).toBeLessThan(FARM_SYNC_LIMITS.receiptBytes); expect(maxResponseBytes).toBeLessThan(FARM_SYNC_LIMITS.responseBytes)
    console.info('Farm receipt witness', JSON.stringify({ thirtyStationBytes, maxStartReceiptBytes: Math.max(...receipts), maxClaimReceiptBytes, thirtyReadyClaims: { batchSizes: batches.map(b => b.length), maxReferences, maxRequestBytes, maxResponseBytes } }))
  })
})
