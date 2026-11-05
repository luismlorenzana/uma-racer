// The operation registry's types (D381): every change to the account is a named operation with a parser and an
// `apply`. Each area defines its own in its `ops.ts` (account, career, build, stages); `save/operations.ts` joins them
// into one table, which `commitOperation` dispatches through. Pure: no clock, no I/O.
import type { RaceTemplate, SkillTemplate, SupportCardTemplate, UmaTemplate } from '../content'
import type { CourseTemplate } from '../content'
import type { RaceEngine } from '../race-attempt'
import type { RaceResultRecord } from './records'
import type { SaveState } from './state'

/** A real rule, in plain words, that stops an operation. It changes nothing and stores nothing. */
export interface Refusal {
  readonly refused: true
  readonly code: string
  readonly reason: string
  readonly data?: Readonly<Record<string, string | number>>
}

export const isRefusal = (value: unknown): value is Refusal =>
  typeof value === 'object' && value !== null && (value as { refused?: unknown }).refused === true

export const refuse = (code: string, reason: string, data?: Readonly<Record<string, string | number>>): Refusal =>
  (data === undefined ? { refused: true, code, reason } : { refused: true, code, reason, data })

/** What every operation reads beyond the state: the content, and whether dev operations may run. */
export interface OperationEnv {
  readonly content: {
    readonly umas: ReadonlyMap<string, UmaTemplate>
    readonly cards: ReadonlyMap<string, SupportCardTemplate>
    readonly skills: ReadonlyMap<string, SkillTemplate>
    readonly races: readonly RaceTemplate[]
    readonly courses: ReadonlyMap<string, CourseTemplate>
  }
  /** The content release the env was built from; races record it. */
  readonly contentVersion: string
  /** True only on an API started with `DEV_OPERATIONS=true`: `dev-grant` runs nowhere else. */
  readonly dev?: boolean
  /**
   * The race engine (`@racer/race`'s `simulateRace` at its version), which the device and the API each hand in so both
   * run a career race and settle it alike (D383). Without it, `run-race` and `run-finale` refuse.
   */
  readonly race?: RaceEngine
}

/** An operation's success: the new state, its receipt, and any race results it ran (written as `raceResults` rows). */
export interface Applied<R = unknown> {
  readonly state: SaveState
  readonly receipt: R
  readonly raceResults?: readonly RaceResultRecord[]
}

export type OpResult<R = unknown> = Applied<R> | Refusal

/** One operation: its name, its input's parser (null when malformed), and its rule. */
export interface OperationDef<I = unknown, R = unknown> {
  readonly name: string
  readonly parse: (value: unknown) => I | null
  readonly apply: (state: SaveState, input: I, now: number, env: OperationEnv, id: string) => OpResult<R>
}

/**
 * Any operation, in a table of them. `any` because each holds its own input type: the table only passes a parsed input
 * back to the same definition's `apply`, so the pairing is sound.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyOperationDef = OperationDef<any, unknown>

/** An operation definition, typed by its input and receipt. */
export const defineOperation = <I, R>(def: OperationDef<I, R>): OperationDef<I, R> => Object.freeze(def)

/**
 * A declared operation whose rules land in a later part of M036: its name is valid on the wire, and it refuses in plain
 * words until its part replaces it.
 */
export const notBuiltYet = (name: string, part: string): OperationDef<object, never> => defineOperation<object, never>({
  name,
  parse: (value) => (typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null),
  apply: () => refuse('not-built-yet', `That isn't built yet (${part}).`),
})
