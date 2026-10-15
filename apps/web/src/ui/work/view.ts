// One reading of the work at the clock's `now` (docs/rework/02-check-ins-and-notifications.md §3, §8; rework/11 §4):
// the domain's projection (the state settled to `now`, and to the end of every chain) and its queue warnings, made
// once per state and 30-second tick and shared by every card on a page, so a page of eight cards settles once.
import type { OperationEnv } from '@racer/domain/rework/check-in'
import { projectWork, queueWarnings, type Projection, type QueueWarning } from '@racer/domain/rework/planner'
import type { WorkState } from '@racer/domain/rework/work'
import { useMemo } from 'react'
import { useGame, useNow } from '../../app/game'

export interface WorkView {
  readonly now: number
  readonly env: OperationEnv
  readonly projection: Projection
  /** The state settled to `now`: what every card shows. */
  readonly settled: WorkState
  readonly warnings: readonly QueueWarning[]
}

const made = new WeakMap<WorkState, WorkView>()

/** The view of `state` at `now`, kept for the latest `now` of each state. */
export function workView(state: WorkState, now: number, env: OperationEnv): WorkView {
  const kept = made.get(state)
  if (kept !== undefined && kept.now === now && kept.env === env) return kept
  const projection = projectWork(state, now, env)
  const view: WorkView = { now, env, projection, settled: projection.current, warnings: queueWarnings(state, now, env) }
  made.set(state, view)
  return view
}

/** The work view at the shell's clock, or null until the save opens. */
export function useWorkView(): WorkView | null {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  return useMemo(() => (state === null || env === null ? null : workView(state, now, env)), [state, env, now])
}
