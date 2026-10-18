// The four facilities (docs/game/05-training-hub.md §1, D374): what each unlocks, what it takes, and which room takes
// which unlock. The Observatory opens nodes and the Lineage Hall Inspiration slots with tonics (its inherited uniques
// and golds take nothing); the Gym's rooms, one per stat in ring order, take their stat's singles, any Duo with their
// stat, and any Sun, each for a meal; the Dojo's rooms take their card type's bonds, Friend and Group sharing one, for
// nothing. The ids, rooms, slots, levels, speeds and upgrades are T127's (`farm/buildings.ts`).
import type { StatKey } from '../types'
import { BUILDINGS, DOJO_ROOMS, FACILITY_IDS, GYM_ROOMS, type FacilityId, type RoomId } from '../farm/buildings'
import { FAMILIES, familyFor, type FamilyId } from '../items/families'
import { dojoRoomOf, type CardTypeOf } from './bonds'
import { extraNode } from './extra'
import { UNLOCK_FACILITY, UNLOCK_KINDS, type Unlock, type UnlockKind } from './unlocks'

export type GymRoomId = (typeof GYM_ROOMS)[number]
export type DojoRoomId = (typeof DOJO_ROOMS)[number]

/** What each facility unlocks (05 §1). */
export const FACILITY_UNLOCKS: Readonly<Record<FacilityId, readonly UnlockKind[]>> = Object.freeze(Object.fromEntries(
  FACILITY_IDS.map((facility) => [facility, Object.freeze(UNLOCK_KINDS.filter((kind) => UNLOCK_FACILITY[kind] === facility))]),
) as Record<FacilityId, readonly UnlockKind[]>)

/** The family each Gym room's singles take, its stat's (05 §1): Duos and Feasts join two rooms or all five. */
export const GYM_ROOM_FAMILY: Readonly<Record<GymRoomId, FamilyId>> = Object.freeze(
  Object.fromEntries(GYM_ROOMS.map((room) => [room, familyFor(room)])) as Record<GymRoomId, FamilyId>,
)

/** The room names a screen shows: the Gym's by stat, the Dojo's by card type. */
export const ROOM_NAMES: Readonly<Record<RoomId, string>> = Object.freeze({
  stamina: 'Stamina', wit: 'Wit', power: 'Power', speed: 'Speed', guts: 'Guts', 'friend-group': 'Friend & Group',
})

/**
 * The rooms that take an unlock, in ring or type order; none at the Observatory and the Lineage Hall. A bond's room is
 * its card type's, which `cardTypeOf` reads from the content; without it, or for a card the content lacks, none.
 */
export function roomsFor(entry: Pick<Unlock, 'kind' | 'target'>, cardTypeOf?: CardTypeOf): readonly RoomId[] {
  switch (entry.kind) {
    case 'single':
    case 'duo':
    case 'sun': {
      const node = extraNode(entry.target)
      if (!node || node.kind !== entry.kind) return []
      return GYM_ROOMS.filter((room) => node.stats.includes(room as StatKey))
    }
    case 'bond': {
      const type = cardTypeOf?.(entry.target)
      return type === undefined ? [] : [dojoRoomOf(type)]
    }
    default: return []
  }
}

/**
 * Whether a session in `room` may take this unlock: at the Observatory and the Lineage Hall there is no room (null);
 * at the Gym a room takes its stat's singles, a Duo with its stat and any Sun; at the Dojo its card type's bonds.
 */
export function roomAccepts(room: RoomId | null, entry: Pick<Unlock, 'kind' | 'target'>, cardTypeOf?: CardTypeOf): boolean {
  const facility = UNLOCK_FACILITY[entry.kind]
  if (BUILDINGS[facility].rooms.length === 0) return room === null
  return room !== null && roomsFor(entry, cardTypeOf).includes(room)
}

/** Whether `room` is one of the facility's rooms, or null where it has none. */
export const isRoomOf = (facility: FacilityId, room: RoomId | null): boolean =>
  room === null ? BUILDINGS[facility].rooms.length === 0 : BUILDINGS[facility].rooms.includes(room)

/** The family name a screen shows for a facility's dishes. */
export const familyName = (family: FamilyId): string => FAMILIES[family].name
