// Original symmetric food rows, not imported content (docs/design/farm-kitchen-rework.md#6-raw-catalogue).
import { SCENARIOS, type ScenarioDef } from '../../scenarios'
import { STATS, type StatKey } from '../../types'
import { farmBlockLevel, farmIngredientBlock, farmRawLevel } from './progression'
import { FARM_EXTRA_CAPACITY_STEP, FARM_EXTRA_INITIAL_CAPACITY, FARM_EXTRA_NODE_COUNT, FARM_KITCHEN_ENERGY_ID,
  FARM_KITCHEN_EXP_PER_JOB, FARM_KITCHEN_JOB_MS, FARM_KITCHEN_MAX_MEALS, FARM_KITCHEN_PROCESS_BATCH,
  FARM_KITCHEN_RAW_YIELD, FARM_KITCHEN_RULES_VERSION, FARM_PROCESSES, FARM_RAW_FAMILIES, farmSafeId } from './rules'
import type { FarmCatalogue, FarmFood, FarmIngredientSlot, FarmRecipe, FarmScenarioFlavours } from './types'

export const FARM_SCENARIO_FLAVOURS: readonly FarmScenarioFlavours[] = [
  { vegetables: ['Carrot', 'Potato', 'Turnip', 'Pumpkin', 'Spinach'], fruit: ['Apple', 'Banana', 'Pear', 'Peach', 'Berry'], barnTheme: 'Meadow' },
  { vegetables: ['Radish', 'Sweet Potato', 'Corn', 'Bell Pepper', 'Broccoli'], fruit: ['Strawberry', 'Orange', 'Plum', 'Cherry', 'Grape'], barnTheme: 'Sunrise' },
  { vegetables: ['Cucumber', 'Yam', 'Beet', 'Ginger', 'Leek'], fruit: ['Apricot', 'Mango', 'Kiwi', 'Pineapple', 'Raspberry'], barnTheme: 'Brook' },
  { vegetables: ['Asparagus', 'Taro', 'Garlic', 'Chili Pepper', 'Celery'], fruit: ['Melon', 'Papaya', 'Fig', 'Persimmon', 'Blackberry'], barnTheme: 'Hilltop' },
  { vegetables: ['Snap Pea', 'Parsnip', 'Onion', 'Horseradish', 'Kale'], fruit: ['Nectarine', 'Guava', 'Lychee', 'Pomegranate', 'Blueberry'], barnTheme: 'Festival' },
  { vegetables: ['Golden Carrot', 'Eggplant', 'Daikon', 'Butternut Squash', 'Cabbage'], fruit: ['Golden Apple', 'Plantain', 'Asian Pear', 'White Peach', 'Mulberry'], barnTheme: 'Horizon' },
  { vegetables: ['Green Bean', 'Cassava', 'Fennel', 'Shishito Pepper', 'Chard'], fruit: ['Redcurrant', 'Clementine', 'Damson', 'Sour Cherry', 'Muscat Grape'], barnTheme: 'Harvest' },
  { vegetables: ['Zucchini', 'Lotus Root', 'Artichoke', 'Red Pepper', 'Romanesco'], fruit: ['Loquat', 'Passion Fruit', 'Green Kiwi', 'Dragon Fruit', 'Cranberry'], barnTheme: 'Blossom' },
  { vegetables: ['Okra', 'Acorn Squash', 'Bamboo Shoot', 'Mustard Greens', 'Scallion'], fruit: ['Honeydew', 'Starfruit', 'Date', 'Quince', 'Gooseberry'], barnTheme: 'Amber' },
  { vegetables: ['Snow Pea', 'White Beet', 'Kohlrabi', 'Radicchio', 'Watercress'], fruit: ['Blood Orange', 'Jackfruit', 'Longan', 'Tangerine', 'Blackcurrant'], barnTheme: 'Twilight' },
  { vegetables: ['Heirloom Carrot', 'Purple Potato', 'Red Turnip', 'Sugar Pumpkin', 'Baby Spinach'], fruit: ['Honey Apple', 'Red Banana', 'Bosc Pear', 'Yellow Peach', 'Golden Berry'], barnTheme: 'Starlight' },
  { vegetables: ['Cherry Radish', 'Honey Yam', 'Rainbow Corn', 'Sweet Pepper', 'Tender Broccoli'], fruit: ['Alpine Strawberry', 'Mandarin', 'Greengage', 'Rainier Cherry', 'Concord Grape'], barnTheme: 'Cloud' },
  { vegetables: ['Persian Cucumber', 'Golden Taro', 'Ruby Beet', 'Fresh Ginger', 'Young Leek'], fruit: ['Blush Apricot', 'Honey Mango', 'Gold Kiwi', 'Sweet Pineapple', 'White Raspberry'], barnTheme: 'Jubilee' },
  { vegetables: ['White Asparagus', 'Water Chestnut', 'Pearl Onion', 'Wasabi Root', 'Savoy Cabbage'], fruit: ['Cantaloupe', 'Red Papaya', 'Purple Fig', 'Fuyu Persimmon', 'Boysenberry'], barnTheme: 'Aurora' },
]
export const FARM_STAT_FLAVOURS: Record<StatKey, string> = {
  speed: 'Swift', stamina: 'Steady', power: 'Strong', guts: 'Brave', wit: 'Bright',
}
export const FARM_PAIR_MEALS = [
  ['speed', 'stamina', 'Trail Bento'], ['speed', 'power', 'Dash Bento'], ['speed', 'guts', 'Courage Bento'],
  ['speed', 'wit', 'Orchard Bento'], ['stamina', 'power', 'Protein Bento'], ['stamina', 'guts', 'Steady Bento'],
  ['stamina', 'wit', 'Garden Bento'], ['power', 'guts', 'Brave Bento'], ['power', 'wit', "Scholar's Bento"],
  ['guts', 'wit', 'Comfort Bento'],
] as const
export const farmMealId = (block: number, signature: string): string => `farm:meal:b${block}:${signature}`
export const farmRawItemId = (scenarioId: string, family: string, stat: StatKey): string => `farm:raw:${scenarioId}:${family}:${stat}`
export const farmProcessedItemId = (scenarioId: string, family: string, stat: StatKey): string => `farm:processed:${scenarioId}:${family}:${stat}`

