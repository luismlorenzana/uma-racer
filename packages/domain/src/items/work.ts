// Step times and work values (docs/game/08-item-catalogue-and-recipes.md §3, §8; docs/game/12-economy-and-pacing.md
// §4; README "Time model"; D338). Step times are base minutes per grade; every real duration goes through
// `state/time.ts`'s one conversion (× TIME_FACTOR, whole seconds, at speed 1). An item's work value is the work in it,
// its inputs included; building speed and Speed Tickets never change it, and rounding a sale is the Exchange's.
import { workSeconds } from '../state/time'
import { ITEM_GRADES, isItemGrade, itemById, ITEMS, type ItemDef, type ItemGrade, type ItemId } from './catalogue'
import { recipeOf } from './recipes'

/** Gathering one raw item of grade g takes 90 + 5(g − 1) base minutes (README, 07 §2, 12 §4). */
export const GATHER_BASE_MINUTES = 90
export const GATHER_MINUTES_PER_GRADE = 5
/** Crafting takes a quarter of gathering (README, 08 §4). */
export const CRAFT_SHARE_OF_GATHER = 1 / 4
/** Cooking any dish of grade g, planet, Duo or Feast, takes 240 + 10(g − 1) base minutes (README, 08 §4, §12). */
export const COOK_BASE_MINUTES = 240
export const COOK_MINUTES_PER_GRADE = 10

function grade(g: number): ItemGrade {
  if (!isItemGrade(g)) throw new RangeError(`Grade must be 1–${ITEM_GRADES}: ${g}`)
  return g
}

export const gatherBaseMinutes = (g: ItemGrade): number => GATHER_BASE_MINUTES + GATHER_MINUTES_PER_GRADE * (grade(g) - 1)
export const craftBaseMinutes = (g: ItemGrade): number => gatherBaseMinutes(g) * CRAFT_SHARE_OF_GATHER
export const cookBaseMinutes = (g: ItemGrade): number => COOK_BASE_MINUTES + COOK_MINUTES_PER_GRADE * (grade(g) - 1)

/** Real seconds to gather one raw item of grade g at speed 1. */
export const gatherSeconds = (g: ItemGrade): number => workSeconds(gatherBaseMinutes(g))
/** Real seconds to craft one item of grade g at speed 1. */
export const craftSeconds = (g: ItemGrade): number => workSeconds(craftBaseMinutes(g))
/** Real seconds to cook one dish of grade g at speed 1. */
export const cookSeconds = (g: ItemGrade): number => workSeconds(cookBaseMinutes(g))

// --- Work values ----------------------------------------------------------------------------------------------------

interface Steps {
  readonly gather: (g: ItemGrade) => number
  readonly craft: (g: ItemGrade) => number
  readonly cook: (g: ItemGrade) => number
}

/** Walks the recipe: raw = its gather; crafted = its raw + its craft; dish = Σ qty × input + its cook. */
function workValues(steps: Steps): ReadonlyMap<ItemId, number | null> {
  const values = new Map<ItemId, number | null>()
  const value = (item: ItemDef): number | null => {
    const known = values.get(item.id)
    if (known !== undefined) return known
    let total: number | null
    if (item.kind === 'ticket') total = null
    else if (item.kind === 'raw') total = steps.gather(item.grade)
    else {
      let inputs = 0
      for (const { item: id, qty } of recipeOf(item.id)?.inputs ?? []) {
        const worth = value(itemById(id)!)
        if (worth === null) throw new Error(`${item.id} takes ${id}, which has no work value`)
        inputs += qty * worth
      }
      total = inputs + (item.kind === 'crafted' ? steps.craft(item.grade) : steps.cook(item.grade))
    }
    values.set(item.id, total)
    return total
  }
  for (const item of ITEMS) value(item)
  return values
}

const BASE_MINUTES = workValues({ gather: gatherBaseMinutes, craft: craftBaseMinutes, cook: cookBaseMinutes })
const SECONDS = workValues({ gather: gatherSeconds, craft: craftSeconds, cook: cookSeconds })

/**
 * The work in `id` in base minutes, inputs included (08 §3's chains, §5): null for the Speed Ticket, undefined for an
 * id the catalogue doesn't hold.
 */
export const workValueBaseMinutes = (id: ItemId): number | null | undefined => BASE_MINUTES.get(id)

/**
 * The work in `id` in whole real seconds at speed 1, inputs included (08 §8, D338): each step's seconds summed, never
 * rounded again. Real minutes are this ÷ 60 and can end in .5. Null for the Speed Ticket, undefined for an unknown id.
 */
export const workValueSeconds = (id: ItemId): number | null | undefined => SECONDS.get(id)
