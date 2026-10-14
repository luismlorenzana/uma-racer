// Pins every recipe and the side rotation (docs/rework/08-item-catalogue-and-recipes.md §4). Expected values are 08's
// tables copied as written.
import { describe, expect, it } from 'vitest'
import { DUOS, FEASTS, ITEM_GRADE_LIST, itemById, ITEMS, planetDish, SPEED_TICKET_ID, type ItemGrade } from './catalogue'
import { FAMILIES, FAMILY_IDS, FAMILY_RING, STAT_CYCLE, type FamilyId } from './families'
import { DUO_SIDE_FAMILY, dishFamilies, dishSide, recipeOf, sideFamily, sideGrade } from './recipes'

const cells = (row: string) => row.split('|').slice(1, -1).map((cell) => cell.trim())

/** 08 §4.2: all 80 planet dishes' side families (the side's grade in brackets), rows as written. */
const SECTION_4_2 = [
  '| 1 (1) | Nuts | Herbs | Sweets | Fruits | Fish | Fruits | Grains | Grains |',
  '| 2 (1) | Fruits | Fish | Nuts | Herbs | Sweets | Herbs | Grains | Grains |',
  '| 3 (1) | Herbs | Sweets | Fruits | Fish | Nuts | Fish | Grains | Grains |',
  '| 4 (2) | Fish | Nuts | Herbs | Sweets | Fruits | Sweets | Grains | Grains |',
  '| 5 (3) | Grains | Grains | Grains | Grains | Grains | Nuts | Grains | Grains |',
  '| 6 (4) | Nuts | Herbs | Sweets | Fruits | Fish | Fruits | Grains | Grains |',
  '| 7 (5) | Fruits | Fish | Nuts | Herbs | Sweets | Herbs | Grains | Grains |',
  '| 8 (6) | Herbs | Sweets | Fruits | Fish | Nuts | Fish | Grains | Grains |',
  '| 9 (7) | Fish | Nuts | Herbs | Sweets | Fruits | Sweets | Grains | Grains |',
  '| 10 (8) | Grains | Grains | Grains | Grains | Grains | Nuts | Grains | Grains |',
]
/** 08 §4.2's columns, in its order, and its short names. */
const SECTION_4_2_COLUMNS: readonly FamilyId[] = ['sweets', 'fruits', 'fish', 'nuts-seeds', 'herbs-spices', 'grains', 'vegetables', 'mushrooms']
const SHORT: Readonly<Record<string, FamilyId>> = {
  Sweets: 'sweets', Fruits: 'fruits', Fish: 'fish', Nuts: 'nuts-seeds', Herbs: 'herbs-spices', Grains: 'grains',
}

/** 08 §4.3: id and recipe, as written. */
const SECTION_4_3 = [
  ['duo-stamina-wit-3', '2 Peach Preserve + 2 Dried Rosemary + 1 Peanut Butter'],
  ['duo-stamina-wit-5', '2 Orange Marmalade + 2 Ground Ginger + 1 Sesame Paste'],
  ['duo-wit-power-3', '2 Dried Rosemary + 2 Sardine Fillet + 1 Peanut Butter'],
  ['duo-wit-power-5', '2 Ground Ginger + 2 Salmon Fillet + 1 Sesame Paste'],
  ['duo-power-speed-3', '2 Sardine Fillet + 2 Beet Sugar + 1 Apple Preserve'],
  ['duo-power-speed-5', '2 Salmon Fillet + 2 Chocolate + 1 Peach Preserve'],
  ['duo-speed-guts-3', '2 Beet Sugar + 2 Sesame Paste + 1 Apple Preserve'],
  ['duo-speed-guts-5', '2 Chocolate + 2 Chestnut Paste + 1 Peach Preserve'],
] as const

/** 08 §4.4: id and recipe, as written. */
const SECTION_4_4 = [
  ['feast-4', 'Maple Syrup, Plum Preserve, Mackerel Fillet, Walnut Paste, Dried Thyme + Rolled Oats'],
  ['feast-6', 'Vanilla Extract, Grape Jelly, Sea Bream Fillet, Almond Paste, Ground Pepper + Polished Rice'],
  ['feast-8', 'Palm Sugar, Pomegranate Molasses, Tuna Fillet, Macadamia Butter, Saffron Threads + Rye Flour'],
  ['feast-10', 'Ambrosia, Golden Apple Preserve, Rainbow Koi Fillet, Worldseed Oil, Phoenix Spice + Hulled Wild Rice'],
] as const

const nameOf = (id: string) => itemById(id)!.name
const crafted = (id: string) => {
  const item = itemById(id)
  if (item?.kind !== 'crafted') throw new Error(`${id} is not crafted`)
  return item
}

describe('crafting (08 §4)', () => {
  it('makes each crafted item from 1 raw item of its pair at the Pantry', () => {
    for (const item of ITEMS) {
      if (item.kind !== 'crafted') continue
      expect(recipeOf(item.id), item.id).toEqual({ at: 'pantry', inputs: [{ item: item.pair, qty: 1 }] })
    }
  })

  it('has no recipe for raw items and the ticket, and none for an unknown id', () => {
    for (const item of ITEMS) if (item.kind === 'raw') expect(recipeOf(item.id)).toBeNull()
    expect(recipeOf(SPEED_TICKET_ID)).toBeNull()
    expect(recipeOf('nope')).toBeUndefined()
    expect(dishSide('honey')).toBeUndefined()
  })
})

