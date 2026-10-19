// Pins the rework's Farm catalogue (docs/game/08-item-catalogue-and-recipes.md §1, §3, §4.3, §4.4, §9). Expected
// values are 08's tables copied as written, never recomputed by the code under test.
import { describe, expect, it } from 'vitest'
import {
  craftedItem, DUO_GRADES, DUOS, FEAST_GRADES, FEASTS, heldFor, ITEM_GRADES, isKitchenItem, isRetired, itemById, ITEMS, planetDish,
  rawItem, SPEED_TICKET, SPEED_TICKET_ID, duoDish, feastDish, isItemGrade, standInsOf, takeFor, tonicId, tonicItem, TONICS, type ItemDef,
} from './catalogue'
import { FAMILIES, FAMILY_IDS, type FamilyId } from './families'
import { dishSide } from './recipes'

const cells = (row: string) => row.split('|').slice(1, -1).map((cell) => cell.trim())
/** "Honeycomb `honeycomb`" → ["Honeycomb", "honeycomb"]. */
function named(cell: string): [name: string, id: string] {
  const match = /^(.+) `([a-z0-9-]+)`$/.exec(cell)
  if (!match) throw new Error(`Not "Name \`id\`": ${cell}`)
  return [match[1]!, match[2]!]
}

/** 08 §3: each family's table, rows as written. */
const SECTION_3: Readonly<Record<FamilyId, readonly string[]>> = {
  sweets: [
    '| 1 | Honeycomb `honeycomb` | Honey `honey` | Honeycomb Cake `dish-sweets-1` | Peanut Butter (Nuts & Seeds 1) |',
    '| 2 | Sugarcane `sugarcane` | Cane Sugar `cane-sugar` | Sugarcane Cake `dish-sweets-2` | Apple Preserve (Fruits 1) |',
    '| 3 | Sugar Beet `sugar-beet` | Beet Sugar `beet-sugar` | Sugar Beet Cake `dish-sweets-3` | Dried Basil (Herbs & Spices 1) |',
    '| 4 | Maple Sap `maple-sap` | Maple Syrup `maple-syrup` | Maple Sap Cake `dish-sweets-4` | Trout Fillet (Fish 2) |',
    '| 5 | Cacao Pod `cacao-pod` | Chocolate `chocolate` | Cacao Pod Cake `dish-sweets-5` | Sesame Paste (Nuts & Seeds 3) |',
    '| 6 | Vanilla Pod `vanilla-pod` | Vanilla Extract `vanilla-extract` | Vanilla Pod Cake `dish-sweets-6` | Walnut Paste (Nuts & Seeds 4) |',
    '| 7 | Agave Heart `agave-heart` | Agave Syrup `agave-syrup` | Agave Heart Cake `dish-sweets-7` | Orange Marmalade (Fruits 5) |',
    '| 8 | Palm Sap `palm-sap` | Palm Sugar `palm-sugar` | Palm Sap Cake `dish-sweets-8` | Ground Pepper (Herbs & Spices 6) |',
    '| 9 | Fairy Honeycomb `fairy-honeycomb` | Fairy Honey `fairy-honey` | Fairy Honeycomb Cake `dish-sweets-9` | Eel Fillet (Fish 7) |',
    '| 10 | Ambrosia Blossom `ambrosia-blossom` | Ambrosia `ambrosia` | Ambrosia Blossom Cake `dish-sweets-10` | Macadamia Butter (Nuts & Seeds 8) |',
  ],
  fruits: [
    '| 1 | Apple `apple` | Apple Preserve `apple-preserve` | Apple Tart `dish-fruits-1` | Dried Basil (Herbs & Spices 1) |',
    '| 2 | Pear `pear` | Pear Preserve `pear-preserve` | Pear Tart `dish-fruits-2` | Carp Fillet (Fish 1) |',
    '| 3 | Peach `peach` | Peach Preserve `peach-preserve` | Peach Tart `dish-fruits-3` | Honey (Sweets 1) |',
    '| 4 | Plum `plum` | Plum Preserve `plum-preserve` | Plum Tart `dish-fruits-4` | Sunflower Oil (Nuts & Seeds 2) |',
    '| 5 | Orange `orange` | Orange Marmalade `orange-marmalade` | Orange Tart `dish-fruits-5` | Dried Rosemary (Herbs & Spices 3) |',
    '| 6 | Grape `grape` | Grape Jelly `grape-jelly` | Grape Tart `dish-fruits-6` | Dried Thyme (Herbs & Spices 4) |',
    '| 7 | Mango `mango` | Mango Pulp `mango-pulp` | Mango Tart `dish-fruits-7` | Salmon Fillet (Fish 5) |',
    '| 8 | Pomegranate `pomegranate` | Pomegranate Molasses `pomegranate-molasses` | Pomegranate Tart `dish-fruits-8` | Vanilla Extract (Sweets 6) |',
    '| 9 | Starpeach `starpeach` | Starpeach Nectar `starpeach-nectar` | Starpeach Tart `dish-fruits-9` | Pistachio Paste (Nuts & Seeds 7) |',
    '| 10 | Golden Apple `golden-apple` | Golden Apple Preserve `golden-apple-preserve` | Golden Apple Tart `dish-fruits-10` | Saffron Threads (Herbs & Spices 8) |',
  ],
  fish: [
    '| 1 | Carp `carp` | Carp Fillet `carp-fillet` | Carp Grill `dish-fish-1` | Honey (Sweets 1) |',
    '| 2 | Trout `trout` | Trout Fillet `trout-fillet` | Trout Grill `dish-fish-2` | Peanut Butter (Nuts & Seeds 1) |',
    '| 3 | Sardine `sardine` | Sardine Fillet `sardine-fillet` | Sardine Grill `dish-fish-3` | Apple Preserve (Fruits 1) |',
    '| 4 | Mackerel `mackerel` | Mackerel Fillet `mackerel-fillet` | Mackerel Grill `dish-fish-4` | Dried Mint (Herbs & Spices 2) |',
    '| 5 | Salmon `salmon` | Salmon Fillet `salmon-fillet` | Salmon Grill `dish-fish-5` | Beet Sugar (Sweets 3) |',
    '| 6 | Sea Bream `sea-bream` | Sea Bream Fillet `sea-bream-fillet` | Sea Bream Grill `dish-fish-6` | Maple Syrup (Sweets 4) |',
    '| 7 | Eel `eel` | Eel Fillet `eel-fillet` | Eel Grill `dish-fish-7` | Chestnut Paste (Nuts & Seeds 5) |',
    '| 8 | Tuna `tuna` | Tuna Fillet `tuna-fillet` | Tuna Grill `dish-fish-8` | Grape Jelly (Fruits 6) |',
    '| 9 | Silverfin `silverfin` | Silverfin Fillet `silverfin-fillet` | Silverfin Grill `dish-fish-9` | Ground Cinnamon (Herbs & Spices 7) |',
    '| 10 | Rainbow Koi `rainbow-koi` | Rainbow Koi Fillet `rainbow-koi-fillet` | Rainbow Koi Grill `dish-fish-10` | Palm Sugar (Sweets 8) |',
  ],
  'nuts-seeds': [
    '| 1 | Peanut `peanut` | Peanut Butter `peanut-butter` | Peanut Cookies `dish-nuts-seeds-1` | Apple Preserve (Fruits 1) |',
    '| 2 | Sunflower Seed `sunflower-seed` | Sunflower Oil `sunflower-oil` | Sunflower Seed Cookies `dish-nuts-seeds-2` | Dried Basil (Herbs & Spices 1) |',
    '| 3 | Sesame `sesame` | Sesame Paste `sesame-paste` | Sesame Cookies `dish-nuts-seeds-3` | Carp Fillet (Fish 1) |',
    '| 4 | Walnut `walnut` | Walnut Paste `walnut-paste` | Walnut Cookies `dish-nuts-seeds-4` | Cane Sugar (Sweets 2) |',
    '| 5 | Chestnut `chestnut` | Chestnut Paste `chestnut-paste` | Chestnut Cookies `dish-nuts-seeds-5` | Peach Preserve (Fruits 3) |',
    '| 6 | Almond `almond` | Almond Paste `almond-paste` | Almond Cookies `dish-nuts-seeds-6` | Plum Preserve (Fruits 4) |',
    '| 7 | Pistachio `pistachio` | Pistachio Paste `pistachio-paste` | Pistachio Cookies `dish-nuts-seeds-7` | Ground Ginger (Herbs & Spices 5) |',
    '| 8 | Macadamia `macadamia` | Macadamia Butter `macadamia-butter` | Macadamia Cookies `dish-nuts-seeds-8` | Sea Bream Fillet (Fish 6) |',
    '| 9 | Thundernut `thundernut` | Thundernut Oil `thundernut-oil` | Thundernut Cookies `dish-nuts-seeds-9` | Agave Syrup (Sweets 7) |',
    '| 10 | Worldseed `worldseed` | Worldseed Oil `worldseed-oil` | Worldseed Cookies `dish-nuts-seeds-10` | Pomegranate Molasses (Fruits 8) |',
  ],
  'herbs-spices': [
    '| 1 | Basil `basil` | Dried Basil `dried-basil` | Basil Curry `dish-herbs-spices-1` | Carp Fillet (Fish 1) |',
    '| 2 | Mint `mint` | Dried Mint `dried-mint` | Mint Curry `dish-herbs-spices-2` | Honey (Sweets 1) |',
    '| 3 | Rosemary `rosemary` | Dried Rosemary `dried-rosemary` | Rosemary Curry `dish-herbs-spices-3` | Peanut Butter (Nuts & Seeds 1) |',
    '| 4 | Thyme `thyme` | Dried Thyme `dried-thyme` | Thyme Curry `dish-herbs-spices-4` | Pear Preserve (Fruits 2) |',
    '| 5 | Ginger `ginger` | Ground Ginger `ground-ginger` | Ginger Curry `dish-herbs-spices-5` | Sardine Fillet (Fish 3) |',
    '| 6 | Peppercorn `peppercorn` | Ground Pepper `ground-pepper` | Peppercorn Curry `dish-herbs-spices-6` | Mackerel Fillet (Fish 4) |',
    '| 7 | Cinnamon `cinnamon` | Ground Cinnamon `ground-cinnamon` | Cinnamon Curry `dish-herbs-spices-7` | Chocolate (Sweets 5) |',
    '| 8 | Saffron `saffron` | Saffron Threads `saffron-threads` | Saffron Curry `dish-herbs-spices-8` | Almond Paste (Nuts & Seeds 6) |',
    '| 9 | Mandrake `mandrake` | Mandrake Powder `mandrake-powder` | Mandrake Curry `dish-herbs-spices-9` | Mango Pulp (Fruits 7) |',
    '| 10 | Phoenix Pepper `phoenix-pepper` | Phoenix Spice `phoenix-spice` | Phoenix Pepper Curry `dish-herbs-spices-10` | Tuna Fillet (Fish 8) |',
  ],
  grains: [
    '| 1 | Wheat `wheat` | Wheat Flour `wheat-flour` | Wheat Bread `dish-grains-1` | Apple Preserve (Fruits 1) |',
    '| 2 | Oats `oats` | Rolled Oats `rolled-oats` | Oats Bread `dish-grains-2` | Dried Basil (Herbs & Spices 1) |',
    '| 3 | Barley `barley` | Pearl Barley `pearl-barley` | Barley Bread `dish-grains-3` | Carp Fillet (Fish 1) |',
    '| 4 | Rice `rice` | Polished Rice `polished-rice` | Rice Bread `dish-grains-4` | Cane Sugar (Sweets 2) |',
    '| 5 | Corn `corn` | Cornmeal `cornmeal` | Corn Bread `dish-grains-5` | Sesame Paste (Nuts & Seeds 3) |',
    '| 6 | Rye `rye` | Rye Flour `rye-flour` | Rye Bread `dish-grains-6` | Plum Preserve (Fruits 4) |',
    '| 7 | Buckwheat `buckwheat` | Buckwheat Flour `buckwheat-flour` | Buckwheat Bread `dish-grains-7` | Ground Ginger (Herbs & Spices 5) |',
    '| 8 | Wild Rice `wild-rice` | Hulled Wild Rice `hulled-wild-rice` | Wild Rice Bread `dish-grains-8` | Sea Bream Fillet (Fish 6) |',
    '| 9 | Moonrice `moonrice` | Moonrice Flour `moonrice-flour` | Moonrice Bread `dish-grains-9` | Agave Syrup (Sweets 7) |',
    '| 10 | Sunwheat `sunwheat` | Sunwheat Flour `sunwheat-flour` | Sunwheat Bread `dish-grains-10` | Macadamia Butter (Nuts & Seeds 8) |',
  ],
  vegetables: [
    '| 1 | Carrot `carrot` | Chopped Carrot `chopped-carrot` | Carrot Salad `dish-vegetables-1` | Wheat Flour (Grains 1) |',
    '| 2 | Potato `potato` | Diced Potato `diced-potato` | Potato Salad `dish-vegetables-2` | Wheat Flour (Grains 1) |',
    '| 3 | Cabbage `cabbage` | Shredded Cabbage `shredded-cabbage` | Cabbage Salad `dish-vegetables-3` | Wheat Flour (Grains 1) |',
    '| 4 | Onion `onion` | Diced Onion `diced-onion` | Onion Salad `dish-vegetables-4` | Rolled Oats (Grains 2) |',
    '| 5 | Tomato `tomato` | Tomato Purée `tomato-puree` | Tomato Salad `dish-vegetables-5` | Pearl Barley (Grains 3) |',
    '| 6 | Bell Pepper `bell-pepper` | Sliced Bell Pepper `sliced-bell-pepper` | Bell Pepper Salad `dish-vegetables-6` | Polished Rice (Grains 4) |',
    '| 7 | Eggplant `eggplant` | Sliced Eggplant `sliced-eggplant` | Eggplant Salad `dish-vegetables-7` | Cornmeal (Grains 5) |',
    '| 8 | Asparagus `asparagus` | Trimmed Asparagus `trimmed-asparagus` | Asparagus Salad `dish-vegetables-8` | Rye Flour (Grains 6) |',
    '| 9 | Golden Carrot `golden-carrot` | Golden Carrot Purée `golden-carrot-puree` | Golden Carrot Salad `dish-vegetables-9` | Buckwheat Flour (Grains 7) |',
    '| 10 | Emperor Pumpkin `emperor-pumpkin` | Pumpkin Purée `pumpkin-puree` | Emperor Pumpkin Salad `dish-vegetables-10` | Hulled Wild Rice (Grains 8) |',
  ],
  mushrooms: [
    '| 1 | Button Mushroom `button-mushroom` | Dried Button Mushroom `dried-button-mushroom` | Button Mushroom Soup `dish-mushrooms-1` | Wheat Flour (Grains 1) |',
    '| 2 | Shiitake `shiitake` | Dried Shiitake `dried-shiitake` | Shiitake Soup `dish-mushrooms-2` | Wheat Flour (Grains 1) |',
    '| 3 | Oyster Mushroom `oyster-mushroom` | Dried Oyster Mushroom `dried-oyster-mushroom` | Oyster Mushroom Soup `dish-mushrooms-3` | Wheat Flour (Grains 1) |',
    '| 4 | Enoki `enoki` | Dried Enoki `dried-enoki` | Enoki Soup `dish-mushrooms-4` | Rolled Oats (Grains 2) |',
    '| 5 | Chanterelle `chanterelle` | Dried Chanterelle `dried-chanterelle` | Chanterelle Soup `dish-mushrooms-5` | Pearl Barley (Grains 3) |',
    '| 6 | Porcini `porcini` | Dried Porcini `dried-porcini` | Porcini Soup `dish-mushrooms-6` | Polished Rice (Grains 4) |',
    '| 7 | Morel `morel` | Dried Morel `dried-morel` | Morel Soup `dish-mushrooms-7` | Cornmeal (Grains 5) |',
    '| 8 | Truffle `truffle` | Shaved Truffle `shaved-truffle` | Truffle Soup `dish-mushrooms-8` | Rye Flour (Grains 6) |',
    '| 9 | Glowcap `glowcap` | Glowcap Powder `glowcap-powder` | Glowcap Soup `dish-mushrooms-9` | Buckwheat Flour (Grains 7) |',
    '| 10 | King Reishi `king-reishi` | Reishi Powder `reishi-powder` | King Reishi Soup `dish-mushrooms-10` | Hulled Wild Rice (Grains 8) |',
  ],
}

