// The new account as rows (docs/rework/13-removals-and-plan-changes.md §5; T134): 20 Uma Tickets with their ledger row,
// every building at Lv 1, and nothing else. Its stamped rows read back as the rules' own new account.
import { describe, expect, it } from 'vitest'
import { clock } from '../__fixtures__/save'
import { BUILDING_IDS } from '../farm/buildings'
import { INITIAL_UMA_TICKETS, newAccount } from '../tiers/roster'
import { newWorkState } from '../work/adapter'
import { initialSave } from './initial'
import { parseEntityRow, parseLogRow } from './parse'
import { logDraft, rowKey, stampEntity, stampLog } from './rows'
import { toSaveState } from './state'

const T0 = clock('08:00')

describe('the new account (13 §5)', () => {
  it('has 20 Uma Tickets, the one ledger row and 14 buildings at Lv 1, and nothing else', () => {
    const save = initialSave(T0)
    expect(save.entities.map(rowKey)).toEqual(['profile/main', ...BUILDING_IDS.map((id) => `buildings/${id}`)])
    expect(BUILDING_IDS).toHaveLength(14)
    expect(save.entities[0]!.data).toEqual(newAccount(T0).profile)
    expect(save.entities[0]!.data).toMatchObject({ generation: 2, createdAt: T0, umaTickets: 20, umaShards: 0, prizeMoney: 0, featuredUmaId: null })
    expect(save.entities.slice(1).every((row) => row.kind === 'buildings' && row.data.level === 1)).toBe(true)
    expect(save.entities.every((row) => row.generation === 2 && row.schema === 1)).toBe(true)
    expect(save.logs).toEqual([logDraft('ledger', 'initial-uma-tickets', T0, {
      id: 'initial-uma-tickets', resource: 'uma-tickets', delta: INITIAL_UMA_TICKETS, reason: 'initial-uma-tickets', at: T0,
    })])
    expect(save.state).toEqual(newWorkState(newAccount(T0)))
  })

  it('reads back from its stamped rows as newWorkState(newAccount(now)), through JSON too', () => {
    const save = initialSave(T0)
    const entities = save.entities.map((draft) => stampEntity(draft, 1, T0))
    const logs = save.logs.map((draft) => stampLog(draft, T0))
    expect(toSaveState(entities, logs)).toEqual(newWorkState(newAccount(T0)))
    const wire = JSON.parse(JSON.stringify({ entities, logs })) as { entities: unknown[]; logs: unknown[] }
    const parsed = { entities: wire.entities.map(parseEntityRow), logs: wire.logs.map(parseLogRow) }
    expect(parsed).toEqual({ entities, logs })
    expect(toSaveState(entities, logs)).toEqual(toSaveState(parsed.entities.map((row) => row!), parsed.logs.map((row) => row!)))
  })

  it('needs its profile to be read', () => {
    expect(() => toSaveState([], [])).toThrow(RangeError)
  })
})
