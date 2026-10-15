// Generic album browsing engine: search, facets with counts, sorts, grouping
// (docs/design/collection.md#shared-browsing-chrome). Pure — no React, no Dexie, no content imports.

export type FacetValue = readonly string[] | number | boolean | null

/** One catalogue entry, pre-projected by the screen that owns it. */
export interface AlbumRow {
  id: string
  /** Lowercased haystack for substring search. */
  search: string
  facets: Readonly<Record<string, FacetValue>>
  /** Sort values by sort key. `null` always sorts last, in both directions. */
  sorts: Readonly<Record<string, number | string | null>>
}

export interface RangeSelection {
  min: number | null
  max: number | null
}

export type FacetSelection = readonly string[] | RangeSelection | boolean

export interface FacetOption {
  value: string
  label: string
}

export interface FacetDef {
  key: string
  label: string
  kind: 'enum' | 'range' | 'boolean'
  /** Tray section heading. */
  group: string
  /** Enum facets only. Option order is presentation order. */
  options?: readonly FacetOption[]
}

export interface SortDef {
  key: string
  label: string
  defaultDirection: SortDirection
  /** Optional parameter chip, e.g. which aptitude "best for…" means. */
  parameter?: { label: string; options: readonly FacetOption[] }
}

export type SortDirection = 'asc' | 'desc'

/**
 * How the grid draws each entry. `icons` is the dense, image-only default the real game uses for
 * hundreds of entries (docs/design/collection.md#view-modes).
 */
export const ALBUM_VIEWS = ['icons', 'cards', 'list'] as const
export type AlbumView = (typeof ALBUM_VIEWS)[number]

export interface AlbumQuery {
  search: string
  filters: Readonly<Record<string, FacetSelection>>
  sort: string
  direction: SortDirection
  /** Facet key to group by, or null for a flat grid. */
  group: string | null
  view: AlbumView
  /** Album-specific view mode, e.g. the Stable's outfit/character split. */
  mode: string | null
}

/** A one-tap starting point that sets the query; presets are not saved views and never overwrite one. */
export interface AlbumPreset {
  key: string
  label: string
  apply: (query: AlbumQuery) => AlbumQuery
}

export interface AlbumGroup {
  key: string
  label: string
  ids: string[]
}

export interface AlbumResult {
  rows: AlbumRow[]
  /** Per enum facet, the count each option would return; boolean facets count their `true` rows. */
  counts: Record<string, Record<string, number>>
  groups: AlbumGroup[] | null
  total: number
  activeFilterCount: number
}

const isRange = (value: FacetSelection): value is RangeSelection =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A selection that cannot narrow anything is not active, so chips and badges stay honest. */
export function isActiveSelection(selection: FacetSelection | undefined): boolean {
  if (selection === undefined) return false
  if (typeof selection === 'boolean') return selection
  if (Array.isArray(selection)) return selection.length > 0
  if (isRange(selection)) return selection.min !== null || selection.max !== null
  return false
}

export function activeFilterCount(query: AlbumQuery): number {
  return Object.values(query.filters).filter(isActiveSelection).length
}

function matchesFacet(row: AlbumRow, key: string, selection: FacetSelection): boolean {
  if (!isActiveSelection(selection)) return true
  const value = row.facets[key] ?? null
  if (typeof selection === 'boolean') return value === true
  if (Array.isArray(selection)) {
    // Multi-select inside one facet is OR.
    if (value === null) return false
    const values = Array.isArray(value) ? value : [String(value)]
    return selection.some((option) => values.includes(option))
  }
  if (isRange(selection)) {
    if (typeof value !== 'number') return false
    if (selection.min !== null && value < selection.min) return false
    if (selection.max !== null && value > selection.max) return false
  }
  return true
}

function matchesSearch(row: AlbumRow, search: string): boolean {
  const needle = search.trim().toLowerCase()
  return needle.length === 0 || row.search.includes(needle)
}

/** Filters across facets are AND; `exceptKey` powers own-facet-excluded counting. */
export function filterRows(rows: readonly AlbumRow[], query: AlbumQuery, exceptKey?: string): AlbumRow[] {
  return rows.filter((row) => {
    if (!matchesSearch(row, query.search)) return false
    return Object.entries(query.filters).every(([key, selection]) =>
      key === exceptKey || matchesFacet(row, key, selection))
  })
}

