import { farmCropById, type InventoryStackData } from '@racer/domain/farm'
import { describe, expect, it } from 'vitest'
import { buildItemInventory, produceItemDefinitions, resolveItemLink } from './view'

const crops = [
  farmCropById('produce:t2:power')!,
  farmCropById('produce:t1:wit')!,
  farmCropById('produce:t1:speed')!,
]
const definitions = produceItemDefinitions(crops)
const stack = (itemId: string, quantity: number): InventoryStackData => ({ itemId, quantity, updatedAt: 10 })

describe('global Item inventory view', () => {
  it('joins 0, 1 and large stacks and uses scenario, stat, name order', () => {
    const view = buildItemInventory(definitions, [
      stack('produce:t1:wit', 1),
      stack('produce:t2:power', 999_999),
    ], { visibility: 'all', facets: {} })
    expect(view.items.map((item) => [item.itemId, item.quantity])).toEqual([
      ['produce:t1:speed', 0], ['produce:t1:wit', 1], ['produce:t2:power', 999_999],
    ])
    expect(view).toMatchObject({ catalogTotal: 3, ownedUnique: 2, totalQuantity: 1_000_000, orphanedStacks: 0 })
  })

  it('hides zero stacks by default and filters stat and destination scenario', () => {
    const stacks = [stack('produce:t1:wit', 1), stack('produce:t2:power', 4)]
    expect(buildItemInventory(definitions, stacks, { visibility: 'owned', facets: {} }).items).toHaveLength(2)
    expect(buildItemInventory(definitions, stacks, { visibility: 'all', facets: { scenario: '1', stat: 'speed' } }).items
      .map((item) => item.itemId)).toEqual(['produce:t1:speed'])
  })

  it('retains orphan stacks as aggregate diagnostics without pretending they have definitions', () => {
    const view = buildItemInventory(definitions, [stack('future:item', 7)], { visibility: 'owned', facets: {} })
    expect(view.items).toEqual([{ itemId: 'future:item', definition: null, quantity: 7, orphaned: true }])
    expect(view).toMatchObject({ ownedUnique: 1, totalQuantity: 7, orphanedStacks: 1 })
  })

  it('rejects duplicate, negative and unsafe view inputs', () => {
    expect(() => buildItemInventory(definitions, [stack('same', 1), stack('same', 2)], { visibility: 'all', facets: {} })).toThrow(/duplicated/)
    expect(() => buildItemInventory(definitions, [stack('bad', -1)], { visibility: 'all', facets: {} })).toThrow(/invalid/)
    expect(() => buildItemInventory([definitions[0]!, definitions[0]!], [], { visibility: 'all', facets: {} })).toThrow(/duplicated/)
  })

  it('resolves known direct links and rejects unsafe or unknown ids cleanly', () => {
    expect(resolveItemLink(null, definitions).status).toBe('absent')
    expect(resolveItemLink('produce:t1:speed', definitions)).toMatchObject({ status: 'ready', definition: { name: 'Carrot' } })
    expect(resolveItemLink('../secret', definitions).status).toBe('invalid')
    expect(resolveItemLink('produce:t1:future', definitions).status).toBe('invalid')
  })
})
