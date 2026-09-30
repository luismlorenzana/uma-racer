import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { loadItemInventoryPreferences, saveItemInventoryPreferences } from './preferences'

describe('Item inventory preferences', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open() })
  afterEach(async () => { db.close(); await db.delete() })

  it('survives a database reopen and never enters the sync outbox', async () => {
    await saveItemInventoryPreferences({ visibility: 'all', stat: 'power', scenarioTier: 4, density: 'compact' })
    db.close()
    await db.open()
    expect(await loadItemInventoryPreferences()).toEqual({
      visibility: 'all', stat: 'power', scenarioTier: 4, density: 'compact',
    })
    expect(await db.outbox.count()).toBe(0)
  })

  it('falls back safely when the stored row is malformed', async () => {
    await db.albumPrefs.put({ id: 'inventory:global-items', query: { broken: true } as never, views: [], seen: [] })
    expect(await loadItemInventoryPreferences()).toEqual({
      visibility: 'owned', stat: null, scenarioTier: null, density: 'comfortable',
    })
  })
})
