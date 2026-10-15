// Inspiration's pick rules (docs/design/skills-and-inheritance.md, D250): the six independent lineage slots, the two
// gold positions in each, and which parent a grandparent slot hangs from.

export const INSPIRATION_SLOTS = ['parent0', 'parent1', 'parent0-gp0', 'parent0-gp1', 'parent1-gp0', 'parent1-gp1'] as const
export type InspirationSlot = typeof INSPIRATION_SLOTS[number]
export const INSPIRATION_GOLDS_PER_SLOT = 2
export const GRANDPARENT_SP_MULTIPLIER = 2
export const inspirationGoldKey = (slot: string, index: number): string => `${slot}:gold${index}`
export const inspirationParent = (slot: string): InspirationSlot =>
  slot === 'parent0' || slot === 'parent0-gp0' || slot === 'parent0-gp1' ? 'parent0' : 'parent1'
