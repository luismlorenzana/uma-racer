// Retries, stale screens and the clock (docs/game/02-check-ins-and-notifications.md §8, §9, §12): an operation runs
// once under its id; every stale-screen case ends in a result or a one-sentence question, never an error; a clock
// moved forward makes work Ready and Collect all accepts it; one moved back makes waits longer, never negative.
import { describe, expect, it } from 'vitest'
import { account, atFarmLevel, clock, craft, ENV, gather, nodes, ok, slot, uma } from '../__fixtures__/check-in'
import { isRefusal } from '../state/types'
import { start } from '../work/operations'
import { progress, remainingMs } from '../work/timeline'
import type { WorkState } from '../work/types'
import { collectAll } from './collect-all'
import { OPERATIONS, recheck, runOnce } from './once'
import { nextCheckIn } from './schedule'
import { CHECK_IN_WORDS, fill, hasBannedWord } from './words'

const NOW = clock('12:00')

describe('runOnce', () => {
  it('stores the first receipt under the id and returns it, changing nothing, on a retry', () => {
    const state = account(2, { carrot: 4 })
    const call = { id: 'op-1', name: 'start' as const, input: { outfitId: uma(1), slot: slot('pantry'), request: craft('chopped-carrot', 4) } }
    const first = runOnce(state, call, NOW, ENV)
    if (isRefusal(first)) throw new Error(first.reason)
    expect(first.repeated).toBe(false)
    expect(first.state.operations?.['op-1']).toEqual({ name: 'start', at: NOW, receipt: first.receipt })
    const retry = runOnce(first.state, call, NOW + 5_000, ENV)
    if (isRefusal(retry)) throw new Error(retry.reason)
    expect(retry).toEqual({ state: first.state, receipt: first.receipt, repeated: true })
    expect(retry.state.items).toEqual({})
  })

  it('stores nothing for a refusal, and treats a reused id under another name or a missing one as a caller bug', () => {
    const state = account(1)
    const refused = runOnce(state, { id: 'op-2', name: 'start', input: { outfitId: uma(1), slot: slot('pantry'), request: craft('chopped-carrot', 1) } }, NOW, ENV)
    expect(refused).toMatchObject({ refused: true, code: 'short' })
    const done = runOnce(state, { id: 'op-3', name: 'set-repeat-sizing', input: { sizing: 'fit' } }, NOW, ENV)
    if (isRefusal(done)) throw new Error(done.reason)
    expect(() => runOnce(done.state, { id: 'op-3', name: 'collect-all', input: {} }, NOW, ENV)).toThrow(RangeError)
    expect(() => runOnce(state, { id: '', name: 'collect-all', input: {} }, NOW, ENV)).toThrow(RangeError)
    expect(() => runOnce(state, { id: 'x', name: 'teleport' as 'collect-all', input: {} }, NOW, ENV)).toThrow(RangeError)
  })

  it("names every owner action of 13 §6, and gives `buy` and `sell` their ledger ids from the operation's id", () => {
    expect(Object.keys(OPERATIONS)).toEqual([
      'start', 'queue', 'collect', 'collect-all', 'repeat', 'recall', 'speed-up', 'finish', 'upgrade', 'advance-scenario', 'promote', 'induct',
      'buy', 'sell', 'unlock-uma', 'exchange-shards', 'feature-uma', 'set-race-defaults', 'set-targets', 'set-check-in-times', 'set-repeat-sizing', 'set-card-set', 'set-assignments',
      'set-lineage', 'set-active-nodes', 'set-loadout', 'finish-race', 'dev-grant',
    ])
    const rich = { ...account(1, { carrot: 3 }), profile: { ...account(1).profile, prizeMoney: 500 } }
    const bought = runOnce(rich, { id: 'tap-9', name: 'buy', input: { sku: 'carrot', qty: 2, unitPrice: 108 } }, NOW, ENV)
    if (isRefusal(bought)) throw new Error(bought.reason)
    expect(bought.state.ledger.at(-1)!.id).toBe('buy:tap-9:pay')
    const sold = runOnce(bought.state, { id: 'tap-10', name: 'sell', input: { itemId: 'carrot', qty: 1, unitPrice: 36 } }, NOW, ENV)
    if (isRefusal(sold)) throw new Error(sold.reason)
    expect(sold.state.ledger.at(-1)!.id).toBe('sell:tap-10:pay')
  })
})

