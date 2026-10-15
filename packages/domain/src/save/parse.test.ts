// The row parsers (docs/rework/13-removals-and-plan-changes.md §6; T134): every kind takes its fixture back as it is, and
// refuses an unknown key, a wrong id, an out-of-range number, another generation or schema, and every retired kind.
import { describe, expect, it } from 'vitest'
import { raceRun } from '../__fixtures__/race-run'
import { clock, DEV, ENV, opId, Store, uma } from '../__fixtures__/save'
import { createTrainerBadgeState, type FlairEventV1 } from '../badges'
import { flairEventId } from '../flair'
import { goalRaceIds } from '../scenario-goals'
import { buyPrice } from '../economy/exchange'
import { craftedItem, rawItem, SPEED_TICKET_ID } from '../items/catalogue'
import type { OperationName } from '../check-in/once'
import { initialSave } from './initial'
import { ENTITY_KINDS, LOG_KINDS, SAVE_LIMITS, type SaveKind } from './kinds'
import { jsonBytes, parseEntityData, parseEntityRow, parseLogData, parseLogRow } from './parse'
import { entityDraft, logDraft, stampEntity, stampLog, type EntityRow, type LogRow } from './rows'
import type { SaveState } from './state'

const T0 = clock('07:00')
const VEG = rawItem('vegetables', 1).id
const CHOPPED = craftedItem('vegetables', 1).id

/** A small account with a row of every kind: a running job with a queue, a session, a race, purchases, badges and flair. */
function rows(): { entities: EntityRow[]; logs: LogRow[] } {
  const store = new Store()
  const created = initialSave(T0)
  store.write(created.entities, created.logs, T0)
  let state: SaveState = created.state
  const step = (n: number, name: OperationName, input: (s: SaveState) => unknown, env = ENV) => {
    const commit = store.commit(state, { id: opId(n), name, input: input(state), at: T0 + n * 60_000 }, env)
    if (commit.status !== 'applied') throw new Error(`${name}: ${commit.status}`)
    state = commit.state
  }
  step(1, 'unlock-uma', () => ({ outfitId: uma(1) }))
  step(2, 'unlock-uma', () => ({ outfitId: uma(2) }))
  step(3, 'dev-grant', () => ({ prizeMoney: 2_000, items: { [VEG]: 4, 'dish-vegetables-1': 1 } }), DEV)
  step(4, 'start', () => ({ outfitId: uma(1), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: CHOPPED, count: 2 } }))
  step(5, 'queue', () => ({ outfitId: uma(1), add: { request: { kind: 'craft', item: CHOPPED, count: 1 }, building: 'pantry' } }))
  step(6, 'start', () => ({ outfitId: uma(2), slot: { building: 'observatory', slot: 0 }, request: { kind: 'session', unlocks: [{ kind: 'node', target: 'n1' }] } }))
  step(7, 'buy', () => ({ sku: SPEED_TICKET_ID, qty: 1, unitPrice: buyPrice(SPEED_TICKET_ID) }))
  step(8, 'finish-race', (s) => {
    const raceId = goalRaceIds(s.umas[uma(2)]!.career.goals[0]!)[0]!
    return { umaId: uma(2), raceId, placement: 2, localDay: '2026-10-14', board: [], run: raceRun(uma(2), 2) }
  })
  const flair: FlairEventV1 = {
    version: 1, scope: 'uma', umaId: uma(1), kind: 'badge-tier', awardKey: 'synthetic-award', stage: 'bronze', earnedAt: T0,
    source: { kind: 'race', id: 'race:synthetic:0', tier: 1 }, retroactive: false,
  }
  store.write([entityDraft('badges', 'trainer', createTrainerBadgeState(T0))],
    [logDraft('flairEvents', flairEventId('uma', uma(1), 'synthetic-award', 'bronze'), T0, flair)], T0)
  return store.rows()
}

