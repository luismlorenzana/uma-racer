// The grade gate (docs/game/08-item-catalogue-and-recipes.md §3, docs/game/07-farm.md §4, README, D330): grade g
// opens at Farm Lv 5g − 4 (1, 6, 11 … 46) and gates every step, gathering, crafting and cooking a dish of grade g.
import { ITEM_GRADES, isItemGrade, type ItemGrade } from './catalogue'

/** Farm Levels between one grade opening and the next; grade 1 is open at Lv 1 (07 §4). */
export const FARM_LEVELS_PER_GRADE = 5

/** The Farm Level that opens grade `g`: 5g − 4. */
export function gradeOpensAtFarmLevel(g: ItemGrade): number {
  if (!isItemGrade(g)) throw new RangeError(`Grade must be 1–${ITEM_GRADES}: ${g}`)
  return FARM_LEVELS_PER_GRADE * g - (FARM_LEVELS_PER_GRADE - 1)
}

/** The highest grade open at `farmLevel` (1 or more): min(10, ⌊(farmLevel + 4) / 5⌋). */
export function highestOpenGrade(farmLevel: number): ItemGrade {
  if (!Number.isInteger(farmLevel) || farmLevel < 1) throw new RangeError(`Farm Level must be a whole number ≥ 1: ${farmLevel}`)
  return Math.min(ITEM_GRADES, Math.floor((farmLevel + FARM_LEVELS_PER_GRADE - 1) / FARM_LEVELS_PER_GRADE)) as ItemGrade
}

/** Whether an Uma at `farmLevel` may gather, craft or cook grade `g` (for a dish, the dish's grade, not its side's). */
export const canWorkGrade = (farmLevel: number, g: ItemGrade): boolean => farmLevel >= gradeOpensAtFarmLevel(g)
