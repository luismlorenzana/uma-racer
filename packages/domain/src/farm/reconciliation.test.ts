import { describe, expect, it } from 'vitest'
import { farmCropById } from './catalog'
import { assignFarmOutfit, createInitialFarmState, harvestPlot, plantPlot } from './rules'
import { reconcileFarmEvidence } from './reconciliation'

describe('Farm evidence reconciliation', () => {
  const crop = farmCropById('produce:t1:speed')!
  const owned = new Set(['outfit-a'])

  function harvested() {
    const assigned = assignFarmOutfit(createInitialFarmState(), 'plot-1', 'outfit-a', owned)
    const planted = plantPlot({ farm: assigned, plotId: 'plot-1', crop, ownedTemplateIds: owned, now: 1_000 })
    return harvestPlot({ farm: planted.farm, plotId: 'plot-1', cycleId: planted.cycleId, crop, now: planted.readyAt })
  }

  it('repairs stack quantity, worker XP, attempt floor, and a resurrected harvested cycle', () => {
    const result = harvested()
    const resurrected = plantPlot({
      farm: assignFarmOutfit(createInitialFarmState(), 'plot-1', 'outfit-a', owned),
      plotId: 'plot-1', crop, ownedTemplateIds: owned, now: 1_000,
    }).farm
    const repaired = reconcileFarmEvidence(
      resurrected,
      [{ itemId: crop.id, quantity: 0, updatedAt: 0 }],
      [result.movement, result.movement],
    )
    expect(repaired.farm.plots[0]).toMatchObject({ templateId: 'outfit-a', attempt: 1, cycle: null, lastCropId: crop.id })
    expect(repaired.farm.workers['outfit-a']).toEqual({ level: 1, exp: 12 })
    expect(repaired.stacks).toEqual([{ itemId: crop.id, quantity: 1, updatedAt: result.movement.createdAt }])
    expect(repaired).toMatchObject({ farmChanged: true, changedItemIds: [crop.id] })
  })

  it('is write-free when projections already match and rejects conflicting evidence ids', () => {
    const result = harvested()
    const stack = { itemId: crop.id, quantity: 1, updatedAt: result.movement.createdAt }
    const exact = reconcileFarmEvidence(result.farm, [stack], [result.movement])
    expect(exact).toMatchObject({ farmChanged: false, changedItemIds: [] })
    expect(() => reconcileFarmEvidence(result.farm, [stack], [result.movement, {
      ...result.movement,
      itemId: 'produce:t1:power',
    }])).toThrow(/conflicting evidence/)
  })
})
