// The planner's targets (docs/game/02-check-ins-and-notifications.md §6 "Targets", §10; docs/game/12-economy-and-
// pacing.md §12; uma-rpg's D100): up to five Umas in allocation order, marked by the owner, or, with none marked, the
// five furthest behind: the Umas with the most unlocks left in their open layers. Marking one ends automatic.
import { tierRefusal } from '../tiers/refusals'
import { assertNow } from '../tiers/ledger'
import type { BondCard } from '../training/bonds'
import { remainingUnlocks, type RemainingUnlock } from '../training/order'
import { unlocksAhead } from '../training/sessions'
import type { UnlockRef } from '../training/unlocks'
import type { OpResult, ReworkState } from '../state/types'
import type { WorkRequest, WorkRow } from '../work/types'
import { checkInRefusal } from '../check-in/words'

/** Up to five targets (02 §6, uma-rpg's D100). */
export const MAX_TARGETS = 5
/** With none marked, the five furthest behind (02 §6, 12 §12). */
export const AUTO_TARGETS = 5

/** The cards the owner has picked to bond next, per Uma (02 §6): an input, never saved (13 §6). */
export type ChosenCards = Readonly<Record<string, readonly BondCard[]>>

/** Every unlock of her work ahead, made or not (T127's `earlier`, T128's `unlocksAhead`): started entries, then queued. */
export function workAhead(row: Pick<WorkRow, 'entries' | 'queue'> | undefined): readonly UnlockRef[] {
  if (row === undefined) return []
  const requests: WorkRequest[] = [...row.entries.map((entry) => entry.request), ...row.queue]
  return unlocksAhead(requests)
}

/** What is left of her open layers (T128), less her work ahead, with the bonds she has chosen cards for. */
export function remainingFor(state: ReworkState, outfitId: string, chosen: ChosenCards = {}): readonly RemainingUnlock[] {
  const uma = state.umas[outfitId]
  if (!uma) throw new RangeError(`No Uma ${outfitId}`)
  return remainingUnlocks(uma.build, uma, chosen[outfitId] ?? [], workAhead(state.work[outfitId] as WorkRow | undefined))
}

/** Unlocks left in her open layers: each remaining unlock, and each bond still to pick a card for. */
export const unlocksLeft = (remaining: readonly RemainingUnlock[]): number =>
  remaining.reduce((sum, entry) => sum + (entry.kind === 'unlock' ? 1 : entry.count), 0)

/**
 * The automatic targets (02 §6): the `AUTO_TARGETS` Umas with the most unlocks left in their open layers, only those
 * with some left, ties by outfit id.
 */
export function automaticTargets(state: ReworkState, chosen: ChosenCards = {}): readonly string[] {
  return Object.keys(state.umas)
    .map((outfitId) => ({ outfitId, left: unlocksLeft(remainingFor(state, outfitId, chosen)) }))
    .filter(({ left }) => left > 0)
    .sort((a, b) => b.left - a.left || (a.outfitId < b.outfitId ? -1 : a.outfitId > b.outfitId ? 1 : 0))
    .slice(0, AUTO_TARGETS)
    .map(({ outfitId }) => outfitId)
}

/** The targets the planner uses: the owner's, in order, or automatic when none are marked. */
export function targetsOf(state: ReworkState, chosen: ChosenCards = {}): readonly string[] {
  const marked = state.profile.targets.filter((outfitId) => state.umas[outfitId] !== undefined)
  return marked.length > 0 ? marked : automaticTargets(state, chosen)
}

export interface TargetsReceipt {
  readonly targets: readonly string[]
  /** True when the list is empty, so the planner picks the five furthest behind. */
  readonly automatic: boolean
}

/**
 * `set-targets { outfitIds }` (02 §6, §10; 13 §6): up to five owned Umas, in order; an empty list means automatic. An
 * Uma listed twice is a caller's bug and throws.
 */
export function setTargets<S extends ReworkState>(state: S, input: { readonly outfitIds: readonly string[] }, now: number): OpResult<TargetsReceipt, S> {
  assertNow(now)
  const { outfitIds } = input
  if (new Set(outfitIds).size !== outfitIds.length) throw new RangeError(`A target is listed once: ${outfitIds.join(', ')}`)
  if (outfitIds.length > MAX_TARGETS) return checkInRefusal('targets')
  const unknown = outfitIds.find((outfitId) => !state.umas[outfitId])
  if (unknown !== undefined) return tierRefusal('unknown-uma', { uma: unknown })
  const targets = [...outfitIds]
  return { state: { ...state, profile: { ...state.profile, targets } }, receipt: { targets, automatic: targets.length === 0 } }
}
