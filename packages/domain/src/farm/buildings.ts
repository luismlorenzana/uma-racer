// The Farm's ten buildings and the Training Hub's four facilities (docs/rework/07-farm.md §1, §6, §7;
// docs/rework/05-training-hub.md §1, §7; D327, D330, D331): ids, order, rooms, slots, speed and upgrade prices. Every
// building is the account's, starts at Lv 1 and carries through promotion; levels live in the state's `buildings`, and
// a slot is held by a work row, never by a building (07 §5, §12). Pure data and lookups.
import { STATS } from '../types'
import { craftedItem, type ItemGrade } from '../items/catalogue'
import { FAMILIES, FAMILY_IDS, type FamilyId } from '../items/families'
import type { RecipeInput } from '../items/recipes'

/** The ten Farm buildings in 07 §1's order: the eight family sites, the Pantry and the Kitchen. uma-art `farmlands` ids. */
export const FARM_BUILDING_IDS = Object.freeze([
  'sugar-grove', 'orchard', 'fishery', 'nut-grove', 'herb-garden', 'fields', 'vegetable-garden', 'mushroom-cave', 'pantry', 'kitchen',
] as const)
export type FarmBuildingId = (typeof FARM_BUILDING_IDS)[number]

/** The four Training Hub facilities in 05 §1's order (ids from rework/11 §3's places). */
export const FACILITY_IDS = Object.freeze(['observatory', 'lineage-hall', 'gym', 'dojo'] as const)
export type FacilityId = (typeof FACILITY_IDS)[number]

/** Every building in tie-break order: 07 §1's ten, then the facilities (T127's decision; 07 §2 orders only the Farm). */
export const BUILDING_IDS = Object.freeze([...FARM_BUILDING_IDS, ...FACILITY_IDS] as const)
export type BuildingId = (typeof BUILDING_IDS)[number]

/** The Gym's rooms, one per stat, in ring order (05 §1). */
export const GYM_ROOMS = Object.freeze(['stamina', 'wit', 'power', 'speed', 'guts'] as const)
/** The Dojo's rooms, one per card type, Friend and Group sharing one (05 §1). */
export const DOJO_ROOMS = Object.freeze(['speed', 'stamina', 'power', 'guts', 'wit', 'friend-group'] as const)
export type RoomId = (typeof GYM_ROOMS)[number] | (typeof DOJO_ROOMS)[number]

/** What a building's slots run: gathering at a site, crafting at the Pantry, cooking at the Kitchen, or sessions. */
export type BuildingJob = 'gather' | 'craft' | 'cook' | 'session'

export interface BuildingDef {
  readonly id: BuildingId
  readonly name: string
  readonly job: BuildingJob
  /** A site's family (07 §1's "Makes"); null for the Pantry, the Kitchen and the facilities. */
  readonly family: FamilyId | null
  /** Rooms in order; empty where the building has none (05 §1). */
  readonly rooms: readonly RoomId[]
}

const def = (id: BuildingId, name: string, job: BuildingJob, family: FamilyId | null, rooms: readonly RoomId[] = []): BuildingDef =>
  Object.freeze({ id, name, job, family, rooms })

/** 07 §1 and 05 §1. */
export const BUILDINGS: Readonly<Record<BuildingId, BuildingDef>> = Object.freeze({
  'sugar-grove': def('sugar-grove', 'Sugar Grove', 'gather', 'sweets'),
  orchard: def('orchard', 'Orchard', 'gather', 'fruits'),
  fishery: def('fishery', 'Fishery', 'gather', 'fish'),
  'nut-grove': def('nut-grove', 'Nut Grove', 'gather', 'nuts-seeds'),
  'herb-garden': def('herb-garden', 'Herb Garden', 'gather', 'herbs-spices'),
  fields: def('fields', 'Fields', 'gather', 'grains'),
  'vegetable-garden': def('vegetable-garden', 'Vegetable Garden', 'gather', 'vegetables'),
  'mushroom-cave': def('mushroom-cave', 'Mushroom Cave', 'gather', 'mushrooms'),
  pantry: def('pantry', 'Pantry', 'craft', null),
  kitchen: def('kitchen', 'Kitchen', 'cook', null),
  observatory: def('observatory', 'Observatory', 'session', null),
  'lineage-hall': def('lineage-hall', 'Lineage Hall', 'session', null),
  gym: def('gym', 'Gym', 'session', null, GYM_ROOMS),
  dojo: def('dojo', 'Dojo', 'session', null, DOJO_ROOMS),
})

export const isBuildingId = (id: string): id is BuildingId => (BUILDING_IDS as readonly string[]).includes(id)
export const isFacility = (id: BuildingId): id is FacilityId => (FACILITY_IDS as readonly string[]).includes(id)

// --- Levels, slots and speed ----------------------------------------------------------------------------------------

/** Buildings run Lv 1–3 (07 §6–§7, 05 §7). */
export const MAX_BUILDING_LEVEL = 3
export type BuildingLevel = 1 | 2 | 3
export const BUILDING_LEVELS: readonly BuildingLevel[] = Object.freeze([1, 2, 3] as const)
export const isBuildingLevel = (n: number): n is BuildingLevel => Number.isInteger(n) && n >= 1 && n <= MAX_BUILDING_LEVEL

/** Speed by level: Lv 3 divides every duration by 1.25 (07 §6–§7, 05 §7). */
export const BUILDING_SPEED: Readonly<Record<BuildingLevel, number>> = Object.freeze({ 1: 1, 2: 1, 3: 1.25 })

