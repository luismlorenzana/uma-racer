// Rows and back (docs/rework/13-removals-and-plan-changes.md §6; T134). A scripted synthetic account — unlocks, a race,
// purchases, starts, a queue, a Speed Ticket, a recall, Collect all, a sale, an upgrade, Repeat, a second race, an
// advance and a promotion — goes to rows after every operation and back to an equal state, through JSON too. The same
// script run on the full ledger and on the rule rows re-read from the rows gives the same account and receipts at every
// step, and the ledgers' audits hold: each balance and each item count is the sum of its rows.
import { describe, expect, it } from 'vitest'
import { raceRun } from '../__fixtures__/race-run'
import { CHECK_IN_CONTENT } from '../__fixtures__/check-in'
import { placeUma } from '../__fixtures__/tiers'
import { clock, DEV, ENV, opId, stock, Store, uma } from '../__fixtures__/save'
import { goalRaceIds } from '../scenario-goals'
import type { OperationEnv, OperationName } from '../check-in/once'
import { buyPrice } from '../economy/exchange'
import { sellPrice } from '../economy/selling'
import { craftedItem, rawItem, SPEED_TICKET_ID } from '../items/catalogue'
import { LEDGER_BALANCE, type LedgerEntry, type LedgerResource } from '../state/types'
import { initialSave } from './initial'
import { parseEntityRow, parseLogRow } from './parse'
import type { EntityRow, LogRow } from './rows'
import { entityChanges, isRuleLedgerRow, toSaveState, type SaveState } from './state'

const VEG = rawItem('vegetables', 1).id
const CHOPPED = craftedItem('vegetables', 1).id
const T0 = clock('07:00')
const DAY = '2026-10-14'
const STATS = { speed: 400, stamina: 300, power: 350, guts: 250, wit: 300 }

type Step =
  | { readonly kind: 'op'; readonly name: OperationName; readonly input: (s: SaveState) => unknown; readonly at: number; readonly env?: OperationEnv }
  /** A test-only shortcut past rules whose own tests cover them (an Expedition is phase 9's), written as entity rows. */
  | { readonly kind: 'shortcut'; readonly apply: (s: SaveState) => SaveState; readonly at: number }

const op = (name: OperationName, input: (s: SaveState) => unknown, at: number, env?: OperationEnv): Step => ({ kind: 'op', name, input, at, ...(env ? { env } : {}) })
const her = (s: SaveState, n: number) => s.umas[uma(n)]!
const firstGoalRace = (s: SaveState, n: number) => goalRaceIds(her(s, n).career.goals.find((goal) => goal.status === 'active')!)[0]!
const running = (s: SaveState, n: number) => s.work[uma(n)]!.entries.at(-1)!.startedAt

