import { describe, expect, it } from 'vitest'
import { puzzleUiProofData } from '../../screens/puzzles/ui-proof-data'
import { buildItemInventory, constellationItemDefinitions, savedOrphanItem } from './view'
import { clSpendVector, clTicketRows, exchangeBatch } from './cl'
describe('global constellation item catalogue and spend inputs', () => {
  it('generates 56 styles in registry order, supports future registries without a 14-scenario assumption', () => {
    const defs = constellationItemDefinitions()
    expect(defs).toHaveLength(56); expect(defs.slice(0, 4).map(d => d.material.style)).toEqual(['front', 'pace', 'late', 'end'])
    const future = constellationItemDefinitions([{ id: 'invented-new', tier: 20, name: 'Invented new' }, { id: 'invented-next', tier: 21, name: 'Invented next' }])
    expect(buildItemInventory(future, [], { visibility: 'all', facets: {} }).items.map(i => i.itemId)).toEqual(future.map(d => d.id))
    expect(future).toHaveLength(8)
  })
  it('joins only positive Owned, keeps All zeroes, intersects scenario/style, preserves and safely links orphans', () => {
    const defs = constellationItemDefinitions(), stocks = { [defs[0]!.id]: 3, [defs[1]!.id]: 0, 'constellation:invented-future:front': 2 }
    const input = Object.entries(stocks).map(([itemId, quantity]) => ({ itemId, quantity, updatedAt: 1 }))
    expect(buildItemInventory(defs, input, { visibility: 'owned', facets: {} }).items).toHaveLength(2)
    expect(buildItemInventory(defs, input, { visibility: 'all', facets: {} }).items).toHaveLength(57)
    expect(buildItemInventory(defs, input, { visibility: 'all', facets: { scenario: '1', style: 'pace' } }).items.map(i => i.quantity)).toEqual([0])
    expect(savedOrphanItem('constellation:invented-future:front', stocks, defs)).toBe('constellation:invented-future:front')
    expect(savedOrphanItem('https://invalid.test', stocks, defs)).toBeNull(); expect(savedOrphanItem('not-saved', stocks, defs)).toBeNull()
  })
  it('uses literal original A only, rejects unsafe counts, mixed cross-scenario and overspend; universal stays separate', () => {
    const source = puzzleUiProofData().sources[0]!, stocks = { 'constellation:ura-finale:front': 4, 'constellation:ura-finale:pace': 2, 'constellation:unity-cup:front': 3 }
    const rows = clTicketRows(source, 'ura-finale', stocks)
    expect(rows.filter(r => r.eligible).map(r => r.style)).toEqual(['front'])
    expect(clSpendVector({ 'constellation:ura-finale:front': '2', 'training:level-up-ticket': '1' }, rows, 2, 3)).toHaveLength(2)
    for (const raw of ['-1', '1.5', '1e2', '9007199254740992', '5']) expect(clSpendVector({ 'constellation:ura-finale:front': raw }, rows, 2, 9)).toBeNull()
    expect(clSpendVector({ 'constellation:ura-finale:pace': '1' }, rows, 2, 9)).toBeNull()
    expect(clSpendVector({ 'constellation:unity-cup:front': '1' }, rows, 2, 9)).toBeNull()
    expect(clSpendVector({ 'constellation:ura-finale:front': '2' }, rows, 2, 1)).toBeNull()
    expect(clSpendVector({ 'training:level-up-ticket': '1' }, rows, 2, 0)).toBeNull()
  })
  it('batch counts enforce positive safe integers and 1:2 inputs in both directions', () => {
    expect(exchangeBatch('3', true)).toBe(3); expect(exchangeBatch('3', false)).toBe(6)
    for (const raw of ['', '0', '-1', '1.5', '1e2', '9007199254740992']) expect(exchangeBatch(raw, false)).toBeNull()
  })
})
