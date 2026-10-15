// The Extra Stats map (docs/rework/05-training-hub.md §3, §6, §9, D338): 37 nodes a tier. A single per stat per scenario
// at the scenario's first grade (1, 3, 5, 7, 9); the four ring Duos at the Duo grades (3 and 5); a Sun from each Feast
// (4, 6, 8, 10). Values per kind and tier are T125's (`extraNodeValues`); Foundation's ×1.5 is the reviewed buffs'.
// Active capacity per preset is 7, 9, 11, 13 and 15 by scenario of the tier.
import { STATS, type StatKey, type Stats, zeroStats } from '../types'
import { DUO_GRADES, DUO_PAIRS, FEAST_GRADES, duoDish, feastDish, planetDish, type DuoPair, type ItemGrade, type ItemId } from '../items/catalogue'
import { FAMILIES, STAT_CYCLE, familyFor } from '../items/families'
import { tierOf } from '../tiers/map'
import { extraNodeValues } from '../tiers/scaling'
import type { ScenarioOfTier, Tier } from '../state/types'
import { foundationPct } from './buffs'

export type ExtraKind = 'single' | 'duo' | 'sun'

/** One node of the map. Its id is 05 §9's: `speed-03`, `duo-power-speed-3`, `sun-4`. */
export interface ExtraNode {
  readonly id: string
  readonly kind: ExtraKind
  /** The stats it pays: one for a single, a Duo's two in the stat row's order, all five for a Sun. */
  readonly stats: readonly StatKey[]
  readonly grade: ItemGrade
  /** The scenario of the tier whose layer holds it. */
  readonly layer: ScenarioOfTier
  readonly dishId: ItemId
}

/** The five stats in ring order, Stamina – Wit – Power – Speed – Guts: T126's stat cycle by destination (05 §1, §6). */
export const EXTRA_STATS: readonly StatKey[] = Object.freeze(STAT_CYCLE.map((family) => FAMILIES[family].destination as StatKey))

/** The scenarios of a tier, 1–5. */
export const LAYERS: readonly ScenarioOfTier[] = Object.freeze([1, 2, 3, 4, 5] as const)
/** Scenario s of a tier uses grades 2s − 1 and 2s (README "Grades follow scenarios"). */
export const lowerGrade = (s: ScenarioOfTier): ItemGrade => (2 * s - 1) as ItemGrade
export const higherGrade = (s: ScenarioOfTier): ItemGrade => (2 * s) as ItemGrade
/** The scenario of the tier whose layer uses grade g. */
export const layerOfGrade = (g: ItemGrade): ScenarioOfTier => Math.ceil(g / 2) as ScenarioOfTier

/** Each stat has one single per scenario, at the scenario's first grade (05 §3, D338): 1, 3, 5, 7, 9. */
export const EXTRA_SINGLE_GRADES: readonly ItemGrade[] = Object.freeze(LAYERS.map(lowerGrade))

export const extraSingleId = (stat: StatKey, g: ItemGrade): string => `${stat}-${String(g).padStart(2, '0')}`
export const extraDuoId = (pair: DuoPair, g: ItemGrade): string => `duo-${pair}-${g}`
export const extraSunId = (g: ItemGrade): string => `sun-${g}`

function buildMap(): readonly ExtraNode[] {
  const nodes: ExtraNode[] = []
  for (const s of LAYERS) {
    const low = lowerGrade(s)
    for (const stat of EXTRA_STATS) {
      nodes.push({ id: extraSingleId(stat, low), kind: 'single', stats: [stat], grade: low, layer: s, dishId: planetDish(familyFor(stat), low).id })
    }
    if ((DUO_GRADES as readonly number[]).includes(low)) {
      for (const pair of DUO_PAIRS) {
        const dish = duoDish(pair, low as (typeof DUO_GRADES)[number])
        nodes.push({ id: extraDuoId(pair, low), kind: 'duo', stats: dish.stats, grade: low, layer: s, dishId: dish.id })
      }
    }
    const high = higherGrade(s)
    if ((FEAST_GRADES as readonly number[]).includes(high)) {
      nodes.push({ id: extraSunId(high), kind: 'sun', stats: STATS, grade: high, layer: s, dishId: feastDish(high as (typeof FEAST_GRADES)[number]).id })
    }
  }
  return Object.freeze(nodes.map((node) => Object.freeze({ ...node, stats: Object.freeze([...node.stats]) })))
}

/** The 37 nodes in the map's order: by layer, singles in ring order, then Duos in ring order, then the Sun. */
export const EXTRA_NODES: readonly ExtraNode[] = buildMap()
export const EXTRA_NODE_IDS: readonly string[] = Object.freeze(EXTRA_NODES.map((node) => node.id))

const BY_ID = new Map(EXTRA_NODES.map((node) => [node.id, node]))
export const extraNode = (id: string): ExtraNode | undefined => BY_ID.get(id)

/** Active Extra Stats capacity per preset in scenarios 1–5 of a tier (05 §6, README, D338). */
export const EXTRA_CAPACITY = Object.freeze([7, 9, 11, 13, 15] as const)
export const extraCapacity = (s: ScenarioOfTier): number => EXTRA_CAPACITY[s - 1]!

/** Nodes the layers so far hold, scenarios 1–5: 5, 15, 25, 31, 37 (05 §6). */
export const EXTRA_HELD: readonly number[] = Object.freeze(LAYERS.map((s) => EXTRA_NODES.filter((node) => node.layer <= s).length))

/** One node's raw value per stat in `tier`, before any buff: T125's values per kind (D338). */
export function extraNodeVector(tier: Tier, id: string): Stats {
  const node = extraNode(id)
  if (!node) throw new RangeError(`No Extra Stats node ${id}`)
  const value = extraNodeValues(tier)[node.kind]
  const stats = zeroStats()
  for (const stat of node.stats) stats[stat] = value
  return stats
}

/**
 * What one node adds to a profile at scenario T of `tier`: T125's value per stat, × 1.5 under Foundation (04 §8). Whole
 * numbers in every tier. Flat, after growth: no other buff touches it (03 §8).
 */
export function extraNodeStats(tier: Tier, T: number, id: string): Stats {
  if (tierOf(T) !== tier) throw new RangeError(`Scenario ${T} is not in tier ${tier}`)
  const pct = foundationPct(T)
  const vector = extraNodeVector(tier, id)
  for (const stat of STATS) vector[stat] = (vector[stat] * pct) / 100
  return vector
}