describe("the roster's two settings, once (T138)", () => {
  it('feature-uma and set-race-defaults apply once under their id, and refuse an Uma not in the Stable, storing nothing', () => {
    const state = account(2)
    const feature = { id: 'feat-1', name: 'feature-uma' as const, input: { outfitId: uma(2) } }
    const featured = runOnce(state, feature, NOW, ENV)
    if (isRefusal(featured)) throw new Error(featured.reason)
    expect(featured.state.profile.featuredUmaId).toBe(uma(2))
    const swapped = runOnce(featured.state, { id: 'feat-2', name: 'feature-uma', input: { outfitId: uma(1) } }, NOW, ENV)
    if (isRefusal(swapped)) throw new Error(swapped.reason)
    // The first tap's retry returns its first receipt and doesn't feature her again.
    expect(runOnce(swapped.state, feature, NOW + 1, ENV)).toEqual({ state: swapped.state, receipt: featured.receipt, repeated: true })
    expect(runOnce(state, { id: 'feat-3', name: 'feature-uma', input: { outfitId: 'nobody' } }, NOW, ENV)).toMatchObject({ code: 'unknown-uma' })

    const defaults = { id: 'race-1', name: 'set-race-defaults' as const, input: { umaId: uma(1), selectedPreset: 'long' as const } }
    const set = runOnce(state, defaults, NOW, ENV)
    if (isRefusal(set)) throw new Error(set.reason)
    expect(set.state.umas[uma(1)]!.raceDefaults.selectedPreset).toBe('long')
    expect(set.state.operations?.['race-1']).toEqual({ name: 'set-race-defaults', at: NOW, receipt: set.receipt })
    expect(runOnce(set.state, defaults, NOW + 1, ENV)).toMatchObject({ repeated: true, state: set.state })
    const refused = runOnce(state, { id: 'race-2', name: 'set-race-defaults', input: { umaId: 'nobody', selectedPreset: 'mile' } }, NOW, ENV)
    expect(refused).toMatchObject({ refused: true, code: 'unknown-uma' })
    expect(state.operations).toBeUndefined()
  })
})

