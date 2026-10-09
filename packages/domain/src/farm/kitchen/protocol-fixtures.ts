// Small, invented save records shared by protocol/adapter tests only; never production content.
import synthetic from '../../minigames/uma-puzzles/protocol.synthetic.json'
import { createFarmKitchen, createFarmKitchenWorker } from './production'
import { createFarmOperation, farmOperationReferences, type FarmPayloadV1 } from './operations'
import { farmData, type FarmStoredEntity, type FarmStoredLog } from './wire'
import { resolveFarmOperations } from './resolver'
export function farmProtocolFixture(totalExp = 0, generation = 'invented-farm-generation') {
  const entities = new Map<string, FarmStoredEntity>(), logs = new Map<string, FarmStoredLog>()
  const put = (kind: string, id: string, data: object, version = 1) => entities.set(`${kind}/${id}`, { kind, id, data: farmData(data), version, deleted: false, updatedAt: 1 })
  put('farmCutover', 'main', { schemaVersion: 1, generation, phase: 'active', cohortDigest: 'a'.repeat(64), archiveDigest: 'b'.repeat(64),
    outfitCount: 2, pageCount: 1, nextOutfitIndex: 2, createdAt: 0, activatedAt: 1 })
  put('farmCutoverPages', `${generation}:legacy`, { schemaVersion: 1, generation, type: 'legacy', stations: [] })
  put('farm', 'main', { ...createFarmKitchen(generation), stations: [{ id: 'garden-1', outfitId: 'invented-0', attempt: 0, job: null }] })
  for (let i = 0; i < 2; i++) {
    put('umas', `invented-${i}`, { ...structuredClone(synthetic.uma), templateId: `invented-${i}` })
    put('farmWorkers', `invented-${i}`, createFarmKitchenWorker(generation, `invented-${i}`, totalExp))
  }
  let sequence = 0
  const operation = (payload: FarmPayloadV1, id = `invented-operation-${++sequence}`, now = 1000, dependencies: string[] = []) => {
    const provisional = createFarmOperation({ schemaVersion: 1, operationId: id, generation, now, dependencies, expected: [], payload })
    return createFarmOperation({ ...provisional, expected: farmOperationReferences(provisional).entities.map(k => {
      const [kind, rowId] = k.split('/'); return { kind: kind!, id: rowId!, version: entities.get(k)?.version ?? 0 }
    }) })
  }
  const apply = (op: ReturnType<typeof operation>, now = op.now) => {
    const result = resolveFarmOperations({ enabled: true, allowEnergyGrant: true, now, entities, logs }, [op])
    result.writes.forEach(r => entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => logs.set(`${r.kind}/${r.id}`, r)); return result
  }
  return { generation, entities, logs, put, operation, apply }
}
