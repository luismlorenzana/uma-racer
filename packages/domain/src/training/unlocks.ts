// What a Training Hub session unlocks (docs/game/05-training-hub.md §1–§3, docs/game/06-cards-and-bonds.md §2,
// D328, D338): the layers of a tier, each unlock's fixed grade and its one exact dish, and the session time per grade.
// Scenario s of a tier adds its layer: 89 fixed unlocks a tier (28 nodes, 24 Inspiration, 37 Extra Stats) and, at the
// Dojo, bonds with cards the owner picks, counted at 6, 3, 3, 3, 3 for pacing. 107 a tier.
import { INSPIRATION_SLOTS, inspirationGoldKey, type InspirationSlot } from '../inspiration'
import type { FacilityId } from '../farm/buildings'
import { feastDish, planetDish, type FeastGrade, type ItemGrade, type ItemId } from '../items/catalogue'
import { familyFor } from '../items/families'
import { TREE_CARD_NODES } from './trees/sizes'
import { cardNodeId, nodeOrder } from './trees/tree'
import { scenarioNumber } from '../tiers/map'
import { workSeconds } from '../state/time'
import type { Refusal, ScenarioOfTier, Tier } from '../state/types'
import { BOND_FAMILY, bondLayer, cardEraRefusal, type BondCard } from './bonds'
import { EXTRA_NODES, LAYERS, extraNode, higherGrade, lowerGrade } from './extra'

// ---- Unlocks -------------------------------------------------------------------------------------------------------

/** What one unlock opens: a card node, an Inspiration slot, unique or gold, an Extra Stats node, or a bond. */
export type UnlockKind = 'node' | 'slot' | 'unique' | 'gold' | 'single' | 'duo' | 'sun' | 'bond'
export const UNLOCK_KINDS: readonly UnlockKind[] = Object.freeze(['node', 'slot', 'unique', 'gold', 'single', 'duo', 'sun', 'bond'])

/** Which facility opens each kind (05 §1). */
export const UNLOCK_FACILITY: Readonly<Record<UnlockKind, FacilityId>> = Object.freeze({
  node: 'observatory',
  slot: 'lineage-hall',
  unique: 'lineage-hall',
  gold: 'lineage-hall',
  single: 'gym',
  duo: 'gym',
  sun: 'gym',
  bond: 'dojo',
})
export const facilityOf = (kind: UnlockKind): FacilityId => UNLOCK_FACILITY[kind]

/**
 * An unlock's identity. `target` is a node id (`n7`), an Inspiration slot (`parent0-gp1`; a unique names its slot), a
 * gold key (`inspirationGoldKey(slot, 0 | 1)` for gold 1 and 2), an Extra Stats id (`speed-03`) or a card id.
 */
export interface UnlockRef {
  readonly kind: UnlockKind
  readonly target: string
}

/** One unlock as a session holds it (05 §9): its identity, its layer, its fixed grade and the one dish it takes. */
export interface Unlock extends UnlockRef {
  /** The scenario of the tier whose layer holds it; a bond's is its card's first eligible scenario (06 §2). */
  readonly layer: ScenarioOfTier
  readonly grade: ItemGrade
  readonly dishId: ItemId
}

export const unlockKey = (ref: UnlockRef): string => `${ref.kind}:${ref.target}`
export const sameUnlock = (a: UnlockRef, b: UnlockRef): boolean => a.kind === b.kind && a.target === b.target

// ---- Session time (05 §2, README "Time model") ---------------------------------------------------------------------

/** One unlock of grade g takes 180 + 15(g − 1) base minutes (README, 05 §2). */
export const SESSION_BASE_MINUTES = 180
export const SESSION_MINUTES_PER_GRADE = 15
/** A session holds 1–10 unlocks of one facility (one room at the Gym and Dojo) (05 §2). */
export const SESSION_MIN_UNLOCKS = 1
export const SESSION_MAX_UNLOCKS = 10

export function sessionBaseMinutes(g: ItemGrade): number {
  if (!Number.isInteger(g) || g < 1 || g > 10) throw new RangeError(`Grade must be 1–10: ${g}`)
  return SESSION_BASE_MINUTES + SESSION_MINUTES_PER_GRADE * (g - 1)
}

/** Real seconds for one unlock of grade g at a facility's speed: × TIME_FACTOR, then ÷ speed (`workSeconds`). */
export const sessionSeconds = (g: ItemGrade, speed = 1): number => workSeconds(sessionBaseMinutes(g), speed)

// ---- Inspiration (05 §3, §5, D336) ---------------------------------------------------------------------------------

