// The job sheet's model (docs/rework/07-farm.md §2, §3, §5, §10, §11; docs/rework/02-check-ins-and-notifications.md §3;
// T140): the query (`back` in-app only); a site's ten raw grades, locked above her Farm Level; the Pantry's family tabs
// in the ring's order; the Kitchen's eleven tabs with Can cook now; Cook Carrot Salad × 3's inputs; the preview's size
// chips, minutes, end and whole Farm EXP; the aptitude line and the Uma order; and each button's rule in its own words.
import { farmExpMultiplier, farmItemSeconds, QUARTERS_PER_EXP } from '@racer/domain/rework/farm'
import { craftedItem, FAMILIES, FAMILY_RING } from '@racer/domain/rework/items'
import { describe, expect, it } from 'vitest'
import { seed } from '../../../__fixtures__/testing'
import { workView } from '../../../ui/work/view'
import { apply, farmAccount, HOUR, uma, withFarmLevel } from '../__fixtures__/farm'
import {
  aptitudeLine, CAN_COOK_NOW, chooseSlot, inAppPath, modeOf, readSheetQuery, sheetAction, sheetItems, sheetPreview, sheetTabs, shortfallLinks,
  umaNote, umaRows, withoutSheet,
} from './model'

const time = (at: number) => new Date(at).toISOString().slice(11, 16)

describe('the query (11 §7.1)', () => {
  it('opens on `job`, reads its fields, and keeps `back` to in-app paths', () => {
    expect(readSheetQuery(new URLSearchParams(''))).toBeNull()
    expect(readSheetQuery(new URLSearchParams('job='))).toEqual({ job: null, uma: null, count: null, queue: false, slot: null, back: null })
    expect(readSheetQuery(new URLSearchParams('job=potato&uma=sim-uma-01&count=3&queue=1&slot=2&back=%2Ftown%2Fwarehouse'))).toEqual({
      job: 'potato', uma: 'sim-uma-01', count: 3, queue: true, slot: 2, back: '/town/warehouse',
    })
    expect(readSheetQuery(new URLSearchParams('job=x&count=11'))!.count).toBeNull()
    for (const bad of ['https://evil.test/', '//evil.test', '/\\evil', 'javascript:alert(1)', '/x:y', 'town']) expect(inAppPath(bad), bad).toBeNull()
    expect(inAppPath('/farm/kitchen?job=dish-vegetables-1')).toBe('/farm/kitchen?job=dish-vegetables-1')
    expect(withoutSheet('?job=potato&uma=x&peek=y')).toBe('?peek=y')
    expect(withoutSheet('?job=')).toBe('')
  })
})

