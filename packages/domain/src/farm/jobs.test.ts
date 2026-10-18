// The Farm's three jobs (docs/game/07-farm.md §1–§4): job seconds at each speed from T126's base minutes, the
// family → site map, what each building makes, Farm EXP by the right family, and the grade gate on every step.
import { describe, expect, it } from 'vitest'
import { atFarmLevel, ENV, farmAccount, PLAIN, SPRINTS } from '../__fixtures__/work'
import { isRefusal } from '../state/types'
import { itemById, type ItemGrade } from '../items/catalogue'
import type { PlanContext, PlannedItem } from '../work/kinds'
import { WORK_KINDS } from '../work/kinds'
import type { FarmKind, SlotRef, WorkState } from '../work/types'
import { bestExpTenths, expFamilies, FAMILY_SITE, FARM_KINDS, farmItemSeconds, makesHere, suits } from './jobs'
import { FARM_EXP_TENTHS, SUITED_LETTERS } from './level'

const context = (building: SlotRef['building'], speed = 1): PlanContext => ({ slot: { building, slot: 0 }, speed, earlier: [], env: ENV })
const plan = (state: WorkState, outfitId: string, kind: FarmKind, item: string, count: number, building: SlotRef['building'], speed = 1) =>
  WORK_KINDS[kind]!.plan(state, outfitId, { kind, item, count }, 0, context(building, speed))
const items = (result: ReturnType<typeof plan>): readonly PlannedItem[] => {
  if (isRefusal(result)) throw new Error(result.reason)
  return result
}

describe('job seconds (07 §2, D338, D374)', () => {
  it('are T126’s base minutes × k at grades 1 and 10, at speeds 1 and 1.25', () => {
    const at = (kind: FarmKind, g: ItemGrade) => [farmItemSeconds(kind, g), farmItemSeconds(kind, g, 1.25)]
    expect(at('gather', 1)).toEqual([9_720, 7_776])
    expect(at('gather', 10)).toEqual([14_580, 11_664])
    expect(at('craft', 1)).toEqual([2_430, 1_944])
    expect(at('craft', 10)).toEqual([3_645, 2_916])
    expect(at('cook', 1)).toEqual([25_920, 20_736])
    expect(at('cook', 10)).toEqual([35_640, 28_512])
    expect(FARM_KINDS).toEqual(['gather', 'craft', 'cook'])
  })
})

describe('the family → site map (07 §1)', () => {
  it('sends each family to its own site', () => {
    expect(FAMILY_SITE).toEqual({
      sweets: 'sugar-grove', fruits: 'orchard', fish: 'fishery', 'nuts-seeds': 'nut-grove', 'herbs-spices': 'herb-garden',
      grains: 'fields', vegetables: 'vegetable-garden', mushrooms: 'mushroom-cave',
    })
  })

  it('gathers raw at its site, crafts at the Pantry and cooks meals and tonics at the Kitchen, nowhere else', () => {
    const potato = itemById('potato')!, diced = itemById('diced-potato')!, tart = itemById('dish-fruits-2')!, tonic = itemById('tonic-2')!
    expect(makesHere('gather', potato, 'vegetable-garden')).toBe(true)
    expect(makesHere('gather', potato, 'orchard')).toBe(false)
    expect(makesHere('gather', diced, 'vegetable-garden')).toBe(false)
    expect(makesHere('craft', diced, 'pantry')).toBe(true)
    expect(makesHere('craft', potato, 'pantry')).toBe(false)
    expect(makesHere('cook', tart, 'kitchen')).toBe(true)
    expect(makesHere('cook', tonic, 'kitchen')).toBe(true)
    expect(makesHere('cook', tart, 'pantry')).toBe(false)
  })

  it('never cooks a retired salad, soup or bread again (D374)', () => {
    for (const id of ['dish-vegetables-2', 'dish-mushrooms-1', 'dish-grains-5']) expect(makesHere('cook', itemById(id)!, 'kitchen'), id).toBe(false)
    expect(plan(farmAccount(), PLAIN.id, 'cook', 'dish-vegetables-1', 1, 'kitchen')).toMatchObject({ code: 'not-here' })
  })
})

