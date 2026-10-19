// Pins the buildings (docs/game/07-farm.md §1, §6, §7; docs/game/05-training-hub.md §1, §7): ids against uma-art,
// order, rooms, slots, speed and every upgrade price.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  BUILDING_IDS, BUILDING_SPEED, BUILDINGS, DOJO_FAMILIES, DOJO_ROOMS, FACILITY_IDS, FARM_BUILDING_IDS, GYM_ROOMS, INITIAL_BUILDINGS,
  MAX_BUILDING_LEVEL, SLOTS, STAT_FAMILIES, slotsPerRoom, totalSlots, UPGRADES, upgradeCost, upgradeFamilies, type BuildingId, type BuildingLevel,
} from './buildings'

const require = createRequire(import.meta.url)
const artFrames = JSON.parse(readFileSync(require.resolve('@luismlorenzana/uma-art/buildings/atlas.json'), 'utf8')) as {
  frames: Record<string, { page: string }>
}

const sum = (ids: readonly BuildingId[], f: (id: BuildingId) => number) => ids.reduce((total, id) => total + f(id), 0)

describe('the buildings', () => {
  it("are uma-art's ten farmlands buildings, then the four facilities", () => {
    const farmlands = Object.entries(artFrames.frames).filter(([, frame]) => frame.page === 'farmlands').map(([id]) => id)
    expect([...FARM_BUILDING_IDS].sort()).toEqual([...farmlands].sort())
    expect(FARM_BUILDING_IDS).toEqual([
      'sugar-grove', 'orchard', 'fishery', 'nut-grove', 'herb-garden', 'fields', 'vegetable-garden', 'mushroom-cave', 'pantry', 'kitchen',
    ])
    expect(FACILITY_IDS).toEqual(['observatory', 'lineage-hall', 'gym', 'dojo'])
    expect(BUILDING_IDS).toEqual([...FARM_BUILDING_IDS, ...FACILITY_IDS])
    expect(FARM_BUILDING_IDS.map((id) => BUILDINGS[id].family)).toEqual([
      'sweets', 'fruits', 'fish', 'nuts-seeds', 'herbs-spices', 'grains', 'vegetables', 'mushrooms', null, null,
    ])
    expect(BUILDING_IDS.map((id) => BUILDINGS[id].job)).toEqual([...Array(8).fill('gather'), 'craft', 'cook', ...Array(4).fill('session')])
  })

  it('give the Gym and Dojo their rooms in 05 §1 order', () => {
    expect(GYM_ROOMS).toEqual(['stamina', 'wit', 'power', 'speed', 'guts'])
    expect(DOJO_ROOMS).toEqual(['speed', 'stamina', 'power', 'guts', 'wit', 'friend-group'])
    expect(BUILDING_IDS.filter((id) => BUILDINGS[id].rooms.length > 0)).toEqual(['gym', 'dojo'])
  })

  it('run Lv 1–3 at speed 1, 1 and 1.25, and start at Lv 1', () => {
    expect(MAX_BUILDING_LEVEL).toBe(3)
    expect(BUILDING_SPEED).toEqual({ 1: 1, 2: 1, 3: 1.25 })
    expect(Object.values(INITIAL_BUILDINGS).every((row) => row.level === 1)).toBe(true)
    expect(Object.keys(INITIAL_BUILDINGS)).toEqual([...BUILDING_IDS])
  })
})

describe('slots (07 §6, 05 §7)', () => {
  it('pins every building at Lv 1, 2 and 3', () => {
    expect(SLOTS).toEqual({
      'sugar-grove': [2, 3, 3], orchard: [2, 3, 3], fishery: [2, 3, 3], 'nut-grove': [2, 3, 3], 'herb-garden': [2, 3, 3], fields: [2, 3, 3],
      'vegetable-garden': [4, 5, 5], 'mushroom-cave': [2, 3, 3], pantry: [3, 5, 5], kitchen: [6, 9, 9],
      observatory: [2, 3, 3], 'lineage-hall': [2, 3, 3], gym: [1, 2, 2], dojo: [1, 2, 2],
    })
  })

  it('total 27 and 40 on the Farm (D351, D375), and 5 and 6 rooms of 1, then 2, in the facilities', () => {
    const levels: BuildingLevel[] = [1, 2, 3]
    expect(levels.map((lv) => sum(FARM_BUILDING_IDS, (id) => totalSlots(id, lv)))).toEqual([27, 40, 40])
    expect(levels.map((lv) => totalSlots('gym', lv))).toEqual([5, 10, 10])
    expect(levels.map((lv) => totalSlots('dojo', lv))).toEqual([6, 12, 12])
    expect(levels.map((lv) => slotsPerRoom('dojo', lv))).toEqual([1, 2, 2])
    expect(levels.map((lv) => totalSlots('observatory', lv))).toEqual([2, 3, 3])
  })
})

