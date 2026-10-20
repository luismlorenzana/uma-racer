// Racer's race-start rule (01 §2): only sessions are collected; Farm jobs carry on uncollected.
import { assertNow } from '../tiers/ledger'
import { joinSettles, payWork, settle, type CollectReceipt } from './adapter'
import type { WorkEnv } from './kinds'
import { SESSION_KIND, type Done, type WorkState } from './types'

export function collectBeforeRace<S extends WorkState>(state: S, outfitId: string, now: number, env: WorkEnv): Done<CollectReceipt, S> {
  assertNow(now)
  const before = settle(state, now, env)
  const { state: paid, paid: receipt } = payWork(before.state, outfitId, now, env, (entry) => entry.request.kind === SESSION_KIND)
  const after = settle(paid, now, env)
  return {
    state: after.state,
    receipt: { ...receipt, movements: [...before.report.movements, ...receipt.movements, ...after.report.movements], settled: joinSettles(before.report, after.report) },
  }
}
