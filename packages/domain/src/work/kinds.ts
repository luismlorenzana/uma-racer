// The kinds of work the engine runs (docs/game/architecture.md#the-rework-modules; docs/game/07-farm.md §2; docs/game/05-training-hub.md
// §2). A kind plans a request into items (seconds, inputs, output and Farm EXP each) and pays finished outputs. The
// engine owns everything else: slots, reserving, the clock, queues, collect, recall and Speed Tickets. T127 registers
// gather, craft and cook, and T128's `session` (rework/training) joins them; a caller may pass its own table in
// `env.kinds` (the tests' synthetic session kind does).
import { cookKind, craftKind, gatherKind } from '../farm/jobs'
import { sessionKind } from '../training/sessions'
import type { RecipeInput } from '../items/recipes'
import type { Refusal } from '../state/types'
import type { SlotRef, WorkContent, WorkKind, WorkOutput, WorkRequest, WorkState } from './types'

/** One planned item. */
export interface PlannedItem {
  /** Its seconds at the building's speed now: `workSeconds(base, speed)`. */
  readonly seconds: number
  /** What it takes from the Warehouse, reserved when its entry starts. */
  readonly inputs: readonly RecipeInput[]
  readonly output: WorkOutput
  /** Farm EXP in quarter points, fixed now (07 §4); 0 for a session. */
  readonly farmExp: number
}

/** What the engine tells a kind about the request it plans. */
export interface PlanContext {
  /** The slot it would run in: its building (and room) decide what is made there. */
  readonly slot: SlotRef
  /** The building's speed now (07 §2: frozen into the entry when it starts). */
  readonly speed: number
  /**
   * Her requests ahead of this one, oldest first: her started entries, made or not, then the queued requests before
   * it. A kind counts them as made, so a queued session continues in order (T128's dependencies).
   */
  readonly earlier: readonly WorkRequest[]
  readonly env: WorkEnv
}

export interface PayContext {
  readonly now: number
  readonly env: WorkEnv
}

export interface WorkKindRules {
  /**
   * Plans `request` for `outfitId` at `now`: its items, or a refusal (`not-here`, `grade`, or the kind's own). It never
   * checks stock; the engine reserves what the items name.
   */
  plan(state: WorkState, outfitId: string, request: WorkRequest, now: number, context: PlanContext): readonly PlannedItem[] | Refusal
  /** Pays finished outputs, oldest first: Farm items into the Warehouse, a session's unlocks into her build (T128). */
  pay<S extends WorkState>(state: S, outfitId: string, outputs: readonly WorkOutput[], context: PayContext): { readonly state: S; readonly detail?: unknown }
}

export type WorkKinds = Readonly<Partial<Record<WorkKind, WorkKindRules>>>

/** The registered kinds: the Farm's three and T128's Training Hub sessions. */
export const WORK_KINDS: WorkKinds = Object.freeze({ gather: gatherKind, craft: craftKind, cook: cookKind, session: sessionKind })

/** What every operation and settle read beyond the state: the content, and the kinds if not `WORK_KINDS`. */
export interface WorkEnv {
  readonly content: WorkContent
  readonly kinds?: WorkKinds
}

/** The rules for `kind`, or undefined when nothing registered it. */
export const kindRules = (env: WorkEnv, kind: WorkKind): WorkKindRules | undefined => (env.kinds ?? WORK_KINDS)[kind]
