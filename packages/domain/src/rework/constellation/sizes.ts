// The re-authored trees' sizes (docs/rework/05-training-hub.md §4, README): 12, 16, 20, 24 and 28 card nodes for a
// tier's scenarios 1–5, and the per-card cap from the size (D134). A leaf: T125 and T128 import it, T129 draws the trees.
import { CARD_SET_SIZE } from '../../constellation'
import type { ScenarioOfTier } from '../types'

/** Card nodes in scenario s of any tier's tree, s = 1–5. */
export const TREE_CARD_NODES = [12, 16, 20, 24, 28] as const

export const treeCardNodes = (scenario: ScenarioOfTier): number => TREE_CARD_NODES[scenario - 1]!

/** Card nodes in the game's scenario T = 1–15. */
export function treeCardNodesAt(T: number): number {
  if (!Number.isInteger(T) || T < 1 || T > 15) throw new RangeError(`Scenario must be 1–15: ${T}`)
  return TREE_CARD_NODES[(T - 1) % 5]!
}

/** A card's fair share of a tree of N card nodes. */
export const fairShare = (N: number): number => Math.ceil(N / CARD_SET_SIZE)

/** The most nodes one card may hold in a tree of N card nodes: its fair share plus one (D134). */
export const perCardCap = (N: number): number => fairShare(N) + 1