/** 08 §4.3 and §4.4: ids and names as written. */
const DUO_NAMES: readonly (readonly [string, string])[] = [
  ['duo-stamina-wit-3', 'Fruit & Herb Platter'],
  ['duo-stamina-wit-5', 'Fruit & Herb Platter Deluxe'],
  ['duo-wit-power-3', 'Herb & Fish Platter'],
  ['duo-wit-power-5', 'Herb & Fish Platter Deluxe'],
  ['duo-power-speed-3', 'Fish & Honey Platter'],
  ['duo-power-speed-5', 'Fish & Honey Platter Deluxe'],
  ['duo-speed-guts-3', 'Honey & Nut Platter'],
  ['duo-speed-guts-5', 'Honey & Nut Platter Deluxe'],
]
const FEAST_NAMES: readonly (readonly [string, string, number])[] = [
  ['feast-4', 'Spring Feast', 4],
  ['feast-6', 'Summer Feast', 6],
  ['feast-8', 'Harvest Feast', 8],
  ['feast-10', 'Grand Feast', 10],
]

/** 08 §4.5's tonics, as written. */
const TONIC_NAMES: readonly (readonly [string, string, number])[] = [
  ['tonic-1', 'Warm-Up Tonic', 1], ['tonic-2', 'Practice Tonic', 2], ['tonic-3', 'Paddock Tonic', 3], ['tonic-4', 'Gallop Tonic', 4],
  ['tonic-5', 'Stride Tonic', 5], ['tonic-6', 'Stretch Tonic', 6], ['tonic-7', 'Spurt Tonic', 7], ['tonic-8', 'Derby Tonic', 8],
  ['tonic-9', "Champion's Tonic", 9], ['tonic-10', "Legend's Tonic", 10],
]

