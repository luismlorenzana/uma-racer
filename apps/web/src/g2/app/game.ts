// The game port (T137; docs/rework/11-hub-and-places.md §2; docs/rework/02-check-ins-and-notifications.md §8–§9): the
// shell and every place read the game only through `G2Game`. `boot.ts` creates it lazily: the in-memory port over
// synthetic seeds on the dev mount, or T136's device save (`g2/save`), whose `useSave` store adapts to it one to one:
// - `status` is the store's `lifecycle` (`booting`, `ready`, `error`, with its `words`), `trainerName` the trainer
//   badge row's display name;
// - `sync` is the chip's state: `paused` while signed out (today's `useAuth`), `offline`, `failing` (red) on `error`,
//   `waiting` (amber, D157) when `oldestQueuedAt` is over a day old, else `synced`;
// - `run` builds the operation's id, runs the domain's `recheck` and answers with it, the id riding along;
// - `notices` are the taps the server refused or couldn't run, in plain words, until a screen dismisses them (T136;
//   09 §8: "the local purchase rolls back with a notice"); `syncNow` and `logs` are the save's too;
// - `badges` are the device's own badge rows (bounded: one per Uma and the trainer), and `logs` also read every race
//   result and the flair events (T141). A tap's `device` rows (T141's flair) are computed from the applied operation
//   and written in its local transaction, queued behind it in the one lane; `writeDevice` writes them alone (the Trophy
//   Hall's reconcile), as today's badge preferences are.
// Only types come from the domain here, so this file costs the entry chunk nothing but the hooks.
import type { BadgeStateV1, FlairEventV1 } from '@racer/domain'
import type { HubView, hubView } from '@racer/domain/hub'
import type { Answer, OperationEnv, OperationInput, OperationName, OperationReceipt, Words } from '@racer/domain/rework/check-in'
import type { LedgerEntry } from '@racer/domain/rework/tiers'
import type { WorkState } from '@racer/domain/rework/work'
import type { ItemLedgerRow, RaceResultRow } from '@racer/domain/save-g2'
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import type { Clock } from './clock'

export type G2Status = 'booting' | 'ready' | 'error'

/** The Sync chip (rework/11 §2.1, D157): hidden when `synced`. */
export type G2Sync = 'synced' | 'offline' | 'paused' | 'waiting' | 'failing'

/** An operation's receipt on this device, and the server's once it answers (02 §9: "Already collected" in place). */
export interface G2Receipt {
  readonly local: unknown
  readonly server?: unknown
}

/** A tap the server refused or couldn't run (T136): the tap's id, its words for the screen to fill, and the filled text. */
export interface G2Notice {
  readonly id: string
  readonly words: Words
  readonly text: string
}

export interface G2Snapshot {
  readonly status: G2Status
  /** The rework state; null until the save opens. */
  readonly state: WorkState | null
  /** What every operation and query reads beyond the state; null until the save opens. */
  readonly env: OperationEnv | null
  readonly trainerName: string
  readonly sync: G2Sync
  /** The latest operations' receipts, by operation. */
  readonly receipts: Readonly<Record<string, G2Receipt>>
  /** Why the save can't open, in plain words, when `status` is `error`. */
  readonly words?: string
  /** Refused or failed taps, oldest first; absent on a port that saves nothing. */
  readonly notices?: readonly G2Notice[]
  /** The device's badge rows by row id (`trainer`, `uma:<outfitId>`); absent until the save opens (T141). */
  readonly badges?: Readonly<Record<string, BadgeStateV1>>
}

/** What the Racing places read beyond the rules' state (T141): race results by operation id, badges, flair by event id. */
export interface G2Records {
  readonly raceResults: Readonly<Record<string, RaceResultRow>>
  readonly badges: Readonly<Record<string, BadgeStateV1>>
  readonly flairEvents: Readonly<Record<string, FlairEventV1>>
}

export const NO_RECORDS: G2Records = Object.freeze({ raceResults: {}, badges: {}, flairEvents: {} })

/** A flair event's key in the records: one award stage, as its row id names it (`flairEventId`'s parts, unhashed). */
export const flairKeyOf = (event: Pick<FlairEventV1, 'scope' | 'umaId' | 'awardKey' | 'stage'>): string =>
  `${event.scope}/${event.umaId ?? ''}/${event.awardKey}/${event.stage}`

/** Rows the device writes (13 §6's device kinds): a badge state replaces its row, a flair event is written once. */
export interface G2DeviceRows {
  readonly badges?: Readonly<Record<string, BadgeStateV1>>
  readonly flairEvents?: readonly FlairEventV1[]
}

/** An applied operation, as its `device` callback sees it: before and after, the receipt, and the records with its own rows. */
export interface G2Applied<N extends OperationName = OperationName> {
  readonly id: string
  readonly name: N
  readonly at: number
  readonly before: WorkState
  readonly state: WorkState
  readonly receipt: OperationReceipt<N>
  readonly records: G2Records
}

