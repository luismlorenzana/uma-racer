// Synthetic accounts for the place view models' tests (T138): a dev seed's account moved by the rework's own operations
// through `recheck`, at the seed's clock or a later one, so every number a test reads is the rules'. Synthetic only.
import { recheck, type OperationInput, type OperationName, type OperationReceipt } from '@racer/domain/rework/check-in'
import type { WorkState } from '@racer/domain/rework/work'
import { seed } from './testing'

export interface Account {
  state: WorkState
  readonly env: ReturnType<typeof seed>['env']
  readonly at: number
  /** Runs one operation at `now` (the seed's time by default); throws unless it is done. */
  run<N extends OperationName>(name: N, input: OperationInput<N>, now?: number): OperationReceipt<N>
}

export function account(name: 'fresh' | 'busy' | 'quiet' = 'fresh'): Account {
  const base = seed(name)
  let made = 0
  const acc: Account = {
    state: base.state,
    env: base.env,
    at: base.at,
    run(op, input, now = base.at) {
      const answer = recheck(acc.state, { id: `test-${(made += 1)}`, name: op, input }, now, base.env)
      if (answer.kind !== 'done') throw new Error(`${op}: ${answer.kind === 'say' ? answer.words.text : answer.question.text}`)
      acc.state = answer.state
      return answer.receipt
    },
  }
  return acc
}

/** The first `n` synthetic Umas' ids. */
export const umaIds = (n: number): string[] => Array.from({ length: n }, (_, i) => `sim-uma-${String(i + 1).padStart(2, '0')}`)
