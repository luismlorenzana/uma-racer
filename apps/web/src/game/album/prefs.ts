// Device-local album preferences: query, saved views, and the seen set behind NEW markers
// (docs/design/collection.md#shared-behaviours, D112). Never part of the synced save.

import { db } from '../db'
import {
  isActiveSelection,
  type AlbumQuery,
  type Density,
  type FacetDef,
  type FacetSelection,
  type SortDef,
  type SortDirection,
} from './query'

export const MAX_SAVED_VIEWS = 20
export const MAX_VIEW_NAME = 40
/** Keeps a device-local row bounded; the album only needs recent acquisitions to stop being NEW. */
export const MAX_SEEN_IDS = 4000

export interface SavedView {
  name: string
  query: AlbumQuery
}

export interface AlbumPrefs {
  id: string
  query: AlbumQuery
  views: SavedView[]
  seen: string[]
}

export interface LoadedAlbumPrefs extends AlbumPrefs {
  /** True when this device had no stored row, so the album can seed its seen set. */
  fresh: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseSelection(value: unknown, facet: FacetDef): FacetSelection | null {
  if (facet.kind === 'boolean') return typeof value === 'boolean' ? value : null
  if (facet.kind === 'range') {
    if (!isRecord(value)) return null
    const min = typeof value.min === 'number' && Number.isFinite(value.min) ? value.min : null
    const max = typeof value.max === 'number' && Number.isFinite(value.max) ? value.max : null
    return { min, max }
  }
  if (!Array.isArray(value)) return null
  const allowed = new Set((facet.options ?? []).map((option) => option.value))
  const selected = [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && allowed.has(entry)))]
  return selected.sort()
}

/**
 * Stored preferences are untrusted: a stale or corrupt row must fall back to the album's default
 * query rather than throwing, and unknown facets, sorts, modes or densities are dropped.
 */
export function sanitizeQuery(
  raw: unknown,
  fallback: AlbumQuery,
  facets: readonly FacetDef[],
  sorts: readonly SortDef[],
  modes: readonly string[] = [],
): AlbumQuery {
  if (!isRecord(raw)) return fallback
  const filters: Record<string, FacetSelection> = {}
  const rawFilters = isRecord(raw.filters) ? raw.filters : {}
  for (const facet of facets) {
    const parsed = parseSelection(rawFilters[facet.key], facet)
    if (parsed !== null && isActiveSelection(parsed)) filters[facet.key] = parsed
  }
  const sort = sorts.find((entry) => entry.key === raw.sort)
  // A stored sort without a usable direction takes that sort's own default, not the fallback sort's.
  const storedDirection: SortDirection | null = raw.direction === 'asc' || raw.direction === 'desc' ? raw.direction : null
  const direction: SortDirection = storedDirection ?? sort?.defaultDirection ?? fallback.direction
  const density: Density = raw.density === 'compact' || raw.density === 'comfortable' ? raw.density : fallback.density
  const group = typeof raw.group === 'string' && facets.some((facet) => facet.key === raw.group) ? raw.group : null
  const mode = typeof raw.mode === 'string' && modes.includes(raw.mode) ? raw.mode : fallback.mode
  return {
    search: typeof raw.search === 'string' ? raw.search.slice(0, 120) : '',
    filters,
    sort: sort ? sort.key : fallback.sort,
    direction: sort ? direction : fallback.direction,
    group,
    density,
    mode,
  }
}

export function parseViews(
  raw: unknown,
  facets: readonly FacetDef[],
  sorts: readonly SortDef[],
  fallback: AlbumQuery,
  modes: readonly string[] = [],
): SavedView[] {
  if (!Array.isArray(raw)) return []
  const names = new Set<string>()
  const views: SavedView[] = []
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.name !== 'string') continue
    const name = entry.name.trim()
    if (name.length === 0 || name.length > MAX_VIEW_NAME || names.has(name)) continue
    names.add(name)
    views.push({ name, query: sanitizeQuery(entry.query, fallback, facets, sorts, modes) })
    if (views.length === MAX_SAVED_VIEWS) break
  }
  return views
}

export function addSavedView(views: readonly SavedView[], name: string, query: AlbumQuery): SavedView[] {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_VIEW_NAME) throw new Error(`Name a view in 1–${MAX_VIEW_NAME} characters`)
  const without = views.filter((view) => view.name !== trimmed)
  if (without.length >= MAX_SAVED_VIEWS) throw new Error(`Keep at most ${MAX_SAVED_VIEWS} saved views`)
  return [...without, { name: trimmed, query }]
}

export const removeSavedView = (views: readonly SavedView[], name: string): SavedView[] =>
  views.filter((view) => view.name !== name)

/** Newest ids win when the list is trimmed, so a fresh acquisition never loses its NEW marker. */
export function markSeen(seen: readonly string[], ids: readonly string[]): string[] {
  if (ids.length === 0) return [...seen]
  const next = [...new Set([...seen, ...ids])]
  return next.length <= MAX_SEEN_IDS ? next : next.slice(next.length - MAX_SEEN_IDS)
}

export async function loadAlbumPrefs(
  id: string,
  fallback: AlbumQuery,
  facets: readonly FacetDef[],
  sorts: readonly SortDef[],
  modes: readonly string[] = [],
): Promise<LoadedAlbumPrefs> {
  try {
    const row = await db.albumPrefs.get(id)
    if (!row) return { id, query: fallback, views: [], seen: [], fresh: true }
    return {
      id,
      fresh: false,
      query: sanitizeQuery(row.query, fallback, facets, sorts, modes),
      views: parseViews(row.views, facets, sorts, fallback, modes),
      seen: Array.isArray(row.seen) ? row.seen.filter((entry): entry is string => typeof entry === 'string') : [],
    }
  } catch {
    // Preferences are a convenience: a broken row must never block the album.
    return { id, query: fallback, views: [], seen: [], fresh: true }
  }
}

export async function saveAlbumPrefs(prefs: AlbumPrefs): Promise<void> {
  try {
    await db.albumPrefs.put(prefs)
  } catch {
    // Ignored on purpose — private windows and blocked storage still get a working album.
  }
}
