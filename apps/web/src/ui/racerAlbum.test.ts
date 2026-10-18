// @vitest-environment jsdom
// SB6 adapter boundaries: old device preferences remain byte-compatible, and displayed levels never become lifetime.
import { loadAlbumPrefs, markSeen, saveAlbumPrefs } from '@luismlorenzana/uma-kit/roster'
import { beforeEach, describe, expect, it } from 'vitest'
import { stubStorage } from '../__fixtures__/testing'
import { farmAccount } from '../places/farm/__fixtures__/farm'
import { buildStableAlbum, STABLE_DEFAULT_QUERY, STABLE_FACETS, STABLE_SORTS } from '../places/stable/model'
import { racerAlbumRows, racerLevelOrder } from './racerAlbum'

beforeEach(stubStorage)
const schema = { fallback: STABLE_DEFAULT_QUERY, facets: STABLE_FACETS, sorts: STABLE_SORTS }

describe('racer album compatibility', () => {
  it('reads old query, saved views and seen ids at the same key, and writes no new sibling key', () => {
    const query = { ...STABLE_DEFAULT_QUERY, search: 'invented', filters: { tier: ['2'] }, sort: 'farm', view: 'cards' }
    const legacy = { query, views: [{ name: 'My work', query }], seen: ['invented-a', 'invented-b'] }
    localStorage.setItem('uma-racer:g2:album:stable', JSON.stringify(legacy))
    const prefs = loadAlbumPrefs('stable', schema)
    expect(prefs).toEqual({ ...legacy, fresh: false })
    saveAlbumPrefs('stable', { ...prefs, seen: markSeen(prefs.seen, ['invented-c']) })
    expect(JSON.parse(localStorage.getItem('uma-racer:g2:album:stable')!)).toEqual({ ...legacy, seen: [...legacy.seen, 'invented-c'] })
    expect(localStorage.length).toBe(1)
  })

  it('keeps tier-local levels on the tile and lifetime order in every non-work picker', () => {
    const { state, env } = farmAccount(2)
    const ids = Object.keys(state.umas)
    const uma = state.umas[ids[0]!]!
    const changed = { ...state, umas: { ...state.umas, [uma.outfitId]: { ...uma, tier: 2 as const, racing: { ...uma.racing, level: 3 } } } }
    const rows = racerAlbumRows(buildStableAlbum(changed, env.content, ids)).filter((row) => row.entry.owned)
    expect(rows.sort(racerLevelOrder)[0]).toMatchObject({ id: uma.outfitId, level: 3, lifetime: 53, tier: 2 })
    expect(rows.find((row) => row.id === ids[1])?.level).toBe(1)
  })
})