const count = (predicate: (item: ItemDef) => boolean) => ITEMS.filter(predicate).length

describe('the catalogue (08 §1)', () => {
  it('holds 263 unique definitions', () => {
    expect(ITEMS).toHaveLength(263)
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(263)
    expect(count((item) => item.kind === 'raw')).toBe(80)
    expect(count((item) => item.kind === 'crafted')).toBe(80)
    expect(count((item) => item.kind === 'dish' && item.dish === 'planet')).toBe(80)
    expect(count((item) => item.kind === 'dish' && item.dish === 'duo')).toBe(8)
    expect(count((item) => item.kind === 'dish' && item.dish === 'feast')).toBe(4)
    expect(count((item) => item.kind === 'tonic')).toBe(10)
    expect(count((item) => item.kind === 'ticket')).toBe(1)
  })

  it('retires the 30 salads, soups and breads, and no other dish (D375)', () => {
    const retired = ITEMS.filter(isRetired)
    expect(retired).toHaveLength(30)
    expect(new Set(retired.map((item) => (item.kind === 'dish' && item.dish === 'planet' ? item.family : '')))).toEqual(new Set(['grains', 'vegetables', 'mushrooms']))
    expect(isKitchenItem(planetDish('vegetables', 1)) && isKitchenItem(TONICS[0]!) && !isKitchenItem(craftedItem('fish', 1))).toBe(true)
  })

  it('has 10 raw and 10 crafted items per family, 160 in all, one of each grade', () => {
    expect(ITEM_GRADES).toBe(10)
    for (const family of FAMILY_IDS) {
      for (const kind of ['raw', 'crafted'] as const) {
        const grades = ITEMS.filter((item) => item.kind === kind && item.family === family).map((item) => (item.kind === kind ? item.grade : 0))
        expect(grades, `${family} ${kind}`).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      }
    }
    expect(count((item) => item.kind === 'raw' || item.kind === 'crafted')).toBe(160)
  })

  it('pairs every raw item with its crafted form, both ways, in the same family and grade', () => {
    for (const item of ITEMS) {
      if (item.kind !== 'raw' && item.kind !== 'crafted') continue
      const pair = itemById(item.pair)!
      expect(pair.kind, item.id).toBe(item.kind === 'raw' ? 'crafted' : 'raw')
      if (pair.kind !== 'raw' && pair.kind !== 'crafted') throw new Error('unreachable')
      expect(pair.pair).toBe(item.id)
      expect([pair.family, pair.grade]).toEqual([item.family, item.grade])
      expect(item.refined).toBe(item.kind === 'crafted')
    }
  })

  it('orders families raw 1–10 then crafted 1–10, then planets, Duos, Feasts, tonics and the ticket last', () => {
    const expected = [
      ...FAMILY_IDS.flatMap((family) => [...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => `raw ${family} ${g}`), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => `crafted ${family} ${g}`)]),
      ...FAMILY_IDS.flatMap((family) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => `planet ${family} ${g}`)),
      ...DUO_NAMES.map(([id]) => id),
      ...FEAST_NAMES.map(([id]) => id),
      ...TONIC_NAMES.map(([id]) => id),
      SPEED_TICKET_ID,
    ]
    expect(ITEMS.map((item) => {
      if (item.kind === 'raw' || item.kind === 'crafted') return `${item.kind} ${item.family} ${item.grade}`
      if (item.kind === 'dish' && item.dish === 'planet') return `planet ${item.family} ${item.grade}`
      return item.id
    })).toEqual(expected)
  })

  it('looks items up by id and by family and grade', () => {
    expect(itemById('honey')).toBe(craftedItem('sweets', 1))
    expect(itemById('nope')).toBeUndefined()
    expect(rawItem('fish', 4).id).toBe('mackerel')
    expect(planetDish('grains', 10).id).toBe('dish-grains-10')
    expect(duoDish('wit-power', 5).id).toBe('duo-wit-power-5')
    expect(feastDish(8).id).toBe('feast-8')
    expect(() => rawItem('fish', 11 as never)).toThrow(RangeError)
    expect([0, 1, 10, 11, 2.5].map(isItemGrade)).toEqual([false, true, true, false, false])
  })

  it('is frozen', () => {
    expect(Object.isFrozen(ITEMS)).toBe(true)
    for (const item of ITEMS) {
      expect(Object.isFrozen(item), item.id).toBe(true)
      if (item.art) expect(Object.isFrozen(item.art)).toBe(true)
    }
  })
})

