// Pure transactional boundaries, invented records and clocks only.
import { describe, expect, it } from 'vitest'
import { farmProtocolFixture } from './protocol-fixtures'
import { FARM_KITCHEN_JOB_MS, FARM_KITCHEN_ENERGY_ID, FARM_STATION_IDS } from './rules'
import { STATS } from '../../types'
import { FARM_KITCHEN_CATALOGUE } from './catalogue'
import { emptyFarmRecipes } from './production'
import { parseFarmEntity, farmEntityIdMatches } from './records'
import { createFarmOperation, parseFarmOperation, parseFarmOperationBatch, parseFarmOperationReceipt, parseFarmOperationResponses,
  farmOperationReferences, partitionFarmOperations } from './operations'
import { resolveFarmOperations } from './resolver'
import { farmBytes } from './wire'
const start = { kind: 'start' as const, stationId: 'garden-1' as const, outfitId: 'invented-0',
  recipeId: 'farm:raw:ura-finale:vegetable:speed', quantity: 1, choices: {} }
describe('Farm semantic protocol', () => {
  it('freezes, pays once, and restores byte-identical receipts before stale/disabled checks', () => {
    const f = farmProtocolFixture(), op = f.operation(start), first = f.apply(op)
    expect(first.responses[0]!.status).toBe('applied')
    expect(parseFarmOperationReceipt(first.responses[0]!.receipt)).toEqual(first.responses[0]!.receipt)
    expect(f.entities.get(`items/${start.recipeId}`)).toBeUndefined()
    const jobId = `farm-job:${f.generation}:garden-1:1`, claim = f.operation({ kind: 'claim', stationId: 'garden-1', outfitId: 'invented-0', jobId, recipeId: start.recipeId }, 'claim', 1000 + FARM_KITCHEN_JOB_MS)
    const paid = f.apply(claim), receipt = paid.responses[0]!.receipt!
    expect(paid.responses[0]!.status).toBe('applied'); expect(receipt.result).toMatchObject({ expAward: 12, output: { amount: 6 } })
    expect(f.entities.get('farmWorkers/invented-0')!.data.totalExp).toBe(12)
    expect(f.apply(claim).responses[0]).toMatchObject({ status: 'duplicate', receipt })
    const duplicate = resolveFarmOperations({ enabled: false, now: 2000, entities: f.entities, logs: f.logs }, [op])
    expect(duplicate.responses[0]!.receipt).toEqual(first.responses[0]!.receipt)
    const other = f.operation(claim.payload, 'other-claim', claim.now), r = f.apply(other)
    expect(r.responses[0]!.receipt).toMatchObject({ reusedTarget: jobId, changes: [], logs: [], result: receipt.result })
    expect(f.entities.get(`items/${start.recipeId}`)!.data.quantity).toBe(6)
    expect(parseFarmOperationResponses(r.responses, [other])).toEqual(r.responses)
    const changed = createFarmOperation({ ...claim, now: claim.now + 1 })
    expect(f.apply(changed).responses[0]).toMatchObject({ status: 'rejected', reason: expect.stringMatching(/different bytes/) })
  })
  it('claims all blocks even for an old recipe and an already-over-threshold worker', () => {
    const f = farmProtocolFixture(108 * 24), op = f.operation(start); f.apply(op)
    const claim = f.operation({ kind: 'claim', stationId: 'garden-1', outfitId: 'invented-0', jobId: `farm-job:${f.generation}:garden-1:1`, recipeId: start.recipeId }, 'claim', 1000 + FARM_KITCHEN_JOB_MS)
    expect(farmOperationReferences(claim).entities.filter(r => r.startsWith('farmRecipes/'))).toEqual(['farmRecipes/b1', 'farmRecipes/b2', 'farmRecipes/b3'])
    expect(f.apply(claim).responses[0]!.status).toBe('applied')
    expect(FARM_KITCHEN_CATALOGUE.blocks.map(b => f.entities.get(`farmRecipes/b${b}`)!.data.cooking !== null)).toEqual([true, true, true])
  })
  it('debits ten concrete stacks for four banquets atomically, never substitutes or splits', () => {
    const f = farmProtocolFixture(), farm = f.entities.get('farm/main')!
    f.put('farm', 'main', { ...farm.data, stations: [{ id: 'kitchen-1', outfitId: 'invented-0', attempt: 0, job: null }] })
    const milestone = { jobId: `farm-job:${f.generation}:garden-1:1`, outfitId: 'invented-1', level: 9 }
    f.put('farmRecipes', 'b1', { ...emptyFarmRecipes(f.generation, 1), processing: milestone, cooking: milestone })
    const choices = Object.fromEntries(STATS.flatMap(stat => [[`raw-${stat}`, `farm:raw:ura-finale:vegetable:${stat}`], [`processed-${stat}`, `farm:processed:ura-finale:cheese:${stat}`]]))
    for (const id of Object.values(choices)) f.put('items', id, { itemId: id, quantity: 4, updatedAt: 1 })
    const payload = { ...start, stationId: 'kitchen-1' as const, recipeId: 'farm:meal:b1:sun', quantity: 4, choices }
    const last = Object.values(choices).at(-1)!; f.put('items', last, { itemId: last, quantity: 3, updatedAt: 1 })
    const rejected = f.apply(f.operation(payload))
    expect(rejected.writes).toEqual([]); expect(rejected.appends).toEqual([])
    expect(Object.values(choices).map(id => f.entities.get(`items/${id}`)!.data.quantity)).toEqual([...Array(9).fill(4), 3])
    f.put('items', last, { itemId: last, quantity: 4, updatedAt: 1 })
    const accepted = f.apply(f.operation(payload)); expect(accepted.responses[0]!.status).toBe('applied')
    expect(accepted.responses[0]!.receipt!.logs).toHaveLength(10)
    expect(Object.values(choices).map(id => f.entities.get(`items/${id}`)!.data.quantity)).toEqual(Array(10).fill(0))
    expect(accepted.responses[0]!.receipt!.result).toMatchObject({ job: { quantity: 4, output: { amount: 4 }, expAward: 12 } })
    expect(parseFarmOperation({ ...f.operation(payload), awards: 500 })).toBeNull()
    const wrong = { ...payload, choices: { ...choices, 'raw-speed': choices['processed-speed']! } }
    expect(() => f.operation(wrong)).toThrow(/Invalid/)
  })
  it('Energy is a separate one-job debit, with retries unable to accelerate the next attempt', () => {
    const f = farmProtocolFixture(); f.apply(f.operation(start))
    f.put('items', FARM_KITCHEN_ENERGY_ID, { itemId: FARM_KITCHEN_ENERGY_ID, quantity: 2, updatedAt: 1 })
    const op = f.operation({ kind: 'energy', stationId: 'garden-1', outfitId: 'invented-0', jobId: `farm-job:${f.generation}:garden-1:1` }, 'energy')
    expect(f.apply(op).responses[0]!.status).toBe('applied'); expect(f.apply(op).responses[0]!.status).toBe('duplicate')
    expect(f.entities.get(`items/${FARM_KITCHEN_ENERGY_ID}`)!.data.quantity).toBe(1)
    expect(f.apply(f.operation({ kind: 'energy', stationId: 'garden-1', outfitId: 'invented-0', jobId: 'invented-wrong' }, 'wrong')).responses[0]!.status).toBe('rejected')
  })
  it('preserves existing trusted-device timing through delayed offline Start and Claim acknowledgements', () => {
    const f = farmProtocolFixture(); f.apply(f.operation(start), 1000 + FARM_KITCHEN_JOB_MS)
    expect(f.entities.get('farm/main')!.data.stations).toMatchObject([{ job: { startedAt: 1000, readyAt: 1000 + FARM_KITCHEN_JOB_MS } }])
    const claim = f.operation({ kind: 'claim', stationId: 'garden-1', outfitId: 'invented-0', jobId: `farm-job:${f.generation}:garden-1:1`, recipeId: start.recipeId }, 'future', 1000 + FARM_KITCHEN_JOB_MS)
    const accepted = f.apply(claim, 1000 + 2 * FARM_KITCHEN_JOB_MS).responses[0]!
    expect(accepted.status).toBe('applied'); expect(accepted.receipt!.createdAt).toBe(1000 + 2 * FARM_KITCHEN_JOB_MS)
    expect(f.entities.get('farmWorkers/invented-0')!.data.totalExp).toBe(12)
  })
  it('purchases one named target across distances once, never autoactivating its retry', () => {
    const f = farmProtocolFixture(), itemId = 'farm:meal:b1:speed'
    f.put('items', itemId, { itemId, quantity: 2, updatedAt: 1 })
    const buy = { kind: 'buy-node' as const, outfitId: 'invented-0', scenarioId: 'ura-finale', distance: 'sprint' as const, nodeId: 'speed-01', autoactivate: true }
    const first = f.apply(f.operation(buy))
    expect(first.responses[0]!.status).toBe('applied'); expect(first.responses[0]!.receipt!.result).toMatchObject({ nodeName: 'Speed Seed', activated: true })
    expect(f.entities.get(`items/${itemId}`)!.data.quantity).toBe(1)
    const retry = f.apply(f.operation({ ...buy, distance: 'long', autoactivate: true }))
    expect(retry.responses[0]!.receipt).toMatchObject({ changes: [], logs: [], result: first.responses[0]!.receipt!.result })
    expect(f.entities.get(`items/${itemId}`)!.data.quantity).toBe(1)
    const activated = f.apply(f.operation({ kind: 'set-active', outfitId: buy.outfitId, scenarioId: buy.scenarioId, distance: 'long', nodeIds: ['speed-01'] }))
    expect(activated.responses[0]!.status).toBe('applied'); expect(activated.responses[0]!.receipt!.logs).toEqual([])
    expect(f.entities.get('farmExtra/invented-0:b1')!.data).toMatchObject({ activeByScenario: { 'ura-finale': { sprint: ['speed-01'], long: ['speed-01'] } } })
    const corrupted = structuredClone(first.responses[0]!.receipt!); const movement = corrupted.logs.find(l => l.kind === 'itemLedger')!
    movement.data.delta = -2; expect(parseFarmOperationReceipt(corrupted)).toBeNull()
  })
  it('legacy claims pay the frozen crop once, no v3 EXP, and keep their old deadline', () => {
    const f = farmProtocolFixture(), cycle = { id: 'farm:plot-1:1', cropId: 'produce:t1:speed', plantedAt: 1000, readyAt: 1000 + 10 * 3600000 }
    f.put('farmCutoverPages', `${f.generation}:legacy`, { schemaVersion: 1, generation: f.generation, type: 'legacy', stations: [{ stationId: 'garden-1', outfitId: 'invented-0', attempt: 1, cycle }] })
    const payload = { kind: 'claim-legacy' as const, stationId: 'garden-1' as const, outfitId: 'invented-0', cycleId: cycle.id, cropId: cycle.cropId }
    expect(f.apply(f.operation(start)).responses[0]!.status).toBe('rejected')
    expect(f.apply(f.operation(payload, 'early', 1000)).responses[0]!.status).toBe('rejected')
    const accepted = f.apply(f.operation(payload, 'claim-old', cycle.readyAt))
    expect(accepted.responses[0]!.status).toBe('applied'); expect(accepted.responses[0]!.receipt!.result).toMatchObject({ expAward: 0, output: { amount: 1 } })
    expect(f.entities.get('farmWorkers/invented-0')!.data.totalExp).toBe(0)
    expect(f.apply(f.operation(payload, 'second-old', cycle.readyAt)).writes).toEqual([])
    expect(f.entities.get(`items/${cycle.cropId}`)!.data.quantity).toBe(1)
    expect(f.apply(f.operation(start, 'new-job', cycle.readyAt)).responses[0]!.status).toBe('applied')
  })
  it('validates ownership, exact locks, dependencies and generation before mutating', () => {
    const f = farmProtocolFixture(), op = f.operation(start)
    for (const bad of [createFarmOperation({ ...op, expected: op.expected.slice(1) }), createFarmOperation({ ...op, generation: 'old-generation' }),
      createFarmOperation({ ...op, expected: op.expected.map(e => ({ ...e, version: 999 })) })]) expect(f.apply(bad).writes).toEqual([])
    expect(f.apply(f.operation({ kind: 'assign', stationId: 'barn-6', outfitId: 'unavailable' })).responses[0]!.status).toBe('rejected')
    expect(f.apply(f.operation(start, 'child', 1000, ['missing'])).responses[0]!.status).toBe('blocked')
    expect(() => f.operation(start, 'bad', 1000, ['same', 'same'])).toThrow()
    expect(farmOperationReferences(f.operation({ kind: 'assign', stationId: 'garden-6', outfitId: 'invented-0' })).entities.filter(k => k.startsWith('farmWorkers/'))).toEqual(['farmWorkers/invented-0'])
    f.apply(op)
    for (const stationId of FARM_STATION_IDS.filter(id => id !== 'garden-1')) expect(f.apply(f.operation({ kind: 'assign', stationId, outfitId: 'invented-0' })).writes).toEqual([])
    expect(f.apply(f.operation({ kind: 'remove', stationId: 'garden-1' })).writes).toEqual([])
  })
  it('strictly preserves future/invalid record errors and registered identity agreement', () => {
    const f = farmProtocolFixture()
    for (const r of f.entities.values()) if (r.kind.startsWith('farm')) {
      expect(parseFarmEntity(r.kind, r.data)).not.toBeNull(); expect(farmEntityIdMatches(r.kind, r.id, r.data)).toBe(true)
      expect(parseFarmEntity(r.kind, { ...r.data, schemaVersion: 999 })).toBeNull()
      expect(parseFarmEntity(r.kind, { ...r.data, unknown: true })).toBeNull()
      expect(farmEntityIdMatches(r.kind, 'wrong', r.data)).toBe(false)
    }
  })
  it('partitions thirty claims and rejects oversized command groups', () => {
    const f = farmProtocolFixture(), claims = FARM_STATION_IDS.map((stationId, i) => f.operation({ kind: 'claim', stationId, outfitId: `invented-${i}`, jobId: `farm-job:${f.generation}:${stationId}:1`, recipeId: start.recipeId }, `claim-${i}`))
    const batches = partitionFarmOperations(claims)
    expect(batches.flat()).toEqual(claims); expect(batches.length).toBeGreaterThan(1)
    for (const batch of batches) { expect(parseFarmOperationBatch(batch)).not.toBeNull(); expect(farmBytes(batch)).toBeLessThanOrEqual(262144) }
    expect(parseFarmOperationBatch(Array.from({ length: 17 }, (_, i) => f.operation({ kind: 'grant-energy' }, `grant-${i}`)))).toBeNull()
  })
})
