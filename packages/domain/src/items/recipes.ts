// Every recipe (docs/game/08-item-catalogue-and-recipes.md §4): a crafted item from its raw pair at the Pantry, and
// every dish and tonic at the Kitchen from exact crafted items, with §4.2's side rotation. No substitutions: a recipe
// names its items, and a higher grade never stands in for a lower one. The retired salads, soups and breads keep their
// recipes, which their work value reads, though the Kitchen no longer cooks them (D374).
import {
  craftedItem, duoPairOf, isItemGrade, ITEM_GRADES, ITEMS, type DuoDishDef, type DuoPair, type FeastDishDef,
  type ItemGrade, type ItemId, type KitchenDef, type PlanetDishDef, type TonicDef,
} from './catalogue'
import { FAMILY_IDS, STAT_CYCLE, TONIC_FAMILIES, type FamilyId } from './families'

export interface RecipeInput {
  readonly item: ItemId
  readonly qty: number
}

export interface Recipe {
  /** The Pantry crafts; the Kitchen cooks every dish. */
  readonly at: 'pantry' | 'kitchen'
  readonly inputs: readonly RecipeInput[]
}

/** A crafted item takes 1 raw item of its pair (08 §4). */
export const CRAFT_RAW_QTY = 1
/** A planet dish takes 4 crafted items of its family at its grade (08 §4). */
export const PLANET_OWN_QTY = 4
/** A Duo takes 2 crafted items of each of its two families at its grade (08 §4, §4.3). */
export const DUO_OWN_QTY = 2
/** A Feast takes 1 crafted item of each stat family at its grade (08 §4, §4.4). */
export const FEAST_OWN_QTY = 1
/** A tonic takes 1 crafted item of each tonic family at its grade, and no side (08 §4.5, D374). */
export const TONIC_OWN_QTY = 1
/** Every dish takes 1 crafted side of another family (08 §4). */
export const SIDE_QTY = 1
/** A side is this many grades below its dish, and never below grade 1 (08 §4: max(1, g − 2)). */
export const SIDE_GRADES_BELOW = 2

/** The side's grade for a dish of grade `g`: max(1, g − 2). */
export function sideGrade(g: ItemGrade): ItemGrade {
  if (!isItemGrade(g)) throw new RangeError(`Grade must be 1–${ITEM_GRADES}: ${g}`)
  return Math.max(1, g - SIDE_GRADES_BELOW) as ItemGrade
}

/** The retired salads and soups came with bread, and Feasts still do (08 §4.2 rules 1 and 5). */
export const BREAD_FAMILY: FamilyId = 'grains'
const BREAD_DISH_FAMILIES: readonly FamilyId[] = ['vegetables', 'mushrooms']

/**
 * The side family of `family`'s planet dish at grade `g` (08 §4.2):
 * - a stat family takes the family ((g − 1) mod 5) + 1 steps on in `STAT_CYCLE`, and one step on at grades 5 and 10,
 *   where that count would come back to itself (D374: Grains feeds tonics, so no stat dish takes bread);
 * - the retired salads and soups took Grains, and the retired breads `STAT_CYCLE[(g − 1) mod 5]`.
 */
export function sideFamily(family: FamilyId, g: ItemGrade): FamilyId {
  if (!isItemGrade(g)) throw new RangeError(`Grade must be 1–${ITEM_GRADES}: ${g}`)
  const turn = (g - 1) % STAT_CYCLE.length
  if (family === BREAD_FAMILY) return STAT_CYCLE[turn]!
  if (BREAD_DISH_FAMILIES.includes(family)) return BREAD_FAMILY
  const at = STAT_CYCLE.indexOf(family)
  if (at < 0) throw new RangeError(`${family} has no side rule`)
  const steps = turn + 1 === STAT_CYCLE.length ? 1 : turn + 1
  return STAT_CYCLE[(at + steps) % STAT_CYCLE.length]!
}

/** Duo sides go to the two stat families that sit in only one Duo (08 §4.2 rule 4). */
export const DUO_SIDE_FAMILY: Readonly<Record<DuoPair, FamilyId>> = Object.freeze({
  'stamina-wit': 'nuts-seeds',
  'wit-power': 'nuts-seeds',
  'power-speed': 'fruits',
  'speed-guts': 'fruits',
})

