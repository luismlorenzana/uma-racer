// Training Hub sessions on T127's work engine (docs/rework/05-training-hub.md §2): 1–10 unlocks of one facility, one
// room at the Gym and Dojo, one after another, each paid with its one exact dish and lasting 180 + 15(g − 1) base
// minutes × TIME_FACTOR ÷ the facility's speed. The engine (`work`) runs the slot, the dishes, the clock, queues,
// collect, recall and Speed Tickets; this is the `session` kind it registers: `plan` checks a request where its slot
// is and lists each unlock's dish and seconds, and `pay` commits finished unlocks into her build.
import { isFacility, type FacilityId } from '../farm/buildings'
import { itemById } from '../items/catalogue'
import { assertNow, withUma } from '../tiers/ledger'
import { tierRefusal } from '../tiers/refusals'
import { isRefusal, type Refusal, type Tier, type UmaState } from '../state/types'
import type { PayContext, PlanContext, PlannedItem, WorkKindRules } from '../work/kinds'
import { workRefusal } from '../work/refusals'
import { SESSION_KIND, type WorkContent, type WorkOutput, type WorkRequest, type WorkState } from '../work/types'
import { BOND_FAMILY } from './bonds'
import { commitUnlocks, type CommitReceipt } from './build'
import { lowerGrade } from './extra'
import { roomAccepts } from './facilities'
import { unlockStatus } from './order'
import { trainingRefusal } from './refusals'
import {
  SESSION_MAX_UNLOCKS, SESSION_MIN_UNLOCKS, UNLOCK_KINDS, bondUnlock, facilityOf, fixedUnlock, sessionSeconds,
  unlockKey, unlockLabel, type Unlock, type UnlockKind, type UnlockRef,
} from './unlocks'

/** What a session's pay reports in the collect receipt's `paid`: every opening and every newly bonded card (06 §7). */
export interface SessionPaid extends CommitReceipt {
  readonly umaId: string
}

/** A request's unlocks as refs (`{ kind, target }`), or the full unlocks the rules give, which carry both. */
type AnyRef = { readonly kind: string; readonly target: string }

const isUnlockKind = (kind: string): kind is UnlockKind => (UNLOCK_KINDS as readonly string[]).includes(kind)

/** A bond unlock as this module wrote it into an entry: its layer, grade and dish agree with a bond's dish rule. */
function storedBond(ref: AnyRef): Unlock | null {
  const entry = ref as Partial<Unlock>
  if (typeof entry.layer !== 'number' || typeof entry.grade !== 'number' || typeof entry.dishId !== 'string') return null
  const dish = itemById(entry.dishId)
  const families: readonly string[] = Object.values(BOND_FAMILY)
  if (dish?.kind !== 'dish' || dish.dish !== 'planet' || !families.includes(dish.family) || dish.grade !== entry.grade) return null
  if (entry.grade !== lowerGrade(entry.layer as Unlock['layer'])) return null
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
 * `plan` for a session (05 §2): at a facility's slot, 1–10 unlocks of that facility and room, none open or already on
 * her list, each allowed now with her earlier requests and the session's earlier unlocks counted as made. Each item
 * takes its one dish and lasts `workSeconds(base, speed)`; a session earns no Farm EXP.
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
  const misplaced = unlocks.find((entry) => !roomAccepts(room, entry))
  if (misplaced) return trainingRefusal('wrong-room', { unlock: unlockLabel(misplaced), room: room ?? '' })

  const made: UnlockRef[] = [...unlocksAhead(context.earlier)]
  const listed = new Set(made.map(unlockKey))
  const items: PlannedItem[] = []
  for (const entry of unlocks) {
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
    items.push(Object.freeze({
      seconds: sessionSeconds(entry.grade, context.speed),
      inputs: [Object.freeze({ item: entry.dishId, qty: 1 })],
      output: Object.freeze({ unlock: entry }),
      farmExp: 0,
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