const ROWS = rows()
const entity = (kind: string, id?: string) => ROWS.entities.find((row) => row.kind === kind && (id === undefined || row.id === id))!
const log = (kind: string) => ROWS.logs.find((row) => row.kind === kind)!
const fixture = (kind: SaveKind): EntityRow | LogRow =>
  (ENTITY_KINDS as readonly string[]).includes(kind) ? entity(kind, kind === 'work' ? uma(1) : kind === 'items' ? VEG : undefined) : log(kind)
const parse = (row: unknown) => (typeof row === 'object' && row !== null && (LOG_KINDS as readonly unknown[]).includes((row as { kind: unknown }).kind)
  ? parseLogRow(row) : parseEntityRow(row))

/** A deep copy of `row` with `edit` applied to it. */
function edited<T>(row: T, edit: (copy: any) => void): unknown { // eslint-disable-line @typescript-eslint/no-explicit-any -- a test reaches into any field
  const copy = JSON.parse(JSON.stringify(row)) as T
  edit(copy)
  return copy
}

/** Per kind: a wrong id, and out-of-range numbers or broken shapes in its data. */
const BAD: Readonly<Record<SaveKind, readonly ((row: any) => void)[]>> = { // eslint-disable-line @typescript-eslint/no-explicit-any -- as above
  profile: [
    (r) => { r.id = 'other' }, (r) => { r.data.exchangeGrade = 11 }, (r) => { r.data.generation = 1 }, (r) => { r.data.umaTickets = -1 },
    (r) => { r.data.checkIns = [480, 600, 700, 800, 900] }, (r) => { r.data.checkIns = [780, 480] }, (r) => { r.data.checkIns = [1_440] },
    (r) => { r.data.checkIns = [] }, (r) => { r.data.targets = ['a', 'b', 'c', 'd', 'e', 'f'] }, (r) => { r.data.targets = ['a', 'a'] },
    (r) => { r.data.purse.day = '2026-02-30' }, (r) => { r.data.repeatSizing = 'double' },
  ],
  umas: [
    (r) => { r.id = uma(9) }, (r) => { r.data.tier = 4 }, (r) => { r.data.scenario = 6 }, (r) => { r.data.racing.level = 51 },
    (r) => { r.data.farm.level = 0 }, (r) => { r.data.build.constellationOpened = 29 }, (r) => { r.data.build.inspiration.slots = ['parent2'] },
    (r) => { r.data.build.presets.mile.assignments = { n29: 'card' } }, (r) => { r.data.build.extraNodes = ['no-such-node'] },
    (r) => { r.data.career.tier = 0 }, (r) => { delete r.data.build.presets.long },
  ],
  buildings: [(r) => { r.id = 'castle' }, (r) => { r.data.level = 4 }, (r) => { r.data.level = 0 }],
  work: [
    (r) => { r.id = uma(2) }, (r) => { r.data.entries[0].collected = 3 }, (r) => { r.data.entries[0].seconds.push(60) },
    (r) => { r.data.entries[0].request.count = 11 }, (r) => { r.data.queue = [...r.data.queue, ...r.data.queue, ...r.data.queue, ...r.data.queue] },
    (r) => { r.data.slot.slot = 9 }, (r) => { r.data.slot.room = 'speed' }, (r) => { r.data.entries[0].speed = 0 },
    (r) => { r.data.entries[0].inputs[0][0].item = 'no-such-item' },
  ],
  items: [(r) => { r.id = 'no-such-item' }, (r) => { r.data.count = -1 }, (r) => { r.data.count = 1.5 }],
  badges: [(r) => { r.id = 'uma:someone' }, (r) => { r.data.version = 2 }],
  ledger: [(r) => { r.id = 'other' }, (r) => { r.data.delta = 0 }, (r) => { r.data.reason = 'daily-grant' }, (r) => { r.data.resource = 'tickets' },
    (r) => { r.at += 1 }],
  itemLedger: [(r) => { r.id = 'other' }, (r) => { r.data.delta = -r.data.delta }, (r) => { r.data.opId = 'short' }, (r) => { r.data.reason = 'consume' }],
  raceResults: [(r) => { r.id = opId(99) }, (r) => { r.data.scenario = 6 }, (r) => { r.data.tier = 0 }, (r) => { r.data.umaId = uma(9) },
    (r) => { r.data.run.engineVersion = 1 }, (r) => { r.data.commit = [] }, (r) => { delete r.data.cardSetIds }, (r) => { r.data.cardSetIds = ['a', 'a'] },
    (r) => { r.data.cardSetIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }],
  flairEvents: [(r) => { r.id = 'flair:uma:other' }, (r) => { r.at += 1 }, (r) => { r.data.stage = 'mythic' }],
  operations: [(r) => { r.id = 'op:with:colons' }, (r) => { r.data.name = 'teleport' }, (r) => { r.data.receipt = 'done' }, (r) => { r.at += 1 }],
}

