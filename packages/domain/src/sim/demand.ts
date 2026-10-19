// What a tier of training asks of the Farm, per Uma (docs/game/08-item-catalogue-and-recipes.md §7; M033 cross-task
// acceptance #2): each of T128's fixed unlocks takes its one meal or tonic, or nothing, and each bond of the deck
// nothing (D375); T126's `craftedDemand` expands the meals and tonics into crafted items. Pure.
import type { SupportCardTemplate } from '../content'
import { DUOS, FEASTS, ITEM_GRADES, itemById, type ItemId } from '../items/catalogue'
import { craftedDemand, type CraftedDemand } from '../items/demand'
import { FAMILY_IDS, type FamilyId } from '../items/families'
import { LAYERS } from '../training/extra'
import { bondUnlock, layerUnlocks, type Unlock } from '../training/unlocks'
import { isRefusal, type ScenarioOfTier, type Tier } from '../state/types'
import { deckCards } from './fixtures'

/** A deck: the cards bonded in each scenario of the tier, scenario 1 first. */
export type Deck = readonly (readonly SupportCardTemplate[])[]

/** The representative deck of tier `tier` (T132 "Bonds"): six, then three a scenario, each of its scenario's era. */
export const representativeDeck = (tier: Tier = 1): Deck => LAYERS.map((s) => deckCards(tier, s))

export interface ScenarioDemand {
  readonly scenario: ScenarioOfTier
  readonly unlocks: number
  /** Meals and tonics. */
  readonly dishes: number
  readonly crafted: CraftedDemand
}

/** The rows of 08 §7's dish table: planet meals by family, Duos, Feasts and tonics. */
export type DishRow = FamilyId | 'duos' | 'feasts' | 'tonics'

export interface TierDemand {
  /** Every unlock with the item it takes, layer by layer: the fixed ones, then the deck's bonds. */
  readonly unlocks: readonly Unlock[]
  /** Meal or tonic id → how many, over the tier. */
  readonly dishes: Readonly<Record<ItemId, number>>
  /** Planet meals per family by grade (index g − 1), Duos, Feasts and tonics by grade. */
  readonly dishTable: Readonly<Record<DishRow, readonly number[]>>
  readonly crafted: CraftedDemand
  readonly byScenario: readonly ScenarioDemand[]
}

function count(unlocks: readonly Unlock[]): Record<ItemId, number> {
  const dishes: Record<ItemId, number> = {}
  for (const entry of unlocks) if (entry.dishId !== null) dishes[entry.dishId] = (dishes[entry.dishId] ?? 0) + 1
  return dishes
}

/** One Uma's tier of training with `deck`, in dishes and crafted items, whole and per scenario. */
export function tierDemand(deck: Deck, tier: Tier = 1): TierDemand {
  const byLayer = LAYERS.map((s) => {
    const bonds = (deck[s - 1] ?? []).map((card) => {
      const entry = bondUnlock(card, tier, s)
      if (isRefusal(entry)) throw new RangeError(`The deck's ${card.id} can't bond in scenario ${s}: ${entry.reason}`)
      return entry
    })
    return [...layerUnlocks(s), ...bonds]
  })
  const unlocks = byLayer.flat()
  const dishes = count(unlocks)
  const row = () => Array.from({ length: ITEM_GRADES }, () => 0)
  const dishTable = Object.fromEntries([...FAMILY_IDS, 'duos', 'feasts', 'tonics'].map((key) => [key, row()])) as Record<DishRow, number[]>
  for (const [id, n] of Object.entries(dishes)) {
    const dish = itemById(id)
    if (dish?.kind !== 'dish' && dish?.kind !== 'tonic') throw new Error(`${id} isn't a meal or a tonic`)
    const key: DishRow = dish.kind === 'tonic' ? 'tonics' : dish.dish === 'planet' ? dish.family : dish.dish === 'duo' ? 'duos' : 'feasts'
    dishTable[key][dish.grade - 1]! += n
  }
  return {
    unlocks,
    dishes,
    dishTable,
    crafted: craftedDemand(dishes),
    byScenario: byLayer.map((entries, i) => {
      const here = count(entries)
      return { scenario: LAYERS[i]!, unlocks: entries.length, dishes: Object.values(here).reduce((a, b) => a + b, 0), crafted: craftedDemand(here) }
    }),
  }
}

/** The Duo and Feast ids, for tables that list them apart. */
export const SPECIAL_DISHES: readonly ItemId[] = Object.freeze([...DUOS.map((duo) => duo.id), ...FEASTS.map((feast) => feast.id)])
