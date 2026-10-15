// Operation inputs (docs/rework/13-removals-and-plan-changes.md §6; T134): every operation has a strict parser that takes
// a well-formed input back as it is and refuses an unknown key; a rule's own refusal is never a parser's.
import { describe, expect, it } from 'vitest'
import { raceRun } from '../__fixtures__/race-run'
import { OPERATIONS, type OperationName } from '../rework/check-in/once'
import { OPERATION_INPUTS } from './inputs'

const STATS = { speed: 400, stamina: 300, power: 350, guts: 250, wit: 300 }
const slot = { building: 'pantry', slot: 0 }

/** A well-formed input for every operation, and more than one where the operation has variants. */
const SAMPLES: Readonly<Record<OperationName, readonly Record<string, unknown>[]>> = {
  start: [
    { outfitId: 'uma-01', slot, request: { kind: 'craft', item: 'chopped-carrot', count: 4 } },
    { outfitId: 'uma-01', slot: { building: 'gym', room: 'speed', slot: 0 }, request: { kind: 'session', unlocks: [{ kind: 'single', target: 'speed-01' }] } },
    { outfitId: 'uma-01', from: 'dropped' },
    { outfitId: 'uma-01', from: 'dropped', count: 3 },
  ],
  queue: [
    { outfitId: 'uma-01', add: { request: { kind: 'gather', item: 'carrot', count: 2 }, building: 'vegetable-garden' } },
    { outfitId: 'uma-01', add: { request: { kind: 'session', unlocks: [{ kind: 'bond', target: 'speed-e1' }] }, building: 'dojo', room: 'speed' } },
    { outfitId: 'uma-01', remove: 0 },
    { outfitId: 'uma-01', move: { from: 2, to: 0 } },
    { outfitId: 'uma-01', dismiss: true },
  ],
  collect: [{ outfitId: 'uma-01' }],
  'collect-all': [{}, { places: ['pantry', 'kitchen'], shown: [slot] }],
  repeat: [{}, { outfitIds: ['uma-01'], places: ['pantry'], utcOffsetMin: -300 }],
  recall: [{ outfitId: 'uma-01' }],
  'speed-up': [{ outfitId: 'uma-01', startedAt: 1_000, tickets: 2 }, { all: true, span: 60 }, { all: true, span: 'next-check-in', utcOffsetMin: 540 }],
  finish: [{ outfitId: 'uma-01', startedAt: 1_000 }],
  upgrade: [{ building: 'kitchen' }],
  'advance-scenario': [{ umaId: 'uma-01' }],
  promote: [{ umaId: 'uma-01', presets: { sprint: { stats: STATS, skillPoints: 1 }, mile: { stats: STATS, skillPoints: 2 }, medium: { stats: STATS, skillPoints: 3 }, long: { stats: STATS, skillPoints: 4 } } }],
  induct: [{ umaId: 'uma-01' }],
  buy: [{ sku: 'speed-ticket', qty: 3, unitPrice: 30 }],
  sell: [{ itemId: 'carrot', qty: 1, unitPrice: 36 }],
  'unlock-uma': [{ outfitId: 'uma-01' }],
  'exchange-shards': [{}],
  'set-targets': [{ outfitIds: [] }, { outfitIds: ['uma-01', 'uma-02'] }],
  'set-check-in-times': [{ times: [480, 780, 1_350] }],
  'set-repeat-sizing': [{ sizing: 'fit' }],
  'set-card-set': [{ umaId: 'uma-01', preset: 'mile', cardSetIds: ['speed-e1', 'wit-e1'] }],
  'set-assignments': [{ umaId: 'uma-01', preset: 'mile', assignments: { n1: 'speed-e1', n2: 'wit-e1' } }],
  'set-lineage': [{ umaId: 'uma-01', preset: 'long', lineage: { parent0: 'uma-02', 'parent1-gp0': 'uma-03' } }],
  'set-active-nodes': [{ umaId: 'uma-01', preset: 'sprint', nodeIds: ['speed-01'] }],
  'set-loadout': [{ umaId: 'uma-01', preset: 'medium', skillIds: ['hint1-speed-e1'] }],
  'finish-race': [{ umaId: 'uma-01', raceId: 'race-1', placement: 2, localDay: '2026-10-14', board: ['race-1', 'race-2'], run: raceRun('uma-01', 2) }],
  'dev-grant': [{ prizeMoney: 1_000 }, { items: { carrot: 5 }, umaTickets: 2, finish: 'uma-01', gate: 'uma-02' }],
}

