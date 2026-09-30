import { describe, expect, it } from 'vitest'
import { parseSaveSnapshotOrThrow, parseSyncRequest } from '../save'
import { createInitialFarmState } from './rules'

describe('Farm save vocabulary', () => {
  it('accepts optional Farm kinds without changing legacy snapshots', () => {
    expect(parseSaveSnapshotOrThrow({ entities: [], logs: [], serverTime: 1 })).toEqual({ entities: [], logs: [], serverTime: 1 })
    expect(parseSyncRequest({
      upserts: [
        { kind: 'farm', id: 'main', baseVersion: 0, data: createInitialFarmState() },
        { kind: 'items', id: 'produce:t1:speed', baseVersion: 0,
          data: { itemId: 'produce:t1:speed', quantity: 1, updatedAt: 2 } },
      ],
      appends: [{ kind: 'itemLedger', id: 'farm:plot-1:1', createdAt: 2, data: {
        id: 'farm:plot-1:1', itemId: 'produce:t1:speed', delta: 1, reason: 'farm-harvest', createdAt: 2,
        source: { kind: 'farm-harvest', plotId: 'plot-1', cycleId: 'farm:plot-1:1', templateId: 'outfit-a', farmingExp: 12 },
      } }],
    })).toMatchObject({ upserts: [{ kind: 'farm' }, { kind: 'items' }], appends: [{ kind: 'itemLedger' }] })
  })

  it('reports a newer Farm schema as an app-update error', () => {
    expect(() => parseSaveSnapshotOrThrow({ entities: [{
      kind: 'farm', id: 'main', version: 1, data: { ...createInitialFarmState(), schemaVersion: 2 }, deleted: false, updatedAt: 1,
    }], logs: [], serverTime: 1 })).toThrow('App update required for Farm schema 2')
  })
})
