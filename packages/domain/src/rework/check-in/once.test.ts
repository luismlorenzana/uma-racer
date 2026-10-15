// Retries, stale screens and the clock (docs/rework/02-check-ins-and-notifications.md §8, §9, §12): an operation runs
// once under its id; every stale-screen case ends in a result or a one-sentence question, never an error; a clock
// moved forward makes work Ready and Collect all accepts it; one moved back makes waits longer, never negative.
import { describe, expect, it } from 'vitest'
import { account, clock, craft, ENV, gather, nodes, ok, slot, uma } from '../../__fixtures__/rework-check-in'
import { isRefusal } from '../types'
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
      'buy', 'sell', 'unlock-uma', 'exchange-shards', 'set-targets', 'set-check-in-times', 'set-repeat-sizing', 'set-card-set', 'set-assignments',
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
