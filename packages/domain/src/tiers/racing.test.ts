// Racing Level and Racing EXP (docs/game/03-uma-progression.md §2): today's curve inside a tier, its holds, the gate's
// bank, the tier's last gate, and a gate's Uma Shard paid once (04 §6, D336).
import { describe, expect, it } from 'vitest'
import { CONTENT, COLT, placeUma, wonCareer } from '../__fixtures__/tiers'
import { careerHoldLevel } from '../career-stages'
import { GATE_SHARD_REWARD, expToNextUmaLevel, umaGateShardLedgerId } from '../progression'
import { addUmaRaceExp } from '../progression-race'
import type { UmaSave } from '../career-shapes'
import { isRefusal, type ReworkState, type ScenarioOfTier, type Tier, type UmaState } from '../state/types'
import { advanceScenario } from './advance'
import { freezeCareer } from './career'
import { RACING_LEVELS_PER_TIER, firstLevel, gateLevel, lifetimeLevel, scenarioCatalogue, scenariosInTier, tierAndScenario, tierOf } from './map'
import { promote } from './promotion'
import { addRacingExp, applyRaceFinish, racingExpToNext, type RaceFinishInput } from './racing'
import { newAccount, unlockUma } from './roster'
import { recordExpeditionRace } from './expedition'

const FIFTEEN = scenarioCatalogue(15)

function account(): ReworkState {
  const result = unlockUma(newAccount(0), { outfitId: COLT.id }, 1, { content: CONTENT })
  if (isRefusal(result)) throw new Error(result.reason)
  return result.state
}
const COLT_UMA = account().umas[COLT.id]!
const at = (tier: Tier, scenario: ScenarioOfTier, level: number, careerWon = false, exp = 0): UmaState =>
  placeUma(COLT_UMA, { tier, scenario, level, exp, careerWon })

function ok<R>(result: { state: ReworkState; receipt: R } | { refused: true; reason: string }): { state: ReworkState; receipt: R } {
  if ('refused' in result) throw new Error(result.reason)
  return result
}

const WIN = (raceId: string, index = 0): Omit<RaceFinishInput, 'umaId'> =>
  ({ raceId, resultId: `race:colt:${index}`, grade: 'g1', placement: 1, raceBonus: 0 })

describe('the curve', () => {
  it('costs 1,800 EXP a scenario in every tier', () => {
    for (const tier of [1, 2, 3] as const) {
      for (let scenario = 1; scenario <= scenariosInTier(tier); scenario += 1) {
        const s = scenario as ScenarioOfTier
        const start = at(tier, s, firstLevel(s), true)
        expect(addRacingExp(start, 1799).uma.racing.level).toBe(gateLevel(s) - 1)
        const full = addRacingExp(start, 1800)
        expect(full.uma.racing).toEqual({ level: gateLevel(s), exp: 0 })
        expect(full.levelsGained).toEqual(Array.from({ length: 9 }, (_, i) => firstLevel(s) + i + 1))
        expect(full.reachedGate).toBe(gateLevel(s))
      }
    }
  })

  it('holds at levels 2 and 5 of a scenario, one short of the next level', () => {
    const open = at(1, 3, 21)
    expect(addRacingExp(open, 10_000).uma.racing).toEqual({ level: 22, exp: expToNextUmaLevel(22) - 1 })
    const trials = { ...open, career: { ...open.career, goals: open.career.goals.map((goal) => goal.slot === 'maiden' ? { ...goal, status: 'completed' as const } : goal) } }
    expect(addRacingExp(trials, 10_000).uma.racing).toEqual({ level: 25, exp: expToNextUmaLevel(25) - 1 })
  })

  it('banks at most 100 at a gate, and nothing at the tier’s last gate', () => {
    expect(addRacingExp(at(2, 3, 30, true, 40), 500).uma.racing).toEqual({ level: 30, exp: 100 })
    expect(addRacingExp(at(1, 1, 9, true), 10_000).uma.racing).toEqual({ level: 10, exp: 100 })
    expect(addRacingExp(at(1, 5, 49, true), 10_000).uma.racing).toEqual({ level: 50, exp: 0 })
    expect(addRacingExp(at(1, 5, 50, true), 10_000).uma.racing).toEqual({ level: 50, exp: 0 })
  })

  it('stops tier 3 at 40 with 14 scenarios and at 50 with 15', () => {
    expect(addRacingExp(at(3, 4, 39, true), 10_000).uma.racing).toEqual({ level: 40, exp: 0 })
    expect(addRacingExp(at(3, 4, 39, true), 10_000, FIFTEEN).uma.racing).toEqual({ level: 40, exp: 100 })
    expect(addRacingExp(at(3, 4, 40, true), 10_000).uma.racing).toEqual({ level: 40, exp: 0 })
  })

  it('never passes Racing Level 50 in tier 1', () => {
    let uma = at(1, 5, 41, true)
    for (let i = 0; i < 30; i += 1) uma = addRacingExp(uma, 5000).uma
    expect(uma.racing.level).toBe(RACING_LEVELS_PER_TIER)
  })

  it('refuses nonsense EXP', () => {
    expect(() => addRacingExp(COLT_UMA, -1)).toThrow(RangeError)
    expect(() => addRacingExp(COLT_UMA, 1.5)).toThrow(RangeError)
  })

  it("fills the profile's bar toward the next level, the advance's first step at a gate, and nothing at the last gate (T138)", () => {
    expect(racingExpToNext(at(1, 1, 1))).toBe(100)
    expect(racingExpToNext(at(1, 1, 9))).toBe(300)
    // At a gate the bank holds up to the next scenario's first step, which the advance applies.
    expect(racingExpToNext(at(1, 1, 10, true))).toBe(100)
    expect(addRacingExp(at(1, 1, 10, true), 10_000).uma.racing.exp).toBe(racingExpToNext(at(1, 1, 10, true)))
    expect(racingExpToNext(at(1, 5, 50, true))).toBeNull()
    expect(racingExpToNext(at(3, 4, 40, true))).toBeNull()
    expect(racingExpToNext(at(3, 4, 40, true), FIFTEEN)).toBe(100)
  })
})

