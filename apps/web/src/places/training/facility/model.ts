// A Training facility's page and Peek (docs/game/05-training-hub.md §7, §8; docs/game/11-hub-and-places.md §3.2;
// docs/game/02-check-ins-and-notifications.md §2, §6; T139), read from one work view: the header (level, slots in use
// from `slotsOf` and `slotHolder`, speed, the next upgrade with what it adds); one card per slot, by room at the Gym and
// Dojo, a busy one naming her current unlock and its dish; **Needs here**, the planner's `facilityLines` in 02 §6's
// words with Start when she can and the Kitchen for a short dish; Collect here's slots; and the Peek's lines. Pure.
import { hasReady } from '@racer/domain/check-in'
import { BUILDINGS, buildingSpeed, type BuildingLevel, type FacilityId, type RoomId } from '@racer/domain/farm'
import { FAMILIES, itemById, ITEM_GRADE_LIST, planetDish, DUOS, FEASTS, type ItemId } from '@racer/domain/items'
import { facilityLines, layerProgress, planFrom, targetsOf, type PlannedUnlock } from '@racer/domain/planner'
import { FACILITY_DISH_FAMILY, ROOM_NAMES, type UnlockRef } from '@racer/domain/training'
import { buildingLevel, holdsSlot, SESSION_KIND, stockOf, type SlotRef, type WorkRequest, type WorkRow } from '@racer/domain/work'
import { slotCards, upgradeView, type HeldSlotCard, type SlotCardModel, type UpgradeView } from '../../../ui/work/model'
import type { WorkView } from '../../../ui/work/view'
import type { WordsContext } from '../../../ui/work/words'
import { sheetQuery } from '../../farm/building/model'
import { dishWords, sessionPath, unlockName, type Content } from '../common'
import { trainingWords } from '../words'

export interface RoomView {
  /** Null at the Observatory and the Lineage Hall. */
  readonly room: RoomId | null
  readonly name: string | null
  readonly cards: readonly SlotCardModel[]
}

/** One target's line in Needs here (02 §6): "Special Week · 3 nodes · 2 in stock, 1 short". */
export interface NeedsLineView {
  readonly outfitId: string
  readonly words: string
  /** The sheet with her, when she's Free and a dish is in stock (`canStart`). */
  readonly start: string | null
  /** The Kitchen's job sheet for her first short dish here. */
  readonly cook: { readonly dish: ItemId; readonly to: string } | null
  /** The Dojo: her bonds still to pick cards for, at her bonds view. */
  readonly pick: string | null
}

export interface FacilityView {
  readonly facility: FacilityId
  readonly name: string
  readonly level: BuildingLevel
  readonly slots: number
  /** Slots a session holds: "2 / 3 in use". */
  readonly used: number
  readonly speed: number
  readonly upgrade: UpgradeView | null
  readonly rooms: readonly RoomView[]
  readonly lines: readonly NeedsLineView[]
  /** Umas with a finished session here: the Counter (11 §3.2) and Collect here's slots. */
  readonly ready: number
  readonly readySlots: readonly SlotRef[]
}

