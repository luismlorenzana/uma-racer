// The in-memory game port (T137): a seed's account in memory, every tap through the domain's `recheck` (T131), nothing
// saved. Its clock starts at the seed's time and runs with real time. The seeds' mount's default; T136's device save is
// the real one. T141 adds what the device save keeps beside the rules' state: a `finish-race` that applies writes its
// `raceResults` row as T134's commit does (`raceResultRow`), a tap's device rows (badges and flair) are written with it
// in one step or not at all, the snapshot carries the badges, and `logs` read the race results and flair events. On the
// seeds' mount, Account can load another of the synthetic seeds in place (T138).
import type { FlairEventV1 } from '@racer/domain'
import { recheck, type FinishRaceInput, type OperationInput, type OperationName, type OperationReceipt } from '@racer/domain/check-in'
import { raceResultRow, type RaceResultRow } from '@racer/domain/save'
import { flairKeyOf, NO_RECORDS, type G2Answer, type G2DeviceRows, type G2Game, type G2Receipt, type G2Records, type G2RunOptions, type G2Snapshot } from '../app/game'
import type { G2Seed } from './seed'

/** The store keeps the latest operations' receipts (T136: 100). */
export const RECEIPTS_KEPT = 100

/** Device rows over records: a badge state replaces its row, a flair event is written once (first write wins). */
export function withDeviceRows(records: G2Records, rows: G2DeviceRows): G2Records {
  const badges = rows.badges === undefined || Object.keys(rows.badges).length === 0 ? records.badges : { ...records.badges, ...rows.badges }
  const fresh = (rows.flairEvents ?? []).filter((event) => records.flairEvents[flairKeyOf(event)] === undefined)
  const flairEvents = fresh.length === 0 ? records.flairEvents : { ...records.flairEvents, ...Object.fromEntries(fresh.map((event) => [flairKeyOf(event), event])) }
  return badges === records.badges && flairEvents === records.flairEvents ? records : { ...records, badges, flairEvents }
}

const byTime = <T extends { readonly at: number; readonly opId: string }>(a: T, b: T): number => a.at - b.at || (a.opId < b.opId ? -1 : a.opId > b.opId ? 1 : 0)

export function createMemoryGame(
  first: G2Seed,
  realNow: () => number = () => Date.now(),
  /** Seeds Account's dev section may load in place, by name (T138). */
  seeds: Readonly<Record<string, () => G2Seed>> = {},
): G2Game {
  let seed = first
  let bootedAt = realNow()
  let state = seed.state
  let records: G2Records = seed.records ?? NO_RECORDS
  let receipts: Readonly<Record<string, G2Receipt>> = {}
  const listeners = new Set<() => void>()
  const busy = new Map<string, Promise<G2Answer>>()
  let made = 0

  const freeze = (): G2Snapshot =>
    Object.freeze({ status: 'ready', state, env: seed.env, trainerName: seed.trainerName, sync: seed.sync, receipts, badges: records.badges })
  let snapshot = freeze()
  const now = () => seed.at + Math.max(0, realNow() - bootedAt)
  const newId = () => globalThis.crypto?.randomUUID?.() ?? `dev-op-${String((made += 1)).padStart(4, '0')}`
  const publish = () => {
    snapshot = freeze()
    for (const listener of [...listeners]) listener()
  }

  function keep(id: string, receipt: unknown): void {
    const ids = [...Object.keys(receipts), id].slice(-RECEIPTS_KEPT)
    receipts = Object.fromEntries(ids.map((key) => [key, key === id ? { local: receipt } : receipts[key]!]))
  }

  function run<N extends OperationName>(name: N, input: OperationInput<N>, busyKey?: string, options?: G2RunOptions<N>): Promise<G2Answer<N>> {
    const pending = busyKey === undefined ? undefined : busy.get(busyKey)
    if (pending !== undefined) return pending as Promise<G2Answer<N>>
    const id = newId()
    const answer = Promise.resolve().then((): G2Answer<N> => {
      const at = now()
      const result = recheck(state, { id, name, input }, at, seed.env)
      if (result.kind === 'done') {
        // One step: the operation's rows and the device's are written together, or nothing is.
        let next = records
        if (!result.repeated) {
          if (name === 'finish-race') {
            const row = raceResultRow(state, result.state, id, at, input as FinishRaceInput, result.receipt as OperationReceipt<'finish-race'>, seed.env)
            next = { ...next, raceResults: { ...next.raceResults, [id]: row } }
          }
          const rows = options?.device?.({ id, name, at, before: state, state: result.state, receipt: result.receipt, records: next })
          if (rows !== undefined) next = withDeviceRows(next, rows)
        }
        state = result.state
        records = next
        keep(id, result.receipt)
        publish()
      }
      return { ...result, id }
    })
    if (busyKey !== undefined) {
      busy.set(busyKey, answer as Promise<G2Answer>)
      void answer.finally(() => busy.delete(busyKey)).catch(() => {})
    }
    return answer
  }

  const races = (): RaceResultRow[] => Object.values(records.raceResults).sort(byTime)
  const names = Object.keys(seeds)

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    now,
    utcOffsetMin: () => seed.utcOffsetMin,
    run,
    async writeDevice(rows) {
      const next = withDeviceRows(records, rows)
      if (next === records) return
      records = next
      publish()
    },
    logs: {
      raceResults: async (umaId) => races().filter((row) => row.umaId === umaId),
      allRaceResults: async () => races(),
      flairEvents: async (): Promise<FlairEventV1[]> => Object.values(records.flairEvents).sort((a, b) => a.earnedAt - b.earnedAt),
      ledgerRows: async () => [...state.ledger],
      itemLedgerRows: async () => [],
      receipt: async (id) => receipts[id]?.local ?? state.operations?.[id]?.receipt ?? null,
    },
    // T138: Account's dev section loads another seed in place, its account and records both.
    ...(names.length === 0 ? {} : {
      fixtures: Object.freeze(names),
      loadFixture: async (name: string) => {
        const make = seeds[name]
        if (make === undefined) throw new RangeError(`No fixture ${name}`)
        seed = make()
        bootedAt = realNow()
        state = seed.state
        records = seed.records ?? NO_RECORDS
        receipts = {}
        publish()
      },
    }),
  }
}