describe("parity with today's addUmaRaceExp", () => {
  // One open and one won career per scenario: holds bite in the first, not in the second.
  const careers = new Map<number, { open: UmaState; won: UmaState }>()
  for (let T = 1; T <= 14; T += 1) {
    const where = tierAndScenario(T)
    const open = placeUma(COLT_UMA, { ...where, level: firstLevel(where.scenario) })
    careers.set(T, { open, won: { ...open, career: wonCareer(open.career) } })
  }
  const GAINS = [0, 1, 99, 100, 124, 150, 299, 300, 451, 1000, 1800, 5000]

  it('walks the same levels at every lifetime level 1–139 but the tier ends, 50 and 100', () => {
    let compared = 0
    for (let lifetime = 1; lifetime <= 139; lifetime += 1) {
      if (lifetime === 50 || lifetime === 100) continue
      const T = Math.ceil(lifetime / 10)
      const tier = tierOf(T)
      const offset = lifetimeLevel(tier, 1) - 1
      for (const kind of ['open', 'won'] as const) {
        const base = careers.get(T)![kind]
        const hold = careerHoldLevel(base.career, lifetime)
        const starts = [0, hold !== null && lifetime >= hold ? expToNextUmaLevel(lifetime) - 1 : lifetime % 10 === 0 ? 100 : 37]
        for (const exp of starts) {
          for (const gain of GAINS) {
            const today = addUmaRaceExp({ level: lifetime, exp } as UmaSave, gain, hold)
            const rework = addRacingExp({ ...base, racing: { level: lifetime - offset, exp } }, gain)
            expect(rework.uma.racing.level + offset).toBe(today.uma.level)
            expect(rework.levelsGained.map((level) => level + offset)).toEqual(today.levelsGained)
            expect(rework.reachedGate === null ? null : rework.reachedGate + offset).toBe(today.reachedGate)
            // Landing on a tier's last gate: today banks the next scenario's step, the rework has no next scenario.
            if (today.uma.level === 50 || today.uma.level === 100) expect(rework.uma.racing.exp).toBe(0)
            else expect(rework.uma.racing.exp).toBe(today.uma.exp)
            compared += 1
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(5000)
  })
})

describe('applyRaceFinish', () => {
  it('settles goals first, so the winning race releases its own hold', () => {
    const uma = at(1, 1, 2, false, expToNextUmaLevel(2) - 1)
    const state = { ...account(), umas: { [COLT.id]: uma } }
    const maiden = uma.career.goals.find((goal) => goal.slot === 'maiden')!
    const result = ok(applyRaceFinish(state, { umaId: COLT.id, ...WIN(maiden.raceId!), grade: 'g3' }, 500))
    expect(result.receipt.completedGoalIds).toEqual([maiden.id])
    expect(result.receipt.expGained).toBe(80)
    expect(result.state.umas[COLT.id]!.racing).toEqual({ level: 3, exp: 124 + 80 - 125 })
    expect(result.state.umas[COLT.id]!.career.goals[0]).toMatchObject({ status: 'completed', completedRaceResultId: 'race:colt:0', completedAt: 500 })
  })

  it('pays EXP by finish and Race Bonus, and settles nothing without a win', () => {
    const state = { ...account(), umas: { [COLT.id]: at(1, 1, 1, true) } }
    expect(ok(applyRaceFinish(state, { umaId: COLT.id, ...WIN('x'), raceBonus: 0.33 }, 1)).receipt.expGained).toBe(200)
    const third = ok(applyRaceFinish(state, { umaId: COLT.id, ...WIN('x'), placement: 3 }, 1))
    expect(third.receipt).toMatchObject({ expGained: 38, completedGoalIds: [] })
    const fourth = ok(applyRaceFinish(state, { umaId: COLT.id, ...WIN('x'), placement: 4 }, 1))
    expect(fourth.receipt.expGained).toBe(0)
    expect(fourth.state).toBe(state)
  })

  it('never refuses for work (D328), only for an Uma she is not', () => {
    const state = { ...account(), work: { [COLT.id]: { kind: 'session' } } }
    expect(isRefusal(applyRaceFinish(state, { umaId: COLT.id, ...WIN('x') }, 1))).toBe(false)
    expect(applyRaceFinish(state, { umaId: 'nobody', ...WIN('x') }, 1)).toMatchObject({ refused: true, code: 'unknown-uma' })
    expect(() => applyRaceFinish(state, { umaId: COLT.id, ...WIN('x') }, 1.5)).toThrow(RangeError)
    expect(() => applyRaceFinish(state, { umaId: COLT.id, ...WIN('x'), placement: 0 }, 1)).toThrow(RangeError)
  })

  it("pays a gate's Shard under today's ledger id with her lifetime gate, once", () => {
    const state = { ...account(), umas: { [COLT.id]: at(2, 2, 19, true, 200) } }
    const reached = ok(applyRaceFinish(state, { umaId: COLT.id, ...WIN('x') }, 9))
    expect(reached.receipt).toMatchObject({ reachedGate: 20, shardsPaid: GATE_SHARD_REWARD })
    expect(reached.state.profile.umaShards).toBe(1)
    expect(reached.state.ledger.at(-1)).toEqual({ id: umaGateShardLedgerId(COLT.id, 70), resource: 'uma-shards', delta: 1, reason: 'uma-gate-shard', at: 9 })
    // Back at Lv 19 with the gate already paid: reaching it again pays nothing.
    const again = { ...reached.state, umas: { [COLT.id]: { ...reached.state.umas[COLT.id]!, racing: { level: 19, exp: 200 } } } }
    const twice = ok(applyRaceFinish(again, { umaId: COLT.id, ...WIN('x') }, 10))
    expect(twice.receipt).toMatchObject({ reachedGate: 20, shardsPaid: 0 })
    expect(twice.state.profile.umaShards).toBe(1)
  })
})

describe('Shards across a tier', () => {
  /** Race G1 wins until the gate, then advance with the next career won, until the tier's last gate. */
  function raceThroughTier(start: ReworkState, catalogue = scenarioCatalogue(14)): { state: ReworkState; shards: number } {
    let state = start
    let shards = 0
    for (let guard = 0; guard < 200; guard += 1) {
      const step = ok(applyRaceFinish(state, { umaId: COLT.id, ...WIN('x', guard) }, 100 + guard, { catalogue }))
      state = step.state
      shards += step.receipt.shardsPaid
      const after = state.umas[COLT.id]!
      if (after.racing.level === gateLevel(after.scenario) && after.racing.exp === (after.scenario === scenariosInTier(after.tier, catalogue) ? 0 : 100)) {
        const advanced = advanceScenario(state, { umaId: COLT.id }, 100 + guard, { content: CONTENT, catalogue })
        if (isRefusal(advanced)) return { state, shards }
        const moved = advanced.state.umas[COLT.id]!
        state = { ...advanced.state, umas: { ...advanced.state.umas, [COLT.id]: { ...moved, career: wonCareer(moved.career) } } }
      }
    }
    throw new Error('never reached the last gate')
  }

  const startAt = (tier: Tier): ReworkState => ({ ...account(), umas: { [COLT.id]: at(tier, 1, 1, true) } })

  it('pays five a tier in tiers 1 and 2, and four in tier 3 while it has four scenarios', () => {
    expect(raceThroughTier(startAt(1)).shards).toBe(5)
    expect(raceThroughTier(startAt(2)).shards).toBe(5)
    const tier3 = raceThroughTier(startAt(3))
    expect(tier3.shards).toBe(4)
    expect(tier3.state.ledger.filter((entry) => entry.reason === 'uma-gate-shard').map((entry) => entry.id))
      .toEqual([110, 120, 130, 140].map((gate) => umaGateShardLedgerId(COLT.id, gate)))
  })

  it("pays again for a promoted Uma's tier-2 gates", () => {
    const tier1 = raceThroughTier(startAt(1))
    let state = tier1.state
    for (let race = 0; race < 8; race += 1) state = ok(recordExpeditionRace(state, { umaId: COLT.id, expeditionId: 'europe', won: true }, 400 + race)).state
    const presets = Object.fromEntries((['sprint', 'mile', 'medium', 'long'] as const).map((d) => [d, { stats: { speed: 1, stamina: 1, power: 1, guts: 1, wit: 1 }, skillPoints: 0 }]))
    state = ok(promote(state, { umaId: COLT.id, presets: presets as never }, 500, { content: CONTENT })).state
    state = { ...state, umas: { [COLT.id]: { ...state.umas[COLT.id]!, career: wonCareer(state.umas[COLT.id]!.career) } } }
    const tier2 = raceThroughTier(state)
    expect(tier2.shards).toBe(5)
    expect(tier2.state.profile.umaShards).toBe(10)
    expect(new Set(tier2.state.ledger.filter((entry) => entry.reason === 'uma-gate-shard').map((entry) => entry.id)).size).toBe(10)
  })

  it('freezes each new career on arrival', () => {
    const state = startAt(1)
    expect(state.umas[COLT.id]!.career.tier).toBe(1)
    expect(freezeCareer(state.umas[COLT.id]!, 2, CONTENT).tier).toBe(2)
  })
})
