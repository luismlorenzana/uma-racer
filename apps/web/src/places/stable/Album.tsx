// The Stable's album (docs/game/11-hub-and-places.md §3.1; D386), `/town/stable?tab=owned|locked`: the Owned and Locked
// tabs with their counts, opening on Owned once she owns any Uma and on Locked before (a new account picks its first
// Umas there); uma-kit's album chrome (search, sort and filters, kept on this phone) over the face grid. An owned face
// opens her profile; a locked one opens the unlock sheet.
import { AlbumChrome, useAlbumPrefs } from '@luismlorenzana/uma-kit/album'
import { emptyStateHint, runAlbumQuery } from '@luismlorenzana/uma-kit/roster'
import { Button, Tabs } from '@luismlorenzana/uma-kit/ui'
import type { Place } from '@racer/domain/hub'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useGame } from '../../app/game'
import { profilePath, type OwnershipTab } from '../../hub/nav'
import { PlacePageHeader } from '../PlacePageHeader'
import { STABLE_FACETS, STABLE_SCHEMA, STABLE_SORTS, stableRows, stableTab, stableWords, type StableRow } from './model'
import { UmaGrid } from './UmaGrid'
import { UnlockSheet } from './UnlockSheet'

export function Album({ place }: { place: Place }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const state = useGame((snapshot) => snapshot.state)
  const umas = useGame((snapshot) => snapshot.env?.content.umas ?? null)
  const prefs = useAlbumPrefs('stable', STABLE_SCHEMA)
  const [unlocking, setUnlocking] = useState<string | null>(null)

  const rows = useMemo(() => (state === null || umas === null ? [] : stableRows(umas.values(), state)), [state, umas])
  const owned = rows.filter((row) => row.owned)
  const tab = stableTab(params.get('tab'), owned.length)
  const scoped = tab === 'owned' ? owned : rows.filter((row) => !row.owned)
  const result = runAlbumQuery(scoped, STABLE_FACETS, prefs.query)

  const setTab = (next: OwnershipTab) => {
    const search = new URLSearchParams(params)
    search.set('tab', next)
    setParams(search, { replace: true })
  }
  const open = (row: StableRow) => {
    if (row.owned) navigate(profilePath(row.id), { state: { back: true } })
    else setUnlocking(row.id)
  }

  return (
    <div data-place-page="stable" data-racer="stable" data-tab={tab}>
      <PlacePageHeader place={place} lines={[stableWords('about-tickets'), stableWords('about-profile')]} />
      <div className="space-y-3 px-4 py-3">
        <Tabs
          label={stableWords('tabs')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'owned', label: `${stableWords('owned')} · ${owned.length}` },
            { value: 'locked', label: `${stableWords('locked')} · ${rows.length - owned.length}` },
          ]}
        />
        {scoped.length === 0 ? (
          <div className="space-y-3 rounded-md border border-hairline bg-panel p-4 text-center" data-racer="stable-empty">
            <p className="text-[14px] text-ink-soft">{tab === 'owned' ? stableWords('no-owned') : stableWords('all-owned')}</p>
            {tab === 'owned' && <Button onClick={() => setTab('locked')}>{stableWords('see-locked')}</Button>}
          </div>
        ) : (
          <AlbumChrome
            compact
            title={place.name}
            facets={STABLE_FACETS}
            sorts={STABLE_SORTS}
            query={prefs.query}
            counts={result.counts}
            total={result.total}
            countFor={(draft) => runAlbumQuery(scoped, STABLE_FACETS, draft).total}
            emptyHint={emptyStateHint(scoped, STABLE_FACETS, prefs.query)}
            onQueryChange={prefs.setQuery}
          >
            <UmaGrid rows={result.rows as StableRow[]} onOpen={open} />
          </AlbumChrome>
        )}
      </div>
      <UnlockSheet umaId={unlocking} onClose={() => setUnlocking(null)} />
    </div>
  )
}
