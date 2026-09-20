import { describe, expect, it } from 'vitest'
import {
  MAX_SAVED_VIEWS,
  MAX_SEEN_IDS,
  addSavedView,
  markSeen,
  parseViews,
  removeSavedView,
  sanitizeQuery,
  type SavedView,
} from './prefs'
import type { AlbumQuery, FacetDef, SortDef } from './query'

const facets: FacetDef[] = [
  { key: 'surface', label: 'Surface', kind: 'enum', group: 'Aptitude', options: [{ value: 'turf', label: 'Turf' }] },
  { key: 'level', label: 'Level', kind: 'range', group: 'Progress' },
  { key: 'starter', label: 'Starter', kind: 'boolean', group: 'Identity' },
]
const sorts: SortDef[] = [
  { key: 'release', label: 'Release', defaultDirection: 'desc' },
  { key: 'name', label: 'Name', defaultDirection: 'asc' },
]
const fallback: AlbumQuery = {
  search: '', filters: { surface: ['turf'] }, sort: 'release', direction: 'desc',
  group: null, view: 'icons', mode: 'outfit',
}

describe('album preferences', () => {
  it('keeps a valid stored query', () => {
    const stored = { search: 'gold', filters: { level: { min: 5, max: 20 }, starter: true }, sort: 'name', direction: 'asc', group: 'surface', view: 'list', mode: 'character' }
    expect(sanitizeQuery(stored, fallback, facets, sorts, ['outfit', 'character'])).toEqual({
      search: 'gold',
      filters: { level: { min: 5, max: 20 }, starter: true },
      sort: 'name',
      direction: 'asc',
      group: 'surface',
      view: 'list',
      mode: 'character',
    })
  })

  it('falls back instead of throwing on corrupt or unknown values', () => {
    expect(sanitizeQuery(null, fallback, facets, sorts)).toBe(fallback)
    expect(sanitizeQuery('nonsense', fallback, facets, sorts)).toBe(fallback)
    const weird = sanitizeQuery(
      { search: 42, filters: { ghost: ['x'], surface: ['dirt'], level: 'wide' }, sort: 'ghost', direction: 'sideways', group: 'ghost', view: 'huge', mode: 'ghost' },
      fallback, facets, sorts, ['outfit'],
    )
    // Unknown facets, options, sorts, groups, densities and modes are dropped, not kept.
    expect(weird).toEqual({ search: '', filters: {}, sort: 'release', direction: 'desc', group: null, view: 'icons', mode: 'outfit' })
  })

  it('drops selections that cannot narrow anything', () => {
    const query = sanitizeQuery({ filters: { surface: [], starter: false, level: { min: null, max: null } } }, fallback, facets, sorts)
    expect(query.filters).toEqual({})
  })

  it('parses saved views, dropping duplicates and enforcing the cap', () => {
    const raw = [
      { name: 'Sprinters', query: { sort: 'name' } },
      { name: 'Sprinters', query: {} },
      { name: '   ', query: {} },
      { name: 'x'.repeat(41), query: {} },
      ...Array.from({ length: 25 }, (_, index) => ({ name: `view ${index}`, query: {} })),
    ]
    const views = parseViews(raw, facets, sorts, fallback, ['outfit'])
    expect(views).toHaveLength(MAX_SAVED_VIEWS)
    expect(views[0]).toEqual({ name: 'Sprinters', query: { ...fallback, filters: {}, sort: 'name', direction: 'asc' } })
  })

  it('replaces a view of the same name and rejects invalid names or overflow', () => {
    const views: SavedView[] = [{ name: 'A', query: fallback }]
    expect(addSavedView(views, ' A ', { ...fallback, search: 'x' })).toHaveLength(1)
    expect(() => addSavedView(views, '', fallback)).toThrow()
    expect(() => addSavedView(views, 'x'.repeat(41), fallback)).toThrow()
    const full = Array.from({ length: MAX_SAVED_VIEWS }, (_, index) => ({ name: `v${index}`, query: fallback }))
    expect(() => addSavedView(full, 'one more', fallback)).toThrow()
    expect(removeSavedView(views, 'A')).toEqual([])
  })

  it('keeps the newest ids when the seen set is trimmed', () => {
    expect(markSeen(['a'], ['b', 'a'])).toEqual(['a', 'b'])
    const overflowing = markSeen(Array.from({ length: MAX_SEEN_IDS }, (_, index) => `old-${index}`), ['fresh'])
    expect(overflowing).toHaveLength(MAX_SEEN_IDS)
    expect(overflowing.at(-1)).toBe('fresh')
    expect(overflowing).not.toContain('old-0')
  })
})