describe('the row parsers', () => {
  it.each([...ENTITY_KINDS, ...LOG_KINDS])('%s takes its fixture back as it is', (kind) => {
    const row = fixture(kind)
    expect(row, kind).toBeDefined()
    expect(parse(JSON.parse(JSON.stringify(row)))).toEqual(row)
  })

  it.each([...ENTITY_KINDS, ...LOG_KINDS])('%s refuses an unknown key, a wrong id, a bad number, generation 1 and schema 2', (kind) => {
    const row = fixture(kind)
    expect(parse(edited(row, (r) => { r.extra = true }))).toBeNull()
    expect(parse(edited(row, (r) => { r.data.extra = true }))).toBeNull()
    expect(parse(edited(row, (r) => { r.generation = 1 }))).toBeNull()
    expect(parse(edited(row, (r) => { r.schema = 2 }))).toBeNull()
    expect(parse(edited(row, (r) => { r.savedAt = -1 }))).toBeNull()
    for (const [n, bad] of BAD[kind].entries()) expect(parse(edited(row, bad)), `${kind} #${n}`).toBeNull()
  })

  it('refuses every retired kind: cards, the old Farm, the Inspiration bank', () => {
    const profile = fixture('profile')
    for (const kind of ['cards', 'farm', 'farmWorkers', 'farmRecipes', 'farmExtra', 'inspirationBank']) {
      expect(parseEntityRow({ ...profile, kind }), kind).toBeNull()
    }
    for (const kind of ['farmOperations']) {
      expect(parseLogRow({ ...fixture('ledger'), kind }), kind).toBeNull()
    }
    expect(parseEntityData('cards' as never, { templateId: 'x', stars: 3 })).toBeNull()
  })

  it('checks an entity version from 1, a row within 512 KiB, and the data against its id only when asked', () => {
    expect(parseEntityRow({ ...fixture('profile'), version: 0 })).toBeNull()
    const profile = fixture('profile') as EntityRow<'profile'>
    expect(parseEntityData('profile', profile.data)).toEqual(profile.data)
    expect(parseEntityData('profile', profile.data, 'other')).toBeNull()
    const ledger = fixture('ledger') as LogRow<'ledger'>
    expect(parseLogData('ledger', ledger.data, 'other')).toBeNull()
    const huge = stampLog(logDraft('operations', opId(1), T0, { name: 'collect-all', at: T0, receipt: { lines: 'x'.repeat(SAVE_LIMITS.rowBytes) } }), T0)
    expect(jsonBytes(huge)).toBeGreaterThan(SAVE_LIMITS.rowBytes)
    expect(parseLogRow(huge)).toBeNull()
    expect(stampEntity(entityDraft('items', VEG, { count: 2 }), 3, T0)).toEqual({ kind: 'items', id: VEG, generation: 2, schema: 1, version: 3, savedAt: T0, data: { count: 2 } })
  })

  it('counts JSON bytes as UTF-8', () => {
    expect(jsonBytes('a')).toBe(3)
    expect(jsonBytes('×')).toBe(4)
    expect(jsonBytes('→')).toBe(5)
    expect(jsonBytes('🏇')).toBe(6)
  })
})