describe('planet dishes (08 §4, §4.2)', () => {
  it('take 4 crafted items of their family at g and 1 crafted side at max(1, g − 2), at the Kitchen', () => {
    for (const family of FAMILY_IDS) {
      for (const g of ITEM_GRADE_LIST) {
        const dish = planetDish(family, g)
        const recipe = recipeOf(dish.id)!
        expect(recipe.at).toBe('kitchen')
        expect(recipe.inputs).toHaveLength(2)
        const [own, side] = recipe.inputs as [{ item: string; qty: number }, { item: string; qty: number }]
        expect([crafted(own.item).family, crafted(own.item).grade, own.qty]).toEqual([family, g, 4])
        expect(side.qty).toBe(1)
        expect(side.item).toBe(dishSide(dish.id))
        expect(crafted(side.item).grade).toBe(Math.max(1, g - 2))
        expect(sideGrade(g)).toBe(Math.max(1, g - 2))
      }
    }
  })

  it('take the side families of 08 §4.2\'s 80 cells', () => {
    SECTION_4_2.forEach((row, i) => {
      const [label, ...columns] = cells(row)
      const g = (i + 1) as ItemGrade
      expect(label).toBe(`${g} (${Math.max(1, g - 2)})`)
      SECTION_4_2_COLUMNS.forEach((family, c) => {
        const expected = SHORT[columns[c]!]!
        expect(sideFamily(family, g), `${family} ${g}`).toBe(expected)
        expect(crafted(dishSide(planetDish(family, g).id)!).family, `${family} ${g}`).toBe(expected)
      })
    })
  })
})

describe('Duos and Feasts (08 §4.3, §4.4)', () => {
  it('cook every Duo from 2 + 2 of its families at g and 1 side at g − 2, item for item as 08 §4.3', () => {
    expect(DUOS.map((duo) => duo.id)).toEqual(SECTION_4_3.map(([id]) => id))
    for (const [id, recipe] of SECTION_4_3) {
      const made = recipeOf(id)!
      expect(made.at).toBe('kitchen')
      expect(made.inputs.map(({ item, qty }) => `${qty} ${nameOf(item)}`).join(' + ')).toBe(recipe)
      const duo = DUOS.find((d) => d.id === id)!
      const side = crafted(dishSide(id)!)
      expect(side.family).toBe(DUO_SIDE_FAMILY[`${duo.stats[0]}-${duo.stats[1]}` as keyof typeof DUO_SIDE_FAMILY])
      expect(side.grade).toBe(duo.grade - 2)
    }
  })

  it('send Duo sides to the stat families in only one Duo: Nuts & Seeds, then Fruits', () => {
    expect(DUO_SIDE_FAMILY).toEqual({ 'stamina-wit': 'nuts-seeds', 'wit-power': 'nuts-seeds', 'power-speed': 'fruits', 'speed-guts': 'fruits' })
  })

  it('cook every Feast from one crafted item of each stat family at g and a Grains side at g − 2, as 08 §4.4', () => {
    expect(FEASTS.map((feast) => feast.id)).toEqual(SECTION_4_4.map(([id]) => id))
    for (const [id, recipe] of SECTION_4_4) {
      const made = recipeOf(id)!
      const side = dishSide(id)!
      const own = made.inputs.filter(({ item }) => item !== side)
      expect(made.at).toBe('kitchen')
      expect(own.every(({ qty }) => qty === 1)).toBe(true)
      expect(`${own.map(({ item }) => nameOf(item)).join(', ')} + ${nameOf(side)}`).toBe(recipe)
      expect(crafted(side).family).toBe('grains')
      expect(new Set(own.map(({ item }) => crafted(item).family))).toEqual(new Set(STAT_CYCLE))
    }
  })

  it('makes the four Duos exactly the stat-family neighbours on the ring, so Guts–Stamina has none', () => {
    const isStat = (family: FamilyId) => STAT_CYCLE.includes(family)
    const neighbours = FAMILY_RING.map((family, i) => [family, FAMILY_RING[(i + 1) % FAMILY_RING.length]!] as const)
      .filter(([a, b]) => isStat(a) && isStat(b))
      .map((pair) => [...pair].sort().join('+'))
    const duoPairs = new Set(DUOS.map((duo) => [...duo.families].sort().join('+')))
    expect(new Set(neighbours)).toEqual(duoPairs)
    expect(duoPairs.size).toBe(4)
    expect(duoPairs.has(['fruits', 'nuts-seeds'].sort().join('+'))).toBe(false)
    expect(FAMILIES['nuts-seeds'].destination).toBe('guts')
    expect(FAMILIES.fruits.destination).toBe('stamina')
  })
})

describe('every dish (08 §4.2 rules 6, §12)', () => {
  it('takes only crafted inputs, one side, never Vegetables, Mushrooms or its own family', () => {
    for (const item of ITEMS) {
      if (item.kind !== 'dish') continue
      const recipe = recipeOf(item.id)!
      const side = dishSide(item.id)!
      expect(recipe.inputs.filter((input) => input.item === side), item.id).toEqual([{ item: side, qty: 1 }])
      for (const input of recipe.inputs) expect(itemById(input.item)?.kind, `${item.id} ← ${input.item}`).toBe('crafted')
      const sideFamilyOf = crafted(side).family
      expect(['vegetables', 'mushrooms'], item.id).not.toContain(sideFamilyOf)
      expect(dishFamilies(item), item.id).not.toContain(sideFamilyOf)
      // Exact items: own inputs are the dish's families at the dish's own grade.
      for (const input of recipe.inputs) {
        if (input.item === side) continue
        expect(dishFamilies(item)).toContain(crafted(input.item).family)
        expect(crafted(input.item).grade).toBe(item.grade)
      }
      // Five crafted items for a planet dish or a Duo, six for a Feast (08 §4.1).
      expect(recipe.inputs.reduce((n, input) => n + input.qty, 0), item.id).toBe(item.dish === 'feast' ? 6 : 5)
    }
  })
})
