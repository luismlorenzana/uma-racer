import { describe, expect, it } from 'vitest'
import { STATS } from '../types'
import { FARM_CROP_YIELD, FARMING_EXP_PER_HARVEST } from './constants'
import { cropTierOpenLevel } from './progression'
import { assertFarmCropCatalog, farmCropById, farmCropFor, FARM_CROPS } from './catalog'

const EXPECTED_NAMES = [
  ['Carrot', 'Sweet Potato', 'Corn', 'Chili Pepper', 'Blueberry'],
  ['Radish', 'Yam', 'Potato', 'Bell Pepper', 'Strawberry'],
  ['Snap Pea', 'Taro', 'Daikon', 'Shishito Pepper', 'Tomato'],
  ['Cucumber', 'Cassava', 'Onion', 'Jalapeño', 'Grape'],
  ['Asparagus', 'Beet', 'Garlic', 'Ginger', 'Apple'],
  ['Green Bean', 'Turnip', 'Leek', 'Mustard Greens', 'Pear'],
  ['Zucchini', 'Parsnip', 'Broccoli', 'Horseradish', 'Peach'],
  ['Okra', 'Pumpkin', 'Cauliflower', 'Wasabi Root', 'Plum'],
  ['Celery', 'Butternut Squash', 'Cabbage', 'Red Pepper', 'Cherry'],
  ['Scallion', 'Acorn Squash', 'Eggplant', 'Radicchio', 'Persimmon'],
  ['Bamboo Shoot', 'Plantain', 'Artichoke', 'Bitter Melon', 'Fig'],
  ['Fennel', 'Breadfruit', 'Avocado', 'Turmeric Root', 'Pomegranate'],
  ['Starfruit', 'Lotus Root', 'Jackfruit', 'Habanero', 'Kiwi'],
  ['Snow Pea', 'Winter Melon', 'Romanesco', 'Scotch Bonnet', 'Dragon Fruit'],
]

describe('Farm crop catalog', () => {
  it('contains exactly one pinned crop for every scenario and stat', () => {
    expect(() => assertFarmCropCatalog()).not.toThrow()
    expect(FARM_CROPS).toHaveLength(70)
    for (let tier = 1; tier <= 14; tier += 1) {
      for (const [statIndex, stat] of STATS.entries()) {
        expect(farmCropFor(tier, stat)).toEqual({
          id: `produce:t${tier}:${stat}`,
          name: EXPECTED_NAMES[tier - 1]![statIndex],
          stat,
          scenarioTier: tier,
          outfitLevelRequired: cropTierOpenLevel(tier),
          yield: FARM_CROP_YIELD,
          farmingExp: FARMING_EXP_PER_HARVEST,
        })
      }
    }
    expect(farmCropById('produce:t15:speed')).toBeNull()
  })

  it('rejects duplicate, missing, or drifted definitions', () => {
    expect(() => assertFarmCropCatalog([...FARM_CROPS.slice(1), FARM_CROPS[1]!])).toThrow()
    expect(() => assertFarmCropCatalog(FARM_CROPS.slice(0, -1))).toThrow(/70/)
    expect(() => assertFarmCropCatalog(FARM_CROPS.map((crop, index) => index === 0
      ? { ...crop, outfitLevelRequired: crop.outfitLevelRequired + 1 }
      : crop))).toThrow(/invalid/)
  })
})

