// The Hub's view of the account (docs/rework/11-hub-and-places.md §2.1–§2.4, §3, §4, §5; docs/rework/02-check-ins-
// and-notifications.md §2, §7): what the shell, the page grids and the tiles draw, from one settle at `now`. The pill's
// Collect all and Check-in counts, the start rule's count, the bar's tab badges, every building's slot pips, each
// place's default counter, the featured Uma and the account bar's chips. Pure: only the given `now` is read. Every rule
// is the rework modules'; this file only gathers their answers.
import { hasReady, needingATap } from '../check-in/collect-all'
import { BUILDING_IDS, FACILITY_IDS, FARM_BUILDING_IDS, type BuildingId, type RoomId } from '../farm/buildings'
import { SPEED_TICKET_ID } from '../items/catalogue'
import { advanceReadiness } from '../tiers/advance'
import { assertNow } from '../tiers/ledger'
import { lifetimeLevel, type ScenarioCatalogue } from '../tiers/map'
import { promotionReadiness } from '../tiers/promotion'
import { UMA_SHARDS_PER_TICKET } from '../tiers/roster'
import { isRefusal, type UmaState } from '../state/types'
import { isFree } from '../work/activity'
import type { WorkEnv } from '../work/kinds'
import { slotsOf } from '../work/operations'
import { settle } from '../work/settle'
import { holdsSlot, stockOf } from '../work/state'
import { itemProgress } from '../work/timeline'
import type { SlotRef, WorkRow, WorkState } from '../work/types'
import { PLACES, type PlaceId } from './places'

/** §4: up to eight pips in two rows of four; past eight slots the eighth becomes "+N". */
export const MAX_PIPS = 8

export type PipState = 'busy' | 'ready' | 'free'

/** One slot's pip (§4). */
export interface HubPip {
  readonly state: PipState
  /** Who holds the slot; null when it's free. */
  readonly outfitId: string | null
  /** A busy pip's ring: the current item's progress (`itemProgress`); 1 when ready, 0 when free. */
  readonly progress: number
  /** Requests queued behind her running entry: the "+N" on the busy pip's shoulder. */
  readonly queued: number
  /** The Gym's stat room or the Dojo's card-type room, which tints the ring; null elsewhere. */
  readonly room: RoomId | null
}

/** One building's slots at a glance (§4): counts, pips busy first, then ready, then free, and what doesn't fit. */
export interface HubBuilding {
  readonly slots: number
  /** Slots whose Uma is working with nothing to collect yet. */
  readonly busy: number
  /** Slots whose Uma has something to collect, a running batch's finished items included: its Ready badge. */
  readonly ready: number
  readonly free: number
  /** Requests queued behind every slot here. */
  readonly queued: number
  readonly pips: readonly HubPip[]
  /** Slots past the seventh pip when there are more than eight: the "+N". */
  readonly more: number
}

/** The account bar's chips (§2.1). */
export interface HubWallet {
  readonly prizeMoney: number
  readonly speedTickets: number
  readonly umaTickets: number
  /** Uma Shards held, which can pass the exchange's five (04 §6: the exchange is the owner's tap). */
  readonly shards: number
  readonly shardsPerTicket: number
  /** Enough Shards for a ticket: the chip holds at 5/5, in gold. */
  readonly ticketReady: boolean
}

export interface HubView {
  /** Umas with something to collect (`readyCount`): **Collect all · N ready** (02 §2). */
  readonly ready: number
  /** Free Umas (`freeUmas`): **Check-in · N free** (02 §4). */
  readonly free: number
  /** The slots shown as ready, for Collect all's `shown` (02 §9: one the other device collected reads "Already collected."). */
  readonly readySlots: readonly SlotRef[]
  /** Umas Ready or Free (`needsATap`, 02 §7): the start rule's count (§2.4) and the app badge's in phase 4. */
  readonly needsATap: number
  /** The bar's badges (§2.2): Umas with something to collect at a Farm building, and at a facility. */
  readonly tabs: { readonly farm: number; readonly training: number }
  readonly buildings: Readonly<Record<BuildingId, HubBuilding>>
  /** Each place's default counter, where the rework state gives it; T141's two come from their own hooks. */
  readonly counts: Readonly<Partial<Record<PlaceId, number>>>
  /** The Town Hall plaza's Uma (§5): the profile's, else D181's first by lifetime level; null with no Umas. */
  readonly featured: string | null
  readonly wallet: HubWallet
  /** Umas owned: none sends the start rule to the Stable's Locked tab (§2.4). */
  readonly umas: number
}

/** What the view reads beyond the state: the work kinds' content, and the scenario catalogue if not today's. */
export type HubEnv = WorkEnv & { readonly catalogue?: ScenarioCatalogue }

const PIP_ORDER: Readonly<Record<PipState, number>> = { busy: 0, ready: 1, free: 2 }