/** 05 §5's names for the six slots: parents A and B, A's grandparents A1 and A2, B's B1 and B2. */
export const SLOT_LETTER: Readonly<Record<InspirationSlot, string>> = Object.freeze({
  parent0: 'A', parent1: 'B', 'parent0-gp0': 'A1', 'parent0-gp1': 'A2', 'parent1-gp0': 'B1', 'parent1-gp1': 'B2',
})

export const isGrandparentSlot = (slot: InspirationSlot): boolean => slot.includes('-gp')

type InspirationRow = readonly [kind: 'slot' | 'unique' | 'gold', slot: InspirationSlot, half: 'lower' | 'higher', gold?: 0 | 1]

/**
 * 05 §3's "Inspiration: grade per unlock", scenario by scenario in the table's order, which is the Lineage Hall's
 * canonical order. Each row's grade is its scenario's lower (2s − 1) or higher (2s) grade. 4, 6, 4, 6, 4 a tier (D336).
 */
export const INSPIRATION_LAYER_TABLE: readonly (readonly InspirationRow[])[] = Object.freeze([
  [['slot', 'parent0', 'lower'], ['slot', 'parent1', 'lower'], ['unique', 'parent0', 'higher'], ['unique', 'parent1', 'higher']],
  [['gold', 'parent0', 'lower', 0], ['gold', 'parent0', 'lower', 1], ['gold', 'parent1', 'lower', 0], ['gold', 'parent1', 'lower', 1],
    ['slot', 'parent0-gp0', 'higher'], ['slot', 'parent1-gp0', 'higher']],
  [['slot', 'parent0-gp1', 'lower'], ['slot', 'parent1-gp1', 'lower'], ['unique', 'parent0-gp0', 'higher'], ['unique', 'parent1-gp0', 'higher']],
  [['unique', 'parent0-gp1', 'lower'], ['unique', 'parent1-gp1', 'lower'], ['gold', 'parent0-gp0', 'lower', 0],
    ['gold', 'parent1-gp0', 'higher', 0], ['gold', 'parent0-gp1', 'higher', 0], ['gold', 'parent1-gp1', 'higher', 0]],
  [['gold', 'parent0-gp0', 'lower', 1], ['gold', 'parent1-gp0', 'lower', 1], ['gold', 'parent0-gp1', 'higher', 1], ['gold', 'parent1-gp1', 'higher', 1]],
] as const)

/** The slot and gold index a gold key names (`parent0:gold1` → parent0, 1). */
export function goldPosition(key: string): { readonly slot: InspirationSlot; readonly index: 0 | 1 } | null {
  const match = /^(.+):gold([01])$/.exec(key)
  const slot = match?.[1] as InspirationSlot | undefined
  if (!match || !slot || !INSPIRATION_SLOTS.includes(slot)) return null
  return { slot, index: Number(match[2]) as 0 | 1 }
}

// ---- The fixed layers ----------------------------------------------------------------------------------------------

const unlock = (kind: UnlockKind, target: string, layer: ScenarioOfTier, grade: ItemGrade, dishId: ItemId): Unlock =>
  Object.freeze({ kind, target, layer, grade, dishId })

/** Card nodes layer s adds: the tree of scenario s less the tree before it (12, 4, 4, 4, 4). */
export const layerNodeCount = (s: ScenarioOfTier): number => TREE_CARD_NODES[s - 1]! - (s === 1 ? 0 : TREE_CARD_NODES[s - 2]!)

function observatoryLayer(s: ScenarioOfTier): Unlock[] {
  const first = s === 1 ? 1 : TREE_CARD_NODES[s - 2]! + 1
  const count = layerNodeCount(s)
  // The first half of the layer's nodes at its lower grade, the second half at its higher (05 §3).
  return Array.from({ length: count }, (_, i) => {
    const grade = i < count / 2 ? lowerGrade(s) : higherGrade(s)
    return unlock('node', cardNodeId(first + i), s, grade, planetDish(familyFor('constellation'), grade).id)
  })
}

function lineageHallLayer(s: ScenarioOfTier): Unlock[] {
  return INSPIRATION_LAYER_TABLE[s - 1]!.map(([kind, slot, half, gold]) => {
    const grade = half === 'lower' ? lowerGrade(s) : higherGrade(s)
    const target = kind === 'gold' ? inspirationGoldKey(slot, gold!) : slot
    return unlock(kind, target, s, grade, planetDish(familyFor('inspiration'), grade).id)
  })
}

const gymLayer = (s: ScenarioOfTier): Unlock[] =>
  EXTRA_NODES.filter((node) => node.layer === s).map((node) => unlock(node.kind, node.id, s, node.grade, node.dishId))

/**
 * Layer s's fixed unlocks in canonical order: the Observatory's nodes, the Lineage Hall's 05 §3 table, then the Gym's
 * singles in ring order, Duos in ring order and the Sun. Bonds are not fixed: they name a card (`bondUnlock`).
 */
