// The building page's model (docs/game/07-farm.md §10; docs/game/11-hub-and-places.md §3.4;
// docs/game/02-check-ins-and-notifications.md §6; T140): the header and its upgrade against stock, the Counter as the
// Hub counts it, the targets' lines in 02 §6's words with the gate and the Exchange link only when stocked, a line's
// sheet filled in, and a site's stock by open grade. Every template passes 02 §9's banned words.
import { hubView } from '@racer/domain/hub'
import { CHECK_IN_WORDS, hasBannedWord } from '@racer/domain/check-in'
import { FARM_BUILDING_IDS } from '@racer/domain/farm'
import { describe, expect, it } from 'vitest'
import { seed } from '../../../__fixtures__/testing'
import { workView } from '../../../ui/work/view'
import type { WordsContext } from '../../../ui/work/words'
import { apply, farmAccount, HOUR, uma, withFarmLevel } from '../__fixtures__/farm'
import { FARM_WORDS } from '../words'
import { buildingView, exchangeRow, lineLabel, lineWords, sheetQuery, stockByGrade, withSheet } from './model'

const context = (env: { content: { umas: ReadonlyMap<string, { name?: string }> } }, now = 0): WordsContext =>
  ({ umaName: (id) => env.content.umas.get(id)?.name ?? '', utcOffsetMin: 0, now })

describe('the header and the Counter (07 §10, 11 §3.4)', () => {
  it('counts slots, speed and the upgrade, and refuses an upgrade it can\'t pay in its own words', () => {
    const { state, env, at } = farmAccount(1)
    const view = buildingView(workView(state, at, env), 'kitchen', context(env))
    expect(view).toMatchObject({ name: 'Kitchen', job: 'cook', family: null, level: 1, slots: 6, used: 0, speed: 1, ready: 0 })
    expect(view.upgrade).toMatchObject({ to: 2, prizeMoney: 3_000, haveMoney: 0 })
    expect(view.upgrade!.items).toHaveLength(8)
    expect(view.upgrade!.refusal).toEqual({ text: 'Needs {n} Prize Money.', data: { n: 3_000, have: 0 } })

    const paid = apply(state, 'dev-grant', { prizeMoney: 3_000 }, at).state
    expect(buildingView(workView(paid, at, env), 'kitchen', context(env)).upgrade!.refusal).toEqual({ text: 'Short {n} {item}.', data: { n: 2, item: 'honey' } })

    const top = { ...state, buildings: { ...state.buildings, orchard: { level: 3 as const } } }
    const orchard = buildingView(workView(top, at, env), 'orchard', context(env))
    expect(orchard).toMatchObject({ level: 3, slots: 3, speed: 1.25, upgrade: null, family: 'fruits', job: 'gather' })
  })

  it("counts Umas with finished outputs here as the Hub's Counter does, on every building of the busy seed", () => {
    const busy = seed('busy')
    const view = workView(busy.state, busy.at, busy.env)
    const hub = hubView(busy.state, busy.at, busy.env)
    let total = 0
    for (const building of FARM_BUILDING_IDS) {
      const model = buildingView(view, building, context(busy.env))
      expect(model.ready, building).toBe(hub.counts[building])
      expect(model.readySlots).toHaveLength(model.ready)
      expect(model.cards).toHaveLength(hub.buildings[building].slots)
      expect(model.used).toBe(hub.buildings[building].slots - hub.buildings[building].free)
      total += model.ready
    }
    expect(total).toBeGreaterThan(0)
  })
})