type Per<T> = readonly [lv1: T, lv2: T, lv3: T]

/** Slots per room (or per building, where it has no rooms) at Lv 1, 2 and 3 (07 §6, 05 §7). */
export const SLOTS: Readonly<Record<BuildingId, Per<number>>> = Object.freeze({
  'sugar-grove': [2, 3, 3],
  orchard: [2, 3, 3],
  fishery: [2, 3, 3],
  'nut-grove': [2, 3, 3],
  'herb-garden': [2, 3, 3],
  fields: [2, 3, 3],
  'vegetable-garden': [4, 5, 5],
  'mushroom-cave': [2, 3, 3],
  pantry: [3, 5, 5], // a fifth slot at Lv 2 and 3 (D351): crafting is the step with the most items
  kitchen: [6, 8, 8],
  observatory: [2, 3, 3],
  'lineage-hall': [2, 3, 3],
  gym: [1, 2, 2],
  dojo: [1, 2, 2],
})

/** Slots in each room (or the building) at `level`. */
export const slotsPerRoom = (building: BuildingId, level: BuildingLevel): number => SLOTS[building][level - 1]!
/** Every slot in the building at `level`, all rooms together. */
export const totalSlots = (building: BuildingId, level: BuildingLevel): number =>
  slotsPerRoom(building, level) * Math.max(1, BUILDINGS[building].rooms.length)
export const buildingSpeed = (level: BuildingLevel): number => BUILDING_SPEED[level]

// --- Upgrades -------------------------------------------------------------------------------------------------------

/** One upgrade: Prize Money plus `each` crafted items of `grade` from each of the building's upgrade families (07 §7). */
export interface UpgradeStep {
  readonly prizeMoney: number
  readonly each: number
  readonly grade: ItemGrade
}

const step = (prizeMoney: number, each: number, grade: ItemGrade): UpgradeStep => Object.freeze({ prizeMoney, each, grade })
/** Each site: 1,200 PM + 4 crafted grade 1 of its family, then 2,400 PM + 4 crafted grade 3 (07 §7). */
const site = (): readonly [UpgradeStep, UpgradeStep] => [step(1_200, 4, 1), step(2_400, 4, 3)]

/** To Lv 2 and to Lv 3, in Prize Money and crafted items (07 §7 for the Farm, 05 §7 for the facilities). */
export const UPGRADES: Readonly<Record<BuildingId, readonly [toLv2: UpgradeStep, toLv3: UpgradeStep]>> = Object.freeze({
  'sugar-grove': site(),
  orchard: site(),
  fishery: site(),
  'nut-grove': site(),
  'herb-garden': site(),
  fields: site(),
  'vegetable-garden': site(),
  'mushroom-cave': site(),
  pantry: [step(1_500, 1, 1), step(6_000, 1, 3)],
  kitchen: [step(3_000, 2, 1), step(12_000, 2, 3)],
  observatory: [step(1_200, 4, 1), step(2_400, 4, 3)],
  'lineage-hall': [step(1_000, 4, 1), step(1_500, 4, 3)],
  gym: [step(2_400, 1, 1), step(4_800, 2, 3)],
  dojo: [step(1_500, 1, 1), step(2_000, 1, 3)],
})

/** The stat families, in `FAMILY_IDS` order: the Gym's upgrade families (05 §7). */
export const STAT_FAMILIES: readonly FamilyId[] = Object.freeze(
  FAMILY_IDS.filter((family) => (STATS as readonly string[]).includes(FAMILIES[family].destination)),
)
/** The Dojo's six families: the stat families and Grains for Friend and Group cards (05 §1, §7). */
export const DOJO_FAMILIES: readonly FamilyId[] = Object.freeze(
  FAMILY_IDS.filter((family) => STAT_FAMILIES.includes(family) || FAMILIES[family].destination === 'skill'),
)

/** Whose crafted items an upgrade takes (07 §7, 05 §7): a site its own family; the Pantry and Kitchen every family. */
export function upgradeFamilies(building: BuildingId): readonly FamilyId[] {
  const own = BUILDINGS[building].family
  if (own !== null) return [own]
  switch (building) {
    case 'observatory': return ['vegetables']
    case 'lineage-hall': return ['mushrooms']
    case 'gym': return STAT_FAMILIES
    case 'dojo': return DOJO_FAMILIES
    default: return FAMILY_IDS
  }
}

export interface UpgradeCost {
  readonly prizeMoney: number
  /** Crafted items, one row per family in `FAMILY_IDS` order. */
  readonly items: readonly RecipeInput[]
}

/** What raising `building` to `toLevel` (2 or 3) costs. */
export function upgradeCost(building: BuildingId, toLevel: 2 | 3): UpgradeCost {
  const { prizeMoney, each, grade } = UPGRADES[building][toLevel - 2]!
  return {
    prizeMoney,
    items: upgradeFamilies(building).map((family) => Object.freeze({ item: craftedItem(family, grade).id, qty: each })),
  }
}

/** The starting levels: every building at Lv 1 with its starting slots (13 §5). */
export const INITIAL_BUILDINGS: Readonly<Record<BuildingId, { readonly level: BuildingLevel }>> = Object.freeze(
  Object.fromEntries(BUILDING_IDS.map((id) => [id, Object.freeze({ level: 1 as BuildingLevel })])) as Record<BuildingId, { readonly level: BuildingLevel }>,
)