/** Feast sides are Grains (08 §4.2 rule 5). */
export const FEAST_SIDE_FAMILY: FamilyId = BREAD_FAMILY

/** The stat families, in `FAMILY_IDS` order: a Feast's own inputs. */
const FEAST_FAMILIES: readonly FamilyId[] = Object.freeze(FAMILY_IDS.filter((family) => STAT_CYCLE.includes(family)))

// --- Recipes --------------------------------------------------------------------------------------------------------

const input = (item: ItemId, qty: number): RecipeInput => Object.freeze({ item, qty })
const kitchen = (own: readonly RecipeInput[], side: ItemId): Recipe =>
  Object.freeze({ at: 'kitchen', inputs: Object.freeze([...own, input(side, SIDE_QTY)]) })

function planetRecipe(dish: PlanetDishDef): { recipe: Recipe; side: ItemId } {
  const side = craftedItem(sideFamily(dish.family, dish.grade), sideGrade(dish.grade)).id
  return { recipe: kitchen([input(craftedItem(dish.family, dish.grade).id, PLANET_OWN_QTY)], side), side }
}

function duoRecipe(duo: DuoDishDef): { recipe: Recipe; side: ItemId } {
  const side = craftedItem(DUO_SIDE_FAMILY[duoPairOf(duo)], sideGrade(duo.grade)).id
  return { recipe: kitchen(duo.families.map((family) => input(craftedItem(family, duo.grade).id, DUO_OWN_QTY)), side), side }
}

function feastRecipe(feast: FeastDishDef): { recipe: Recipe; side: ItemId } {
  const side = craftedItem(FEAST_SIDE_FAMILY, sideGrade(feast.grade)).id
  return { recipe: kitchen(FEAST_FAMILIES.map((family) => input(craftedItem(family, feast.grade).id, FEAST_OWN_QTY)), side), side }
}

/** A tonic: one crafted Vegetables, Mushrooms and Grains item at its grade (08 §4.5, D374). */
const tonicRecipe = (tonic: TonicDef): Recipe => Object.freeze({
  at: 'kitchen',
  inputs: Object.freeze(TONIC_FAMILIES.map((family) => input(craftedItem(family, tonic.grade).id, TONIC_OWN_QTY))),
})

const RECIPES = new Map<ItemId, Recipe | null>()
const SIDES = new Map<ItemId, ItemId>()
for (const item of ITEMS) {
  if (item.kind === 'raw' || item.kind === 'ticket') { RECIPES.set(item.id, null); continue }
  if (item.kind === 'crafted') {
    RECIPES.set(item.id, Object.freeze({ at: 'pantry', inputs: Object.freeze([input(item.pair, CRAFT_RAW_QTY)]) }))
    continue
  }
  if (item.kind === 'tonic') { RECIPES.set(item.id, tonicRecipe(item)); continue }
  const { recipe, side } = item.dish === 'planet' ? planetRecipe(item) : item.dish === 'duo' ? duoRecipe(item) : feastRecipe(item)
  RECIPES.set(item.id, recipe)
  SIDES.set(item.id, side)
}

/**
 * How `id` is made: crafted items at the Pantry, dishes and tonics at the Kitchen. Null for raw items (gathered at their
 * family's site) and the Speed Ticket; undefined for an id the catalogue doesn't hold.
 */
export const recipeOf = (id: ItemId): Recipe | null | undefined => RECIPES.get(id)

/** A dish's crafted side (08 §3's "Its side", §4.2), or undefined for anything that isn't a dish (a tonic has none). */
export const dishSide = (id: ItemId): ItemId | undefined => SIDES.get(id)

/**
 * A Kitchen item's own families, whose crafted items are its main inputs: a planet dish's one, a Duo's two, a Feast's
 * five, a tonic's three.
 */
export function dishFamilies(dish: KitchenDef): readonly FamilyId[] {
  if (dish.kind === 'tonic') return TONIC_FAMILIES
  if (dish.dish === 'planet') return [dish.family]
  if (dish.dish === 'duo') return dish.families
  return FEAST_FAMILIES
}
