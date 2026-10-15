// Racing Level and Racing EXP (docs/game/03-uma-progression.md §2, D241): today's curve and EXP per finish, inside a
// tier. Her career holds levels 2 and 5 of each scenario, a gate banks up to the next scenario's first step (100), and
// the tier's last gate stops EXP: there is no next scenario to bank for. Each gate reached pays 1 Uma Shard once
// (D336, docs/game/04-tiers-and-promotion.md §6).
import { careerHoldLevel } from '../career-stages'
import { GATE_SHARD_REWARD, expToNextUmaLevel, raceExp, umaGateShardLedgerId } from '../progression'
import { isGateLevel } from '../scenarios'
import type { RaceGrade } from '../types'
import type { OpResult, ReworkState, UmaState } from '../state/types'
import { settleGoalWin } from './career'
import { assertNow, payOnce, withUma } from './ledger'
import { TODAY_CATALOGUE, lastGate, lifetimeLevel, type ScenarioCatalogue } from './map'
import { tierRefusal } from './refusals'

export interface RacingExpResult {
  readonly uma: UmaState
  readonly expGained: number
  /** Racing Levels reached, in order. */
  readonly levelsGained: readonly number[]
  /** The gate's Racing Level, when a level-up landed on one. */
  readonly reachedGate: number | null
}

/** Her career's hold as a Racing Level: today's `careerHoldLevel` reads lifetime levels, which equal today's Uma Level. */
function holdLevel(uma: UmaState): number | null {
  const offset = lifetimeLevel(uma.tier, 1) - 1
  const hold = careerHoldLevel(uma.career, offset + uma.racing.level)
  return hold === null ? null : hold - offset
}

/**
 * Walk Racing EXP up today's curve (`addUmaRaceExp`'s rule, restated): at a hold she banks one short of the next level,
 * at a gate up to the next scenario's first step, and at the tier's last gate nothing. Racing Level never passes it.
 */
export function addRacingExp(uma: UmaState, exp: number, catalogue: ScenarioCatalogue = TODAY_CATALOGUE): RacingExpResult {
  if (!Number.isSafeInteger(exp) || exp < 0) throw new RangeError(`Race EXP must be a whole number ≥ 0: ${exp}`)
  const last = lastGate(uma.tier, catalogue)
  const hold = holdLevel(uma)
  let level = uma.racing.level
  let bank = uma.racing.exp
  const levelsGained: number[] = []
  let reachedGate: number | null = null

  if (level >= last) {
    bank = 0
  } else if (isGateLevel(level)) {
    bank = Math.min(expToNextUmaLevel(level + 1), bank + exp)
  } else if (hold !== null && level >= hold) {
    bank = Math.min(expToNextUmaLevel(level) - 1, bank + exp)
  } else {
    bank += exp
    while (level < last && !isGateLevel(level)) {
      const needed = expToNextUmaLevel(level)
      if (bank < needed) break
      bank -= needed
      level += 1
      levelsGained.push(level)
      if (isGateLevel(level)) {
        reachedGate = level
        bank = level >= last ? 0 : Math.min(expToNextUmaLevel(level + 1), bank)
        break
      }
      if (level === hold) {
        bank = Math.min(expToNextUmaLevel(level) - 1, bank)
        break
      }
    }
  }
  const racing = level === uma.racing.level && bank === uma.racing.exp ? uma.racing : { level, exp: bank }
  return { uma: racing === uma.racing ? uma : { ...uma, racing }, expGained: exp, levelsGained, reachedGate }
}

/**
 * What her Racing EXP bar fills toward (03 §2; the profile's bar, T138): the next level's cost, or at a gate the next
 * scenario's first step her bank holds for the advance; null at the tier's last gate, where EXP stops.
 */
export function racingExpToNext(uma: Pick<UmaState, 'tier' | 'racing'>, catalogue: ScenarioCatalogue = TODAY_CATALOGUE): number | null {
  const { level } = uma.racing
  if (level >= lastGate(uma.tier, catalogue)) return null
  return expToNextUmaLevel(isGateLevel(level) ? level + 1 : level)
}

export interface RaceFinishInput {
  readonly umaId: string
  readonly raceId: string
  /** The race result's id, recorded on any goal it wins. */
  readonly resultId: string
  readonly grade: RaceGrade
  readonly placement: number
  /** The preset's summed card Race Bonus (0.33 = +33%), from T128's derivation. */
  readonly raceBonus: number
}

export interface RaceFinishReceipt {
  readonly umaId: string
  readonly completedGoalIds: readonly string[]
  readonly expGained: number
  readonly levelsGained: readonly number[]
  readonly reachedGate: number | null
  /** Uma Shards paid for the gate: 1 the first time she reaches it in this tier, else 0. */
  readonly shardsPaid: number
}

/**
 * Commit one race's finish (03 §2, §4): a win settles her goals first, so the race that wins a hold's goal releases it;
 * then the finish's EXP walks the curve; a gate reached pays its Shard once, under today's
 * `uma-gate-shard:{umaId}:{lifetime gate}`. Racing is never blocked by her work (D328). T130 adds Prize Money here.
 */
export function applyRaceFinish<S extends ReworkState>(
  state: S,
  input: RaceFinishInput,
  now: number,
  env: { readonly catalogue?: ScenarioCatalogue } = {},
): OpResult<RaceFinishReceipt, S> {
  assertNow(now)
  if (!Number.isSafeInteger(input.placement) || input.placement < 1) throw new RangeError(`Placement must be 1 or more: ${input.placement}`)
  if (!Number.isFinite(input.raceBonus) || input.raceBonus < 0) throw new RangeError(`Race Bonus must be ≥ 0: ${input.raceBonus}`)
  const uma = state.umas[input.umaId]
  if (!uma) return tierRefusal('unknown-uma', { uma: input.umaId })

  const settled = input.placement === 1
    ? settleGoalWin(uma.career, input.raceId, input.resultId, now)
    : { career: uma.career, completedGoalIds: [] }
  const withGoals = settled.career === uma.career ? uma : { ...uma, career: settled.career }
  const result = addRacingExp(withGoals, raceExp(input.grade, input.placement, input.raceBonus), env.catalogue)

  let next: S = result.uma === uma ? state : withUma(state, result.uma)
  let shardsPaid = 0
  if (result.reachedGate !== null) {
    const id = umaGateShardLedgerId(uma.outfitId, lifetimeLevel(uma.tier, result.reachedGate))
    const paid = payOnce(next, { id, resource: 'uma-shards', delta: GATE_SHARD_REWARD, reason: 'uma-gate-shard' }, now)
    next = paid.state
    shardsPaid = paid.paid
  }
  return {
    state: next,
    receipt: {
      umaId: uma.outfitId,
      completedGoalIds: settled.completedGoalIds,
      expGained: result.expGained,
      levelsGained: result.levelsGained,
      reachedGate: result.reachedGate,
      shardsPaid,
    },
  }
}
