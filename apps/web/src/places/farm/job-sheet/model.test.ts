// The job sheet's model (docs/game/07-farm.md §2, §3, §5, §10, §11; docs/game/02-check-ins-and-notifications.md §3;
// T140, D366): the query (`back` in-app only); a site's ten raw grades, locked above her Farm Level; the Pantry's family
// tabs in the ring's order; the Kitchen's eleven icon tabs with Can cook now; Cook Carrot Salad × 3's inputs; the
// preview's duration, end and whole Farm EXP; the aptitude line; Free Umas only, Farm Level first, then suited (A03); the
// preselection (the first row, a named Uma, a link's item and what the plan wants most); and each
// button's rule in its own words.
import { durationText } from '@racer/domain/check-in'
import { FARM_BUILDING_IDS, farmExpMultiplier, farmItemSeconds, QUARTERS_PER_EXP } from '@racer/domain/farm'
import { craftedItem, FAMILIES, FAMILY_RING, rawItem } from '@racer/domain/items'
import { suggestFrom } from '@racer/domain/planner'
import { describe, expect, it } from 'vitest'
import { seed } from '../../../__fixtures__/testing'
import { workView } from '../../../ui/work/view'
import { apply, farmAccount, HOUR, uma, withFarmLevel } from '../__fixtures__/farm'
import {
  aptitudeLine, bestItem, CAN_COOK_NOW, chooseSlot, freeRows, inAppPath, neededByItem, preselect, readSheetQuery, readyHere, sheetAction, sheetItems,
  sheetPlan, sheetPreview, sheetTabs, sheetTiming, shortfallLinks, withoutSheet, type SheetQuery,
} from './model'

