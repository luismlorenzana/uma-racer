// SC5's boundary: old frozen saves survive the package rename; levels, receipts and building rules stay Racer's.
import { describe, expect, it } from 'vitest'
import { ENV, PLAIN, clock, farmAccount, ok, withStock, atFarmLevel } from '../__fixtures__/work'
import { BUILDING_IDS, BUILDINGS, buildingSpeed, slotsPerRoom, upgradeCost } from '../farm/buildings'
import { parseEntry, parseWorkRow } from '../save/parse'
import { WORK_BUILDINGS, collect, start } from './adapter'
import type { Entry, SlotRef, WorkRow } from './types'

const at = clock('08:00')
const slot: SlotRef = { building: 'pantry', slot: 0 }
const working = () => ok(start(withStock(farmAccount(), { carrot: 4 }), {
  outfitId: PLAIN.id, slot, request: { kind: 'craft', item: 'chopped-carrot', count: 4 },
}, at, ENV)).state
const legacyEntry = (entry: Entry) => { const { exp, ...rest } = entry; return { ...rest, farmExp: exp } }

describe('SC5 save compatibility', () => {
  it('reads pre-SC5 farmExp entries without replanning or moving their clocks, items, progress or queue', () => {
    const state = working(), row = state.work[PLAIN.id]!
    const partial = { ...row.entries[0]!, acceleratedMs: 30_000, collected: 1 }
    const migrated = parseWorkRow({ ...row, entries: [legacyEntry(partial)] })
    expect(migrated).toEqual({ ...row, entries: [partial] })
    const old = { ...state, work: { ...state.work, [PLAIN.id]: migrated! } }
    expect(collect(old, { outfitId: PLAIN.id }, at + 24 * 3_600_000, ENV))
      .toEqual(collect({ ...state, work: { ...state.work, [PLAIN.id]: { ...row, entries: [partial] } } }, { outfitId: PLAIN.id }, at + 24 * 3_600_000, ENV))
  })

  it('refuses ambiguous or malformed EXP spellings instead of silently discarding work', () => {
    const entry = working().work[PLAIN.id]!.entries[0]!
    expect(parseEntry({ ...entry, farmExp: entry.exp })).toBeNull()
    expect(parseEntry({ ...legacyEntry(entry), farmExp: [-1] })).toBeNull()
    expect(parseEntry({ ...legacyEntry(entry), extra: true })).toBeNull()
    expect(parseEntry(JSON.parse(JSON.stringify(entry)))).toEqual(entry)
  })

  it('reads old dropped-queue reasons as messages and round-trips canonical drops', () => {
    const row: WorkRow = { outfitId: PLAIN.id, slot: null, entries: [], queue: [], last: null, dropped: {
      at, slot, requests: [{ kind: 'craft', item: 'chopped-carrot', count: 1 }], short: [],
      refused: { refused: true, code: 'grade', message: 'Needs Farm Lv {level}.', data: { level: 6 } },
    } }
    const { message, ...rest } = row.dropped!.refused!
    expect(parseWorkRow({ ...row, dropped: { ...row.dropped, refused: { ...rest, reason: message } } })).toEqual(row)
    expect(parseWorkRow(JSON.parse(JSON.stringify(row)))).toEqual(row)
    expect(parseWorkRow({ ...row, dropped: { ...row.dropped, refused: { ...rest, message, reason: message } } })).toBeNull()
  })

  it('still reports only credited Farm EXP at the cap, not the package’s planned EXP', () => {
    const state = atFarmLevel(farmAccount(), PLAIN.id, 50)
    const started = ok(start(state, { outfitId: PLAIN.id, slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at, ENV)).state
    const result = collect(started, { outfitId: PLAIN.id }, at + 24 * 3_600_000, ENV)
    expect(result.receipt.farmExp).toBe(0)
    expect(result.receipt.farmLevel).toEqual({ from: 50, to: 50 })
    expect(result.state.umas[PLAIN.id]!.farm).toEqual(state.umas[PLAIN.id]!.farm)
    expect(result.receipt.outputs).toEqual([{ item: 'wheat' }])
  })
})

it('adapts every live building number and tie order, including D375’s Kitchen slots', () => {
  expect(WORK_BUILDINGS.ids).toEqual(BUILDING_IDS)
  for (const id of BUILDING_IDS) {
    expect(WORK_BUILDINGS.rooms(id)).toEqual(BUILDINGS[id].rooms)
    for (const level of [1, 2, 3] as const) {
      expect(WORK_BUILDINGS.slots(id, level)).toBe(slotsPerRoom(id, level))
      expect(WORK_BUILDINGS.speed(id, level)).toBe(buildingSpeed(level))
      if (level > 1) {
        const cost = upgradeCost(id, level as 2 | 3)
        expect(WORK_BUILDINGS.upgradeCost(id, level)).toEqual({ money: cost.prizeMoney, items: cost.items })
      }
    }
  }
  expect([1, 2, 3].map((level) => WORK_BUILDINGS.slots('kitchen', level))).toEqual([6, 9, 9])
})