describe('the family tables (08 §3)', () => {
  it.each(FAMILY_IDS)('%s: every raw, crafted and planet dish id and name, and its side', (family) => {
    const rows = SECTION_3[family]
    expect(rows).toHaveLength(10)
    rows.forEach((row, i) => {
      const [g, raw, crafted, dish, side] = cells(row) as [string, string, string, string, string]
      const grade = (i + 1) as 1
      expect(Number(g)).toBe(grade)
      const [rawName, rawId] = named(raw), [craftedName, craftedId] = named(crafted), [dishName, dishId] = named(dish)
      expect(rawItem(family, grade)).toMatchObject({ id: rawId, name: rawName, pair: craftedId })
      expect(craftedItem(family, grade)).toMatchObject({ id: craftedId, name: craftedName, pair: rawId })
      expect(planetDish(family, grade)).toMatchObject({ id: dishId, name: dishName, destination: FAMILIES[family].destination })
      // "Its side (crafted)": e.g. "Peanut Butter (Nuts & Seeds 1)".
      const sideItem = itemById(dishSide(dishId)!)!
      if (sideItem.kind !== 'crafted') throw new Error(`${dishId}'s side is not crafted`)
      expect(`${sideItem.name} (${FAMILIES[sideItem.family].name} ${sideItem.grade})`).toBe(side)
    })
  })
})