describe('upgrades (07 §7, 05 §7)', () => {
  it('price the Farm at 14,100, 37,200 and 51,300 PM, and the facilities at 6,100, 10,700 and 16,800', () => {
    const toLv2 = (ids: readonly BuildingId[]) => sum(ids, (id) => UPGRADES[id][0].prizeMoney)
    const toLv3 = (ids: readonly BuildingId[]) => sum(ids, (id) => UPGRADES[id][1].prizeMoney)
    expect([toLv2(FARM_BUILDING_IDS), toLv3(FARM_BUILDING_IDS), toLv2(FARM_BUILDING_IDS) + toLv3(FARM_BUILDING_IDS)]).toEqual([14_100, 37_200, 51_300])
    expect([toLv2(FACILITY_IDS), toLv3(FACILITY_IDS), toLv2(FACILITY_IDS) + toLv3(FACILITY_IDS)]).toEqual([6_100, 10_700, 16_800])
  })

  it('pins each building’s Prize Money, count and grade', () => {
    const steps = (id: BuildingId) => UPGRADES[id].map(({ prizeMoney, each, grade }) => [prizeMoney, each, grade])
    for (const site of FARM_BUILDING_IDS.slice(0, 8)) expect(steps(site)).toEqual([[1_200, 4, 1], [2_400, 4, 3]])
    expect(steps('pantry')).toEqual([[1_500, 1, 1], [6_000, 1, 3]])
    expect(steps('kitchen')).toEqual([[3_000, 2, 1], [12_000, 2, 3]])
    expect(steps('observatory')).toEqual([[1_200, 4, 1], [2_400, 4, 3]])
    expect(steps('lineage-hall')).toEqual([[1_000, 4, 1], [1_500, 4, 3]])
    expect(steps('gym')).toEqual([[2_400, 1, 1], [4_800, 2, 3]])
    expect(steps('dojo')).toEqual([[1_500, 1, 1], [2_000, 1, 3]])
  })

  it("take crafted items of the building's own families", () => {
    expect(upgradeCost('orchard', 2)).toEqual({ prizeMoney: 1_200, items: [{ item: 'apple-preserve', qty: 4 }] })
    expect(upgradeCost('vegetable-garden', 3)).toEqual({ prizeMoney: 2_400, items: [{ item: 'shredded-cabbage', qty: 4 }] })
    expect(upgradeCost('kitchen', 2).items).toEqual([
      'honey', 'apple-preserve', 'carp-fillet', 'peanut-butter', 'dried-basil', 'wheat-flour', 'chopped-carrot', 'dried-button-mushroom',
    ].map((item) => ({ item, qty: 2 })))
    expect(upgradeCost('pantry', 3).items.map(({ qty }) => qty)).toEqual(Array(8).fill(1))
    expect(upgradeCost('observatory', 2)).toEqual({ prizeMoney: 1_200, items: [{ item: 'chopped-carrot', qty: 4 }] })
    expect(upgradeCost('lineage-hall', 3)).toEqual({ prizeMoney: 1_500, items: [{ item: 'dried-oyster-mushroom', qty: 4 }] })
    expect(STAT_FAMILIES).toEqual(['sweets', 'fruits', 'fish', 'nuts-seeds', 'herbs-spices'])
    expect(DOJO_FAMILIES).toEqual(['sweets', 'fruits', 'fish', 'nuts-seeds', 'herbs-spices', 'grains'])
    expect(upgradeFamilies('gym')).toBe(STAT_FAMILIES)
    expect(upgradeCost('gym', 3).items).toEqual(['beet-sugar', 'peach-preserve', 'sardine-fillet', 'sesame-paste', 'dried-rosemary'].map((item) => ({ item, qty: 2 })))
    expect(upgradeCost('dojo', 2).items.map(({ item }) => item)).toEqual(['honey', 'apple-preserve', 'carp-fillet', 'peanut-butter', 'dried-basil', 'wheat-flour'])
  })
})
