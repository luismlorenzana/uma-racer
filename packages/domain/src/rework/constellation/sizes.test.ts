// Pins the re-authored tree sizes and their per-card caps (rework/05 §4), and their parity with today's cap rule.
import { describe, expect, it } from 'vitest'
import { cardFairShare, cardNodeCap, shapeDef } from '../../constellation'
import { fairShare, perCardCap, TREE_CARD_NODES, treeCardNodes, treeCardNodesAt } from './sizes'

describe('tree sizes', () => {
  it('are 12, 16, 20, 24 and 28 in every tier', () => {
    expect(TREE_CARD_NODES).toEqual([12, 16, 20, 24, 28])
    expect([1, 2, 3, 4, 5].map((s) => treeCardNodes(s as 1 | 2 | 3 | 4 | 5))).toEqual([12, 16, 20, 24, 28])
    expect(Array.from({ length: 15 }, (_, i) => treeCardNodesAt(i + 1))).toEqual([12, 16, 20, 24, 28, 12, 16, 20, 24, 28, 12, 16, 20, 24, 28])
    expect(() => treeCardNodesAt(16)).toThrow(RangeError)
  })

  it('cap each card at its fair share plus one', () => {
    expect(TREE_CARD_NODES.map(fairShare)).toEqual([2, 3, 4, 4, 5])
    expect(TREE_CARD_NODES.map(perCardCap)).toEqual([3, 4, 5, 5, 6])
  })

  it('apply today\'s rule to today\'s sizes', () => {
    for (let t = 1; t <= 14; t += 1) {
      expect(fairShare(shapeDef(t).cardNodes)).toBe(cardFairShare(t))
      expect(perCardCap(shapeDef(t).cardNodes)).toBe(cardNodeCap(t))
    }
  })
})
