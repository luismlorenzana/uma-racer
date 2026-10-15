// Crafted demand (docs/game/08-item-catalogue-and-recipes.md §7): any dish counts expanded through the recipes into
// the crafted items they need, with each family split into its own recipes' use and its use as other dishes' sides.
// The dish counts come from the layers and a deck (T128, T132); this module only expands them.
import { FAMILY_IDS, type FamilyId } from './families'
import { ITEM_GRADES, itemById, type ItemId } from './catalogue'
import { dishSide, recipeOf } from './recipes'

export interface FamilyDemand {
  /** Crafted items of the family by grade: index g − 1. */
  readonly byGrade: readonly number[]
  readonly total: number
  /** Used as its own dishes', Duos' and Feasts' main inputs. */
  readonly own: number
  /** Used as other dishes' sides. */
  readonly sides: number
}

export interface CraftedDemand {
  /** Crafted item id → count, in catalogue order, only for items needed. */
  readonly items: Readonly<Record<ItemId, number>>
  readonly families: Readonly<Record<FamilyId, FamilyDemand>>
  readonly total: number
  readonly own: number
  readonly sides: number
}

/**
 * The crafted items `dishCounts` (dish id → how many) need. Every key must be a dish of the catalogue and every count a
 * whole number ≥ 0.
 */
export function craftedDemand(dishCounts: Readonly<Record<ItemId, number>>): CraftedDemand {
  const own = new Map<ItemId, number>()
  const sides = new Map<ItemId, number>()
  const add = (to: Map<ItemId, number>, id: ItemId, qty: number) => to.set(id, (to.get(id) ?? 0) + qty)

  for (const [id, count] of Object.entries(dishCounts)) {
    const dish = itemById(id)
    if (dish?.kind !== 'dish') throw new RangeError(`Not a dish: ${id}`)
    if (!Number.isInteger(count) || count < 0) throw new RangeError(`Dish count must be a whole number ≥ 0: ${id} × ${count}`)
    if (count === 0) continue
    const side = dishSide(id)
    for (const input of recipeOf(id)!.inputs) add(input.item === side ? sides : own, input.item, input.qty * count)
  }

  const families = {} as Record<FamilyId, { byGrade: number[]; total: number; own: number; sides: number }>
  for (const family of FAMILY_IDS) families[family] = { byGrade: Array.from({ length: ITEM_GRADES }, () => 0), total: 0, own: 0, sides: 0 }
  const items: Record<ItemId, number> = {}
  const needed = [...new Set([...own.keys(), ...sides.keys()])]
  for (const id of needed.sort(byCatalogueOrder)) {
    const item = itemById(id)
    if (item?.kind !== 'crafted') throw new Error(`${id} is a dish input but not a crafted item`)
    const asOwn = own.get(id) ?? 0, asSide = sides.get(id) ?? 0
    const row = families[item.family]
    row.byGrade[item.grade - 1]! += asOwn + asSide
    row.own += asOwn
    row.sides += asSide
    row.total += asOwn + asSide
    items[id] = asOwn + asSide
  }

  const sum = (key: 'total' | 'own' | 'sides') => FAMILY_IDS.reduce((n, family) => n + families[family][key], 0)
  return Object.freeze({
    items: Object.freeze(items),
    families: Object.freeze(Object.fromEntries(FAMILY_IDS.map((family) => {
      const row = families[family]
      return [family, Object.freeze({ ...row, byGrade: Object.freeze(row.byGrade) })]
    })) as Record<FamilyId, FamilyDemand>),
    total: sum('total'),
    own: sum('own'),
    sides: sum('sides'),
  })
}

function byCatalogueOrder(a: ItemId, b: ItemId): number {
  const x = itemById(a)!, y = itemById(b)!
  if (x.kind !== 'crafted' || y.kind !== 'crafted') return 0
  return FAMILY_IDS.indexOf(x.family) - FAMILY_IDS.indexOf(y.family) || x.grade - y.grade
}