export function layerUnlocks(s: ScenarioOfTier): readonly Unlock[] {
  const layer = FIXED_BY_LAYER[s - 1]
  if (!layer) throw new RangeError(`Scenario of a tier must be 1–5: ${s}`)
  return layer
}

const FIXED_BY_LAYER: readonly (readonly Unlock[])[] = Object.freeze(LAYERS.map((s) =>
  Object.freeze([...observatoryLayer(s), ...lineageHallLayer(s), ...gymLayer(s)])))

/** Every fixed unlock of a tier, layer by layer in canonical order: 89. */
export const FIXED_UNLOCKS: readonly Unlock[] = Object.freeze(FIXED_BY_LAYER.flat())

const FIXED_BY_KEY = new Map(FIXED_UNLOCKS.map((entry) => [unlockKey(entry), entry]))
/** The fixed unlock a ref names, or undefined (a bond, or nothing the map holds). */
export const fixedUnlock = (ref: UnlockRef): Unlock | undefined => FIXED_BY_KEY.get(unlockKey(ref))

// ---- Bonds (06 §2) -------------------------------------------------------------------------------------------------

/** Bonds each scenario's layer counts for pacing (06 §2, D329): a pacing assumption, not a cap. */
export const BONDS_BY_SCENARIO = Object.freeze([6, 3, 3, 3, 3] as const)
/** Bonds counted by the end of scenario s: 6, 9, 12, 15, 18 ("Fully Trained", 05 §11). */
export const bondsThrough = (s: ScenarioOfTier): number => BONDS_BY_SCENARIO.slice(0, s).reduce((sum, n) => sum + n, 0)

/**
 * The bond unlock for `card` in scenario s of `tier`: layer p = max(1, era − 5(tier − 1)), grade 2p − 1, the card type's
 * family dish (06 §2). Refused while its era is past the scenario.
 */
export function bondUnlock(card: BondCard, tier: Tier, s: ScenarioOfTier): Unlock | Refusal {
  if (card.era > scenarioNumber({ tier, scenario: s })) return cardEraRefusal(card)
  const layer = bondLayer(card.era, tier) as ScenarioOfTier
  const grade = lowerGrade(layer)
  return unlock('bond', card.id, layer, grade, planetDish(BOND_FAMILY[card.type], grade).id)
}

// ---- Sizes ---------------------------------------------------------------------------------------------------------

export interface LayerSize {
  readonly observatory: number
  readonly 'lineage-hall': number
  readonly gym: number
  /** The Dojo's pacing count. */
  readonly dojo: number
  readonly total: number
}

/** Unlocks per layer and facility (05 §3, README): 27, 23, 21, 19 and 17. */
export const LAYER_SIZES: readonly LayerSize[] = Object.freeze(LAYERS.map((s): LayerSize => {
  const count = (facility: FacilityId) => layerUnlocks(s).filter((entry) => facilityOf(entry.kind) === facility).length
  const sizes = { observatory: count('observatory'), 'lineage-hall': count('lineage-hall'), gym: count('gym'), dojo: BONDS_BY_SCENARIO[s - 1]! }
  return Object.freeze({ ...sizes, total: sizes.observatory + sizes['lineage-hall'] + sizes.gym + sizes.dojo })
}))

/** Unlocks a tier: 107 (D338). */
export const UNLOCKS_PER_TIER = LAYER_SIZES.reduce((sum, size) => sum + size.total, 0)

// ---- Labels --------------------------------------------------------------------------------------------------------

const capital = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

/** How a screen and a refusal name an unlock: "node 14", "slot B1", "A1's unique", "B gold 2", "Speed grade 3". */
export function unlockLabel(ref: UnlockRef): string {
  switch (ref.kind) {
    case 'node': return `node ${nodeOrder(ref.target) ?? ref.target}`
    case 'slot': return `slot ${SLOT_LETTER[ref.target as InspirationSlot] ?? ref.target}`
    case 'unique': return `${SLOT_LETTER[ref.target as InspirationSlot] ?? ref.target}'s unique`
    case 'gold': {
      const at = goldPosition(ref.target)
      return at ? `${SLOT_LETTER[at.slot]} gold ${at.index + 1}` : ref.target
    }
    case 'single':
    case 'duo':
    case 'sun': {
      const node = extraNode(ref.target)
      if (!node) return ref.target
      if (node.kind === 'single') return `${capital(node.stats[0]!)} grade ${node.grade}`
      if (node.kind === 'duo') return `${node.stats.map(capital).join('–')} Duo grade ${node.grade}`
      return `${feastDish(node.grade as FeastGrade).name} Sun`
    }
    case 'bond': return ref.target
  }
}
