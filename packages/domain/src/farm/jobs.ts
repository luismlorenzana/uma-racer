// The Farm's three kinds of work (docs/game/07-farm.md §1–§4): gather raw items at their family's site, craft at the
// Pantry (one raw into the crafted item of its family and grade), cook at the Kitchen. Step times are T126's base
// minutes (`items`), which T127 turns into seconds at the building's speed through `workSeconds`. Every step is
// gated by her Farm Level (Lv 5g − 4, a dish by its own grade) and pays Farm EXP by the listed minute × her running
// aptitude for the family: the site's, the crafted item's or the dish's, a Duo or Feast the best of its main families.
import { workSeconds } from '../state/time'
import { itemById, type ItemDef, type ItemGrade } from '../items/catalogue'
import { FAMILY_IDS, type FamilyId } from '../items/families'
import { canWorkGrade, gradeOpensAtFarmLevel } from '../items/grades'
import { dishFamilies, recipeOf } from '../items/recipes'
import { cookBaseMinutes, craftBaseMinutes, gatherBaseMinutes } from '../items/work'
import { tierRefusal } from '../tiers/refusals'
import type { Refusal } from '../state/types'
import type { PlanContext, PlannedItem, WorkKindRules } from '../work/kinds'
import { workRefusal } from '../work/refusals'
import { SESSION_KIND, type FarmKind, type ItemStock, type WorkContent, type WorkOutput, type WorkRequest, type WorkState } from '../work/types'
import { BUILDINGS, FARM_BUILDING_IDS, type BuildingId, type FarmBuildingId } from './buildings'
import { familyAptitude, farmExpMultiplier, farmExpPerItem } from './level'

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

/** Whether `building` makes `item` as `kind` (07 §1): raw at its family's site, crafted at the Pantry, dishes at the Kitchen. */
export function makesHere(kind: FarmKind, item: ItemDef, building: BuildingId): boolean {
  switch (kind) {
    case 'gather': return item.kind === 'raw' && FAMILY_SITE[item.family] === building
    case 'craft': return item.kind === 'crafted' && building === 'pantry'
    case 'cook': return item.kind === 'dish' && building === 'kitchen'
  }
}

/** The families whose aptitude counts for an item (07 §3): its own, or a Duo's or Feast's main families. */
export function expFamilies(item: ItemDef): readonly FamilyId[] {
  if (item.kind === 'raw' || item.kind === 'crafted') return [item.family]
  if (item.kind === 'dish') return dishFamilies(item)
  return []
}

/** Her best Farm EXP multiplier, in tenths, over `families` (07 §3: a Duo or Feast uses the best of its families). */
export function bestExpTenths(content: WorkContent, outfitId: string, families: readonly FamilyId[]): number {
  const template = content.umas.get(outfitId)
  if (!template) throw new RangeError(`No Uma template ${outfitId}`)
  return Math.max(0, ...families.map((family) => farmExpMultiplier(familyAptitude(template.aptitudes, family))))
}

function planFarm(kind: FarmKind) {
  return (state: WorkState, outfitId: string, request: WorkRequest, _now: number, context: PlanContext): readonly PlannedItem[] | Refusal => {
    if (request.kind === SESSION_KIND || request.kind !== kind) return workRefusal('not-here')
    const item = itemById(request.item)
    if (item === undefined || item.kind === 'ticket' || !makesHere(kind, item, context.slot.building)) return workRefusal('not-here')
    const uma = state.umas[outfitId]
    if (!uma) return tierRefusal('unknown-uma', { uma: outfitId })
    if (!canWorkGrade(uma.farm.level, item.grade)) return workRefusal('grade', { level: gradeOpensAtFarmLevel(item.grade), grade: item.grade })
    const base = stepBaseMinutes(kind, item.grade)
    const planned: PlannedItem = Object.freeze({
      seconds: workSeconds(base, context.speed),
      inputs: recipeOf(item.id)?.inputs ?? [],
      output: Object.freeze({ item: item.id }),
      farmExp: farmExpPerItem(workSeconds(base), bestExpTenths(context.env.content, outfitId, expFamilies(item))),
    })
    return Array.from({ length: request.count }, () => planned)
  }
}

/** Finished Farm items go into the Warehouse's free stock (07 §2 "Collect"). */
function payItems<S extends WorkState>(state: S, _outfitId: string, outputs: readonly WorkOutput[]): { readonly state: S } {
  const items: Record<string, number> = { ...state.items }
  for (const output of outputs) {
    if (!('item' in output)) throw new RangeError('A Farm job pays items only')
    items[output.item] = (items[output.item] ?? 0) + 1
  }
  return { state: { ...state, items: items as ItemStock } }
}

export const gatherKind: WorkKindRules = Object.freeze({ plan: planFarm('gather'), pay: payItems })
export const craftKind: WorkKindRules = Object.freeze({ plan: planFarm('craft'), pay: payItems })
export const cookKind: WorkKindRules = Object.freeze({ plan: planFarm('cook'), pay: payItems })