describe("02 §9's stale screens end in a result or a one-sentence question", () => {
  const sentence = (text: string) => {
    expect(hasBannedWord(text), text).toBe(false)
    expect(/reload|review|retry|error/i.test(text), text).toBe(false)
  }

  it('still makes sense: it runs, and Collect all collects whatever is ready now', () => {
    let state = ok(start(account(2), { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 3) }, clock('08:00'), ENV)).state
    state = ok(start(state, { outfitId: uma(2), slot: slot('orchard'), request: gather('apple', 1) }, clock('08:00'), ENV)).state
    const answer = recheck(state, { id: 'c', name: 'collect-all', input: { shown: [slot('orchard')] } }, NOW, ENV)
    expect(answer.kind).toBe('done')
    if (answer.kind !== 'done') return
    expect(answer.receipt.lines.map((l) => [l.outfitId, l.status])).toEqual([[uma(2), 'collected'], [uma(1), 'collected']])
  })

  it('already done: shows that result, the same receipt for the same tap or "Already collected." for the other device', () => {
    const state = ok(start(account(1), { outfitId: uma(1), slot: slot('orchard'), request: gather('apple', 1) }, clock('08:00'), ENV)).state
    const first = recheck(state, { id: 'c1', name: 'collect-all', input: {} }, NOW, ENV)
    if (first.kind !== 'done') throw new Error(first.kind)
    const again = recheck(first.state, { id: 'c1', name: 'collect-all', input: {} }, NOW, ENV)
    expect(again).toMatchObject({ kind: 'done', repeated: true, receipt: first.receipt })
    const other = recheck(first.state, { id: 'c2', name: 'collect-all', input: { shown: [slot('orchard')] } }, NOW, ENV)
    if (other.kind !== 'done') throw new Error(other.kind)
    expect(other.receipt.lines.map((l) => fill(l.words!))).toEqual(['Already collected.'])
    sentence(CHECK_IN_WORDS['already-collected'])
  })

  it('the choice changed underneath: asks again with the new numbers, and yes starts it', () => {
    const state = account(1, { carrot: 3 })
    const answer = recheck(state, { id: 's1', name: 'start', input: { outfitId: uma(1), slot: slot('pantry'), request: craft('chopped-carrot', 6) } }, NOW, ENV)
    expect(answer.kind).toBe('ask')
    if (answer.kind !== 'ask') return
    expect(fill(answer.question)).toBe('Only 3 left now. Start ×3?')
    expect(fill(answer.question).split('?')).toHaveLength(2)
    sentence(fill(answer.question))
    const yes = runOnce(state, { id: 's2', name: 'start', input: answer.input }, NOW, ENV)
    expect(!isRefusal(yes) && yes.receipt.request).toEqual(craft('chopped-carrot', 3))
    // A session asks with its first unlocks.
    const dishes = account(1, { 'dish-vegetables-1': 2 })
    const session = recheck(dishes, { id: 's3', name: 'start', input: { outfitId: uma(1), slot: slot('observatory'), request: nodes(1, 2, 3) } }, NOW, ENV)
    expect(session.kind === 'ask' && fill(session.question)).toBe('Only 2 left now. Start ×2?')
    expect(session.kind === 'ask' && 'request' in session.input && session.input.request.kind === 'session' && session.input.request.unlocks.length).toBe(2)
  })

  it('a real rule: says it plainly, as "{uma} is busy until {time}."', () => {
    const state = ok(start(account(1, { carrot: 4 }), { outfitId: uma(1), slot: slot('pantry'), request: craft('chopped-carrot', 4) }, NOW, ENV)).state
    const answer = recheck(state, { id: 'b', name: 'start', input: { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 1) } }, NOW + 60_000, ENV)
    expect(answer).toEqual({ kind: 'say', words: { text: '{uma} is busy until {time}.', data: { uma: uma(1), time: NOW + 108 * 60_000, freeAt: NOW + 108 * 60_000 } } })
    if (answer.kind === 'say') sentence(answer.words.text)
    sentence(CHECK_IN_WORDS.offline)
    sentence(CHECK_IN_WORDS.unexpected)
  })
})

describe('the clock', () => {
  const working = (): WorkState => ok(start(account(1), { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 2) }, NOW, ENV)).state

  it('moved forward makes work Ready, and Collect all accepts it', () => {
    const state = working()
    const entry = state.work[uma(1)]!.entries[0]!
    expect(collectAll(state, {}, NOW + 60 * 60_000, ENV).receipt.lines).toEqual([])
    const forward = NOW + 5 * 60 * 60_000
    expect(remainingMs(entry, forward)).toBe(0)
    const { receipt } = collectAll(state, {}, forward, ENV)
    expect(receipt.lines).toMatchObject([{ outfitId: uma(1), status: 'collected', items: [{ item: 'wheat', qty: 2 }], freed: true }])
  })

  it('moved back makes waits longer and never negative', () => {
    const entry = working().work[uma(1)]!.entries[0]!
    let previous = -1
    for (const at of [NOW + 200 * 60_000, NOW + 60 * 60_000, NOW, NOW - 60 * 60_000, NOW - 24 * 60 * 60_000]) {
      const wait = remainingMs(entry, at)
      expect(wait).toBeGreaterThan(previous)
      expect(progress(entry, at)).toBeGreaterThanOrEqual(0)
      expect(nextCheckIn(at, [480, 780, 1350], 0) - at).toBeGreaterThan(0)
      previous = wait
    }
    expect(collectAll(working(), {}, NOW - 60 * 60_000, ENV).receipt.lines).toEqual([])
  })
})

