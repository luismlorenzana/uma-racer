// The work engine's state and shapes (docs/rework/07-farm.md §2, §5, §12; docs/rework/05-training-hub.md §2, §9;
// docs/rework/02-check-ins-and-notifications.md §3, §10; docs/rework/13-removals-and-plan-changes.md §6). One engine
// runs every timed thing an Uma does, a Farm job or a Training Hub session: 1–10 items one after another in one slot,
// with up to three requests queued behind. Only timestamps are stored. T127 widens T125's `ReworkState` with the three
// parts it needs (the Warehouse's free stock, building levels and the work rows) rather than editing it, so T125's
// operations and tests carry these parts through untouched.
import type { UmaTemplate } from '../../content'
import type { ItemId } from '../items/catalogue'
import type { RecipeInput } from '../items/recipes'
import type { Refusal, ReworkState } from '../types'
import type { BuildingId, BuildingLevel, RoomId } from '../farm/buildings'

/** One slot: a building, its room at the Gym and Dojo (absent elsewhere), and the slot index from 0. */
export interface SlotRef {
  readonly building: BuildingId
  readonly room?: RoomId
  readonly slot: number
}

/** The Farm's three kinds of work (07 §2). */
export type FarmKind = 'gather' | 'craft' | 'cook'
/** T128's session kind, registered by whichever of T127 and T128 lands second. */
export const SESSION_KIND = 'session'
export type SessionKind = typeof SESSION_KIND

/** A Farm job's request: 1–10 of one item (07 §2). */
export interface FarmRequest {
  readonly kind: FarmKind
  readonly item: ItemId
  readonly count: number
}

/**
 * One unlock a session makes, by T128's refs: what it opens (`kind`, e.g. a node) and which one (`target`, e.g.
 * `n6`). T128 owns the values and may pass its full unlocks, which carry these two fields.
 */
export interface UnlockRef {
  readonly kind: string
  readonly target: string
}

/** A session's request: 1–10 unlocks in order (05 §2). */
export interface SessionRequest {
  readonly kind: SessionKind
  readonly unlocks: readonly UnlockRef[]
}

export type WorkRequest = FarmRequest | SessionRequest
export type WorkKind = WorkRequest['kind']

/** What one finished item pays: a Farm item into the Warehouse, or one of a session's unlocks (T128). */
export type WorkOutput = { readonly item: ItemId } | { readonly unlock: UnlockRef }

/** One started request: its items' frozen plan and its clock (07 §2 "The clock", 05 §9). */
export interface Entry {
  readonly request: WorkRequest
  /** Each item's seconds at the frozen speed. */
  readonly seconds: readonly number[]
  /** Each item's inputs, reserved when the entry started. */
  readonly inputs: readonly (readonly RecipeInput[])[]
  /** Each item's output. */
  readonly outputs: readonly WorkOutput[]
  /** Each item's Farm EXP in quarter points, fixed at the start (0 for a session). */
  readonly farmExp: readonly number[]
  /** When it started, integer milliseconds since the epoch. */
  readonly startedAt: number
  /** Milliseconds taken off by Speed Tickets: every item's end moves this much earlier (07 §8). */
  readonly acceleratedMs: number
  /** Items already paid by Collect; never falls. */
  readonly collected: number
  /** The building's speed when it started (07 §2: "frozen into the job"). */
  readonly speed: number
  /** True when a queue started it (07 §2 "Queue start"). */
  readonly fromQueue: boolean
}

/** Her last finished work, for Repeat (02 §5, 07 §9): where and what. Cleared by Recall. */
export interface LastWork {
  readonly slot: SlotRef
  readonly request: WorkRequest
}

/** A queue that couldn't start its next entry (07 §2, 02 §3): kept until the owner restarts or dismisses it (T131). */
export interface DroppedQueue {
  /** When the entry would have started. */
  readonly at: number
  readonly slot: SlotRef
  /** The entry that couldn't start and every one behind it, in order. */
  readonly requests: readonly WorkRequest[]
  /** What the free stock lacked for the first one, item by item; empty when its plan was refused instead. */
  readonly short: readonly RecipeInput[]
  /** The plan's refusal when it was refused for another reason (T128's rules), else null. */
  readonly refused: Refusal | null
}

/** `work/{outfitId}` (13 §6, 07 §12): her started entries, oldest first, her queue, her last work and a dropped queue. */
export interface WorkRow {
  readonly outfitId: string
  /** The slot her entries hold; null once Collect or Recall frees it. */
  readonly slot: SlotRef | null
  /** Started entries, oldest first; only the last can still be running. Empty when she is Free. */
  readonly entries: readonly Entry[]
  /** Up to three requests behind the running entry, at the same place. Nothing is reserved for them. */
  readonly queue: readonly WorkRequest[]
  readonly last: LastWork | null
  readonly dropped: DroppedQueue | null
}

/** The Warehouse's free stock, `items/{itemId}` (13 §6): reserved inputs have left it and sit in work entries. */
export type ItemStock = Readonly<Record<ItemId, number>>

/** `buildings/{id}` (07 §12, 05 §9): each building's level. Slots are held by work rows. */
export type BuildingLevels = Readonly<Record<BuildingId, { readonly level: BuildingLevel }>>

/** T125's state with the work engine's parts. A caller's wider state (T130's profile fields) passes through. */
export interface WorkState extends ReworkState {
  readonly items: ItemStock
  readonly buildings: BuildingLevels
  readonly work: Readonly<Record<string, WorkRow>>
}

/** What the engine reads of the content: her running aptitudes for Farm EXP (07 §3). T125's `TierContent` fits. */
export interface WorkContent {
  readonly umas: ReadonlyMap<string, Pick<UmaTemplate, 'aptitudes'>>
}

/** One movement of Warehouse stock, so phase 3 can write `itemLedger` from a receipt (07 §12, 09 §9). */
export interface ItemMovement {
  readonly kind: 'reserve' | 'return' | 'output' | 'cost' | 'ticket'
  readonly item: ItemId
  readonly qty: number
  /** Whose work moved it; null for an upgrade's cost. */
  readonly outfitId: string | null
  /** When it applied: a queued start's moment, else the operation's `now`. */
  readonly at: number
}

/** A queued entry that started during a settle. */
export interface QueueStart {
  readonly outfitId: string
  readonly slot: SlotRef
  readonly at: number
  readonly request: WorkRequest
}

/** What settling did: queue starts and drops in time order, and the stock they reserved. */
export interface SettleReport {
  readonly started: readonly QueueStart[]
  readonly dropped: readonly (DroppedQueue & { readonly outfitId: string })[]
  readonly movements: readonly ItemMovement[]
}

/** An operation that never refuses: Collect, Recall and the race-start collect (02 §9). */
export interface Done<R, S> {
  readonly state: S
  readonly receipt: R
}