describe('What (07 §10)', () => {
  it("a site lists its family's ten raw grades, each locked above her Farm Level", () => {
    const { state, env, at } = farmAccount(1)
    const [tab, ...more] = sheetTabs('vegetable-garden', state, 7)
    expect(more).toEqual([])
    expect(tab!.items).toEqual(['carrot', 'potato', 'cabbage', 'onion', 'tomato', 'bell-pepper', 'eggplant', 'asparagus', 'golden-carrot', 'emperor-pumpkin'])
    const rows = sheetItems(tab!, state, 7, new Map(), new Map())
    expect(rows.map((row) => row.locked)).toEqual([null, null, 11, 16, 21, 26, 31, 36, 41, 46])
    expect(workView(state, at, env)).toBeDefined()
  })

  it("the Pantry tabs its crafted items by family in the ring's order", () => {
    const tabs = sheetTabs('pantry', farmAccount(0).state, 1)
    expect(tabs.map((tab) => tab.id)).toEqual([...FAMILY_RING])
    expect(tabs.map((tab) => tab.label)).toEqual(FAMILY_RING.map((family) => FAMILIES[family].name))
    expect(tabs[1]!.items[0]).toBe(craftedItem('vegetables', 1).id)
  })

  it("the Kitchen's eleven tabs, Can cook now holding what the free stock covers once at her Farm Level", () => {
    const { state, at } = farmAccount(1)
    const tabs = sheetTabs('kitchen', state, 1)
    expect(tabs.map((tab) => tab.label)).toEqual([
      'Speed', 'Stamina', 'Power', 'Guts', 'Wit', 'Skill bonds', 'Constellation', 'Inspiration', 'Duos', 'Feasts', 'Can cook now',
    ])
    expect(tabs.find((tab) => tab.id === CAN_COOK_NOW)!.items).toEqual([])
    expect(tabs[0]!.items[0]).toBe('dish-sweets-1')
    expect(tabs[8]!.items).toHaveLength(8)
    expect(tabs[9]!.items).toHaveLength(4)
    const stocked = apply(state, 'dev-grant', { items: { 'chopped-carrot': 4, 'wheat-flour': 1, 'diced-potato': 4 } }, at).state
    expect(sheetTabs('kitchen', stocked, 1).find((tab) => tab.id === CAN_COOK_NOW)!.items).toEqual(['dish-vegetables-1'])
    // Potato Salad's side is also Wheat Flour; its grade opens at Farm Lv 6, so it joins at 6 once the side is there twice.
    const more = apply(stocked, 'dev-grant', { items: { 'wheat-flour': 1 } }, at).state
    expect(sheetTabs('kitchen', more, 6).find((tab) => tab.id === CAN_COOK_NOW)!.items).toEqual(['dish-vegetables-1', 'dish-vegetables-2'])
  })
})

describe('How many and the preview (07 §2, §10; 02 §3)', () => {
  it("Cook Carrot Salad × 3 takes 12 Chopped Carrot and 3 Wheat Flour, against free stock", () => {
    const { state, env, at } = farmAccount(1)
    const stocked = apply(state, 'dev-grant', { items: { 'chopped-carrot': 9, 'wheat-flour': 3 } }, at).state
    const view = workView(stocked, at, env)
    const slot = chooseSlot(stocked, 'kitchen', uma(1), null)!
    const preview = sheetPreview(view, 'kitchen', uma(1), 'dish-vegetables-1', 3, 'start', slot)!
    expect(preview.request).toEqual({ kind: 'cook', item: 'dish-vegetables-1', count: 3 })
    expect(preview.inputs).toEqual([
      { item: 'chopped-carrot', need: 12, have: 9, short: 3 },
      { item: 'wheat-flour', need: 3, have: 3, short: 0 },
    ])
    expect(preview.max).toBe(2)
    expect(preview.minutesEach).toBe(farmItemSeconds('cook', 1) / 60)
    expect(preview.endsAt).toBe(at + 3 * farmItemSeconds('cook', 1) * 1000)
  })

  it('shows Farm EXP in whole numbers from the quarter points Start would freeze', () => {
    const { state, env, at } = farmAccount(1)
    const view = workView(state, at, env)
    const slot = chooseSlot(state, 'pantry', uma(1), null)!
    const stocked = apply(state, 'dev-grant', { items: { carrot: 10 } }, at).state
    const preview = sheetPreview(workView(stocked, at, env), 'pantry', uma(1), 'chopped-carrot', 3, 'start', slot)!
    // A craft of 27 listed minutes at Front Runner A (×1.6) is 43.2 EXP, 173 quarter points each: 519 for three.
    expect(preview.farmExp).toBe(Math.round((3 * 173) / QUARTERS_PER_EXP))
    expect(Number.isInteger(preview.farmExp)).toBe(true)
    expect(sheetPreview(view, 'pantry', null, 'chopped-carrot', 3, 'start', slot)!.farmExp).toBeNull()
    expect(sheetPreview(view, 'pantry', uma(1), 'carrot', 3, 'start', slot)).toBeNull()
  })
})

