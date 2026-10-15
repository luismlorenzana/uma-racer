// The unlock order (docs/rework/05-training-hub.md §3): what each unlock waits on, which are open now, the next ones at a
// facility and room, what is left of her layers, and when a layer is done.
// - Observatory: the lowest locked node. Lineage Hall: a grandparent slot needs its parent's slot open; a unique or gold
//   needs its own slot open, not filled; gold 2 never needs gold 1, B never needs A. Gym: singles in grade order per
//   stat; a Duo needs both same-grade singles; a Sun its scenario's five. Dojo: none; a bond names its card.
// - A dependency is met by an opened unlock, by her pending work ahead of it, or by an earlier unlock in the same session.
// - A later layer is refused with its scenario's name; earlier layers stay open for the whole tier (D328).
import { INSPIRATION_SLOTS, inspirationParent, type InspirationSlot } from '../inspiration'
import type { FacilityId, RoomId } from '../farm/buildings'
import { cardNodeId, nodeOrder } from './trees/tree'
import { scenarioNumber, scenarioRow } from '../tiers/map'
import { isRefusal, type Refusal, type ScenarioAt, type ScenarioOfTier, type UmaBuild } from '../state/types'
import { bondStatus, type BondCard } from './bonds'
import { EXTRA_STATS, extraNode, extraSingleId } from './extra'
import { isRoomOf, roomAccepts, roomsFor } from './facilities'
import { trainingRefusal } from './refusals'
import {
  BONDS_BY_SCENARIO, FIXED_UNLOCKS, bondUnlock, bondsThrough, facilityOf, goldPosition, layerUnlocks, unlockKey, unlockLabel,
  type Unlock, type UnlockRef,
} from './unlocks'

/** Whether her build already holds an unlock. */
export function isOpen(build: UmaBuild, ref: UnlockRef): boolean {
  switch (ref.kind) {
    case 'node': {
      const order = nodeOrder(ref.target)
      return order !== null && order >= 1 && order <= build.constellationOpened
    }
    case 'slot': return build.inspiration.slots.includes(ref.target as InspirationSlot)
    case 'unique': return build.inspiration.uniques.includes(ref.target as InspirationSlot)
    case 'gold': return build.inspiration.golds.includes(ref.target)
    case 'single':
    case 'duo':
    case 'sun': return build.extraNodes.includes(ref.target)
    case 'bond': return build.bonds.includes(ref.target)
  }
}

/** What an unlock waits on (05 §3). Fixed by the unlock alone; bonds wait on nothing. */
export function dependenciesOf(ref: UnlockRef): readonly UnlockRef[] {
  switch (ref.kind) {
    case 'node': {
      const order = nodeOrder(ref.target)
      return order !== null && order > 1 ? [{ kind: 'node', target: cardNodeId(order - 1) }] : []
    }
    case 'slot': {
      const slot = ref.target as InspirationSlot
      return slot.includes('-gp') ? [{ kind: 'slot', target: inspirationParent(slot) }] : []
    }
    case 'unique': return [{ kind: 'slot', target: ref.target }]
    case 'gold': {
      const at = goldPosition(ref.target)
      return at ? [{ kind: 'slot', target: at.slot }] : []
    }
    case 'single':
    case 'duo':
    case 'sun': {
      const node = extraNode(ref.target)
      if (!node) return []
      if (node.kind === 'single') return node.grade > 2 ? [{ kind: 'single', target: extraSingleId(node.stats[0]!, (node.grade - 2) as typeof node.grade) }] : []
      if (node.kind === 'duo') return node.stats.map((stat) => ({ kind: 'single', target: extraSingleId(stat, node.grade) }))
      return EXTRA_STATS.map((stat) => ({ kind: 'single', target: extraSingleId(stat, (node.grade - 1) as typeof node.grade) }))
    }
    case 'bond': return []
  }
}

export type UnlockStatus = { readonly status: 'open' | 'pending' | 'available' } | Refusal

const refSet = (refs: readonly UnlockRef[]): Set<string> => new Set(refs.map(unlockKey))

/** Refused because its layer is later than her scenario: "Opens in scenario 3 · Trackblazer" (05 §3, 06 §2). */
function laterLayer(at: ScenarioAt, entry: Unlock): Refusal {
  const row = scenarioRow(scenarioNumber({ tier: at.tier, scenario: entry.layer }))
  return entry.kind === 'bond'
    ? trainingRefusal('card-era', { card: entry.target, tier: row.tier, scenario: row.scenario, name: row.name })
    : trainingRefusal('later-layer', { unlock: unlockLabel(entry), scenario: row.scenario, name: row.name })
}

function firstUnmet(build: UmaBuild, entry: UnlockRef, made: ReadonlySet<string>): UnlockRef | null {
  return dependenciesOf(entry).find((dep) => !isOpen(build, dep) && !made.has(unlockKey(dep))) ?? null
}

/**
 * An unlock's state for her at `at`: open; pending in her work ahead (`pending`); available to start now; or refused
 * with the reason a locked item shows (a later layer, a card's era, or what it needs first).
 */