describe('Duos, Feasts and the ticket (08 §4.3, §4.4, §9)', () => {
  it('names the Duos as 08 §4.3 does, at grades 3 and 5', () => {
    expect(DUOS.map((duo) => [duo.id, duo.name])).toEqual(DUO_NAMES)
    expect(DUO_GRADES).toEqual([3, 5])
    expect(DUOS.map((duo) => duo.grade)).toEqual([3, 5, 3, 5, 3, 5, 3, 5])
    expect(DUOS.map((duo) => duo.stats.join('+'))).toEqual(['stamina+wit', 'stamina+wit', 'wit+power', 'wit+power', 'power+speed', 'power+speed', 'speed+guts', 'speed+guts'])
    for (const duo of DUOS) expect(duo.families.map((family) => FAMILIES[family].destination)).toEqual(duo.stats)
  })

  it('names the Feasts as 08 §4.4 does, for the Sun', () => {
    expect(FEASTS.map((feast) => [feast.id, feast.name, feast.grade])).toEqual(FEAST_NAMES)
    expect(FEAST_GRADES).toEqual([4, 6, 8, 10])
    for (const feast of FEASTS) expect(feast.destination).toBe('sun')
  })

  it('has one Speed Ticket, without art', () => {
    expect(SPEED_TICKET_ID).toBe('speed-ticket')
    expect(itemById('speed-ticket')).toBe(SPEED_TICKET)
    expect(SPEED_TICKET).toEqual({ kind: 'ticket', id: 'speed-ticket', name: 'Speed Ticket', art: null })
    expect(ITEMS.at(-1)).toBe(SPEED_TICKET)
  })
})