const SCRIPT: readonly Step[] = [
  op('unlock-uma', () => ({ outfitId: uma(1) }), clock('08:00')),
  op('unlock-uma', () => ({ outfitId: uma(2) }), clock('08:01')),
  op('unlock-uma', () => ({ outfitId: uma(3) }), clock('08:02')),
  op('finish-race', (s) => ({ umaId: uma(1), raceId: firstGoalRace(s, 1), placement: 1, localDay: DAY, board: [firstGoalRace(s, 1)], run: raceRun(uma(1)) }), clock('08:05')),
  op('dev-grant', () => ({ prizeMoney: 3_000 }), clock('08:06'), DEV),
  op('buy', () => ({ sku: VEG, qty: 6, unitPrice: buyPrice(VEG) }), clock('08:07')),
  op('buy', () => ({ sku: SPEED_TICKET_ID, qty: 2, unitPrice: buyPrice(SPEED_TICKET_ID) }), clock('08:08')),
  op('start', () => ({ outfitId: uma(2), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: CHOPPED, count: 4 } }), clock('08:20')),
  op('start', () => ({ outfitId: uma(3), slot: { building: 'vegetable-garden', slot: 0 }, request: { kind: 'gather', item: VEG, count: 3 } }), clock('08:21')),
  op('queue', () => ({ outfitId: uma(3), add: { request: { kind: 'gather', item: VEG, count: 2 }, building: 'vegetable-garden' } }), clock('08:22')),
  op('speed-up', (s) => ({ outfitId: uma(3), startedAt: running(s, 3), tickets: 1 }), clock('08:30')),
  op('start', () => ({ outfitId: uma(1), slot: { building: 'pantry', slot: 1 }, request: { kind: 'craft', item: CHOPPED, count: 2 } }), clock('08:31')),
  op('recall', () => ({ outfitId: uma(1) }), clock('08:40')),
  // A refusal writes nothing, and the script runs on.
  op('unlock-uma', () => ({ outfitId: uma(1) }), clock('08:41')),
  op('collect-all', () => ({}), clock('14:00')),
  op('sell', () => ({ itemId: CHOPPED, qty: 1, unitPrice: sellPrice(CHOPPED) }), clock('14:01')),
  op('dev-grant', () => ({ prizeMoney: 2_000, items: { [CHOPPED]: 1 } }), clock('14:02'), DEV),
  op('upgrade', () => ({ building: 'vegetable-garden' }), clock('14:03')),
  op('repeat', () => ({}), clock('14:05')),
  op('finish-race', (s) => ({ umaId: uma(2), raceId: firstGoalRace(s, 2), placement: 3, localDay: DAY, board: [], run: raceRun(uma(2), 3) }), clock('14:10')),
  op('dev-grant', () => ({ gate: uma(1) }), clock('14:20'), DEV),
  // The gate's Shard is once-only by its ledger row, which the rule rows keep: the second jump pays nothing.
  op('dev-grant', () => ({ gate: uma(1) }), clock('14:20'), DEV),
  op('advance-scenario', () => ({ umaId: uma(1) }), clock('14:21')),
  op('set-targets', () => ({ outfitIds: [uma(2), uma(3)] }), clock('14:22')),
  op('set-check-in-times', () => ({ times: [420, 1_230] }), clock('14:23')),
  op('set-repeat-sizing', () => ({ sizing: 'fit' }), clock('14:24')),
  {
    kind: 'shortcut', at: clock('14:30'),
    apply: (s) => ({
      ...s,
      umas: {
        ...s.umas,
        [uma(1)]: {
          ...placeUma(her(s, 1), { tier: 1, scenario: 5, level: 50, careerWon: true }, CHECK_IN_CONTENT),
          expedition: { runs: [{ expeditionId: 'europe', races: 9, wins: 8, completed: true }] },
        },
      },
    }),
  },
  op('promote', () => ({ umaId: uma(1), presets: Object.fromEntries(['sprint', 'mile', 'medium', 'long'].map((d) => [d, { stats: STATS, skillPoints: 120 }])) }), clock('14:31')),
  op('collect-all', () => ({}), clock('08:00', 1)),
]

/** What the rules read of a state, with the ledger at its rule rows in the rows' order. */
const ruleView = (s: SaveState) => ({
  profile: s.profile, umas: s.umas, work: s.work, items: stock(s.items), buildings: s.buildings,
  ledger: s.ledger.filter(isRuleLedgerRow).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)),
})

interface Run {
  readonly store: Store
  readonly receipts: unknown[]
  readonly statuses: string[]
  readonly views: ReturnType<typeof ruleView>[]
}

/** Runs the script: on its own full-ledger state, or (`reread`) on the state read back from the rows before each step. */
function run(reread: boolean, check?: (store: Store, state: SaveState) => void): Run {
  const store = new Store()
  const created = initialSave(T0)
  store.write(created.entities, created.logs, T0)
  let state: SaveState = created.state
  const out: Run = { store, receipts: [], statuses: [], views: [] }
  SCRIPT.forEach((step, n) => {
    if (reread) state = store.state()
    if (step.kind === 'shortcut') {
      const next = step.apply(state)
      store.write(entityChanges(state, next), [], step.at)
      state = next
    } else {
      const commit = store.commit(state, { id: opId(n), name: step.name, input: step.input(state), at: step.at }, step.env ?? ENV)
      out.statuses.push(`${step.name}:${commit.status}`)
      out.receipts.push(commit.status === 'refused' ? commit.refusal : commit.receipt)
      if (commit.status !== 'refused') state = commit.state
    }
    out.views.push(ruleView(state))
    check?.(store, state)
  })
  return out
}