export interface G2RunOptions<N extends OperationName = OperationName> {
  /** The device's rows for an operation that applied now (not a repeat), written in its transaction: T141's flair. */
  readonly device?: (applied: G2Applied<N>) => G2DeviceRows
}

/** `recheck`'s answer (T131: done, ask or say), with the operation's id so a sheet can find its receipt again. */
export type G2Answer<N extends OperationName = OperationName> = Answer<N, WorkState> & { readonly id: string }

export interface G2Game {
  subscribe(listener: () => void): () => void
  getSnapshot(): G2Snapshot
  /** The game's clock, integer milliseconds. */
  now(): number
  /** The device's offset from UTC at `now`, in minutes, for check-in times. */
  utcOffsetMin(now: number): number
  /**
   * One tap: applied at once through `recheck`, never twice; a second tap while `busyKey` is held gets the first's answer.
   * `options.device` adds the device's rows to the same local transaction (T141).
   */
  run<N extends OperationName>(name: N, input: OperationInput<N>, busyKey?: string, options?: G2RunOptions<N>): Promise<G2Answer<N>>
  /** The device's own rows, alone (the Trophy Hall's reconcile, T141); absent on a port that writes none. */
  writeDevice?(rows: G2DeviceRows): Promise<void>
  /** Clears a notice once the screen has shown it. */
  dismissNotice?(id: string): void
  /** Account's Sync now: a flush and a pull at once (T136); absent on a port that saves nothing. */
  syncNow?(): Promise<void>
  /** The logs the store doesn't hold, read on demand with the queued taps' own rows (T136). */
  readonly logs?: G2Logs
}

/** The save's logs, read when a screen needs them: never loaded into the snapshot. */
export interface G2Logs {
  /** One Uma's race results, oldest first. */
  raceResults(umaId: string): Promise<RaceResultRow[]>
  /** Every Uma's race results, by time (T141: the Trainer's records and the Trophy Hall). */
  allRaceResults?(): Promise<RaceResultRow[]>
  /** The flair events, by time (T141: the result's flair, the Trophy Hall and its counter). */
  flairEvents?(): Promise<FlairEventV1[]>
  /** The whole ledger, by time. */
  ledgerRows(): Promise<LedgerEntry[]>
  /** The Warehouse's movements, by time. */
  itemLedgerRows(): Promise<ItemLedgerRow[]>
  /** An operation's receipt: the snapshot's latest, else the server's from the operations log. */
  receipt(id: string): Promise<unknown>
}

/** The rules the shell runs, loaded with the port so the entry chunk holds none of them. */
export interface G2Rules {
  readonly hubView: typeof hubView
}

export interface G2Runtime {
  readonly game: G2Game
  readonly rules: G2Rules | null
  readonly clock: Clock
}

const EMPTY: G2Snapshot = Object.freeze({ status: 'booting', state: null, env: null, trainerName: '', sync: 'synced', receipts: {} })

const deviceOffset = (now: number): number => -new Date(now).getTimezoneOffset()

/** The port while the real one loads: a quiet frame, no state, and taps that wait for nothing. */
export const BOOTING_GAME: G2Game = Object.freeze({
  subscribe: () => () => {},
  getSnapshot: () => EMPTY,
  now: () => Date.now(),
  utcOffsetMin: deviceOffset,
  run: () => Promise.reject(new Error('The game is still opening.')),
})

/** A port that couldn't open: the shell shows why, with Try again and Copy details, and offers to clear nothing. */
export function errorGame(words: string): G2Game {
  const snapshot: G2Snapshot = Object.freeze({ ...EMPTY, status: 'error', words })
  return { ...BOOTING_GAME, getSnapshot: () => snapshot }
}

export const RuntimeContext = createContext<G2Runtime | null>(null)

export function useRuntime(): G2Runtime {
  const runtime = useContext(RuntimeContext)
  if (runtime === null) throw new Error('The new game needs its GameProvider')
  return runtime
}

/** The snapshot, re-read whenever the port publishes. */
export function useSnapshot(): G2Snapshot {
  const { game } = useRuntime()
  return useSyncExternalStore(game.subscribe, game.getSnapshot, game.getSnapshot)
}

/** A slice of the snapshot. The selector runs on every publish, so keep it cheap. */
export function useGame<T>(selector: (snapshot: G2Snapshot) => T): T {
  return selector(useSnapshot())
}

/** The one 30-second clock (rework/11 §4, 02 §8): stops while the page is hidden, ticks again on return; writes nothing. */
export function useNow(): number {
  const { clock } = useRuntime()
  return useSyncExternalStore(clock.subscribe, clock.get, clock.get)
}

/** The Hub's view at the clock's `now`, or null until the save and the rules have loaded. */
export function useHub(): HubView | null {
  const { rules } = useRuntime()
  const { state, env } = useSnapshot()
  const now = useNow()
  return useMemo(() => (rules !== null && state !== null && env !== null ? rules.hubView(state, now, env) : null), [rules, state, env, now])
}

/** The port's `run`, for a tap. */
export function useRun(): G2Game['run'] {
  const { game } = useRuntime()
  return useMemo(() => game.run.bind(game), [game])
}
