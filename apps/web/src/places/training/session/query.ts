// The session sheet's query (docs/game/11-hub-and-places.md §1, §7.1; T139): the sheet opens over a facility page from
// `?session=:umaId&room=:room&unlocks=<kind>:<target>,…&back=<path>`, plus `&queue=1` (T138's Queue for a busy Uma)
// and `&slot=n` (a slot card's Start a session). `session` present opens it, empty when the sheet picks her; `back` is an
// in-app path only. Every place reaches the sheet by this link: a slot, a locked item's Unlock, a Needs line, the
// planner and the Card Library's Bond.
import { BUILDINGS, type FacilityId, type RoomId } from '@racer/domain/farm'
import { FACILITY_UNLOCKS, fixedUnlock, isRoomOf, unlockKey, type UnlockKind, type UnlockRef } from '@racer/domain/training'
import { inAppPath } from '../../farm/job-sheet/model'

export interface SessionQuery {
  /** Her outfit, or null when the sheet picks her. */
  readonly uma: string | null
  /** A room of this facility, or null (none given, or the facility has none). */
  readonly room: RoomId | null
  /** What arrives picked, in order, each of this facility; a bond names its card. */
  readonly unlocks: readonly UnlockRef[]
  /** Where Start returns. */
  readonly back: string | null
  /** Open on Add to queue. */
  readonly queue: boolean
  /** The slot card's slot. */
  readonly slot: number | null
}

const KEYS = ['session', 'room', 'unlocks', 'back', 'queue', 'slot'] as const

/** `kind:target` refs this facility makes; anything else is left out. A fixed kind must name one of the layers'. */
export function parseUnlocks(value: string | null, facility: FacilityId): readonly UnlockRef[] {
  if (value === null || value === '') return []
  const kinds: readonly UnlockKind[] = FACILITY_UNLOCKS[facility]
  const seen = new Set<string>()
  const refs: UnlockRef[] = []
  for (const part of value.split(',')) {
    const at = part.indexOf(':')
    if (at <= 0) continue
    const kind = part.slice(0, at) as UnlockKind
    const target = part.slice(at + 1)
    if (!kinds.includes(kind) || target === '') continue
    if (kind !== 'bond' && fixedUnlock({ kind, target }) === undefined) continue
    const ref = { kind, target }
    if (seen.has(unlockKey(ref))) continue
    seen.add(unlockKey(ref))
    refs.push(ref)
  }
  return refs
}

/** The sheet's query on a facility page, or null when the page has none. */
export function readSessionQuery(params: URLSearchParams, facility: FacilityId): SessionQuery | null {
  if (!params.has('session')) return null
  const room = params.get('room')
  const slot = params.get('slot')
  return {
    uma: params.get('session') || null,
    room: room !== null && BUILDINGS[facility].rooms.length > 0 && isRoomOf(facility, room as RoomId) ? (room as RoomId) : null,
    unlocks: parseUnlocks(params.get('unlocks'), facility),
    back: inAppPath(params.get('back')),
    queue: params.get('queue') === '1',
    slot: slot !== null && /^\d{1,2}$/.test(slot) ? Number(slot) : null,
  }
}

/** The facility page's search without the sheet's fields. */
export function withoutSession(search: string): string {
  const params = new URLSearchParams(search)
  for (const key of KEYS) params.delete(key)
  const rest = params.toString()
  return rest === '' ? '' : `?${rest}`
}