describe('Uma (07 §3, §5, §10)', () => {
  it('reads her aptitude for the families that count: "Front Runner A · Farm EXP ×1.6"', () => {
    const { env } = farmAccount(0)
    expect(aptitudeLine(env, uma(1), ['vegetables'])).toEqual({ tenths: 16, words: 'Front Runner A · Farm EXP ×1.6' })
    expect(aptitudeLine(env, uma(2), ['vegetables'])).toEqual({ tenths: 10, words: 'Front Runner C · Farm EXP ×1' })
    expect(aptitudeLine(env, uma(1), ['sweets'])!.words).toBe('Sprint A · Farm EXP ×1.6')
    // A Duo counts the best of its families (07 §3).
    expect(aptitudeLine(env, uma(2), ['fruits', 'herbs-spices'])!.tenths).toBe(Math.max(farmExpMultiplier('C'), farmExpMultiplier('B')))
    expect(aptitudeLine(env, uma(1), [])).toBeNull()
  })

  it('orders Free first, then suited for the chosen item, then Farm Level; a session greys her, a job elsewhere is Recall and start', () => {
    const { state, env, at } = farmAccount(4)
    let next = withFarmLevel(state, uma(4), 9)
    next = apply(next, 'dev-grant', { items: { 'dish-vegetables-1': 1 } }, at).state
    // uma 3 works at the Fields; uma 4 is the highest level and Free.
    next = apply(next, 'start', { outfitId: uma(3), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 2 } }, at).state
    const view = workView(next, at, env)
    const rows = umaRows(view, 'vegetable-garden', 'carrot')
    expect(rows.map((row) => row.outfitId)).toEqual([uma(1), uma(4), uma(2), uma(3)])
    expect(rows.map((row) => row.status)).toEqual(['free', 'free', 'free', 'elsewhere'])
    expect(rows.find((row) => row.outfitId === uma(4))).toMatchObject({ farmLevel: 9, highestGrade: 2, tier: 1 })
    expect(umaRows(view, 'vegetable-garden', null).map((row) => row.outfitId)).toEqual([uma(4), uma(1), uma(2), uma(3)])
    const elsewhere = rows.find((row) => row.outfitId === uma(3))!
    expect(modeOf(elsewhere)).toBe('recall-start')
    expect(elsewhere.until).toBe(at + 2 * farmItemSeconds('gather', 1) * 1000)
    expect(umaRows(view, 'fields', 'wheat').find((row) => row.outfitId === uma(3))).toMatchObject({ status: 'here', pickable: true })
  })

  it('greys an Uma in a session with its end, last', () => {
    const quiet = seed('quiet')
    const view = workView(quiet.state, quiet.at, quiet.env)
    const rows = umaRows(view, 'kitchen', null)
    const session = rows.filter((row) => row.status === 'session')
    expect(session.length).toBeGreaterThan(0)
    for (const row of session) {
      expect(row.pickable).toBe(false)
      expect(umaNote(row, time)).toBe(`in a session until ${time(row.until!)}`)
    }
    expect(rows.slice(-session.length).every((row) => row.status === 'session')).toBe(true)
    expect(rows.some((row) => row.status === 'here' || row.status === 'elsewhere')).toBe(true)
  })
})

