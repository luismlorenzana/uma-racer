// The activity rule (docs/game/01-game-loop.md §2, docs/game/07-farm.md §5, D328): an Uma does one passive thing at
// a time, a Farm job or a Training Hub session, and races in every state. She is Free (nothing started, nothing to
// collect), Working (an entry is running, maybe with a queue) or Ready (everything finished and waiting for Collect).
// Starting work for a Ready Uma collects her first; a Working one is refused with her free time; a queue never leaves
// its slot. A race collects only a session's finished unlocks, so she never races without one she has earned; a Farm
// job runs on. Promotion needs her Free (04 §5).
import { assertNow } from '../tiers/ledger'
import { isRefusal, type ReworkState } from '../state/types'
import { payWork, type CollectReceipt } from './collect'
import { kindRules, type WorkEnv } from './kinds'
import { joinSettles, settle } from './settle'
import { speedAt } from './state'
import { chainTimes, endsAt, finishedCount } from './timeline'
import { SESSION_KIND, type Done, type ItemStock, type WorkRow, type WorkState } from './types'

export type WorkStatus = 'free' | 'working' | 'ready'

/** Her status on a settled state: Working while her last entry runs, Ready once it has ended, else Free. */
export function statusOf(row: WorkRow | undefined, now: number): WorkStatus {
  if (row === undefined || row.entries.length === 0) return 'free'
  return endsAt(row.entries[row.entries.length - 1]!) > now ? 'working' : 'ready'
}

/** Her status at `now`, after settling every queue due by then. */
export function workState(state: WorkState, outfitId: string, now: number, env: WorkEnv): WorkStatus {
  assertNow(now)
  return statusOf(settle(state, now, env).state.work[outfitId], now)
}

/**
 * When her chain ends on a settled state: the running entry's end, then each queued request planned at the building's
 * speed now, in order. A queued entry that couldn't plan ends the projection there. Stock isn't projected (T131 does).
 */
export function chainEnd(state: WorkState, row: WorkRow, now: number, env: WorkEnv): number {
  const slot = row.slot!
  const earlier = row.entries.map((entry) => entry.request)
  const queued: number[][] = []
  for (const request of row.queue) {
    const plan = kindRules(env, request.kind)?.plan(state, row.outfitId, request, now, { slot, speed: speedAt(state, slot.building), earlier: [...earlier], env })
    if (plan === undefined || isRefusal(plan)) break
    queued.push(plan.map((item) => item.seconds))
    earlier.push(request)
  }
  return chainTimes(row, queued).endsAt!
}

/** When a Working Uma stops working ("busy until 18:30", 01 §2), or null when she isn't Working. */
export function freeAt(state: WorkState, outfitId: string, now: number, env: WorkEnv): number | null {
  assertNow(now)
  const settled = settle(state, now, env).state
  const row = settled.work[outfitId]
  return row !== undefined && statusOf(row, now) === 'working' ? chainEnd(settled, row, now, env) : null
}

/**
 * Whether she is Free (01 §2, 04 §5): no started entry and no queue. A row that only keeps her last work or a dropped
 * queue is Free; any other value in T125's untyped `work` is not. Time doesn't change it: only Collect and Recall
 * empty a row.
 */
export function isFree(state: Pick<ReworkState, 'work'>, outfitId: string): boolean {
  const row = state.work[outfitId] as Partial<WorkRow> | undefined
  if (row === undefined) return true
  return Array.isArray(row.entries) && row.entries.length === 0 && Array.isArray(row.queue) && row.queue.length === 0
}

/**
 * The Warehouse's reserved stock at `now` (07 §2, §10; 09 §6.1; T138): the inputs of every item not yet made in a
 * started entry, summed by item over every Uma. They left the Warehouse count when the entry started; an item made or
 * collected has used its inputs, and a queued request reserves nothing until it starts. It is what Recall would hand
 * back, so read it on a settled state (`projectWork(...).current`), as the screens do. An item none holds is absent.
 */
export function reservedStock(state: Pick<WorkState, 'work'>, now: number): ItemStock {
  assertNow(now)
  const reserved: Record<string, number> = {}
  for (const row of Object.values(state.work)) {
    for (const entry of row.entries) {
      const made = Math.max(entry.collected, finishedCount(entry, now))
      for (const inputs of entry.inputs.slice(made)) for (const { item, qty } of inputs) reserved[item] = (reserved[item] ?? 0) + qty
    }
  }
  return reserved
}

/**
 * Before a race (01 §2): her session's finished unlocks are collected in the same tap, so she races with every unlock
 * she has earned; the one in progress counts once it finishes. A Farm job is left running and uncollected.
 */
export function collectBeforeRace<S extends WorkState>(state: S, outfitId: string, now: number, env: WorkEnv): Done<CollectReceipt, S> {
  assertNow(now)
  const before = settle(state, now, env)
  const { state: paid, paid: receipt } = payWork(before.state, outfitId, now, env, (entry) => entry.request.kind === SESSION_KIND)
  const after = settle(paid, now, env)
  return {
    state: after.state,
    receipt: {
      ...receipt,
      movements: [...before.report.movements, ...receipt.movements, ...after.report.movements],
      settled: joinSettles(before.report, after.report),
    },
  }
}
