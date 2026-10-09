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
const request = (farmOperations: ReturnType<typeof createFarmOperation>[]) => ({ upserts: [], appends: [], farmProtocolVersion: 1, farmOperations })
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
    const f = farmProtocolFixture(), source = parseUmaSave(f.entities.get('umas/invented-0')!.data)!
    const uma: UmaSave = { ...source, level: 131, unlockedTier: 14, scenarios: Array.from({ length: 14 }, (_, i) => {
      const unit = structuredClone(source.scenarios[0]!); unit.tier = i + 1
      for (const distance of DISTANCE_CATEGORIES) unit.presets[distance].assignments = Object.fromEntries(constellationTemplate(i + 1).nodes.map(n => [n.id, { kind: 'card' as const, cardId: `invented-${'c'.repeat(110)}` }]))
      return unit
    }) }
    expect(parseUmaSave(uma)).not.toBeNull()
    const record = { ...f.entities.get('umas/invented-0')!, data: uma as unknown as Record<string, unknown> }
    expect(parseFarmStoredEntity(record)).not.toBeNull(); expect(parseSaveSnapshotOrThrow({ entities: [record], logs: [], serverTime: 1 }).entities).toHaveLength(1)
    const configuredUmaBytes = farmBytes(record)
    for (const unit of uma.scenarios) for (const distance of DISTANCE_CATEGORIES) for (const assignment of Object.values(unit.presets[distance].assignments))
      if (assignment.kind === 'card') assignment.cardId = `invented-${'c'.repeat(50)}`
    const op = f.operation({ kind: 'grant-energy' }), body = { ...request([op]), upserts: [{ kind: 'umas', id: source.templateId, baseVersion: 1, data: uma }] }
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
  it('measures a full station projection and terminal receipt under lower document ceilings', () => {
    const f = farmProtocolFixture(), stations = FARM_STATION_IDS.map((id, i) => ({ id, outfitId: `invented-${i}`, attempt: 0, job: null }))
    f.put('farm', 'main', { schemaVersion: 3, generation: f.generation, stations })
    const op = f.operation({ kind: 'start', stationId: 'garden-1', outfitId: 'invented-0', recipeId: 'farm:raw:ura-finale:vegetable:speed', quantity: 1, choices: {} }); f.apply(op)
    const claim = f.operation({ kind: 'claim', stationId: 'garden-1', outfitId: 'invented-0', jobId: `farm-job:${f.generation}:garden-1:1`, recipeId: 'farm:raw:ura-finale:vegetable:speed' }, 'claim', 1000 + FARM_KITCHEN_JOB_MS)
    const result = f.apply(claim), receipt = result.responses[0]!.receipt!
    expect(result.responses[0]!.status).toBe('applied'); expect(farmBytes(receipt)).toBeLessThan(FARM_SYNC_LIMITS.receiptBytes)
    console.info('Farm receipt witness', JSON.stringify({ thirtyStationBytes: farmBytes(f.entities.get('farm/main')), claimReceiptBytes: farmBytes(receipt), claimResponseBytes: farmBytes(result.responses) }))
  })
})