/** What one target has left here, by 02 §6's noun: "3 nodes", "1 unlock", "2 bonds". */
export function leftWords(facility: FacilityId, n: number): string {
  const noun = facility === 'dojo' ? 'bond' : facility === 'lineage-hall' ? 'unlock' : 'node'
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/** The noun a Peek counts Umas by. */
export const peekNoun = (facility: FacilityId): string => (facility === 'dojo' ? 'bonds' : facility === 'lineage-hall' ? 'unlocks' : 'nodes')

function needsLines(view: WorkView, facility: FacilityId, route: string, context: WordsContext): NeedsLineView[] {
  const planned = planFrom(view.projection, targetsOf(view.settled), {})
  const name = (outfitId: string) => context.umaName(outfitId) || outfitId
  const lines = facilityLines(planned, facility).map((line): NeedsLineView => {
    const target = planned.targets.find((entry) => entry.outfitId === line.outfitId)!
    const here: readonly PlannedUnlock[] = target.unlocks.filter((entry) => entry.facility === facility)
    const short = line.left - line.ready - line.coming
    const parts = [trainingWords('needs-line', { uma: name(line.outfitId), left: leftWords(facility, line.left), ready: line.ready })]
    if (short > 0) parts.push(trainingWords('needs-short', { n: short }))
    if (line.coming > 0) parts.push(trainingWords('needs-coming', { n: line.coming }))
    const firstShort = here.find((entry) => entry.supply === 'short')
    return {
      outfitId: line.outfitId,
      words: parts.join(', '),
      start: line.canStart ? sessionPath(facility, { uma: line.outfitId, room: here[0]?.room ?? null, back: route }) : null,
      cook: firstShort === undefined ? null : { dish: firstShort.unlock.dishId, to: `/farm/kitchen${sheetQuery({ job: firstShort.unlock.dishId, back: route })}` },
      pick: null,
    }
  })
  if (facility !== 'dojo') return lines
  // A bond with no card chosen has no dish to cascade (02 §6): "3 bonds: pick cards", at her bonds view.
  const picks = planned.targets.filter((target) => target.pickCards > 0).map((target): NeedsLineView => ({
    outfitId: target.outfitId,
    words: target.pickCards === 1
      ? trainingWords('pick-cards-one', { uma: name(target.outfitId) })
      : trainingWords('pick-cards', { uma: name(target.outfitId), n: target.pickCards }),
    start: null,
    cook: null,
    pick: `/training/dojo/${encodeURIComponent(target.outfitId)}`,
  }))
  return [...lines, ...picks]
}

/** Everything a facility page draws at the view's `now`. */
export function facilityView(view: WorkView, facility: FacilityId, context: WordsContext): FacilityView {
  const settled = view.settled
  const level = buildingLevel(settled, facility)
  const cards = slotCards(settled, facility, view.now)
  const rooms = BUILDINGS[facility].rooms
  const readyRows = Object.values(settled.work).filter((row) => holdsSlot(row) && row.slot!.building === facility && hasReady(row, view.now))
  return {
    facility,
    name: BUILDINGS[facility].name,
    level,
    slots: cards.length,
    used: cards.filter((card) => card.kind === 'held').length,
    speed: buildingSpeed(level),
    upgrade: upgradeView(view, facility),
    rooms: rooms.length === 0
      ? [{ room: null, name: null, cards }]
      : rooms.map((room) => ({ room, name: ROOM_NAMES[room], cards: cards.filter((card) => card.slot.room === room) })),
    lines: needsLines(view, facility, `/training/${facility}`, context),
    ready: readyRows.length,
    readySlots: readyRows.map((row) => row.slot!),
  }
}

// ---- A busy slot's line --------------------------------------------------------------------------------------------

/** The unlock a held card shows: the one in progress, else the session's last (05 §8). */
export function currentUnlock(row: WorkRow | undefined, card: HeldSlotCard): { readonly ref: UnlockRef; readonly dishId: ItemId } | null {
  const entry = row?.entries.at(-1)
  if (entry === undefined || entry.request.kind !== SESSION_KIND) return null
  const index = Math.min(card.running ? card.made : card.count - 1, entry.request.unlocks.length - 1)
  const ref = entry.request.unlocks[index]
  const dishId = entry.inputs[index]?.[0]?.item
  return ref === undefined || dishId === undefined ? null : { ref: { kind: ref.kind as UnlockRef['kind'], target: ref.target }, dishId }
}

/** "Node 7 · Potato Salad": her current unlock and its dish by name. */
export function unlockLine(ref: UnlockRef, dishId: ItemId, content: Content | null): string {
  return `${unlockName(ref, content)} · ${itemById(dishId)?.name ?? dishId}`
}

/** A queued session's short name for the queue chips: "Node 9 +2". */
export function queuedWords(request: WorkRequest, content: Content | null): string {
  if (request.kind !== SESSION_KIND || request.unlocks.length === 0) return ''
  const first = request.unlocks[0]!
  const name = unlockName({ kind: first.kind as UnlockRef['kind'], target: first.target }, content)
  return request.unlocks.length === 1 ? name : `${name} +${request.unlocks.length - 1}`
}

// ---- The Peek (11 §3.2) ---------------------------------------------------------------------------------------------

export interface PeekDish {
  readonly item: ItemId
  readonly count: number
  readonly words: string
}

/** The facility's dishes in the Warehouse (11 §3.2): Vegetables, Mushrooms, or the Gym's stat, Duo and Feast dishes. */
export function facilityDishes(view: WorkView, facility: FacilityId): readonly PeekDish[] {
  const settled = view.settled
  const ids: ItemId[] = facility === 'observatory' || facility === 'lineage-hall'
    ? ITEM_GRADE_LIST.map((grade) => planetDish(FACILITY_DISH_FAMILY[facility], grade).id)
    : facility === 'gym'
      ? [
        ...Object.values(FACILITY_DISH_FAMILY.gym).flatMap((family) => ITEM_GRADE_LIST.map((grade) => planetDish(family, grade).id)),
        ...DUOS.map((duo) => duo.id),
        ...FEASTS.map((feast) => feast.id),
      ]
      : []
  return ids
    .map((item) => ({ item, count: stockOf(settled.items, item), words: dishWords(item) }))
    .filter((dish) => dish.count > 0)
}

/** The family a facility's dishes are named by in its Peek: "Vegetables", "Mushrooms"; the Gym's are many. */
export const dishFamilyName = (facility: FacilityId): string =>
  facility === 'observatory' || facility === 'lineage-hall' ? FAMILIES[FACILITY_DISH_FAMILY[facility]].name : 'Stat, Duo and Feast'

/** Umas with unlocks left here in their open layers (`layerProgress`), most first; at the Dojo, bonds left this layer. */
export function leftHere(view: WorkView, facility: FacilityId): readonly { readonly outfitId: string; readonly left: number }[] {
  return Object.values(view.settled.umas)
    .map((uma) => {
      const row = layerProgress(uma).find((entry) => entry.facility === facility)!
      return { outfitId: uma.outfitId, left: row.total - row.done }
    })
    .filter((entry) => entry.left > 0)
    .sort((a, b) => b.left - a.left || (a.outfitId < b.outfitId ? -1 : 1))
}