export function unlockStatus(build: UmaBuild, at: ScenarioAt, entry: Unlock, pending: readonly UnlockRef[] = []): UnlockStatus {
  if (isOpen(build, entry)) return { status: 'open' }
  const made = refSet(pending)
  if (made.has(unlockKey(entry))) return { status: 'pending' }
  if (entry.layer > at.scenario) return laterLayer(at, entry)
  const unmet = firstUnmet(build, entry, made)
  if (unmet) return trainingRefusal('needs-first', { unlock: unlockLabel(entry), needs: unlockLabel(unmet) })
  return { status: 'available' }
}

/**
 * The next `n` unlocks she can take at a facility and room, in canonical order, each counting the ones before it as
 * made: "the next N nodes" at the Observatory, 05 §3's table order at the Lineage Hall, and at a Gym room its stat's
 * single, Duos in ring order, then the Sun, layer by layer. Items still waiting on something are passed over. The Dojo
 * has no order (a bond names its card), so it gives none.
 */
export function nextUnlocks(
  build: UmaBuild,
  at: ScenarioAt,
  facility: FacilityId,
  room: RoomId | null,
  n: number,
  pending: readonly UnlockRef[] = [],
): readonly Unlock[] {
  if (!isRoomOf(facility, room)) throw new RangeError(`${facility} has no room ${String(room)}`)
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Take a whole number of unlocks: ${n}`)
  if (facility === 'dojo') return []
  const made = refSet(pending)
  const taken: Unlock[] = []
  for (const entry of FIXED_UNLOCKS) {
    if (taken.length >= n) break
    if (entry.layer > at.scenario || facilityOf(entry.kind) !== facility || !roomAccepts(room, entry)) continue
    if (isOpen(build, entry) || made.has(unlockKey(entry))) continue
    if (firstUnmet(build, entry, made)) continue
    taken.push(entry)
    made.add(unlockKey(entry))
  }
  return taken
}

/** One thing left in her layers: an unlock with where it is done and its dish, or bonds still to pick cards for. */
export type RemainingUnlock =
  | {
    readonly kind: 'unlock'
    readonly unlock: Unlock
    readonly layer: ScenarioOfTier
    readonly facility: FacilityId
    /** The first room that takes it, or null without rooms; `rooms` lists every room that does. */
    readonly room: RoomId | null
    readonly rooms: readonly RoomId[]
    readonly grade: Unlock['grade']
    readonly dishId: Unlock['dishId']
  }
  | { readonly kind: 'pick-cards'; readonly layer: ScenarioOfTier; readonly facility: 'dojo'; readonly count: number }

const remaining = (entry: Unlock): RemainingUnlock => {
  const rooms = roomsFor(entry)
  return {
    kind: 'unlock', unlock: entry, layer: entry.layer, facility: facilityOf(entry.kind), room: rooms[0] ?? null, rooms,
    grade: entry.grade, dishId: entry.dishId,
  }
}

/**
 * What is left of her open layers, oldest layer first (02 §6): every fixed unlock not open and not pending, a bond for
 * each `chosen` card she can bond now, and "pick cards" for the rest of each layer's pacing count (6, 3, 3, 3, 3). Bonds
 * already made or pending count toward the pacing, oldest layer first.
 */
export function remainingUnlocks(
  build: UmaBuild,
  at: ScenarioAt,
  chosen: readonly BondCard[],
  pending: readonly UnlockRef[] = [],
): readonly RemainingUnlock[] {
  const made = refSet(pending)
  const T = scenarioNumber(at)
  const seen = new Set<string>()
  const bonds: Unlock[] = []
  for (const card of chosen) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    const status = bondStatus(build, card, T, pending)
    if (isRefusal(status) || status.status !== 'available') continue
    const entry = bondUnlock(card, at.tier, at.scenario)
    if (!isRefusal(entry)) bonds.push(entry)
  }
  const pendingBonds = pending.filter((ref) => ref.kind === 'bond' && !build.bonds.includes(ref.target)).length
  let covered = build.bonds.length + pendingBonds + bonds.length

  const result: RemainingUnlock[] = []
  for (let s = 1 as ScenarioOfTier; s <= at.scenario; s = (s + 1) as ScenarioOfTier) {
    for (const entry of layerUnlocks(s)) if (!isOpen(build, entry) && !made.has(unlockKey(entry))) result.push(remaining(entry))
    for (const entry of bonds) if (entry.layer === s) result.push(remaining(entry))
    const share = BONDS_BY_SCENARIO[s - 1]!
    const count = share - Math.min(share, covered)
    covered = Math.max(0, covered - share)
    if (count > 0) result.push({ kind: 'pick-cards', layer: s, facility: 'dojo', count })
  }
  return result
}

/**
 * Whether layer s is done: every fixed unlock of the layer open, and bonds made up to the pacing count by its end
 * (6, 9, 12, 15, 18). "[Scenario] Fully Trained" (05 §11).
 */
export function layerDone(build: UmaBuild, s: ScenarioOfTier): boolean {
  return layerUnlocks(s).every((entry) => isOpen(build, entry)) && build.bonds.length >= bondsThrough(s)
}

/** Her open Inspiration slots in 05 §5's slot order. */
export const openSlots = (build: UmaBuild): readonly InspirationSlot[] => INSPIRATION_SLOTS.filter((slot) => build.inspiration.slots.includes(slot))