describe('For your targets (02 §6)', () => {
  it("lists the planner's lines here in 02 §6's words, each opening the sheet filled in", () => {
    const busy = seed('busy')
    const view = workView(busy.state, busy.at, busy.env)
    const model = buildingView(view, 'vegetable-garden', context(busy.env, busy.at))
    expect(model.lines.length).toBeGreaterThan(0)
    const grades = model.lines.map((line) => line.line.grade)
    expect(grades).toEqual([...grades].sort((a, b) => a - b))
    for (const line of model.lines) {
      expect(line.words.startsWith(`${lineLabel(line.line.item)} · `)).toBe(true)
      expect(line.words).toContain(`Warehouse ${line.line.have}`)
      if (line.line.short > 0) expect(line.words).toContain(`short ${line.line.short}`)
      if (line.line.coming > 0) expect(line.words).toMatch(/coming \d+ \([^,]+, in \d+[dhm]/)
      expect(line.words).not.toMatch(/\d\d:\d\d/)
      expect(line.sheet.startsWith(`?job=${line.line.item}`)).toBe(true)
    }
    // Each coming output says how long until it lands, never its clock time (D366), here and in the Needs views.
    const coming = model.lines.find((line) => line.line.coming > 0)!
    expect(coming).toBeDefined()
    expect(lineWords(coming.line, context(busy.env, busy.at))).toBe(coming.words)
    expect(coming.words).toMatch(/coming \d+ \([^,]+, in \d+[dhm]/)
    expect(lineLabel('cabbage')).toBe('Vegetables G3')
    expect(lineLabel('dish-vegetables-1')).toBe('Vegetables G1')
    expect(lineLabel('duo-stamina-wit-3')).toBe('Duo G3')
    expect(lineLabel('feast-4')).toBe('Feast G4')
  })

  it('reads a gate in its words, and offers the Exchange only when it stocks the grade', () => {
    // Two Umas: the target at Farm Lv 1 needs grade-2 dishes; the only Free one is Lv 1, so grade-2 raw is gated.
    const { state, env, at } = farmAccount(2)
    const view = workView(state, at, env)
    const model = buildingView(view, 'vegetable-garden', context(env))
    const gated = model.lines.find((line) => line.gate !== null)
    expect(gated).toBeDefined()
    expect(gated!.gate).toBe(CHECK_IN_WORDS.gate.replace('{grade}', String(gated!.line.grade)).replace('{level}', String(gated!.line.gate!.needsLevel)).replace('{highest}', '1'))
    expect(gated!.buy).toBeNull()

    // Once any Uma reaches the grade's Farm Level (here a busy one, so the gate stays), the Exchange stocks it.
    const leveled = withFarmLevel(state, uma(2), 6)
    const busy = apply(leveled, 'start', { outfitId: uma(2), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 10 } }, at).state
    const stocked = buildingView(workView(busy, at, env), 'vegetable-garden', context(env)).lines.find((line) => line.gate !== null && line.line.grade === 2)
    expect(stocked?.buy).toEqual({ price: 114, to: exchangeRow('vegetables', 2) })
    expect(stocked?.buy?.to).toBe('/town/exchange?family=vegetables&grade=2')
  })

  it('fills the sheet with a suggested Uma and a fitted size', () => {
    const { state, env, at } = farmAccount(1)
    const view = workView(state, at, env)
    const line = buildingView(view, 'vegetable-garden', context(env)).lines.find((candidate) => candidate.line.grade === 1)
    expect(line?.sheet).toMatch(new RegExp(`^\\?job=${line!.line.item}&uma=${uma(1)}&count=\\d+$`))
    expect(sheetQuery({ job: null, slot: 2 })).toBe('?job=&slot=2')
    // Over the map, the side panel's place stays and a previous sheet's fields go (D366).
    expect(withSheet('?peek=kitchen&job=old&uma=x', sheetQuery({ job: null, slot: 3 }))).toBe('?peek=kitchen&job=&slot=3')
    expect(withSheet('', '?job=potato&count=2')).toBe('?job=potato&count=2')
    expect(sheetQuery({ job: 'potato', uma: 'x', count: 3, queue: true, back: '/town/warehouse' })).toBe('?job=potato&uma=x&count=3&queue=1&back=%2Ftown%2Fwarehouse')
  })
})

describe('the Peek (11 §3.4)', () => {
  it("shows a site's raw stock by grade up to the highest any Uma has open, and none for the Pantry and Kitchen", () => {
    const { state, at } = farmAccount(2)
    const stocked = apply(withFarmLevel(state, uma(2), 11), 'dev-grant', { items: { carrot: 4, cabbage: 1 } }, at).state
    expect(stockByGrade(stocked, 'vegetable-garden')).toEqual([
      { item: 'carrot', grade: 1, count: 4 }, { item: 'potato', grade: 2, count: 0 }, { item: 'cabbage', grade: 3, count: 1 },
    ])
    expect(stockByGrade(stocked, 'pantry')).toEqual([])
    expect(stockByGrade(farmAccount(0).state, 'orchard')).toEqual([{ item: 'apple', grade: 1, count: 0 }])
    expect(at + HOUR).toBeGreaterThan(at)
  })
})

describe('plain words (02 §9)', () => {
  it('no Farm template holds a banned word', () => {
    for (const [key, text] of Object.entries(FARM_WORDS)) expect(hasBannedWord(text), key).toBe(false)
  })
})