function compareValues(left: number | string | null, right: number | string | null, direction: SortDirection): number {
  if (left === null && right === null) return 0
  // Missing values sort last in both directions, so flipping direction never surfaces a hole.
  if (left === null) return 1
  if (right === null) return -1
  const order = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right))
  return direction === 'asc' ? order : -order
}

/**
 * Sorts by the chosen key, then by every key in `tieBreak` in order, then by id — so the same query
 * always produces the same order.
 */
export function sortRows(
  rows: readonly AlbumRow[],
  sort: string,
  direction: SortDirection,
  tieBreak: readonly { key: string; direction: SortDirection }[] = [],
): AlbumRow[] {
  return [...rows].sort((left, right) => {
    const primary = compareValues(left.sorts[sort] ?? null, right.sorts[sort] ?? null, direction)
    if (primary !== 0) return primary
    for (const next of tieBreak) {
      const order = compareValues(left.sorts[next.key] ?? null, right.sorts[next.key] ?? null, next.direction)
      if (order !== 0) return order
    }
    return left.id.localeCompare(right.id)
  })
}

function countFacet(rows: readonly AlbumRow[], facet: FacetDef, query: AlbumQuery): Record<string, number> {
  const scoped = filterRows(rows, query, facet.key)
  const counts: Record<string, number> = {}
  if (facet.kind === 'boolean') {
    counts.true = scoped.filter((row) => row.facets[facet.key] === true).length
    return counts
  }
  if (facet.kind === 'range') return counts
  for (const option of facet.options ?? []) counts[option.value] = 0
  for (const row of scoped) {
    const value = row.facets[facet.key]
    if (value === null || value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [String(value)]) {
      if (entry in counts) counts[entry] = (counts[entry] ?? 0) + 1
    }
  }
  return counts
}

function buildGroups(rows: readonly AlbumRow[], facet: FacetDef | undefined): AlbumGroup[] {
  const labels = new Map((facet?.options ?? []).map((option) => [option.value, option.label]))
  const order = new Map((facet?.options ?? []).map((option, index) => [option.value, index]))
  const groups = new Map<string, string[]>()
  for (const row of rows) {
    const value = facet ? row.facets[facet.key] : null
    const key = value === null || value === undefined
      ? 'other'
      : Array.isArray(value) ? (value[0] ?? 'other') : String(value)
    groups.set(key, [...(groups.get(key) ?? []), row.id])
  }
  return [...groups.entries()]
    .map(([key, ids]) => ({ key, label: labels.get(key) ?? key, ids }))
    .sort((left, right) => (order.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.key) ?? Number.MAX_SAFE_INTEGER)
      || left.label.localeCompare(right.label))
}

export function runAlbumQuery(
  rows: readonly AlbumRow[],
  facets: readonly FacetDef[],
  query: AlbumQuery,
  tieBreak: readonly { key: string; direction: SortDirection }[] = [],
): AlbumResult {
  const filtered = filterRows(rows, query)
  const sorted = sortRows(filtered, query.sort, query.direction, tieBreak)
  const counts: Record<string, Record<string, number>> = {}
  for (const facet of facets) counts[facet.key] = countFacet(rows, facet, query)
  const groupFacet = query.group ? facets.find((facet) => facet.key === query.group) : undefined
  return {
    rows: sorted,
    counts,
    groups: query.group ? buildGroups(sorted, groupFacet) : null,
    total: sorted.length,
    activeFilterCount: activeFilterCount(query),
  }
}

export interface EmptyStateHint {
  facetKey: string
  label: string
  count: number
}

/**
 * When a query returns nothing, name the single facet worth dropping — "remove Dirt to see 12" —
 * instead of leaving a dead end (docs/design/collection.md#shared-behaviours).
 */
export function emptyStateHint(
  rows: readonly AlbumRow[],
  facets: readonly FacetDef[],
  query: AlbumQuery,
): EmptyStateHint | null {
  const active = facets.filter((facet) => isActiveSelection(query.filters[facet.key]))
  if (active.length === 0) return null
  const hints = active
    .map((facet) => ({ facetKey: facet.key, label: facet.label, count: filterRows(rows, query, facet.key).length }))
    .filter((hint) => hint.count > 0)
    .sort((left, right) => right.count - left.count || left.facetKey.localeCompare(right.facetKey))
  return hints[0] ?? null
}
