// The game port (docs/game/11-hub-and-places.md §2; docs/game/architecture.md "The save and sync"; T137, T152): the
// shell and every place read the game only through `RacerGame`. `boot.ts` creates it lazily over the device save
// (`save/`), whose `useSave` store adapts to it one to one:
// - `status` is the store's `lifecycle` (`booting`, `ready`, `error`, with its `words`); `state` generation 3's
//   `SaveState`, and `env` the operations' content, once the save opens;
// - `sync` is the chip's state: `paused` while signed out (the auth provider's), `offline`, `failing` (red) on `error`,
//   `waiting` (amber, D157) when the oldest queued tap is over a day old, else `synced`;
// - `run` is one tap through `commitOperation`, answered `done` or `refused` in plain words, its id riding along;
// - `notices` are the taps the server refused or couldn't run, until a screen dismisses them; `syncNow` and `logs` are
//   the save's too.
// Only types come from the domain here, so this file costs the entry chunk nothing but the hooks.
import type { HubView, hubView } from '@racer/domain/hub'
import type { OperationEnv, OperationRecord, RaceResultRecord, SaveState } from '@racer/domain/save'
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import type { Clock } from './clock'

export type RacerStatus = 'booting' | 'ready' | 'error'

/** The Sync chip (game/11 §2.1, D157): hidden when `synced`. */
export type RacerSync = 'synced' | 'offline' | 'paused' | 'waiting' | 'failing'

/** An operation's receipt on this device, and the server's once it answers. */
export interface RacerReceipt {
  readonly local: unknown
  readonly server?: unknown
}

/** A tap the server refused or couldn't run: the tap's id and its plain words. */
export interface RacerNotice {
  readonly id: string
  readonly text: string
}

export interface RacerSnapshot {
  readonly status: RacerStatus
  /** The account; null until the save opens. */
  readonly state: SaveState | null
  /** What every operation reads beyond the state; null until the save opens. */
  readonly env: OperationEnv | null
  readonly sync: RacerSync
  /** The latest operations' receipts, by operation. */
  readonly receipts: Readonly<Record<string, RacerReceipt>>
  /** Why the save can't open, in plain words, when `status` is `error`. */
  readonly words?: string
  /** Refused or failed taps, oldest first; absent on a port that saves nothing. */
  readonly notices?: readonly RacerNotice[]
}

/**
 * A tap's answer, with the operation's id so a screen can find its receipt again: `done` (applied now, or `repeated`),
 * or `refused` with the rule's plain words (`code` is for the screen's logic, never shown).
 */
export type RacerAnswer<R = unknown> =
  | { readonly kind: 'done'; readonly id: string; readonly state: SaveState; readonly receipt: R; readonly repeated: boolean }
  | { readonly kind: 'refused'; readonly id: string; readonly code: string; readonly text: string }

export interface RacerGame {
  subscribe(listener: () => void): () => void
  getSnapshot(): RacerSnapshot
  /** The game's clock, integer milliseconds. */
  now(): number
  /** One tap: applied at once through `commitOperation`, never twice; a second tap while `busyKey` is held gets the first's answer. */
  run<R = unknown>(name: string, input: unknown, busyKey?: string): Promise<RacerAnswer<R>>
  /** Clears a notice once the screen has shown it. */
  dismissNotice?(id: string): void
  /** Account's Sync now: a flush and a pull at once; absent on a port that saves nothing. */
  syncNow?(): Promise<void>
  /** The logs the store doesn't hold, read on demand with the queued taps' own rows. */
  readonly logs?: RacerLogs
  /** Account's Sign in and Sign out: the auth provider's. Absent where nobody signs in (auth off). */
  signIn?(): Promise<void>
  signOut?(): Promise<void>
}

/** The save's logs, read when a screen needs them: never loaded into the snapshot. */
export interface RacerLogs {
  /** One Uma's race results, by time. */
  raceResults(umaId: string): Promise<RaceResultRecord[]>
  /** An operation's receipt: the snapshot's latest, else the server's from the operations log. */
  receipt(id: string): Promise<unknown>
  /** An operation's log row (its name, time and receipt): a queued tap's own, else the confirmed one; null when neither. */
  operation(id: string): Promise<OperationRecord | null>
}

/** The rules the shell runs, loaded with the port so the entry chunk holds none of them. */
export interface RacerRules {
  readonly hubView: typeof hubView
}

export interface RacerRuntime {
  readonly game: RacerGame
  readonly rules: RacerRules | null
  readonly clock: Clock
}

const EMPTY: RacerSnapshot = Object.freeze({ status: 'booting', state: null, env: null, sync: 'synced', receipts: {} })

/** The port while the real one loads: a quiet frame, no state, and taps that wait for nothing. */
export const BOOTING_GAME: RacerGame = Object.freeze({
  subscribe: () => () => {},
  getSnapshot: () => EMPTY,
  now: () => Date.now(),
  run: () => Promise.reject(new Error('The game is still opening.')),
})

/** A port that couldn't open: the shell shows why, with Try again and Copy details, and offers to clear nothing. */
export function errorGame(words: string): RacerGame {
  const snapshot: RacerSnapshot = Object.freeze({ ...EMPTY, status: 'error', words })
  return { ...BOOTING_GAME, getSnapshot: () => snapshot }
}

export const RuntimeContext = createContext<RacerRuntime | null>(null)

export function useRuntime(): RacerRuntime {
  const runtime = useContext(RuntimeContext)
  if (runtime === null) throw new Error('The game needs its GameProvider')
  return runtime
}

/** The snapshot, re-read whenever the port publishes. */
export function useSnapshot(): RacerSnapshot {
  const { game } = useRuntime()
  return useSyncExternalStore(game.subscribe, game.getSnapshot, game.getSnapshot)
}

/** A slice of the snapshot. The selector runs on every publish, so keep it cheap. */
export function useGame<T>(selector: (snapshot: RacerSnapshot) => T): T {
  return selector(useSnapshot())
}

/** The one 30-second clock (game/11 §4): stops while the page is hidden, ticks again on return; writes nothing. */
export function useNow(): number {
  const { clock } = useRuntime()
  return useSyncExternalStore(clock.subscribe, clock.get, clock.get)
}

/** The Hub's view of the account, or null until the save and the rules have loaded. */
export function useHub(): HubView | null {
  const { rules } = useRuntime()
  const { state } = useSnapshot()
  return useMemo(() => (rules !== null && state !== null ? rules.hubView(state) : null), [rules, state])
}

/** The port's `run`, for a tap. */
export function useRun(): RacerGame['run'] {
  const { game } = useRuntime()
  return useMemo(() => game.run.bind(game), [game])
}