/** An appended scenario requires an explicit original row and reviewed capacity; no invented production scenario. */
export function createFarmKitchenCatalogue(scenarios: readonly ScenarioDef[], flavours: readonly FarmScenarioFlavours[]): FarmCatalogue {
  if (!scenarios.length || scenarios.length !== flavours.length ||
    scenarios.some((s, i) => s.tier !== i + 1 || !farmSafeId(s.id) ||
      FARM_EXTRA_INITIAL_CAPACITY + FARM_EXTRA_CAPACITY_STEP * i > FARM_EXTRA_NODE_COUNT) ||
    new Set(scenarios.map(s => s.id)).size !== scenarios.length ||
    flavours.some(row => row.vegetables.length !== 5 || row.fruit.length !== 5 ||
      [...row.vegetables, ...row.fruit, row.barnTheme].some(name => !name.trim() || name.length > 80 || /[\u0000-\u001f]/.test(name)))) {
    throw new RangeError('Farm registry/flavour/capacity coverage requires an explicit definition')
  }
  const foods: FarmFood[] = []
  const recipes: FarmRecipe[] = []
  const blocks = [...new Set(scenarios.map(s => farmIngredientBlock(s.tier)))]
  const addRecipe = (food: FarmFood, recipe: Omit<FarmRecipe, 'durationMs' | 'expAward' | 'rulesVersion' | 'outputItemId' | 'name' | 'id'>) => {
    if (!farmSafeId(food.id)) throw new RangeError('Farm item identity exceeds its parsed bound')
    foods.push(food)
    recipes.push({ ...recipe, id: food.id, name: food.name, outputItemId: food.id,
      durationMs: FARM_KITCHEN_JOB_MS, expAward: FARM_KITCHEN_EXP_PER_JOB, rulesVersion: FARM_KITCHEN_RULES_VERSION })
  }
  for (const [i, scenario] of scenarios.entries()) {
    const row = flavours[i]!
    const block = farmIngredientBlock(scenario.tier)
    for (const [statIndex, stat] of STATS.entries()) {
      const theme = `${row.barnTheme} ${FARM_STAT_FLAVOURS[stat]}`
      for (const family of FARM_RAW_FAMILIES) {
        const name = family === 'vegetable' ? row.vegetables[statIndex]!
          : family === 'fruit' ? row.fruit[statIndex]!
            : `${theme} ${family[0]!.toUpperCase()}${family.slice(1)}`
        const food: FarmFood = { id: farmRawItemId(scenario.id, family, stat), name, stage: 'raw',
          scenarioId: scenario.id, scenarioIndex: scenario.tier, block, family, stat, signature: null, potency: 1 }
        addRecipe(food, { kind: 'raw', district: family === 'vegetable' ? 'garden' : family === 'fruit' ? 'orchard' : 'barn',
          scenarioId: scenario.id, block, requiredLevel: farmRawLevel(scenario.tier), signature: null,
          inputs: [], outputPerQuantity: FARM_KITCHEN_RAW_YIELD, maxQuantity: 1 })
      }
      for (const process of FARM_PROCESSES) {
        const rawId = farmRawItemId(scenario.id, process.raw, stat)
        const raw = foods.find(food => food.id === rawId)!
        const name = process.raw === 'vegetable' || process.raw === 'fruit'
          ? process.label === 'Canned' ? `Canned ${raw.name}` : `${raw.name} Juice`
          : `${theme} ${process.label}`
        const food: FarmFood = { id: farmProcessedItemId(scenario.id, process.id, stat), name, stage: 'processed',
          scenarioId: scenario.id, scenarioIndex: scenario.tier, block, family: process.id, stat, signature: null, potency: 2 }
        addRecipe(food, { kind: 'processing', district: 'workshop', scenarioId: scenario.id, block,
          requiredLevel: farmBlockLevel(block), signature: null,
          inputs: [{ id: `raw-${stat}`, stage: 'raw', stat, amount: FARM_KITCHEN_PROCESS_BATCH, fixedItemId: rawId }],
          outputPerQuantity: FARM_KITCHEN_PROCESS_BATCH, maxQuantity: 1 })
      }
    }
  }
  for (const block of blocks) {
    const meals: Array<{ signature: string; name: string; stats: readonly StatKey[] }> = [
      ...STATS.map(stat => ({ signature: stat, name: `${FARM_STAT_FLAVOURS[stat]} Bowl`, stats: [stat] })),
      ...FARM_PAIR_MEALS.map(([a, b, name]) => ({ signature: `${a}-${b}`, name, stats: [a, b] })),
      { signature: 'sun', name: 'Sunrise Banquet', stats: STATS },
    ]
    for (const meal of meals) {
      const slots: FarmIngredientSlot[] = meal.stats.flatMap(stat => [
        { id: `raw-${stat}`, stage: 'raw' as const, stat, amount: 1, fixedItemId: null },
        { id: `processed-${stat}`, stage: 'processed' as const, stat, amount: 1, fixedItemId: null },
      ])
      const food: FarmFood = { id: farmMealId(block, meal.signature), name: meal.name, stage: 'meal',
        scenarioId: null, scenarioIndex: null, block, family: 'meal', stat: meal.stats.length === 1 ? meal.stats[0]! : null,
        signature: meal.signature, potency: 0 }
      addRecipe(food, { kind: 'cooking', district: 'kitchen', scenarioId: null, block, requiredLevel: farmBlockLevel(block),
        signature: meal.signature, inputs: slots, outputPerQuantity: 1, maxQuantity: FARM_KITCHEN_MAX_MEALS })
    }
  }
  foods.push({ id: FARM_KITCHEN_ENERGY_ID, name: 'Farm Energy', stage: 'energy', scenarioId: null, scenarioIndex: null,
    block: null, family: 'energy', stat: null, signature: null, potency: 0 })
  const foodsById = new Map(foods.map(food => [food.id, food]))
  const recipesById = new Map(recipes.map(recipe => [recipe.id, recipe]))
  if (foodsById.size !== foods.length || recipesById.size !== recipes.length) throw new RangeError('Farm identity collision')
  return { scenarios: [...scenarios], blocks, foods, recipes, foodsById, recipesById }
}
export const FARM_KITCHEN_CATALOGUE = createFarmKitchenCatalogue(SCENARIOS, FARM_SCENARIO_FLAVOURS)

export function legalFarmIngredients(catalogue: FarmCatalogue, recipe: FarmRecipe, slot: FarmIngredientSlot): readonly FarmFood[] {
  return catalogue.foods.filter(food => food.stage === slot.stage && food.stat === slot.stat && food.block === recipe.block &&
    (slot.fixedItemId === null || food.id === slot.fixedItemId))
}
