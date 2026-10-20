// The Farm's three kinds of work (docs/game/07-farm.md §1–§4): gather raw items at their family's site, craft at the
// Pantry (one raw into the crafted item of its family and grade), cook at the Kitchen: meals, and tonics brewed in the
// cook's time (D375). Step times are T126's base minutes (`items`), which T127 turns into seconds at the building's
// speed through `workSeconds`. Every step is gated by her Farm Level (Lv 5g − 4, a dish by its own grade) and pays Farm
// EXP by the listed minute × her running aptitude for the family: the site's, the crafted item's or the dish's, a Duo,
// Feast or tonic the best of its main families.
import { workSeconds } from '../state/time'
import { isKitchenItem, isRetired, itemById, type ItemDef, type ItemGrade } from '../items/catalogue'
import { FAMILY_IDS, type FamilyId } from '../items/families'
import { dishFamilies } from '../items/recipes'
import { cookBaseMinutes, craftBaseMinutes, gatherBaseMinutes } from '../items/work'
import type { FarmKind, WorkContent } from '../work/types'
import { BUILDINGS, FARM_BUILDING_IDS, type BuildingId, type FarmBuildingId } from './buildings'
import { familyAptitude, farmExpMultiplier, SUITED_LETTERS } from './level'

export { gatherKind } from '../work/kinds/gather'
export { craftKind } from '../work/kinds/craft'
export { cookKind } from '../work/kinds/cook'

/** Each family's site (07 §1, README's family table): T127 owns this map. */
export const FAMILY_SITE: Readonly<Record<FamilyId, FarmBuildingId>> = Object.freeze(Object.fromEntries(FAMILY_IDS.map((family) => {
  const site = FARM_BUILDING_IDS.find((id) => BUILDINGS[id].family === family)
  if (site === undefined) throw new Error(`No site gathers ${family}`)
  return [family, site]
})) as Record<FamilyId, FarmBuildingId>)

/** The Farm's kinds in 07 §2's order. */
export const FARM_KINDS: readonly FarmKind[] = Object.freeze(['gather', 'craft', 'cook'] as const)

/** A step's base minutes for grade `g` (T126). */
export function stepBaseMinutes(kind: FarmKind, g: ItemGrade): number {
  return kind === 'gather' ? gatherBaseMinutes(g) : kind === 'craft' ? craftBaseMinutes(g) : cookBaseMinutes(g)
}

/** One item's real seconds at `speed` (1, or 1.25 at Lv 3): `workSeconds(base, speed)`. */
export const farmItemSeconds = (kind: FarmKind, g: ItemGrade, speed = 1): number => workSeconds(stepBaseMinutes(kind, g), speed)

/**
 * Whether `building` makes `item` as `kind` (07 §1): raw at its family's site, crafted at the Pantry, dishes and tonics
 * at the Kitchen. A retired salad, soup or bread is never cooked again (D375).
 */
export function makesHere(kind: FarmKind, item: ItemDef, building: BuildingId): boolean {
  switch (kind) {
    case 'gather': return item.kind === 'raw' && FAMILY_SITE[item.family] === building
    case 'craft': return item.kind === 'crafted' && building === 'pantry'
    case 'cook': return isKitchenItem(item) && !isRetired(item) && building === 'kitchen'
  }
}

/** The families whose aptitude counts for an item (07 §3): its own, or a Duo's, Feast's or tonic's main families. */
export function expFamilies(item: ItemDef): readonly FamilyId[] {
  if (item.kind === 'raw' || item.kind === 'crafted') return [item.family]
  if (isKitchenItem(item)) return dishFamilies(item)
  return []
}

/** Her best Farm EXP multiplier, in tenths, over `families` (07 §3: a Duo or Feast uses the best of its families). */
export function bestExpTenths(content: WorkContent, outfitId: string, families: readonly FamilyId[]): number {
  const template = content.umas.get(outfitId)
  if (!template) throw new RangeError(`No Uma template ${outfitId}`)
  return Math.max(0, ...families.map((family) => farmExpMultiplier(familyAptitude(template.aptitudes, family))))
}

/** Whether her aptitude suits any of `families` (07 §3, D366): an S or A letter for one of them. None suits no family. */
export function suits(content: WorkContent, outfitId: string, families: readonly FamilyId[]): boolean {
  const template = content.umas.get(outfitId)
  if (!template) throw new RangeError(`No Uma template ${outfitId}`)
  return families.some((family) => SUITED_LETTERS.includes(familyAptitude(template.aptitudes, family)))
}
