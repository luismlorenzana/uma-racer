import { describe, expect, it } from 'vitest'
import { parseSyncRequest, resolveUpserts, type EntityRecord } from './save.types'

const farmV1 = {
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

/** v2 (D234): sparse plots and uncapped Farming Levels. */
const farm = {
  schemaVersion: 2,
  plots: [farmV1.plots[0]!],
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

  it('opens plots past six by Farm Level, sparsely, and times crops from 12h down to 8h (D234)', () => {
    const upsert = (data: unknown) => parseSyncRequest({ upserts: [{ kind: 'farm', id: 'main', baseVersion: 0, data }] })
    const idle = (id: string, templateId: string) => ({ id, templateId, lastCropId: null, attempt: 0, cycle: null })
    // Plot 7 opens at Farm Level 183; one worker at Lv183 is Farm Level 183.
    const sectionTwo = { ...farm, plots: [...farm.plots, idle('plot-7', 'second-outfit')], workers: { 'synthetic-outfit': { level: 183, exp: 0 } } }
    expect(upsert(sectionTwo)).toMatchObject({ upserts: [{ kind: 'farm' }] })
    expect(upsert({ ...sectionTwo, workers: { 'synthetic-outfit': { level: 182, exp: 0 } } })).toMatch(/invalid farm/)
    expect(upsert({ ...farm, plots: [...farm.plots, { ...idle('plot-2', 'x'), templateId: null }] })).toMatch(/invalid farm/)
    expect(upsert({ ...sectionTwo, plots: [...sectionTwo.plots].reverse() })).toMatch(/invalid farm/)
    const lasting = (minutes: number) => upsert({ ...farm, plots: [{ ...farm.plots[0]!,
      cycle: { ...farm.plots[0]!.cycle!, readyAt: 1 + minutes * 60_000 } }] })
    expect(lasting(480)).toMatchObject({ upserts: [{ kind: 'farm' }] })
    expect(lasting(456)).toMatch(/invalid farm/)
    expect(upsert({ ...farm, workers: { a: { level: 50_000, exp: 23 } } })).toMatchObject({ upserts: [{ kind: 'farm' }] })
    expect(upsert({ ...farm, workers: { a: { level: 500, exp: 24 } } })).toMatch(/invalid farm/)
    expect(parseSyncRequest({ appends: [{ kind: 'itemLedger', id: 'farm:plot-40:3', createdAt: 5, data: { ...movement,
      id: 'farm:plot-40:3', createdAt: 5, source: { ...movement.source, plotId: 'plot-40', cycleId: 'farm:plot-40:3' } } }] }))
      .toMatchObject({ appends: [{ kind: 'itemLedger' }] })
  })

  it('still answers an older client that writes v1, and keeps the newer schema as the conflict', () => {
    expect(parseSyncRequest({ upserts: [{ kind: 'farm', id: 'main', baseVersion: 0, data: farmV1 }] })).toMatchObject({ upserts: [{ kind: 'farm' }] })
    const current: EntityRecord = { kind: 'farm', id: 'main', version: 7, data: farm, deleted: false, updatedAt: 1 }
    const result = resolveUpserts(new Map([['farm/main', current]]), [{ kind: 'farm', id: 'main', baseVersion: 7, data: farmV1 }], 2)
    expect(result).toEqual({ writes: [], conflicts: [current] })
  })
})
