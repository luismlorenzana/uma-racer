// The in-memory game port (T137): a seed's account in memory, every tap through the domain's `recheck` (T131), nothing
// saved. Its clock starts at the seed's time and runs with real time. T136's store replaces it in `boot.ts`.
import { recheck, type OperationInput, type OperationName } from '@racer/domain/rework/check-in'
import type { G2Answer, G2Game, G2Receipt, G2Snapshot } from '../app/game'
import type { G2Seed } from './seed'

/** The store keeps the latest operations' receipts (T136: 100). */
export const RECEIPTS_KEPT = 100

export function createMemoryGame(seed: G2Seed, realNow: () => number = () => Date.now()): G2Game {
  const bootedAt = realNow()
  let state = seed.state
  let receipts: Readonly<Record<string, G2Receipt>> = {}
  const listeners = new Set<() => void>()
  const busy = new Map<string, Promise<G2Answer>>()
  let made = 0

  const freeze = (): G2Snapshot => Object.freeze({ status: 'ready', state, env: seed.env, trainerName: seed.trainerName, sync: seed.sync, receipts })
  let snapshot = freeze()
  const now = () => seed.at + Math.max(0, realNow() - bootedAt)
  const newId = () => globalThis.crypto?.randomUUID?.() ?? `dev-${(made += 1)}`

  function keep(id: string, receipt: unknown): void {
    const ids = [...Object.keys(receipts), id].slice(-RECEIPTS_KEPT)
    receipts = Object.fromEntries(ids.map((key) => [key, key === id ? { local: receipt } : receipts[key]!]))
  }

  function run<N extends OperationName>(name: N, input: OperationInput<N>, busyKey?: string): Promise<G2Answer<N>> {
    const pending = busyKey === undefined ? undefined : busy.get(busyKey)
    if (pending !== undefined) return pending as Promise<G2Answer<N>>
    const id = newId()
    const answer = Promise.resolve().then((): G2Answer<N> => {
      const result = recheck(state, { id, name, input }, now(), seed.env)
      if (result.kind === 'done') {
        state = result.state
        keep(id, result.receipt)
        snapshot = freeze()
        for (const listener of [...listeners]) listener()
      }
      return { ...result, id }
    })
    if (busyKey !== undefined) {
      busy.set(busyKey, answer as Promise<G2Answer>)
      void answer.finally(() => busy.delete(busyKey)).catch(() => {})
    }
    return answer
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    now,
    utcOffsetMin: () => seed.utcOffsetMin,
    run,
  }
}
