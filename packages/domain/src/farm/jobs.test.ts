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

describe('job seconds (07 §2, D338)', () => {
  it('are T126’s base minutes × k at grades 1 and 10, at speeds 1 and 1.25', () => {
    const at = (kind: FarmKind, g: ItemGrade) => [farmItemSeconds(kind, g), farmItemSeconds(kind, g, 1.25)]
    expect(at('gather', 1)).toEqual([6_480, 5_184])
    expect(at('gather', 10)).toEqual([9_720, 7_776])
    expect(at('craft', 1)).toEqual([1_620, 1_296])
    expect(at('craft', 10)).toEqual([2_430, 1_944])
    expect(at('cook', 1)).toEqual([17_280, 13_824])
    expect(at('cook', 10)).toEqual([23_760, 19_008])
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

  it('gathers raw at its site, crafts at the Pantry and cooks at the Kitchen, nowhere else', () => {
    const potato = itemById('potato')!, diced = itemById('diced-potato')!, salad = itemById('dish-vegetables-2')!
    expect(makesHere('gather', potato, 'vegetable-garden')).toBe(true)
    expect(makesHere('gather', potato, 'orchard')).toBe(false)
    expect(makesHere('gather', diced, 'vegetable-garden')).toBe(false)
    expect(makesHere('craft', diced, 'pantry')).toBe(true)
    expect(makesHere('craft', potato, 'pantry')).toBe(false)
    expect(makesHere('cook', salad, 'kitchen')).toBe(true)
    expect(makesHere('cook', salad, 'pantry')).toBe(false)
  })
})

describe('planning a Farm job', () => {
  const state = farmAccount()

  it('makes `count` items with their inputs, output and fixed EXP', () => {
    const salads = items(plan(state, PLAIN.id, 'cook', 'dish-vegetables-1', 3, 'kitchen'))
    expect(salads).toHaveLength(3)
    expect(salads[0]).toEqual({
      seconds: 17_280, inputs: [{ item: 'chopped-carrot', qty: 4 }, { item: 'wheat-flour', qty: 1 }], output: { item: 'dish-vegetables-1' }, farmExp: 1_152,
    })
    expect(items(plan(state, PLAIN.id, 'gather', 'carrot', 1, 'vegetable-garden'))[0]).toEqual({ seconds: 6_480, inputs: [], output: { item: 'carrot' }, farmExp: 432 })
    expect(items(plan(state, PLAIN.id, 'craft', 'chopped-carrot', 2, 'pantry', 1.25))[1]).toEqual({
      seconds: 1_296, inputs: [{ item: 'carrot', qty: 1 }], output: { item: 'chopped-carrot' }, farmExp: 108,
    })
  })

  it("pays EXP by the site's, the crafted item's or the dish's main family, never the side's", () => {
    // SPRINTS: Sweets S (18), Fish D (9), Fruits G (8), Herbs B (12), the rest C (10).
    expect(items(plan(state, SPRINTS.id, 'gather', 'honeycomb', 1, 'sugar-grove'))[0]!.farmExp).toBe(778)
    expect(items(plan(state, SPRINTS.id, 'craft', 'carp-fillet', 1, 'pantry'))[0]!.farmExp).toBe(97)
    // An Apple Tart's side is Herbs (B), but its family is Fruits (G): ×0.8.
    expect(expFamilies(itemById('dish-fruits-1')!)).toEqual(['fruits'])
    expect(items(plan(state, SPRINTS.id, 'cook', 'dish-fruits-1', 1, 'kitchen'))[0]!.farmExp).toBe(922)
    // A Duo or Feast takes the best of its main families: Fish D and Sweets S → ×1.8.
    const sixGrades = atFarmLevel(state, SPRINTS.id, 26)
    expect(expFamilies(itemById('duo-power-speed-3')!)).toEqual(['fish', 'sweets'])
    expect(bestExpTenths(ENV.content, SPRINTS.id, ['fish', 'sweets'])).toBe(18)
    expect(items(plan(sixGrades, SPRINTS.id, 'cook', 'duo-power-speed-3', 1, 'kitchen'))[0]!.farmExp).toBe(Math.round((18_720 * 18) / 150))
    expect(items(plan(sixGrades, SPRINTS.id, 'cook', 'feast-4', 1, 'kitchen'))[0]!.farmExp).toBe(Math.round((19_440 * 18) / 150))
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
    // Cabbage Salad is grade 3 with a grade-1 side: Lv 10 can't cook it, Lv 11 can.
    expect(plan(atFarmLevel(state, PLAIN.id, 10), PLAIN.id, 'cook', 'dish-vegetables-3', 1, 'kitchen')).toMatchObject({ code: 'grade', data: { level: 11 } })
    expect(isRefusal(plan(atFarmLevel(state, PLAIN.id, 11), PLAIN.id, 'cook', 'dish-vegetables-3', 1, 'kitchen'))).toBe(false)
    expect(plan(atFarmLevel(state, PLAIN.id, 45), PLAIN.id, 'gather', 'emperor-pumpkin', 1, 'vegetable-garden')).toMatchObject({ data: { level: 46 } })
  })
})