describe('rows and back', () => {
  it('reads every step back to an equal state, through JSON too', () => {
    const result = run(false, (store, state) => {
      expect(ruleView(store.state())).toEqual(ruleView(state))
      expect(store.state().operations).toEqual(state.operations)
      const wire = JSON.parse(JSON.stringify(store.rows())) as { entities: unknown[]; logs: unknown[] }
      const entities = wire.entities.map(parseEntityRow)
      const logs = wire.logs.map(parseLogRow)
      expect(entities.every((row) => row !== null) && logs.every((row) => row !== null)).toBe(true)
      expect(toSaveState(entities as EntityRow[], logs as LogRow[])).toEqual(store.state())
    })
    expect(result.statuses.filter((status) => !status.endsWith(':applied'))).toEqual(['unlock-uma:refused'])
    const end = result.store.state()
    expect(end.umas[uma(1)]).toMatchObject({ tier: 2, scenario: 1 })
    expect(end.buildings['vegetable-garden']).toEqual({ level: 2 })
    expect(Object.keys(end.umas)).toHaveLength(3)
  })

  it('needs only the rule rows of the ledger: the same script on them gives the same account and receipts', () => {
    const full = run(false)
    const reread = run(true)
    expect(reread.statuses).toEqual(full.statuses)
    reread.views.forEach((view, n) => expect(view, `step ${n}`).toEqual(full.views[n]))
    reread.receipts.forEach((receipt, n) => expect(receipt, `step ${n}`).toEqual(full.receipts[n]))
    const jumps = full.receipts.filter((receipt) => (receipt as { gate?: unknown }).gate) as { gate: { shardsPaid: number } }[]
    expect(jumps.map((receipt) => receipt.gate.shardsPaid)).toEqual([1, 0])
  })

  it("keeps the audits: each balance is its ledger rows' sum, and each item count its item rows' sum", () => {
    const { store } = run(false)
    const { entities, logs } = store.rows()
    const profile = store.state().profile
    const ledger = logs.filter((row): row is LogRow<'ledger'> => row.kind === 'ledger').map((row) => row.data as LedgerEntry)
    for (const resource of Object.keys(LEDGER_BALANCE) as LedgerResource[]) {
      const total = ledger.filter((row) => row.resource === resource).reduce((sum, row) => sum + row.delta, 0)
      expect(total, resource).toBe(profile[LEDGER_BALANCE[resource]])
    }
    const moved = new Map<string, number>()
    for (const row of logs) if (row.kind === 'itemLedger') moved.set(row.data.itemId, (moved.get(row.data.itemId) ?? 0) + row.data.delta)
    // Reserved inputs have left the Warehouse: what work rows hold reserved is the rest of the item rows' sum.
    const held = new Map<string, number>()
    for (const row of entities) if (row.kind === 'items') held.set(row.id, row.data.count)
    for (const [item, total] of moved) expect(held.get(item) ?? 0, item).toBe(total)
    expect([...held].filter(([, count]) => count > 0).every(([item]) => moved.has(item))).toBe(true)
  })

  it('never deletes a row: a work row that empties is written empty, and a used-up item as 0', () => {
    const { store } = run(false)
    const recalled = [...store.rows().entities].find((row) => row.kind === 'work' && row.id === uma(1))
    expect(recalled?.data).toEqual({ outfitId: uma(1), slot: null, entries: [], queue: [], last: null, dropped: null })
    expect(recalled!.version).toBeGreaterThan(1)
    expect(store.state().work[uma(1)]).toBeUndefined()

    const sold = new Store()
    const created = initialSave(T0)
    sold.write(created.entities, created.logs, T0)
    let state: SaveState = created.state
    for (const [n, name, input, env] of [
      [1, 'dev-grant', { items: { [VEG]: 2 } }, DEV],
      [2, 'sell', { itemId: VEG, qty: 2, unitPrice: sellPrice(VEG) }, ENV],
    ] as const) {
      const commit = sold.commit(state, { id: opId(n), name, input, at: T0 + n }, env)
      if (commit.status !== 'applied') throw new Error(commit.status)
      state = commit.state
    }
    expect(sold.entities.get(`items/${VEG}`)).toMatchObject({ version: 2, data: { count: 0 } })
    expect(sold.state().items).toEqual({})
  })
})
