import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { RacerDb } from '../../db'
import { DEFAULT_FARM_KITCHEN_PREFERENCES, loadFarmKitchenPreferences, parseFarmKitchenPreferences, saveFarmKitchenPreferences } from './preferences'

let database: RacerDb | null = null
afterEach(async () => { if (database) { database.close(); await database.delete(); database = null } })
describe('Farm kitchen preferences', () => {
  it('does not write defaults while opening and retains valid choices explicitly', async () => {
    database = new RacerDb(`farm-kitchen-preferences-${crypto.randomUUID()}`)
    expect(await loadFarmKitchenPreferences(database)).toEqual(DEFAULT_FARM_KITCHEN_PREFERENCES)
    expect(await database.farmPreferences.count()).toBe(0)
    await saveFarmKitchenPreferences(database, { ...DEFAULT_FARM_KITCHEN_PREFERENCES, lastDistrict: 'kitchen', density: 'compact' })
    expect(await loadFarmKitchenPreferences(database)).toMatchObject({ lastDistrict: 'kitchen', density: 'compact' })
  })
  it('bounds and validates saved goals', () => {
    expect(parseFarmKitchenPreferences({ lastDistrict: 'void', stage: 'bad', goals: [{ id: '__proto__', recipeId: 'missing', quantity: 1000 }] }))
      .toEqual(DEFAULT_FARM_KITCHEN_PREFERENCES)
  })
})
