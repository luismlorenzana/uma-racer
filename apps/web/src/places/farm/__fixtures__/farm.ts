// Synthetic Farm accounts for T140's tests, built with the rework's own operations on `rework/sim`'s invented content
// (T137's `fresh` seed, a new account at day 0, 08:00 UTC), never from the private packs. Imported by tests only.
import { OPERATIONS, runOnce, type OperationEnv, type OperationInput, type OperationName, type OperationReceipt } from '@racer/domain/check-in'
import { farmExpAtLevel, QUARTERS_PER_EXP } from '@racer/domain/farm'
import { simUmaId } from '@racer/domain/sim'
import { isRefusal } from '@racer/domain/tiers'
import type { WorkState } from '@racer/domain/work'
import { SEED_ENV, SEEDS, type G2Seed } from '../../../dev/seed'

/** The env with `dev-grant` allowed, as a dev build's is (M034). */
export const DEV_ENV: OperationEnv = Object.freeze({ ...SEED_ENV, dev: true })

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE

let made = 0

/** One operation applied once, or a test failure naming its refusal. */
export function apply<N extends OperationName>(state: WorkState, name: N, input: OperationInput<N>, now: number, env: OperationEnv = DEV_ENV): { state: WorkState; receipt: OperationReceipt<N> } {
  if (!Object.hasOwn(OPERATIONS, name)) throw new Error(name)
  const result = runOnce(state, { id: `test-${(made += 1)}`, name, input }, now, env)
  if (isRefusal(result)) throw new Error(`Refused ${result.code}: ${result.reason}`)
  return { state: result.state, receipt: result.receipt }
}

/** The fresh account (13 §5) with the first `n` synthetic Umas unlocked at its start. */
export function farmAccount(n: number): { state: WorkState; env: OperationEnv; at: number } {
  const fresh = SEEDS['fresh']!()
  let state = fresh.state
  for (let i = 0; i < n; i += 1) state = apply(state, 'unlock-uma', { outfitId: simUmaId(i) }, fresh.at).state
  return { state, env: DEV_ENV, at: fresh.at }
}

/** Her Farm Level set outright, at the EXP that opens it. */
export function withFarmLevel(state: WorkState, outfitId: string, level: number): WorkState {
  const uma = state.umas[outfitId]!
  return { ...state, umas: { ...state.umas, [outfitId]: { ...uma, farm: { level, exp: farmExpAtLevel(level) * QUARTERS_PER_EXP } } } }
}

/** A dev seed over a built state: the in-memory port's account. */
export function farmSeed(state: WorkState, at: number, changes: Partial<G2Seed> = {}): G2Seed {
  const fresh = SEEDS['fresh']!()
  return { ...fresh, name: 'farm', state, env: DEV_ENV, at, ...changes }
}

export const uma = (n: number): string => simUmaId(n - 1)
