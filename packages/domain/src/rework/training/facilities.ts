// The four facilities (docs/rework/05-training-hub.md §1): what each unlocks, which dish family it takes, and which room
// takes which unlock. The Observatory opens nodes with Vegetables and the Lineage Hall Inspiration with Mushrooms; the
// Gym's rooms, one per stat in ring order, take their stat's singles, any Duo with their stat, and any Sun; the Dojo's
// rooms take their card type's bonds, Friend and Group sharing one. The ids, rooms, slots, levels, speeds and upgrades
// are T127's (`rework/farm/buildings.ts`).
import type { StatKey } from '../../types'
import { BUILDINGS, DOJO_ROOMS, FACILITY_IDS, GYM_ROOMS, type FacilityId, type RoomId } from '../farm/buildings'
import { itemById } from '../items/catalogue'
import { FAMILIES, familyFor, type FamilyId } from '../items/families'
import { extraNode } from './extra'
import { UNLOCK_FACILITY, UNLOCK_KINDS, type Unlock, type UnlockKind } from './unlocks'

export type GymRoomId = (typeof GYM_ROOMS)[number]
export type DojoRoomId = (typeof DOJO_ROOMS)[number]

/** What each facility unlocks (05 §1). */
export const FACILITY_UNLOCKS: Readonly<Record<FacilityId, readonly UnlockKind[]>> = Object.freeze(Object.fromEntries(
  FACILITY_IDS.map((facility) => [facility, Object.freeze(UNLOCK_KINDS.filter((kind) => UNLOCK_FACILITY[kind] === facility))]),
) as Record<FacilityId, readonly UnlockKind[]>)

/** The family a Dojo room's bonds take: its stat's, or Grains (the Skill family) for Friend and Group (06 §2). */
const dojoFamily = (room: DojoRoomId): FamilyId => familyFor(room === 'friend-group' ? 'skill' : room)

/**
 * The dish family each facility takes (05 §1, README): one family at the Observatory and the Lineage Hall, one per
 * room at the Gym (a single's; Duos and Feasts join two or all five) and at the Dojo.
 */
export const FACILITY_DISH_FAMILY = Object.freeze({
  observatory: familyFor('constellation'),
  'lineage-hall': familyFor('inspiration'),
  gym: Object.freeze(Object.fromEntries(GYM_ROOMS.map((room) => [room, familyFor(room)])) as Record<GymRoomId, FamilyId>),
  dojo: Object.freeze(Object.fromEntries(DOJO_ROOMS.map((room) => [room, dojoFamily(room)])) as Record<DojoRoomId, FamilyId>),
})

/** The room names a screen shows: the Gym's by stat, the Dojo's by card type. */
export const ROOM_NAMES: Readonly<Record<RoomId, string>> = Object.freeze({
  stamina: 'Stamina', wit: 'Wit', power: 'Power', speed: 'Speed', guts: 'Guts', 'friend-group': 'Friend & Group',
})

/** The rooms that take an unlock, in ring or type order; none at the Observatory and the Lineage Hall. */
export function roomsFor(entry: Pick<Unlock, 'kind' | 'target' | 'dishId'>): readonly RoomId[] {
  switch (entry.kind) {
    case 'single':
    case 'duo':
    case 'sun': {
      const node = extraNode(entry.target)
      if (!node || node.kind !== entry.kind) return []
      return GYM_ROOMS.filter((room) => node.stats.includes(room as StatKey))
    }
    case 'bond': {
      const dish = itemById(entry.dishId)
      if (dish?.kind !== 'dish' || dish.dish !== 'planet') return []
      return DOJO_ROOMS.filter((room) => dojoFamily(room) === dish.family)
    }
    default: return []
  }
}

/**
 * Whether a session in `room` may take this unlock: at the Observatory and the Lineage Hall there is no room (null);
 * at the Gym a room takes its stat's singles, a Duo with its stat and any Sun; at the Dojo its card type's bonds.
 */
export function roomAccepts(room: RoomId | null, entry: Pick<Unlock, 'kind' | 'target' | 'dishId'>): boolean {
  const facility = UNLOCK_FACILITY[entry.kind]
  if (BUILDINGS[facility].rooms.length === 0) return room === null
  return room !== null && roomsFor(entry).includes(room)
}

/** Whether `room` is one of the facility's rooms, or null where it has none. */
export const isRoomOf = (facility: FacilityId, room: RoomId | null): boolean =>
  room === null ? BUILDINGS[facility].rooms.length === 0 : BUILDINGS[facility].rooms.includes(room)

/** The family name a screen shows for a facility's dishes. */
export const familyName = (family: FamilyId): string => FAMILIES[family].name
