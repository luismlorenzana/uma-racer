import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  emptyStateHint,
  filterRows,
  runAlbumQuery,
  sortRows,
  type AlbumQuery,
  type AlbumRow,
  type FacetDef,
} from './query'

const facets: FacetDef[] = [
  { key: 'surface', label: 'Surface', kind: 'enum', group: 'Aptitude', options: [{ value: 'turf', label: 'Turf' }, { value: 'dirt', label: 'Dirt' }] },
  { key: 'distance', label: 'Distance', kind: 'enum', group: 'Aptitude', options: [{ value: 'mile', label: 'Mile' }, { value: 'long', label: 'Long' }] },
  { key: 'level', label: 'Level', kind: 'range', group: 'Progress' },
  { key: 'owned', label: 'Owned', kind: 'boolean', group: 'Ownership' },
]

const rows: AlbumRow[] = [
  { id: 'a', search: 'alpha', facets: { surface: ['turf'], distance: ['mile'], level: 10, owned: true }, sorts: { name: 'alpha', level: 10 } },
  { id: 'b', search: 'bravo', facets: { surface: ['turf', 'dirt'], distance: ['long'], level: 5, owned: true }, sorts: { name: 'bravo', level: 5 } },
  { id: 'c', search: 'charlie', facets: { surface: ['dirt'], distance: ['mile'], level: 1, owned: false }, sorts: { name: 'charlie', level: 1 } },
  { id: 'd', search: 'delta', facets: { surface: null, distance: ['long'], level: null, owned: false }, sorts: { name: 'delta', level: null } },
]

const query = (overrides: Partial<AlbumQuery> = {}): AlbumQuery => ({
  search: '', filters: {}, sort: 'name', direction: 'asc', group: null, view: 'icons', mode: null, ...overrides,
})

describe('album query engine', () => {
  it('ANDs across facets and ORs inside one', () => {
    expect(filterRows(rows, query({ filters: { surface: ['turf'], distance: ['mile'] } })).map((row) => row.id)).toEqual(['a'])
    expect(filterRows(rows, query({ filters: { surface: ['turf', 'dirt'] } })).map((row) => row.id)).toEqual(['a', 'b', 'c'])
  })

  it('applies range and boolean facets, and rejects missing values under a bound', () => {
    expect(filterRows(rows, query({ filters: { level: { min: 5, max: null } } })).map((row) => row.id)).toEqual(['a', 'b'])
    expect(filterRows(rows, query({ filters: { level: { min: null, max: 4 } } })).map((row) => row.id)).toEqual(['c'])
    expect(filterRows(rows, query({ filters: { owned: true } })).map((row) => row.id)).toEqual(['a', 'b'])
    // `false` means "not filtering", not "show unowned".
    expect(filterRows(rows, query({ filters: { owned: false } })).map((row) => row.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('searches the projected haystack', () => {
    expect(filterRows(rows, query({ search: 'AR' })).map((row) => row.id)).toEqual(['c'])
    expect(filterRows(rows, query({ search: '  ' })).map((row) => row.id)).toHaveLength(4)
  })

  it('counts each option with its own facet excluded', () => {
    const result = runAlbumQuery(rows, facets, query({ filters: { surface: ['turf'] } }))
    // Picking Turf must not collapse the other Surface options to zero.
    expect(result.counts.surface).toEqual({ turf: 2, dirt: 2 })
    // Distance counts respect the active Surface selection.
    expect(result.counts.distance).toEqual({ mile: 1, long: 1 })
    expect(result.counts.owned).toEqual({ true: 2 })
  })

  it('sorts with missing values last in both directions, then by tie-breaks and id', () => {
    expect(sortRows(rows, 'level', 'desc').map((row) => row.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(sortRows(rows, 'level', 'asc').map((row) => row.id)).toEqual(['c', 'b', 'a', 'd'])
    const tied: AlbumRow[] = [
      { id: 'z', search: '', facets: {}, sorts: { tier: 1, name: 'same' } },
      { id: 'y', search: '', facets: {}, sorts: { tier: 1, name: 'same' } },
    ]
    expect(sortRows(tied, 'tier', 'asc', [{ key: 'name', direction: 'asc' }]).map((row) => row.id)).toEqual(['y', 'z'])
  })

  it('groups by a facet in option order, with unknown values last', () => {
    const result = runAlbumQuery(rows, facets, query({ group: 'surface' }))
    expect(result.groups?.map((group) => [group.key, group.ids.length])).toEqual([['turf', 2], ['dirt', 1], ['other', 1]])
  })

  it('counts only selections that can narrow anything', () => {
    expect(activeFilterCount(query({ filters: { surface: [], owned: false, level: { min: null, max: null } } }))).toBe(0)
    expect(activeFilterCount(query({ filters: { surface: ['turf'], owned: true } }))).toBe(2)
  })

  it('names the single facet worth dropping when nothing matches', () => {
    // Nothing is both Dirt and level 8+, so this returns nothing.
    const dead = query({ filters: { surface: ['dirt'], level: { min: 8, max: null } } })
    expect(runAlbumQuery(rows, facets, dead).total).toBe(0)
    // Dropping Level returns two rows and dropping Surface only one, so Level is the suggestion.
    expect(emptyStateHint(rows, facets, dead)).toEqual({ facetKey: 'level', label: 'Level', count: 2 })

    // When every drop returns the same count, the stable tie-break keeps the hint deterministic.
    const tiedDead = query({ filters: { surface: ['dirt'], distance: ['mile'], owned: true } })
    expect(runAlbumQuery(rows, facets, tiedDead).total).toBe(0)
    expect(emptyStateHint(rows, facets, tiedDead)).toEqual({ facetKey: 'distance', label: 'Distance', count: 1 })

    expect(emptyStateHint(rows, facets, query())).toBeNull()
  })
})