const query = (fields: Partial<SheetQuery> = {}): SheetQuery => ({ job: null, uma: null, count: null, queue: false, slot: null, back: null, ...fields })

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

  it("the Pantry tabs its crafted items by family in the ring's order, each tab its family's first crafted item", () => {
    const tabs = sheetTabs('pantry', farmAccount(0).state, 1)
    expect(tabs.map((tab) => tab.id)).toEqual([...FAMILY_RING])
    expect(tabs.map((tab) => tab.label)).toEqual(FAMILY_RING.map((family) => FAMILIES[family].name))
    expect(tabs[1]!.items[0]).toBe(craftedItem('vegetables', 1).id)
    expect(tabs.map((tab) => tab.icon)).toEqual(FAMILY_RING.map((family) => ({ kind: 'item', item: craftedItem(family, 1).id })))
  })

  it("the Kitchen's eleven tabs, each an icon, Can cook now holding what the free stock covers once at her Farm Level", () => {
    const { state, at } = farmAccount(1)
    const tabs = sheetTabs('kitchen', state, 1)
    expect(tabs.map((tab) => tab.label)).toEqual([
      'Speed', 'Stamina', 'Power', 'Guts', 'Wit', 'Skill bonds', 'Constellation', 'Inspiration', 'Duos', 'Feasts', 'Can cook now',
    ])
    expect(tabs.map((tab) => (tab.icon.kind === 'type' ? tab.icon.type : tab.icon.kind === 'mark' ? tab.icon.mark : 'item'))).toEqual([
      'speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'star', 'spark', 'item', 'item', 'check',
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

describe('How many and the preview (07 §2, §10; 02 §3; D366)', () => {
  it("Cook Carrot Salad × 3 takes 12 Chopped Carrot and 3 Wheat Flour, against free stock, and reads how long it takes", () => {
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
    expect(preview.ms).toBe(3 * farmItemSeconds('cook', 1) * 1000)
    expect(preview.endsAt).toBe(at + preview.ms)
    // Start's label reads the duration: "Start · ×3 · 14h 24m" (240 base minutes × 1.2, three times).
    expect(durationText(preview.ms)).toBe('14h 24m')
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

describe('Uma (07 §3, §5, §10; D366)', () => {
  it('reads her aptitude for the families that count: "Front Runner A · Farm EXP ×1.6"', () => {
    const { env } = farmAccount(0)
    expect(aptitudeLine(env, uma(1), ['vegetables'])).toEqual({ tenths: 16, words: 'Front Runner A · Farm EXP ×1.6' })
    expect(aptitudeLine(env, uma(2), ['vegetables'])).toEqual({ tenths: 10, words: 'Front Runner C · Farm EXP ×1' })
    expect(aptitudeLine(env, uma(1), ['sweets'])!.words).toBe('Sprint A · Farm EXP ×1.6')
    // A Duo counts the best of its families (07 §3).
    expect(aptitudeLine(env, uma(2), ['fruits', 'herbs-spices'])!.tenths).toBe(Math.max(farmExpMultiplier('C'), farmExpMultiplier('B')))
    expect(aptitudeLine(env, uma(1), [])).toBeNull()
  })

  it('lists Free Umas only, Farm Level first, then suited: never one working, Ready or in a session', () => {
    const { state, env, at } = farmAccount(5)
    let next = withFarmLevel(state, uma(2), 9)
    next = withFarmLevel(next, uma(5), 12)
    // uma 3 works at the Fields; uma 5 finished a job there that still holds its slot (Ready).
    next = apply(next, 'start', { outfitId: uma(3), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 2 } }, at).state
    next = apply(next, 'start', { outfitId: uma(5), slot: { building: 'fields', slot: 1 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
    const later = at + farmItemSeconds('gather', 1) * 1000 + 1
    const view = workView(next, later, env)
    expect(view.settled.work[uma(5)]!.entries).toHaveLength(1)
    const rows = freeRows(view, 'vegetable-garden', 'carrot')
    // uma 1 is Front Runner A (suited for Vegetables) at Lv 1; uma 2 is Lv 9 but C; uma 4 is B at Lv 1.
    expect(rows.map((row) => row.outfitId)).toEqual([uma(2), uma(1), uma(4)])
    expect(rows.map((row) => row.suited)).toEqual([false, true, false])
    expect(rows.find((row) => row.outfitId === uma(2))).toMatchObject({ farmLevel: 9, highestGrade: 2 })
    expect(rows.some((row) => row.outfitId === uma(3) || row.outfitId === uma(5))).toBe(false)
    // At the Orchard, Farm Lv9 still leads; Long A only breaks the Lv1 tie.
    expect(freeRows(view, 'orchard', null).map((row) => [row.outfitId, row.suited])).toEqual([[uma(2), false], [uma(4), true], [uma(1), false]])

    // A session holds her too: in the quiet seed every Uma works, so nobody is listed.
    const quiet = seed('quiet')
    expect(freeRows(workView(quiet.state, quiet.at, quiet.env), 'kitchen', null)).toEqual([])
  })

  it('breaks equal Farm Levels by suited, newest release, then name, not the EXP multiplier', () => {
    const { state, env, at } = farmAccount(4)
    const names = ['Zulu', 'Alpha', 'Beta', 'Alpha']
    const releases = ['2001-01-01', '2030-01-01', '2020-01-01', '2020-01-01']
    const umas = new Map([...env.content.umas].map(([id, template]) => {
      const i = [uma(1), uma(2), uma(3), uma(4)].indexOf(id)
      return [id, i < 0 ? template : { ...template, name: names[i]!, jpRelease: releases[i]! }]
    }))
    const rows = freeRows(workView(state, at, { ...env, content: { ...env.content, umas } }), 'vegetable-garden', 'carrot')
    expect(rows.map(row => row.outfitId)).toEqual([uma(1), uma(2), uma(4), uma(3)])
    expect(rows[1]!.tenths).toBeLessThan(rows[2]!.tenths!)
  })
})

describe('the preselection (D366, A03)', () => {
  it('keeps the default Uma on the first row after the selected item supplies its aptitude tie-break', () => {
    const { state, env, at } = farmAccount(4)
    const items = Object.fromEntries(FAMILY_RING.flatMap(family => ([1, 2, 3] as const).flatMap(grade => [
      [rawItem(family, grade).id, 30], [craftedItem(family, grade).id, 30],
    ])))
    const stocked = apply(state, 'dev-grant', { items }, at).state
    // All are Lv1: selecting a Kitchen/Pantry item supplies the family that breaks their tied levels.
    const umas = new Map([...env.content.umas].map(([id, template]) => [id, { ...template, jpRelease: id === uma(2) ? '2040-01-01' : '2000-01-01' }]))
    const view = workView(stocked, at, { ...env, content: { ...env.content, umas } }), planned = sheetPlan(view)
    for (const building of FARM_BUILDING_IDS) {
      const picked = preselect(view, building, query(), planned, sheetTiming(view, 0))
      expect(picked.uma, building).toBe(freeRows(view, building, picked.item)[0]?.outfitId)
    }
  })

  it('preselects the level-first row, even when the planner suggests another Uma', () => {
    const busy = seed('busy')
    const view = workView(busy.state, busy.at, busy.env)
    const planned = sheetPlan(view)
    const timing = sheetTiming(view, 0)
    const { suggestions } = suggestFrom(view.settled, planned, {}, timing)
    const here = suggestions.find((s) => s.kind === 'job' && s.slot.building === 'vegetable-garden')
    expect(here).toBeDefined()
    const first = freeRows(view, 'vegetable-garden', null)[0]!
    const picked = preselect(view, 'vegetable-garden', query(), planned, timing)
    expect(picked.uma).toBe(first.outfitId)
    expect(here!.outfitId).not.toBe(first.outfitId)
    expect(picked.item).toBe(bestItem(view.settled, 'vegetable-garden', first.farmLevel, neededByItem(planned)))
    expect(freeRows(view, 'vegetable-garden', null).some((row) => row.outfitId === here!.outfitId)).toBe(true)
    // The link's own count is kept.
    expect(preselect(view, 'vegetable-garden', query({ count: 1 }), planned, timing).count).toBe(1)
  })

  it('without one, the best Free Uma (Farm Level first) and what the plan wants most that she can make, else the highest grade she can work', () => {
    const { state, env, at } = farmAccount(4)
    const leveled = withFarmLevel(withFarmLevel(state, uma(4), 11), uma(2), 13)
    const view = workView(leveled, at, env)
    const planned = sheetPlan(view)
    const timing = sheetTiming(view, 0)
    const orchardSuggestion = suggestFrom(view.settled, planned, {}, timing).suggestions.find((s) => s.slot.building === 'orchard')
    expect(orchardSuggestion).toBeUndefined()
    // At the Orchard uma 2's higher Farm Level wins over uma 4's Long A, and makes what the plan wants of it:
    // Apples for the targets' Apple Tarts, though her Farm Level opens grade 3.
    expect(neededByItem(planned).get('apple')).toBeGreaterThan(0)
    expect(preselect(view, 'orchard', query(), planned, timing)).toEqual({ uma: uma(2), item: 'apple', count: null })
    // Wanting nothing here, she takes the highest grade she can gather: grade 3, Peach.
    expect(bestItem(view.settled, 'orchard', 11, new Map())).toBe('peach')
    expect(bestItem(view.settled, 'orchard', 1, new Map())).toBe('apple')
    // What the plan wants most wins over the highest grade, if her Farm Level opens it.
    expect(bestItem(view.settled, 'orchard', 11, new Map([['apple', 3], ['pear', 1]]))).toBe('apple')
    expect(bestItem(view.settled, 'orchard', 1, new Map([['pear', 9]]))).toBe('apple')
    // Nothing to craft without stock; with Carrots in it, Chopped Carrot.
    expect(bestItem(view.settled, 'pantry', 13, new Map())).toBeNull()
    const stocked = workView(apply(state, 'dev-grant', { items: { carrot: 4 } }, at).state, at, env)
    expect(bestItem(stocked.settled, 'pantry', 1, neededByItem(sheetPlan(stocked)))).toBe('chopped-carrot')
  })

  it("keeps a link's item and count, with a Free Uma whose Farm Level opens it; Queue next names her", () => {
    const { state, env, at } = farmAccount(2)
    const view = workView(withFarmLevel(state, uma(2), 6), at, env)
    const planned = sheetPlan(view)
    const timing = sheetTiming(view, 0)
    // Potato is grade 2: uma 1 (suited, Lv 1) can't gather it, so uma 2 (Lv 6) is preselected.
    expect(preselect(view, 'vegetable-garden', query({ job: 'potato', count: 4 }), planned, timing)).toEqual({ uma: uma(2), item: 'potato', count: 4 })
    // Carrot is grade 1 too: the highest Farm Level leads, not the lower-level suited Uma.
    expect(preselect(view, 'vegetable-garden', query({ job: 'carrot' }), planned, timing).uma).toBe(uma(2))
    // A named lower-level Free Uma stays, both with and without an explicit item.
    expect(preselect(view, 'vegetable-garden', query({ job: 'carrot', uma: uma(1) }), planned, timing).uma).toBe(uma(1))
    expect(preselect(view, 'vegetable-garden', query({ uma: uma(1) }), planned, timing).uma).toBe(uma(1))
    expect(preselect(view, 'vegetable-garden', query({ job: 'carrot', uma: uma(2), queue: true }), planned, timing)).toEqual({ uma: uma(2), item: 'carrot', count: null })
  })

  it('with no Free Uma, nobody; a finished job here is what Collect here would free', () => {
    const { state, env, at } = farmAccount(1)
    const working = apply(state, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
    const view = workView(working, at, env)
    expect(preselect(view, 'fields', query(), sheetPlan(view), sheetTiming(view, 0)).uma).toBeNull()
    expect(readyHere(view, 'fields')).toBe(false)
    const done = workView(working, at + farmItemSeconds('gather', 1) * 1000, env)
    expect(readyHere(done, 'fields')).toBe(true)
    expect(readyHere(done, 'orchard')).toBe(false)
    expect(sheetAction(done, 'fields', null, 'start', 'wheat', 1, null)).toEqual({ mode: 'blocked', words: 'No free Uma' })
  })
})

describe("the button says why in the rule's words (07 §10, 02 §9)", () => {
  it('Needs Farm Lv, Short, a full queue, no Umas, and a free slot or how long until the next frees', () => {
    const { state, env, at } = farmAccount(2)
    const view = workView(state, at, env)
    const gated = sheetAction(view, 'vegetable-garden', uma(1), 'start', 'cabbage', 1, null)
    expect(gated).toMatchObject({ mode: 'start', refusal: { text: 'Needs Farm Lv {level}.', data: { level: 11, grade: 3 } } })
    expect(sheetAction(view, 'vegetable-garden', uma(1), 'start', 'carrot', 10, null)).toMatchObject({ mode: 'start', refusal: null })
    expect(sheetAction(view, 'vegetable-garden', uma(1), 'start', null, 1, null)).toEqual({ mode: 'blocked', words: 'Pick what to make.' })
    const empty = farmAccount(0)
    expect(sheetAction(workView(empty.state, at, env), 'kitchen', null, 'start', null, 1, null)).toEqual({ mode: 'blocked', words: 'No Umas yet · unlock them in the Stable' })

    const short = sheetAction(view, 'kitchen', uma(1), 'start', 'dish-vegetables-1', 1, null)
    expect(short).toMatchObject({ mode: 'start', refusal: { text: 'Short {n} {item}.', data: { n: 4, item: 'chopped-carrot' } } })
    const preview = sheetPreview(view, 'kitchen', uma(1), 'dish-vegetables-1', 1, 'start', chooseSlot(state, 'kitchen', uma(1), null)!)!
    const [link] = shortfallLinks(state, preview.inputs, '/farm/kitchen?job=dish-vegetables-1')
    expect(link).toMatchObject({ item: 'chopped-carrot', short: 4, buy: null })
    expect(link!.make).toEqual({ building: 'pantry', to: '/farm/pantry?job=chopped-carrot&count=4&back=%2Ffarm%2Fkitchen%3Fjob%3Ddish-vegetables-1' })
    const raw = shortfallLinks(state, [{ item: 'carrot', need: 3, have: 0, short: 3 }], '/farm/pantry')
    expect(raw[0]).toMatchObject({ make: { building: 'vegetable-garden' }, buy: { price: 108, to: '/town/exchange?family=vegetables&grade=1' } })

    // The Orchard's two slots, both held: the next frees when the shorter job ends, read as how long until then.
    let full = apply(state, 'start', { outfitId: uma(1), slot: { building: 'orchard', slot: 0 }, request: { kind: 'gather', item: 'apple', count: 1 } }, at).state
    full = apply(full, 'start', { outfitId: uma(2), slot: { building: 'orchard', slot: 1 }, request: { kind: 'gather', item: 'apple', count: 2 } }, at).state
    const third = farmAccount(3)
    const crowded = { ...full, umas: { ...full.umas, [uma(3)]: third.state.umas[uma(3)]! } }
    expect(sheetAction(workView(crowded, at, env), 'orchard', uma(3), 'start', 'apple', 1, null))
      .toEqual({ mode: 'blocked', words: `Every slot is taken. The next one here frees in ${durationText(farmItemSeconds('gather', 1) * 1000)}.` })

    // Her own job here takes the queue (Queue next): refused in its words once three wait.
    let queued = full
    for (let i = 0; i < 3; i += 1) queued = apply(queued, 'queue', { outfitId: uma(2), add: { request: { kind: 'gather', item: 'apple', count: 1 }, building: 'orchard' } }, at).state
    expect(sheetAction(workView(queued, at, env), 'orchard', uma(2), 'queue', 'apple', 1, null)).toMatchObject({ mode: 'queue', refusal: { text: 'Three are already queued.' } })
    const one = apply(full, 'queue', { outfitId: uma(2), add: { request: { kind: 'gather', item: 'apple', count: 1 }, building: 'orchard' } }, at).state
    expect(sheetAction(workView(one, at, env), 'orchard', uma(2), 'queue', 'apple', 1, null)).toMatchObject({ mode: 'queue', refusal: null })
    expect(at + HOUR).toBeGreaterThan(at)
  })
})
