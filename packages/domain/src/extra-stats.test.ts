import { describe, expect, it } from 'vitest'
import { constellationTemplate, deriveStats } from './constellation'
import {
  EXTRA_STAT_NODE_IDS,
  emptyExtraStats,
  extraStatUnlockCost,
  extraStatsFromProduce,
  parseExtraStats,
  resolveExtraStatUnlock,
  toggleExtraStat,
  type ExtraStats,
} from './extra-stats'
import { parseItemLedgerEntry } from './farm/types'

const uma = {
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
}

const unlock = (extra: ExtraStats, stat: 'speed' | 'stamina' | 'power' | 'guts' | 'wit', quantity = 10) =>
  resolveExtraStatUnlock({ umaId: 'u1', tier: 2, extra, stat, quantity, now: 50 })

describe('Extra stats (D235)', () => {
  it('lays out four nodes of each stat, bought in order for 1, 2, 3 and 4 of the scenario crop', () => {
    expect(EXTRA_STAT_NODE_IDS).toHaveLength(20)
    expect(EXTRA_STAT_NODE_IDS.slice(0, 5)).toEqual(['speed-1', 'speed-2', 'speed-3', 'speed-4', 'stamina-1'])
    expect([1, 2, 3, 4].map(extraStatUnlockCost)).toEqual([1, 2, 3, 4])

    const first = unlock(emptyExtraStats(), 'stamina', 3)
    expect(first).toMatchObject({ nodeId: 'stamina-1', cropId: 'produce:t2:stamina', cost: 1, quantityBefore: 3, quantityAfter: 2 })
    expect(first.extra).toEqual({ unlocked: { speed: 0, stamina: 1, power: 0, guts: 0, wit: 0 }, active: ['stamina-1'] })
    expect(first.movement).toEqual({
      id: 'extra:u1:2:stamina-1', itemId: 'produce:t2:stamina', delta: -1, reason: 'extra-stat-unlock',
      source: { kind: 'extra-stat-unlock', umaId: 'u1', tier: 2, nodeId: 'stamina-1' }, createdAt: 50,
    })
    expect(parseItemLedgerEntry(first.movement)).toEqual(first.movement)
    // The second node costs two; one crop is not enough.
    expect(() => unlock(first.extra, 'stamina', 1)).toThrow(/needs 2/)
    expect(unlock(first.extra, 'stamina', 2).movement.delta).toBe(-2)
    const full = extraStatsFromProduce(['wit', 'wit', 'wit', 'wit'])
    expect(() => unlock(full, 'wit')).toThrow(/already unlocked/)
  })

  it('turns a bought node on while a slot is free, and leaves it off when all six are on', () => {
    const six = extraStatsFromProduce(['speed', 'speed', 'speed', 'speed', 'power', 'power'])
    const bought = unlock(six, 'guts')
    expect(bought.extra.unlocked.guts).toBe(1)
    expect(bought.extra.active).toEqual(six.active)
  })

  it('toggles bought nodes freely, six at most, in grid order', () => {
    let extra = unlock(unlock(emptyExtraStats(), 'wit').extra, 'speed').extra
    expect(extra.active).toEqual(['speed-1', 'wit-1'])
    extra = toggleExtraStat(extra, 'wit-1', false)
    expect(extra.active).toEqual(['speed-1'])
    extra = toggleExtraStat(extra, 'wit-1', true)
    expect(extra.active).toEqual(['speed-1', 'wit-1'])
    expect(() => toggleExtraStat(extra, 'power-1', true)).toThrow(/not unlocked/)
    const six = extraStatsFromProduce(['speed', 'speed', 'speed', 'speed', 'power', 'power'])
    const withGuts = { ...six, unlocked: { ...six.unlocked, guts: 1 } }
    expect(() => toggleExtraStat(withGuts, 'guts-1', true)).toThrow(/All 6/)
    expect(toggleExtraStat(toggleExtraStat(withGuts, 'speed-4', false), 'guts-1', true).active)
      .toEqual(['speed-1', 'speed-2', 'speed-3', 'power-1', 'power-2', 'guts-1'])
  })

  it('parses only canonical grids', () => {
    const extra = extraStatsFromProduce(['speed', 'wit'])
    expect(parseExtraStats(extra)).toEqual(extra)
    expect(parseExtraStats({ ...extra, active: ['wit-1', 'speed-1'] })).toBeNull()
    expect(parseExtraStats({ ...extra, active: ['speed-1', 'speed-1'] })).toBeNull()
    expect(parseExtraStats({ ...extra, active: ['speed-2'] })).toBeNull()
    expect(parseExtraStats({ ...extra, unlocked: { ...extra.unlocked, speed: 1.5 } })).toBeNull()
  })

  it('pays 40 raw a node for the active ones only, at any Training Level', () => {
    const template = constellationTemplate(1)
    const extra = { ...extraStatsFromProduce(['stamina', 'stamina', 'speed']), unlocked: { speed: 1, stamina: 4, power: 0, guts: 0, wit: 0 } }
    for (const trainingLevel of [1, 10]) {
      const derived = deriveStats({ buffs: false, tier: 1, trainingLevel, template, assignments: {}, cardSetIds: [], umaTemplate: uma,
        cards: new Map(), extraStats: extra })
      expect(derived.raw).toEqual({ speed: 40, stamina: 80, power: 0, guts: 0, wit: 0 })
    }
  })

  it('rejects unlock evidence that does not match its node, crop or cost', () => {
    const movement = unlock(emptyExtraStats(), 'power').movement
    expect(parseItemLedgerEntry({ ...movement, delta: -2 })).toBeNull()
    expect(parseItemLedgerEntry({ ...movement, itemId: 'produce:t2:speed' })).toBeNull()
    expect(parseItemLedgerEntry({ ...movement, itemId: 'produce:t1:power' })).toBeNull()
    expect(parseItemLedgerEntry({ ...movement, id: 'extra:u1:2:power-2' })).toBeNull()
  })
})
