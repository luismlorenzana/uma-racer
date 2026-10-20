// Training Hub sessions on T127's work engine (docs/game/05-training-hub.md §2): 1–10 unlocks of one facility, one
// room at the Gym and Dojo, one after another, each paid with the one item it takes (or none, D375) and lasting
// 180 + 15(g − 1) base minutes × TIME_FACTOR ÷ the facility's speed. The engine (`work`) runs the slot, the items, the
// clock, queues, collect, recall and Speed Tickets; this is the `session` kind it registers: `plan` checks a request
// where its slot is and lists each unlock's item and seconds, and `pay` commits finished unlocks into her build.
import { isFacility, type FacilityId } from '../../farm/buildings'
import { itemById, takeFor, type ItemId } from '../../items/catalogue'
import { assertNow, withUma } from '../../tiers/ledger'
import { tierRefusal } from '../../tiers/refusals'
import { isRefusal, type Refusal, type Tier, type UmaState } from '../../state/types'
import type { PayContext, PlanContext, PlannedItem, WorkKindRules } from '../kinds'
import { workRefusal } from '../refusals'
import { SESSION_KIND, type ItemStock, type WorkContent, type WorkOutput, type WorkRequest, type WorkState } from '../types'
import { cardTypesIn } from '../../training/bonds'
import { commitUnlocks, type CommitReceipt } from '../../training/build'
import { lowerGrade } from '../../training/extra'
import { roomAccepts } from '../../training/facilities'
import { unlockStatus } from '../../training/order'
import { trainingRefusal } from '../../training/refusals'
import {
  SESSION_MAX_UNLOCKS, SESSION_MIN_UNLOCKS, UNLOCK_KINDS, bondUnlock, facilityOf, fixedUnlock, sessionSeconds,
  unlockKey, unlockLabel, type Unlock, type UnlockKind, type UnlockRef,
} from '../../training/unlocks'

/** What a session's pay reports in the collect receipt's `paid`: every opening and every newly bonded card (06 §7). */
export interface SessionPaid extends CommitReceipt {
  readonly umaId: string
}

/** A request's unlocks as refs (`{ kind, target }`), or the full unlocks the rules give, which carry both. */
type AnyRef = { readonly kind: string; readonly target: string }

const isUnlockKind = (kind: string): kind is UnlockKind => (UNLOCK_KINDS as readonly string[]).includes(kind)

/**
 * A bond unlock as this module wrote it into an entry: its grade is its layer's lower one, and it takes no item, or,
 * written before D375, a planet dish of that grade.
 */
function storedBond(ref: AnyRef): Unlock | null {
  const entry = ref as Partial<Unlock>
  if (typeof entry.layer !== 'number' || typeof entry.grade !== 'number' || entry.dishId === undefined) return null
  if (entry.grade !== lowerGrade(entry.layer as Unlock['layer'])) return null
  if (entry.dishId !== null) {
    const dish = itemById(entry.dishId)
    if (dish?.kind !== 'dish' || dish.dish !== 'planet' || dish.grade !== entry.grade) return null
  }
  return { kind: 'bond', target: ref.target, layer: entry.layer as Unlock['layer'], grade: entry.grade, dishId: entry.dishId }
}

/**
 * The unlock a ref names for her tier: a fixed one from the layers, or a bond from the card catalogue (its era and type
 * decide its layer and dish). A card whose era is past her tier is refused; an unknown kind or target, or a bond whose
 * card the content lacks, is a caller's bug and throws. `stored` accepts a bond this module already wrote into an entry.
 */
export function resolveUnlock(ref: AnyRef, tier: Tier, content: Pick<WorkContent, 'cards'>, stored = false): Unlock | Refusal {
  if (!isUnlockKind(ref.kind)) throw new RangeError(`No unlock kind ${ref.kind}`)
  if (ref.kind !== 'bond') {
    const fixed = fixedUnlock({ kind: ref.kind, target: ref.target })
    if (!fixed) throw new RangeError(`No ${ref.kind} ${ref.target} in a tier's layers`)
    return fixed
  }
  const card = content.cards?.get(ref.target)
  if (card) return bondUnlock(card, tier, 5)
  const kept = stored ? storedBond(ref) : null
  if (kept) return kept
  throw new RangeError(`No card ${ref.target} to bond`)
}

/** Her session unlocks ahead of a request: every unlock of her earlier requests, made or not (T127's `earlier`). */
export const unlocksAhead = (earlier: readonly WorkRequest[]): readonly UnlockRef[] =>
  earlier.flatMap((request) => (request.kind === SESSION_KIND ? request.unlocks.filter((ref): ref is UnlockRef => isUnlockKind(ref.kind)) : []))

/**
 * What each unlock takes out of `stock`, in order (D375): its item, a stand-in first (a retired salad or soup for a
 * tonic), or nothing for an unlock that takes none. An item the stock doesn't hold is still named, so the engine's
 * shortfall says what to make.
 */
