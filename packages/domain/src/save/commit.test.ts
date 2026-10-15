// Committing a tap (docs/rework/02-check-ins-and-notifications.md §9, §11; T134): applied with the rows it wrote, repeated
// with its first receipt and no rows, or refused with nothing written. A caller's bug throws. Item rows carry each
// movement's sign; a race writes its `raceResults` row with the scenario she raced in.
import { describe, expect, it } from 'vitest'
import { raceRun } from '../__fixtures__/race-run'
import { clock, DEV, ENV, opId, Store, uma } from '../__fixtures__/save'
import { goalRaceIds } from '../scenario-goals'
import { buyPrice } from '../economy/exchange'
import { racePrizeLedgerId } from '../economy/ledger'
import { sellPrice } from '../economy/selling'
import { craftedItem, rawItem, SPEED_TICKET_ID } from '../items/catalogue'
import type { OperationName, OperationReceipt } from '../check-in/once'
import type { ItemMovement } from '../work/types'
import { commitOperation, itemLedgerRows, parseOperationEnvelope, raceResultRow, type Commit } from './commit'
import { initialSave } from './initial'
import { rowKey } from './rows'
import type { SaveState } from './state'

const T0 = clock('07:00')
const VEG = rawItem('vegetables', 1).id
const CHOPPED = craftedItem('vegetables', 1).id

/** A new account with these taps applied in order, each a minute apart. */
function play(taps: readonly [OperationName, unknown][], env = DEV): { store: Store; state: SaveState; commits: Commit[] } {
  const store = new Store()
  const created = initialSave(T0)
  store.write(created.entities, created.logs, T0)
  let state: SaveState = created.state
  const commits: Commit[] = []
  taps.forEach(([name, input], n) => {
    const commit = store.commit(state, { id: opId(n + 1), name, input, at: T0 + (n + 1) * 60_000 }, env)
    commits.push(commit)
    if (commit.status !== 'refused') state = commit.state
  })
  return { store, state, commits }
}