const slotKey = (slot: SlotRef): string => `${slot.building}/${slot.room ?? ''}/${slot.slot}`

function pipOf(slot: SlotRef, row: WorkRow | undefined, now: number): HubPip {
  const room = slot.room ?? null
  if (row === undefined) return { state: 'free', outfitId: null, progress: 0, queued: 0, room }
  if (hasReady(row, now)) return { state: 'ready', outfitId: row.outfitId, progress: 1, queued: row.queue.length, room }
  return { state: 'busy', outfitId: row.outfitId, progress: itemProgress(row.entries[row.entries.length - 1]!, now), queued: row.queue.length, room }
}

function building(state: WorkState, id: BuildingId, holders: ReadonlyMap<string, WorkRow>, now: number): HubBuilding {
  const all = slotsOf(state, id)
    .map((slot) => pipOf(slot, holders.get(slotKey(slot)), now))
    .sort((a, b) => PIP_ORDER[a.state] - PIP_ORDER[b.state])
  const count = (state: PipState) => all.filter((pip) => pip.state === state).length
  const overflow = all.length > MAX_PIPS
  return {
    slots: all.length,
    busy: count('busy'),
    ready: count('ready'),
    free: count('free'),
    queued: all.reduce((sum, pip) => sum + pip.queued, 0),
    pips: overflow ? all.slice(0, MAX_PIPS - 1) : all,
    more: overflow ? all.length - (MAX_PIPS - 1) : 0,
  }
}

/** Her template's name where the content carries one, for D181's tie-break; else her outfit. */
function nameOf(env: HubEnv, outfitId: string): string {
  const template = env.content.umas.get(outfitId) as { readonly name?: unknown } | undefined
  return typeof template?.name === 'string' ? template.name : outfitId
}

/**
 * The featured Uma (§5, 13 §5): the profile's while she is owned, else the first in D181's order, lifetime level
 * highest first (03 §2), then name; null with no Umas.
 */
export function featuredUma(state: Pick<WorkState, 'profile' | 'umas'>, env: HubEnv): string | null {
  const chosen = state.profile.featuredUmaId
  if (chosen !== null && state.umas[chosen] !== undefined) return chosen
  const level = (uma: UmaState) => lifetimeLevel(uma.tier, uma.racing.level)
  const first = Object.values(state.umas).sort((a, b) => level(b) - level(a)
    || nameOf(env, a.outfitId).localeCompare(nameOf(env, b.outfitId))
    || (a.outfitId < b.outfitId ? -1 : a.outfitId > b.outfitId ? 1 : 0))[0]
  return first?.outfitId ?? null
}

/** Everything the Hub draws at `now`, from one settle (§2, §4). */
export function hubView(state: WorkState, now: number, env: HubEnv): HubView {
  assertNow(now)
  const settled = settle(state, now, env).state
  const rows = Object.values(settled.work)
  const readyRows = rows.filter((row) => hasReady(row, now))
  const holders = new Map(rows.filter(holdsSlot).map((row) => [slotKey(row.slot!), row]))
  const buildings = Object.fromEntries(BUILDING_IDS.map((id) => [id, building(settled, id, holders, now)])) as Record<BuildingId, HubBuilding>
  const at = (ids: readonly BuildingId[]) => readyRows.filter((row) => row.slot !== null && ids.includes(row.slot.building)).length

  const umas = Object.values(settled.umas)
  const counts: Partial<Record<PlaceId, number>> = {}
  for (const place of PLACES) {
    switch (place.counter) {
      case 'uma-tickets':
        counts[place.id] = settled.profile.umaTickets
        break
      case 'finished-here':
        counts[place.id] = buildings[place.id as BuildingId].ready
        break
      case 'ready-to-advance':
        counts[place.id] = umas.filter((uma) => !isRefusal(advanceReadiness(uma, env.catalogue))).length
        break
      case 'promotable':
        counts[place.id] = umas.filter((uma) => !isRefusal(promotionReadiness(settled, uma.outfitId))).length
        break
      default:
        break
    }
  }

  const shards = settled.profile.umaShards
  return {
    ready: readyRows.length,
    free: umas.filter((uma) => isFree(settled, uma.outfitId)).length,
    readySlots: readyRows.flatMap((row) => (row.slot === null ? [] : [row.slot])),
    needsATap: needingATap(settled, now).length,
    tabs: { farm: at(FARM_BUILDING_IDS), training: at(FACILITY_IDS) },
    buildings,
    counts,
    featured: featuredUma(settled, env),
    wallet: {
      prizeMoney: settled.profile.prizeMoney,
      speedTickets: stockOf(settled.items, SPEED_TICKET_ID),
      umaTickets: settled.profile.umaTickets,
      shards,
      shardsPerTicket: UMA_SHARDS_PER_TICKET,
      ticketReady: shards >= UMA_SHARDS_PER_TICKET,
    },
    umas: umas.length,
  }
}