/** Per operation, inputs that are malformed rather than refused by a rule. */
const MALFORMED: Readonly<Partial<Record<OperationName, readonly unknown[]>>> = {
  start: [{ outfitId: 'uma-01', slot: { building: 'castle', slot: 0 }, request: { kind: 'craft', item: 'x', count: 1 } },
    { outfitId: 'uma-01', slot: { building: 'gym', slot: 0 }, request: { kind: 'craft', item: 'x', count: 1 } },
    { outfitId: 'uma-01', slot, request: { kind: 'teleport', item: 'x', count: 1 } }, { outfitId: 'uma-01', from: 'queue' }],
  queue: [{ outfitId: 'uma-01', remove: -1 }, { outfitId: 'uma-01', dismiss: false }],
  'speed-up': [{ all: true, span: 30 }, { outfitId: 'uma-01', startedAt: 1, tickets: 0 }, { all: true, span: 60, utcOffsetMin: 900 }],
  'set-check-in-times': [{ times: [1_440] }, { times: [480.5] }, { times: 'morning' }],
  'set-repeat-sizing': [{ sizing: 'double' }],
  'set-lineage': [{ umaId: 'uma-01', preset: 'long', lineage: { parent2: 'uma-02' } }],
  'set-card-set': [{ umaId: 'uma-01', preset: 'turf', cardSetIds: [] }],
  'set-targets': [{ outfitIds: ['uma-01', 'uma-01'] }],
  promote: [{ umaId: 'uma-01', presets: { sprint: { stats: STATS, skillPoints: 1 } } }],
  'finish-race': [
    { umaId: 'uma-02', raceId: 'race-1', placement: 2, localDay: '2026-10-14', board: [], run: raceRun('uma-01', 2) },
    { umaId: 'uma-01', raceId: 'race-1', placement: 1, localDay: '2026-10-14', board: [], run: raceRun('uma-01', 2) },
    { umaId: 'uma-01', raceId: 'race-1', placement: 2, localDay: '14/10/2026', board: [], run: raceRun('uma-01', 2) },
    { umaId: 'uma-01', raceId: 'race-1', placement: 2, localDay: '2026-10-14', board: ['a', 'b', 'c', 'd'], run: raceRun('uma-01', 2) },
  ],
  'dev-grant': [{}, { items: {} }, { items: { 'no-such-item': 1 } }, { prizeMoney: 0 }, { umaTickets: -2 }],
}

describe('operation inputs', () => {
  it('has a parser for every operation, and nothing else', () => {
    expect(Object.keys(OPERATION_INPUTS).sort()).toEqual(Object.keys(OPERATIONS).sort())
  })

  it.each(Object.keys(OPERATIONS) as OperationName[])('%s takes a well-formed input back and refuses an unknown key', (name) => {
    const parse = OPERATION_INPUTS[name] as (value: unknown) => unknown
    for (const sample of SAMPLES[name]) {
      expect(parse(JSON.parse(JSON.stringify(sample))), JSON.stringify(sample)).toEqual(sample)
      expect(parse({ ...sample, surprise: 1 })).toBeNull()
    }
    for (const value of [null, 'input', 42, [], ...(MALFORMED[name] ?? [])]) expect(parse(value), JSON.stringify(value)).toBeNull()
  })

  it('reads a field holding undefined as absent, as JSON does, so an outbox kept by structured clone parses the same', () => {
    const request = { kind: 'craft', item: 'chopped-carrot', count: 4 }
    expect(OPERATION_INPUTS.start({ outfitId: 'uma-01', slot: { building: 'pantry', room: undefined, slot: 0 }, request }))
      .toEqual({ outfitId: 'uma-01', slot: { building: 'pantry', slot: 0 }, request })
    expect(OPERATION_INPUTS.repeat({ outfitIds: undefined, utcOffsetMin: 60 })).toEqual({ utcOffsetMin: 60 })
    expect(OPERATION_INPUTS['dev-grant']({ prizeMoney: undefined })).toBeNull()
    expect(OPERATION_INPUTS.collect({ outfitId: undefined })).toBeNull()
  })

  it("leaves a rule's limits to the rule: a size of 12, a sixth target or two check-in times at once parse", () => {
    expect(OPERATION_INPUTS.start({ outfitId: 'uma-01', slot, request: { kind: 'craft', item: 'chopped-carrot', count: 12 } })).not.toBeNull()
    expect(OPERATION_INPUTS['set-targets']({ outfitIds: ['a', 'b', 'c', 'd', 'e', 'f'] })).not.toBeNull()
    expect(OPERATION_INPUTS['set-check-in-times']({ times: [480, 480] })).not.toBeNull()
    expect(OPERATION_INPUTS.buy({ sku: 'dish-vegetables-1', qty: 0, unitPrice: 1 })).not.toBeNull()
  })
})