describe('commitOperation', () => {
  it('applies a tap: the entities it changed, the new ledger rows, and its operations row', () => {
    const { commits } = play([['unlock-uma', { outfitId: uma(1) }]])
    const commit = commits[0]!
    if (commit.status !== 'applied') throw new Error(commit.status)
    expect(commit.entities.map(rowKey)).toEqual(['profile/main', `umas/${uma(1)}`])
    expect(commit.logs.map(rowKey)).toEqual([`ledger/unlock-uma:${uma(1)}`, `operations/${opId(1)}`])
    expect(commit.logs.at(-1)).toMatchObject({ at: T0 + 60_000, data: { name: 'unlock-uma', at: T0 + 60_000, receipt: commit.receipt } })
    expect(commit.state.profile.umaTickets).toBe(19)
  })

  it('writes nothing for a refusal, and stores no receipt', () => {
    const { store, commits, state } = play([['buy', { sku: SPEED_TICKET_ID, qty: 1, unitPrice: 30 }]])
    expect(commits[0]).toEqual({ status: 'refused', refusal: expect.objectContaining({ refused: true, code: 'prize-money' }) })
    expect(state.operations).toBeUndefined()
    expect([...store.logs.keys()]).toEqual(['ledger/initial-uma-tickets'])
  })

  it('returns the first receipt for a repeated id, with no rows, and throws for an id reused under another name', () => {
    const { state, commits } = play([['unlock-uma', { outfitId: uma(1) }]])
    const first = commits[0] as Extract<Commit, { status: 'applied' }>
    const again = commitOperation(state, { id: opId(1), name: 'unlock-uma', input: { outfitId: uma(1) }, at: T0 + 999_000 }, ENV)
    expect(again).toEqual({ status: 'repeated', state, receipt: first.receipt, entities: [], logs: [] })
    expect(() => commitOperation(state, { id: opId(1), name: 'collect-all', input: {}, at: T0 }, ENV)).toThrow(RangeError)
  })

  it('throws on a malformed input or id, and on an input a rule rejects as malformed', () => {
    const { state } = play([['unlock-uma', { outfitId: uma(1) }]])
    expect(() => commitOperation(state, { id: opId(7), name: 'unlock-uma', input: { outfitId: uma(2), extra: 1 }, at: T0 }, ENV)).toThrow(RangeError)
    expect(() => commitOperation(state, { id: 'x', name: 'unlock-uma', input: { outfitId: uma(2) }, at: T0 }, ENV)).toThrow(RangeError)
    // A slot index the building doesn't have at any level parses, but the rule calls it a bug.
    expect(() => commitOperation(state, { id: opId(8), name: 'start', input: { outfitId: uma(1), slot: { building: 'gym', room: 'speed', slot: 1 }, request: { kind: 'session', unlocks: [{ kind: 'single', target: 'speed-01' }] } }, at: T0 }, ENV)).toThrow(RangeError)
  })

  it('writes item rows whose signs follow the movement kinds', () => {
    // The craft starts at the fourth tap's time, which `speed-up` names.
    const run = play([
      ['unlock-uma', { outfitId: uma(1) }],
      ['dev-grant', { prizeMoney: 5_000, items: { [VEG]: 3, [CHOPPED]: 4 } }],
      ['buy', { sku: SPEED_TICKET_ID, qty: 2, unitPrice: buyPrice(SPEED_TICKET_ID) }],
      ['start', { outfitId: uma(1), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: CHOPPED, count: 3 } }],
      ['speed-up', { outfitId: uma(1), startedAt: T0 + 4 * 60_000, tickets: 1 }],
      ['recall', { outfitId: uma(1) }],
      ['upgrade', { building: 'vegetable-garden' }],
      ['sell', { itemId: VEG, qty: 1, unitPrice: sellPrice(VEG) }],
    ])
    expect(run.commits.map((commit) => commit.status)).toEqual(Array(8).fill('applied'))
    const reasons = [...run.store.logs.values()].flatMap((row) => (row.kind === 'itemLedger' ? [[row.data.reason, Math.sign(row.data.delta)]] : []))
    expect(new Map(reasons as [string, number][])).toEqual(new Map([
      // The ticket finished her first item, so Recall paid it before returning the rest.
      ['dev-grant', 1], ['buy', 1], ['reserve', -1], ['ticket', -1], ['output', 1], ['return', 1], ['cost', -1], ['sell', -1],
    ]))
    const movement = (kind: ItemMovement['kind']): ItemMovement => ({ kind, item: VEG, qty: 2, outfitId: kind === 'cost' ? null : uma(1), at: T0 })
    const rows = itemLedgerRows(opId(9), { movements: (['reserve', 'return', 'output', 'cost', 'ticket'] as const).map(movement) }, T0)
    expect(rows.map((row) => [row.id, row.reason, row.delta, row.outfitId])).toEqual([
      [`${opId(9)}:m0`, 'reserve', -2, uma(1)], [`${opId(9)}:m1`, 'return', 2, uma(1)], [`${opId(9)}:m2`, 'output', 2, uma(1)],
      [`${opId(9)}:m3`, 'cost', -2, null], [`${opId(9)}:m4`, 'ticket', -2, uma(1)],
    ])
    expect(itemLedgerRows(opId(9), { itemLedger: [{ id: `buy:${opId(9)}:get`, itemId: VEG, delta: 2, reason: 'buy', at: T0 }] }, T0))
      .toEqual([{ id: `buy:${opId(9)}:get`, itemId: VEG, delta: 2, reason: 'buy', outfitId: null, opId: opId(9), at: T0 }])
  })

  it('writes a race as its raceResults row, under its id, with the scenario she raced in and the commit', () => {
    const store = new Store()
    const created = initialSave(T0)
    store.write(created.entities, created.logs, T0)
    const unlocked = store.commit(created.state, { id: opId(1), name: 'unlock-uma', input: { outfitId: uma(1) }, at: T0 }, ENV)
    if (unlocked.status !== 'applied') throw new Error(unlocked.status)
    const raceId = goalRaceIds(unlocked.state.umas[uma(1)]!.career.goals[0]!)[0]!
    const input = { umaId: uma(1), raceId, placement: 1, localDay: '2026-10-14', board: [], run: raceRun(uma(1)) }
    const raced = store.commit(unlocked.state, { id: opId(2), name: 'finish-race', input, at: T0 + 5 }, ENV)
    if (raced.status !== 'applied') throw new Error(raced.status)
    expect(raced.logs.map(rowKey)).toEqual([`ledger/${racePrizeLedgerId(opId(2))}`, `raceResults/${opId(2)}`, `operations/${opId(2)}`])
    expect(store.logs.get(`raceResults/${opId(2)}`)!.data).toEqual({
      umaId: uma(1), raceId, opId: opId(2), at: T0 + 5, tier: 1, scenario: 1, cardSetIds: [], run: input.run, commit: raced.receipt,
    })
  })

  it("keeps the set she raced with: the preset of the race's distance, as the operation left her (T141, Era Loyalist)", () => {
    const store = new Store()
    const created = initialSave(T0)
    store.write(created.entities, created.logs, T0)
    const unlocked = store.commit(created.state, { id: opId(1), name: 'unlock-uma', input: { outfitId: uma(1) }, at: T0 }, ENV)
    if (unlocked.status !== 'applied') throw new Error(unlocked.status)
    const raceId = goalRaceIds(unlocked.state.umas[uma(1)]!.career.goals[0]!)[0]!
    const distance = ENV.content.races.find((race) => race.id === raceId)!.distanceCategory
    const her = unlocked.state.umas[uma(1)]!
    const withSet = (state: typeof unlocked.state, ids: string[]) => ({
      ...state,
      umas: { ...state.umas, [uma(1)]: { ...her, build: { ...her.build, presets: { ...her.build.presets, [distance]: { ...her.build.presets[distance], cardSetIds: ids } } } } },
    })
    const input = { umaId: uma(1), raceId, placement: 1, localDay: '2026-10-14', board: [], run: raceRun(uma(1)) }
    const raced = store.commit(unlocked.state, { id: opId(2), name: 'finish-race', input, at: T0 + 5 }, ENV)
    if (raced.status !== 'applied') throw new Error(raced.status)
    const receipt = raced.receipt as OperationReceipt<'finish-race'>
    const row = raceResultRow(withSet(unlocked.state, ['before']), withSet(raced.state, ['after-1', 'after-2']), opId(2), T0 + 5, input, receipt, ENV)
    expect(row).toMatchObject({ tier: 1, scenario: 1, cardSetIds: ['after-1', 'after-2'], opId: opId(2), at: T0 + 5 })
  })

  it('refuses dev-grant unless the env says dev', () => {
    const { commits } = play([['dev-grant', { prizeMoney: 100 }]], ENV)
    expect(commits[0]).toMatchObject({ status: 'refused', refusal: { code: 'dev-only' } })
    expect(play([['dev-grant', { prizeMoney: 100 }]], DEV).commits[0]!.status).toBe('applied')
  })
})

describe('the envelope', () => {
  it('is exactly { id, name, input, at }, with an 8-64 character id and a known name; the input is checked later', () => {
    const envelope = { id: opId(1), name: 'collect-all', input: { surprise: 1 }, at: T0 }
    expect(parseOperationEnvelope(envelope)).toEqual(envelope)
    for (const bad of [
      { ...envelope, id: 'short' }, { ...envelope, id: 'has:colon:in-it' }, { ...envelope, id: 'x'.repeat(65) }, { ...envelope, name: 'teleport' },
      { ...envelope, at: -1 }, { ...envelope, extra: 1 }, { id: opId(1), name: 'collect-all', at: T0 },
      { ...envelope, input: { big: 'x'.repeat(600 * 1024) } },
    ]) expect(typeof parseOperationEnvelope(bad), JSON.stringify(bad).slice(0, 80)).toBe('string')
  })
})