describe('planning a Farm job', () => {
  const state = farmAccount()

  it('makes `count` items with their inputs, output and fixed EXP', () => {
    const tonics = items(plan(state, PLAIN.id, 'cook', 'tonic-1', 3, 'kitchen'))
    expect(tonics).toHaveLength(3)
    expect(tonics[0]).toEqual({
      seconds: 25_920,
      inputs: [{ item: 'chopped-carrot', qty: 1 }, { item: 'dried-button-mushroom', qty: 1 }, { item: 'wheat-flour', qty: 1 }],
      output: { item: 'tonic-1' }, farmExp: 1_728,
    })
    expect(items(plan(state, PLAIN.id, 'gather', 'carrot', 1, 'vegetable-garden'))[0]).toEqual({ seconds: 9_720, inputs: [], output: { item: 'carrot' }, farmExp: 648 })
    expect(items(plan(state, PLAIN.id, 'craft', 'chopped-carrot', 2, 'pantry', 1.25))[1]).toEqual({
      seconds: 1_944, inputs: [{ item: 'carrot', qty: 1 }], output: { item: 'chopped-carrot' }, farmExp: 162,
    })
  })

  it("pays EXP by the site's, the crafted item's or the dish's main family, never the side's", () => {
    // SPRINTS: Sweets S (18), Fish D (9), Fruits G (8), Herbs B (12), the rest C (10).
    expect(items(plan(state, SPRINTS.id, 'gather', 'honeycomb', 1, 'sugar-grove'))[0]!.farmExp).toBe(1_166)
    expect(items(plan(state, SPRINTS.id, 'craft', 'carp-fillet', 1, 'pantry'))[0]!.farmExp).toBe(146)
    // An Apple Tart's side is Herbs (B), but its family is Fruits (G): ×0.8.
    expect(expFamilies(itemById('dish-fruits-1')!)).toEqual(['fruits'])
    expect(items(plan(state, SPRINTS.id, 'cook', 'dish-fruits-1', 1, 'kitchen'))[0]!.farmExp).toBe(1_382)
    // A Duo or Feast takes the best of its main families: Fish D and Sweets S → ×1.8.
    const sixGrades = atFarmLevel(state, SPRINTS.id, 26)
    expect(expFamilies(itemById('duo-power-speed-3')!)).toEqual(['fish', 'sweets'])
    expect(bestExpTenths(ENV.content, SPRINTS.id, ['fish', 'sweets'])).toBe(18)
    expect(items(plan(sixGrades, SPRINTS.id, 'cook', 'duo-power-speed-3', 1, 'kitchen'))[0]!.farmExp).toBe(Math.round((28_080 * 18) / 150))
    expect(items(plan(sixGrades, SPRINTS.id, 'cook', 'feast-4', 1, 'kitchen'))[0]!.farmExp).toBe(Math.round((29_160 * 18) / 150))
    // A tonic takes the best of Vegetables, Mushrooms and Grains: all C for her.
    expect(expFamilies(itemById('tonic-1')!)).toEqual(['vegetables', 'mushrooms', 'grains'])
  })

  it('marks an Uma suited by an S or A letter for any of the families (07 §3, D366)', () => {
    expect(SUITED_LETTERS).toEqual(['S', 'A'])
    // Sweets is her Sprint (S); Fruits her Long (G); a Duo of Fish and Sweets counts the Sweets.
    expect(suits(ENV.content, SPRINTS.id, ['sweets'])).toBe(true)
    expect(suits(ENV.content, SPRINTS.id, ['fruits'])).toBe(false)
    expect(suits(ENV.content, SPRINTS.id, ['fish', 'sweets'])).toBe(true)
    expect(suits(ENV.content, SPRINTS.id, [])).toBe(false)
    expect(suits(ENV.content, SPRINTS.id, ['sweets'])).toBe(bestExpTenths(ENV.content, SPRINTS.id, ['sweets']) >= FARM_EXP_TENTHS.A)
    expect(() => suits(ENV.content, 'nobody', ['sweets'])).toThrow(RangeError)
  })

  it('refuses what the building does not make', () => {
    expect(plan(state, PLAIN.id, 'gather', 'apple', 1, 'vegetable-garden')).toMatchObject({ code: 'not-here' })
    expect(plan(state, PLAIN.id, 'craft', 'carrot', 1, 'pantry')).toMatchObject({ code: 'not-here' })
    expect(plan(state, PLAIN.id, 'cook', 'chopped-carrot', 1, 'kitchen')).toMatchObject({ code: 'not-here' })
    expect(plan(state, PLAIN.id, 'cook', 'speed-ticket', 1, 'kitchen')).toMatchObject({ code: 'not-here' })
    expect(plan(state, PLAIN.id, 'gather', 'no-such-item', 1, 'fields')).toMatchObject({ code: 'not-here' })
    expect(WORK_KINDS.gather!.plan(state, PLAIN.id, { kind: 'craft', item: 'wheat-flour', count: 1 }, 0, context('fields'))).toMatchObject({ code: 'not-here' })
  })

  it('gates every step by her Farm Level, and a dish by its own grade, not its side’s', () => {
    expect(plan(state, PLAIN.id, 'gather', 'potato', 1, 'vegetable-garden')).toEqual({
      refused: true, code: 'grade', reason: 'Needs Farm Lv {level}.', data: { level: 6, grade: 2 },
    })
    expect(plan(atFarmLevel(state, PLAIN.id, 5), PLAIN.id, 'craft', 'diced-potato', 1, 'pantry')).toMatchObject({ code: 'grade', data: { level: 6 } })
    expect(isRefusal(plan(atFarmLevel(state, PLAIN.id, 6), PLAIN.id, 'craft', 'diced-potato', 1, 'pantry'))).toBe(false)
    // Peach Tart is grade 3 with a grade-1 side: Lv 10 can't cook it, Lv 11 can.
    expect(plan(atFarmLevel(state, PLAIN.id, 10), PLAIN.id, 'cook', 'dish-fruits-3', 1, 'kitchen')).toMatchObject({ code: 'grade', data: { level: 11 } })
    expect(isRefusal(plan(atFarmLevel(state, PLAIN.id, 11), PLAIN.id, 'cook', 'dish-fruits-3', 1, 'kitchen'))).toBe(false)
    expect(plan(atFarmLevel(state, PLAIN.id, 45), PLAIN.id, 'gather', 'emperor-pumpkin', 1, 'vegetable-garden')).toMatchObject({ data: { level: 46 } })
  })
})
