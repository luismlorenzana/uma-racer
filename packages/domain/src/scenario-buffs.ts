// Scenario buffs (T053–T054, D165): the one declared way each scenario bends its constellation's rules
// (docs/game/04-tiers-and-promotion.md §8). Every buff is deterministic, visible on the constellation, never random,
// and reaches a race only through the stats and skill points the tree pays. None depends on which node a card sits
// on, so moving a card never changes a total; some reward which cards you bring or how many nodes each fills.

export type ScenarioBuffId =
  | 'foundation' | 'team-spirit' | 'climax' | 'performance' | 'fragments' | 'expedition' | 'genres'
  | 'cooking' | 'research' | 'legends' | 'construction' | 'soak' | 'shared-light' | 'orders'

export interface ScenarioBuff {
  id: ScenarioBuffId
  name: string
  /** The rule as the player reads it. */
  rule: string
  /**
   * What a typical trained Uma of the scenario gains from it, as a share of her tree's stats: six 3★ current-era
   * cards with one Friend card, about four lineage slots filled, two career goals won. Rivals carry it (D165), so a
   * buff helps only as far as a build leans into it.
   */
  typical: number
}

/** Percentage points each buff adds, or the multiplier it applies, in whole percent so derivation stays exact. */
export const BUFF_VALUES = {
  foundationStatPct: 150,
  teamSpiritPerLineage: 1,
  climaxPerGoal: 2,
  climaxGoals: 4,
  performance: 5,
  fragments: 8,
  fragmentsStars: 3,
  expedition: 5,
  expeditionEra: 6,
  genres: 6,
  cooking: 10,
  research: 10,
  construction: 8,
  soak: 10,
  sharedLight: 8,
  ordersStatPct: 25,
} as const

export const SCENARIO_BUFFS: readonly ScenarioBuff[] = [
  { id: 'foundation', name: 'Foundation', rule: 'Extra stats pay ×1.5.', typical: 0.04 },
  { id: 'team-spirit', name: 'Team Spirit', rule: 'Each filled lineage slot adds +1% to every card node.', typical: 0.037 },
  { id: 'climax', name: 'Climax', rule: 'Each career goal won in this scenario adds +2% to every card node, up to +8%.', typical: 0.037 },
  { id: 'performance', name: 'Performance', rule: 'A set with a Speed, Stamina, Power, Guts and Wit card: every card node pays +5%.', typical: 0.023 },
  { id: 'fragments', name: 'Fragments', rule: 'Cards at 3★ pay +8%.', typical: 0 },
  { id: 'expedition', name: 'Expedition', rule: 'Cards from era 6 or newer pay +5%.', typical: 0.046 },
  { id: 'genres', name: 'Genres', rule: 'A card type with two or more cards in the set pays +6% on those cards.', typical: 0.022 },
  { id: 'cooking', name: 'Cooking', rule: 'A card on its full node cap pays +10% on all its nodes.', typical: 0.02 },
  { id: 'research', name: 'Research', rule: 'Speed and Power cards pay +10%.', typical: 0.055 },
  { id: 'legends', name: 'Legends', rule: 'The first parent slot may hold any Uma, owned or not.', typical: 0 },
  { id: 'construction', name: 'Construction', rule: 'A card on exactly its fair share of nodes pays +8% on all of them.', typical: 0.037 },
  { id: 'soak', name: 'Soak', rule: 'Stamina and Guts cards pay +10%.', typical: 0.028 },
  { id: 'shared-light', name: 'Shared Light', rule: 'Your two lowest stats from the tree each gain +8%.', typical: 0.019 },
  { id: 'orders', name: 'Orders', rule: 'Friend and Group cards also pay a quarter of a node\'s value as stats, beside their SP.', typical: 0.054 },
]

export const scenarioBuff = (tier: number): ScenarioBuff =>
  SCENARIO_BUFFS[Math.min(SCENARIO_BUFFS.length, Math.max(1, Math.trunc(tier))) - 1]!

/** Legends (tier 10): the first parent slot takes any Uma, owned or not. */
export const lineageSlotTakesAnyUma = (tier: number, nodeId: string): boolean =>
  scenarioBuff(tier).id === 'legends' && nodeId === 'parent0'