describe('tonics and their stand-ins (08 §4.5, D375)', () => {
  it('names one tonic a grade, as 08 §4.5 does, with no uma-art frame yet', () => {
    expect(TONICS.map((tonic) => [tonic.id, tonic.name, tonic.grade])).toEqual(TONIC_NAMES)
    for (const tonic of TONICS) expect(tonic.art).toBeNull()
    expect(tonicItem(4)).toBe(itemById('tonic-4'))
    expect(tonicId(10)).toBe('tonic-10')
  })

  it('lets the retired salad and soup of a grade stand in for its tonic, salad first, and nothing else', () => {
    expect(standInsOf('tonic-2')).toEqual(['dish-vegetables-2', 'dish-mushrooms-2'])
    expect(standInsOf('dish-fruits-1')).toEqual([])
    expect(standInsOf('dish-grains-1')).toEqual([])
  })

  it('pools a tonic with its stand-ins and takes a stand-in first, never one twice', () => {
    const stock = { 'tonic-3': 1, 'dish-vegetables-3': 1, 'dish-mushrooms-3': 1, 'dish-mushrooms-4': 2 }
    expect(heldFor(stock, 'tonic-3')).toBe(3)
    expect(heldFor(stock, 'tonic-4')).toBe(2)
    const left = new Map(Object.entries(stock))
    expect([1, 2, 3, 4].map(() => takeFor(left, 'tonic-3'))).toEqual(['dish-vegetables-3', 'dish-mushrooms-3', 'tonic-3', null])
  })
})
