// An in-memory `RacerGame` for the shell's tests (T152): a generation-3 account held in memory, moved by the domain's own
// `commitOperation`, with no database and no network. Its clock is held where the test puts it.
import { commitOperation, initialSave, type OperationEnv, type OperationRecord, type SaveState } from '@racer/domain/save'
import type { RacerAnswer, RacerGame, RacerSnapshot, RacerSync } from '../app/game'
import { syntheticEnv } from './content'

export interface MemoryOptions {
  readonly state?: SaveState
  readonly env?: OperationEnv
  readonly sync?: RacerSync
  readonly now?: () => number
}

/** The fixed time a memory game starts at: 2026-11-04 08:00 UTC. */
export const MEMORY_AT = Date.UTC(2026, 10, 4, 8)

export interface MemoryGame extends RacerGame {
  /** The names of the taps applied, oldest first. */
  readonly applied: readonly string[]
}

export function memoryGame(options: MemoryOptions = {}): MemoryGame {
  const now = options.now ?? (() => MEMORY_AT)
  const env = options.env ?? syntheticEnv()
  const listeners = new Set<() => void>()
  const applied: string[] = []
  const operations = new Map<string, OperationRecord>()
  let made = 0
  let snapshot: RacerSnapshot = Object.freeze({
    status: 'ready', state: options.state ?? initialSave(now()).state, env, sync: options.sync ?? 'synced', receipts: {},
  })
  const publish = (next: Partial<RacerSnapshot>) => {
    snapshot = Object.freeze({ ...snapshot, ...next })
    for (const listener of [...listeners]) listener()
  }
  return {
    applied,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    now,
    async run<R>(name: string, input: unknown): Promise<RacerAnswer<R>> {
      const id = `memory-${String((made += 1)).padStart(4, '0')}`
      const at = now()
      const commit = commitOperation(snapshot.state!, { id, name, input, at }, env)
      if (commit.status === 'refused') return { kind: 'refused', id, code: commit.refusal.code, text: commit.refusal.reason }
      applied.push(name)
      operations.set(id, { name, at, receipt: commit.receipt })
      publish({ state: commit.state, receipts: { ...snapshot.receipts, [id]: { local: commit.receipt } } })
      return { kind: 'done', id, state: commit.state, receipt: commit.receipt as R, repeated: commit.status === 'repeated' }
    },
    logs: {
      raceResults: async () => [],
      receipt: async (id) => operations.get(id)?.receipt ?? null,
      operation: async (id) => operations.get(id) ?? null,
    },
  }
}