describe("the button says why in the rule's words (07 §10, 02 §9)", () => {
  it('Needs Farm Lv, Short, a full queue, no Umas, and a free slot or when the next frees', () => {
    const { state, env, at } = farmAccount(2)
    const view = workView(state, at, env)
    const rows = umaRows(view, 'vegetable-garden', 'cabbage')
    const row = rows.find((candidate) => candidate.outfitId === uma(1))
    const gated = sheetAction(view, 'vegetable-garden', row, 'cabbage', 1, null, time)
    expect(gated).toMatchObject({ mode: 'start', refusal: { text: 'Needs Farm Lv {level}.', data: { level: 11, grade: 3 } } })
    expect(sheetAction(view, 'vegetable-garden', row, 'carrot', 10, null, time)).toMatchObject({ mode: 'start', refusal: null })
    expect(sheetAction(view, 'vegetable-garden', undefined, 'carrot', 1, null, time)).toEqual({ mode: 'blocked', words: 'Pick an Uma.' })
    expect(sheetAction(view, 'vegetable-garden', row, null, 1, null, time)).toEqual({ mode: 'blocked', words: 'Pick what to make.' })
    const empty = farmAccount(0)
    expect(sheetAction(workView(empty.state, at, env), 'kitchen', undefined, null, 1, null, time)).toEqual({ mode: 'blocked', words: 'No Umas yet · unlock them in the Stable' })

    const short = sheetAction(view, 'kitchen', umaRows(view, 'kitchen', 'dish-vegetables-1')[0], 'dish-vegetables-1', 1, null, time)
    expect(short).toMatchObject({ mode: 'start', refusal: { text: 'Short {n} {item}.', data: { n: 4, item: 'chopped-carrot' } } })
    const preview = sheetPreview(view, 'kitchen', uma(1), 'dish-vegetables-1', 1, 'start', chooseSlot(state, 'kitchen', uma(1), null)!)!
    const [link] = shortfallLinks(state, preview.inputs, '/farm/kitchen?job=dish-vegetables-1')
    expect(link).toMatchObject({ item: 'chopped-carrot', short: 4, buy: null })
    expect(link!.make).toEqual({ building: 'pantry', to: '/farm/pantry?job=chopped-carrot&count=4&back=%2Ffarm%2Fkitchen%3Fjob%3Ddish-vegetables-1' })
    const raw = shortfallLinks(state, [{ item: 'carrot', need: 3, have: 0, short: 3 }], '/farm/pantry')
    expect(raw[0]).toMatchObject({ make: { building: 'vegetable-garden' }, buy: { price: 108, to: '/town/exchange?family=vegetables&grade=1' } })

    // Both Vegetable Garden slots of… the Orchard: two slots at Lv 1, both held, the next ends at the shorter job's end.
    let full = apply(state, 'start', { outfitId: uma(1), slot: { building: 'orchard', slot: 0 }, request: { kind: 'gather', item: 'apple', count: 1 } }, at).state
    full = apply(full, 'start', { outfitId: uma(2), slot: { building: 'orchard', slot: 1 }, request: { kind: 'gather', item: 'apple', count: 2 } }, at).state
    const third = farmAccount(3)
    const crowded = { ...full, umas: { ...full.umas, [uma(3)]: third.state.umas[uma(3)]! } }
    const crowdedView = workView(crowded, at, env)
    const free = umaRows(crowdedView, 'orchard', 'apple').find((candidate) => candidate.outfitId === uma(3))
    expect(sheetAction(crowdedView, 'orchard', free, 'apple', 1, null, time)).toEqual({ mode: 'blocked', words: `Every slot is taken. The next job here ends at ${time(at + farmItemSeconds('gather', 1) * 1000)}.` })

    // Her own job here takes the queue: refused in its words once three wait.
    let queued = full
    for (let i = 0; i < 3; i += 1) queued = apply(queued, 'queue', { outfitId: uma(2), add: { request: { kind: 'gather', item: 'apple', count: 1 }, building: 'orchard' } }, at).state
    const queuedView = workView(queued, at, env)
    const mine = umaRows(queuedView, 'orchard', 'apple').find((candidate) => candidate.outfitId === uma(2))!
    expect(mine).toMatchObject({ status: 'here', pickable: false })
    const one = apply(full, 'queue', { outfitId: uma(2), add: { request: { kind: 'gather', item: 'apple', count: 1 }, building: 'orchard' } }, at).state
    const oneView = workView(one, at, env)
    const room = umaRows(oneView, 'orchard', 'apple').find((candidate) => candidate.outfitId === uma(2))!
    expect(sheetAction(oneView, 'orchard', room, 'apple', 1, null, time)).toMatchObject({ mode: 'queue', refusal: null })
    expect(at + HOUR).toBeGreaterThan(at)
  })
})
