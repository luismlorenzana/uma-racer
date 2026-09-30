// Device-local Item inventory preferences stored with the existing album preference port (D112, T085).

import { SCENARIOS, STATS, type StatKey } from '@racer/domain'
import type { AlbumQuery, FacetDef, SortDef } from '../album/query'
import { loadAlbumPrefs, saveAlbumPrefs } from '../album/prefs'

export type ItemInventoryDensity = 'comfortable' | 'compact'

export interface ItemInventoryPreferences {
  visibility: 'owned' | 'all'
  stat: StatKey | null
  scenarioTier: number | null
  density: ItemInventoryDensity
}

const ID = 'inventory:global-items'
const FACETS: readonly FacetDef[] = [
  { key: 'stat', label: 'Stat', kind: 'enum', group: 'Items', options: STATS.map((stat) => ({ value: stat, label: stat })) },
  { key: 'scenario', label: 'Scenario', kind: 'enum', group: 'Items', options: SCENARIOS.map((scenario) => ({ value: String(scenario.tier), label: scenario.name })) },
]
const SORTS: readonly SortDef[] = [{ key: 'catalog', label: 'Catalog', defaultDirection: 'asc' }]
const DEFAULT_QUERY: AlbumQuery = {
  search: '', filters: {}, sort: 'catalog', direction: 'asc', group: null, view: 'cards', mode: 'owned',
}

const first = (value: unknown): string | null => Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null

export async function loadItemInventoryPreferences(): Promise<ItemInventoryPreferences> {
  const loaded = await loadAlbumPrefs(ID, DEFAULT_QUERY, FACETS, SORTS, ['owned', 'all'])
  const stat = first(loaded.query.filters.stat)
  const scenario = Number(first(loaded.query.filters.scenario))
  return {
    visibility: loaded.query.mode === 'all' ? 'all' : 'owned',
    stat: STATS.includes(stat as StatKey) ? stat as StatKey : null,
    scenarioTier: Number.isSafeInteger(scenario) && scenario >= 1 && scenario <= SCENARIOS.length ? scenario : null,
    density: loaded.query.view === 'list' ? 'compact' : 'comfortable',
  }
}

export async function saveItemInventoryPreferences(preferences: ItemInventoryPreferences): Promise<void> {
  const filters: AlbumQuery['filters'] = {
    ...(preferences.stat ? { stat: [preferences.stat] } : {}),
    ...(preferences.scenarioTier ? { scenario: [String(preferences.scenarioTier)] } : {}),
  }
  await saveAlbumPrefs({
    id: ID,
    query: {
      ...DEFAULT_QUERY,
      filters,
      view: preferences.density === 'compact' ? 'list' : 'cards',
      mode: preferences.visibility,
    },
    views: [], seen: [],
  })
}