describe("the collect commit raises the Exchange's stock mark (09 §5.3, §10; D345; T140)", () => {
  const STATS = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
  const PRESETS = { sprint: { stats: STATS, skillPoints: 0 }, mile: { stats: STATS, skillPoints: 0 }, medium: { stats: STATS, skillPoints: 0 }, long: { stats: STATS, skillPoints: 0 } }
  function done<T>(result: T): Exclude<T, { readonly refused: true }> {
    if (isRefusal(result)) throw new Error(result.reason)
    return result as Exclude<T, { readonly refused: true }>
  }
  const TWO_HOURS = 2 * 60 * 60_000

  it('a collect that lifts an Uma to Farm Lv 6 raises it to 2; a retry and promotion leave it there', () => {
    // 500 EXP from Lv 5 to 6 is 2,000 quarter points; one grade-1 gather pays 108 EXP (432 quarters) at C.
    const state = atFarmLevel(account(1), uma(1), 5, 1_600)
    expect(state.profile.exchangeGrade).toBe(1)
    const started = done(runOnce(state, { id: 'g-1', name: 'start', input: { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 1) } }, NOW, ENV))
    expect(started.state.profile.exchangeGrade).toBe(1)
    const later = NOW + TWO_HOURS
    const collected = done(runOnce(started.state, { id: 'c-1', name: 'collect', input: { outfitId: uma(1) } }, later, ENV))
    expect(collected.state.umas[uma(1)]!.farm.level).toBe(6)
    expect(collected.state.profile.exchangeGrade).toBe(2)

    const retried = done(runOnce(collected.state, { id: 'c-1', name: 'collect', input: { outfitId: uma(1) } }, later + 60_000, ENV))
    expect(retried.repeated).toBe(true)
    expect(retried.state).toBe(collected.state)

    const quiet = done(runOnce(collected.state, { id: 's-1', name: 'set-repeat-sizing', input: { sizing: 'fit' } }, later, ENV))
    expect(quiet.state.profile).toEqual({ ...collected.state.profile, repeatSizing: 'fit' })

    const her = collected.state.umas[uma(1)]!
    const run = { expeditionId: 'europe', races: 11, wins: 8, completed: true }
    const travelled = { ...collected.state, umas: { ...collected.state.umas, [uma(1)]: { ...her, expedition: { runs: [run] } } } }
    const promoted = done(runOnce(travelled, { id: 'p-1', name: 'promote', input: { umaId: uma(1), presets: PRESETS } }, later, ENV))
    expect(promoted.state.umas[uma(1)]!.farm.level).toBe(1)
    expect(promoted.state.profile.exchangeGrade).toBe(2)
  })

  it('every collect path raises it: Collect all, Recall, Repeat and a start that collects first', () => {
    const ready = (id: string): WorkState => {
      const state = atFarmLevel(account(1), uma(1), 5, 1_600)
      return done(runOnce(state, { id, name: 'start', input: { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 2) } }, NOW, ENV)).state
    }
    const both = NOW + 2 * TWO_HOURS
    expect(done(runOnce(ready('a'), { id: 'ca', name: 'collect-all', input: {} }, NOW + TWO_HOURS, ENV)).state.profile.exchangeGrade).toBe(2)
    expect(done(runOnce(ready('b'), { id: 'rc', name: 'recall', input: { outfitId: uma(1) } }, NOW + TWO_HOURS, ENV)).state.profile.exchangeGrade).toBe(2)
    const restart = done(runOnce(ready('c'), { id: 'st', name: 'start', input: { outfitId: uma(1), slot: slot('fields'), request: gather('wheat', 1) } }, both, ENV))
    expect(restart.receipt.collected?.farmLevel.to).toBe(6)
    expect(restart.state.profile.exchangeGrade).toBe(2)
    // Repeat collects nothing itself; a mark below the open grades (an older save) still rises on its commit.
    const collected = done(runOnce(ready('d'), { id: 'cd', name: 'collect', input: { outfitId: uma(1) } }, both, ENV)).state
    const lowered: WorkState = { ...collected, profile: { ...collected.profile, exchangeGrade: 1 } }
    expect(done(runOnce(lowered, { id: 'rp', name: 'repeat', input: {} }, both, ENV)).state.profile.exchangeGrade).toBe(2)
  })
})
