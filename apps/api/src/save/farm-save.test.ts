import { describe, expect, it } from 'vitest'
import { parseSyncRequest, resolveUpserts, type EntityRecord } from './save.types'

const farm = {
  schemaVersion: 1,
  plots: Array.from({ length: 6 }, (_, index) => ({
    id: `plot-${index + 1}`,
    templateId: index === 0 ? 'synthetic-outfit' : null,
    lastCropId: null,
    attempt: index === 0 ? 1 : 0,
    cycle: index === 0 ? {
      id: 'farm:plot-1:1', cropId: 'produce:t1:speed', plantedAt: 1, readyAt: 43_200_001,
    } : null,
  })),
  workers: {},
}

const movement = {
  id: 'farm:plot-1:1', itemId: 'produce:t1:speed', delta: 1, reason: 'farm-harvest',
  source: { kind: 'farm-harvest', plotId: 'plot-1', cycleId: 'farm:plot-1:1', templateId: 'synthetic-outfit', farmingExp: 12 },
  createdAt: 43_200_001,
}

describe('Farm save wire contract', () => {
  it('strictly accepts and round-trips Farm, item stack, and evidence operations', () => {
    const request = parseSyncRequest({
      upserts: [
        { kind: 'farm', id: 'main', baseVersion: 0, data: farm },
        { kind: 'items', id: 'produce:t1:speed', baseVersion: 0,
          data: { itemId: 'produce:t1:speed', quantity: 1, updatedAt: 43_200_001 } },
      ],
      appends: [{ kind: 'itemLedger', id: movement.id, data: movement, createdAt: movement.createdAt }],
    })
    expect(request).toMatchObject({ upserts: [{ kind: 'farm' }, { kind: 'items' }], appends: [{ kind: 'itemLedger' }] })
    if (typeof request === 'string') throw new Error(request)
    const existing = new Map<string, EntityRecord>()
    expect(resolveUpserts(existing, request.upserts, 99).writes).toMatchObject([
      { kind: 'farm', id: 'main', version: 1 },
      { kind: 'items', id: 'produce:t1:speed', version: 1 },
    ])
  })

  it('rejects mismatched ids, unknown Farm fields, bad deadlines, and malformed evidence', () => {
    expect(parseSyncRequest({ upserts: [{ kind: 'farm', id: 'other', baseVersion: 0, data: farm }] })).toMatch(/id does not match/)
    expect(parseSyncRequest({ upserts: [{ kind: 'farm', id: 'main', baseVersion: 0, data: { ...farm, surprise: true } }] }))
      .toMatch(/invalid farm/)
    const badDeadline = { ...farm, plots: farm.plots.map((plot, index) => index === 0
      ? { ...plot, cycle: { ...plot.cycle!, readyAt: 2 } }
      : plot) }
    expect(parseSyncRequest({ upserts: [{ kind: 'farm', id: 'main', baseVersion: 0, data: badDeadline }] })).toMatch(/invalid farm/)
    expect(parseSyncRequest({ appends: [{ kind: 'itemLedger', id: movement.id,
      data: { ...movement, delta: 2 }, createdAt: movement.createdAt }] })).toMatch(/invalid itemLedger/)
    expect(parseSyncRequest({ upserts: [{ kind: 'items', id: 'produce:t1:speed', baseVersion: 0,
      data: { itemId: 'produce:t1:power', quantity: 1, updatedAt: 1 } }] })).toMatch(/id does not match/)
  })

  it('keeps a newer Farm schema as the authoritative conflict', () => {
    const future: EntityRecord = { kind: 'farm', id: 'main', version: 7, data: { ...farm, schemaVersion: 2 }, deleted: false, updatedAt: 1 }
    const result = resolveUpserts(new Map([['farm/main', future]]), [{ kind: 'farm', id: 'main', baseVersion: 7, data: farm }], 2)
    expect(result).toEqual({ writes: [], conflicts: [future] })
  })
})