export function sessionInputs(unlocks: readonly Pick<Unlock, 'dishId'>[], stock: ItemStock): readonly (ItemId | null)[] {
  const left = new Map(Object.entries(stock))
  return unlocks.map((entry) => (entry.dishId === null ? null : takeFor(left, entry.dishId) ?? entry.dishId))
}

/**
 * `plan` for a session (05 §2): at a facility's slot, 1–10 unlocks of that facility and room, none open or already on
 * her list, each allowed now with her earlier requests and the session's earlier unlocks counted as made. Each item
 * takes the one item its unlock takes, or none (`sessionInputs`), and lasts `workSeconds(base, speed)`; a session
 * earns no Farm EXP.
 */
export function planSession(state: WorkState, outfitId: string, request: WorkRequest, now: number, context: PlanContext): readonly PlannedItem[] | Refusal {
  assertNow(now)
  if (request.kind !== SESSION_KIND || !isFacility(context.slot.building)) return workRefusal('not-here')
  const uma = state.umas[outfitId]
  if (!uma) return tierRefusal('unknown-uma', { uma: outfitId })
  const facility: FacilityId = context.slot.building
  const room = context.slot.room ?? null
  const count = request.unlocks.length
  if (count < SESSION_MIN_UNLOCKS || count > SESSION_MAX_UNLOCKS) return trainingRefusal('session-size', { max: SESSION_MAX_UNLOCKS })

  const unlocks: Unlock[] = []
  for (const ref of request.unlocks) {
    const entry = resolveUnlock(ref, uma.tier, context.env.content)
    if (isRefusal(entry)) return entry
    unlocks.push(entry)
  }
  const facilities = new Set(unlocks.map((entry) => facilityOf(entry.kind)))
  if (facilities.size > 1) return trainingRefusal('mixed-facility')
  if (!facilities.has(facility)) return workRefusal('not-here')
  const misplaced = unlocks.find((entry) => !roomAccepts(room, entry, cardTypesIn(context.env.content.cards)))
  if (misplaced) return trainingRefusal('wrong-room', { unlock: unlockLabel(misplaced), room: room ?? '' })

  const made: UnlockRef[] = [...unlocksAhead(context.earlier)]
  const listed = new Set(made.map(unlockKey))
  const inputs = sessionInputs(unlocks, state.items)
  const items: PlannedItem[] = []
  for (const [i, entry] of unlocks.entries()) {
    if (listed.has(unlockKey(entry))) return trainingRefusal('duplicate', { item: unlockLabel(entry) })
    const status = unlockStatus(uma.build, uma, entry, made)
    if (isRefusal(status)) return status
    if (status.status === 'open') {
      return entry.kind === 'bond'
        ? trainingRefusal('already-bonded', { card: entry.target, uma: outfitId })
        : trainingRefusal('already-open', { unlock: unlockLabel(entry) })
    }
    listed.add(unlockKey(entry))
    made.push(entry)
    const item = inputs[i]!
    items.push(Object.freeze({
      seconds: sessionSeconds(entry.grade, context.speed),
      inputs: item === null ? [] : [Object.freeze({ item, qty: 1 })],
      output: Object.freeze({ unlock: entry }),
      exp: 0,
    }))
  }
  return items
}

/**
 * `pay` for a session: Collect commits exactly the finished unlocks, in order, into her build (05 §2). Its detail lists
 * every opening and every newly bonded card, which the collect receipt carries in `paid`.
 */
export function paySession<S extends WorkState>(state: S, outfitId: string, outputs: readonly WorkOutput[], context: PayContext): { readonly state: S; readonly detail: SessionPaid } {
  const uma: UmaState | undefined = state.umas[outfitId]
  if (!uma) throw new RangeError(`No Uma ${outfitId} to pay`)
  const unlocks = outputs.map((output) => {
    if (!('unlock' in output)) throw new RangeError('A session pays unlocks only')
    const entry = resolveUnlock(output.unlock, uma.tier, context.env.content, true)
    if (isRefusal(entry)) throw new RangeError(`${unlockKey(output.unlock as UnlockRef)} can't be paid: ${entry.code}`)
    return entry
  })
  const committed = commitUnlocks(uma.build, uma, unlocks)
  return {
    state: committed.build === uma.build ? state : withUma(state, { ...uma, build: committed.build }),
    detail: { umaId: outfitId, ...committed.receipt },
  }
}

/** The `session` kind, registered in T127's `WORK_KINDS` beside gather, craft and cook. */
export const sessionKind: WorkKindRules = Object.freeze({ plan: planSession, pay: paySession })

/** A session request for these unlocks, in order. */
export const sessionRequest = (unlocks: readonly AnyRef[]): WorkRequest => ({ kind: SESSION_KIND, unlocks })
