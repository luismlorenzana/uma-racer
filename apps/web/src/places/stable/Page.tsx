// The Stable (docs/game/11-hub-and-places.md §3.1; docs/game/04-tiers-and-promotion.md §6; ux "Albums",
// D176, D181): the roster in the shared album chrome, Owned and Locked tabs with counts, the ticket note with the Shard
// exchange, Unlock in a sheet, and the Locked tab's multi-select that unlocks up to the tickets in hand, then reveals
// them in turn. Each profile (`outfit/:umaId`, `/skills`, `/needs`) is its own chunk.
import { Button, Tabs, UiMark } from '@luismlorenzana/uma-kit/ui'
import { UnlockConfirm } from '@luismlorenzana/uma-kit/places'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AlbumChrome, AlbumGrid, useAlbumPrefs } from '@luismlorenzana/uma-kit/album'
import { runAlbumQuery } from '@luismlorenzana/uma-kit/roster'
import { useGame } from '../../app/game'
import { racerAlbumRows, racerBadges } from '../../ui/racerAlbum'
import { PlacePageHeader } from '../PlacePageHeader'
import { doneOrThrow, TapNoteLine, useTap, useWordsContext } from '../../ui/work'
import type { PageProps } from '../registry'
import {
  buildStableAlbum, openingTab, queryStable, STABLE_ALBUM, STABLE_DEFAULT_QUERY, STABLE_FACETS, STABLE_SORTS, ticketNote, unlockBlocked,
  profilePath, type StableEntry, type StableTab,
} from './model'
import { revealPath } from '../reveal/path'

const Profile = lazy(() => import('./Profile'))

const PROFILE = /^outfit\/([^/]+)(?:\/(skills|needs))?\/?$/

export default function StablePage({ place, rest }: PageProps) {
  const profile = PROFILE.exec(rest)
  if (profile !== null) {
    return (
      <Suspense fallback={null}>
        <Profile place={place} rest={rest} umaId={decodeURIComponent(profile[1]!)} tab={(profile[2] as 'skills' | 'needs' | undefined) ?? null} />
      </Suspense>
    )
  }
  return <Roster place={place} rest={rest} />
}

const SCHEMA = { fallback: STABLE_DEFAULT_QUERY, facets: STABLE_FACETS, sorts: STABLE_SORTS }

const PRESETS = [
  ...[1, 2, 3].map((tier) => ({ key: `tier-${tier}`, label: `Tier ${tier}`, apply: (query: typeof STABLE_DEFAULT_QUERY) => ({ ...query, filters: { tier: [String(tier)] } }) })),
  { key: 'ready', label: 'Ready to advance or promote', apply: (query: typeof STABLE_DEFAULT_QUERY) => ({ ...query, filters: { ready: true } }) },
  { key: 'targets', label: 'Planner targets', apply: (query: typeof STABLE_DEFAULT_QUERY) => ({ ...query, filters: { target: true } }) },
]

/** SD4's shared UnlockConfirm, with racer-owned refusal and operation. */
function UnlockSheet({ entry, onClose, onUnlocked }: { entry: StableEntry | null; onClose: () => void; onUnlocked: (id: string) => void }) {
  const profile = useGame((snapshot) => snapshot.state?.profile ?? null)
  const tap = useTap()
  const context = useWordsContext()
  const blocked = entry === null || profile === null ? null : unlockBlocked(profile, entry.name)
  return (
    <UnlockConfirm
      open={entry !== null && profile !== null}
      onClose={onClose}
      name={entry?.name ?? ''}
      tickets={profile?.umaTickets ?? 0}
      ticketMark={<UiMark mark="currency/uma-ticket" />}
      onConfirm={async () => {
        if (entry === null) return
        doneOrThrow(await tap.run('unlock-uma', { outfitId: entry.id }, `unlock:${entry.id}`), context)
        onUnlocked(entry.id)
      }}
      words={{ final: blocked === null ? 'Unlocking is final. She joins at tier 1, scenario 1, Racing Lv 1 and Farm Lv 1.' : `${blocked.reason} ${blocked.shards}.` }}
    />
  )
}

function Roster({ place, rest }: PageProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const state = useGame((snapshot) => snapshot.state)
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const prefs = useAlbumPrefs(STABLE_ALBUM, SCHEMA)
  const tap = useTap()
  const [batch, setBatch] = useState(false)
  const [unlocking, setUnlocking] = useState<StableEntry | null>(null)
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<readonly string[]>([])
  const [parameter, setParameter] = useState<string | null>(null)

  const album = useMemo(() => (state === null || content === null ? null : buildStableAlbum(state, content, prefs.seen)), [state, content, prefs.seen])
  const owned = album?.owned ?? 0
  const tab: StableTab = openingTab(params.get('tab'), owned)
  // A device with no stored album has seen everything it already owns: only new arrivals read NEW.
  useEffect(() => {
    if (prefs.fresh && state !== null) prefs.see(Object.keys(state.umas))
    // Once, when the album first reads this device's preferences.
  }, [prefs.fresh, state === null])
  useEffect(() => {
    if (tab !== 'locked') { setPicking(false); setPicked([]) }
  }, [tab])

  if (state === null || album === null) return <PlacePageHeader place={place} rest={rest} />
  const note = ticketNote(state.profile)
  const { result, entries, emptyHint } = queryStable(album, tab, prefs.query)
  const byId = new Map(racerAlbumRows(album).map((row) => [row.id, row]))
  const tabRowsOf = album.rows.filter((row) => (row.facets['ownership'] as string[])[0] === tab)
  const full = picked.length >= note.tickets
  const setTab = (next: StableTab) => setParams((current) => {
    const search = new URLSearchParams(current)
    search.set('tab', next)
    return search
  }, { replace: true })

  const unlockPicked = async () => {
    setBatch(true)
    const done: string[] = []
    for (const outfitId of picked) {
      const answer = await tap.run('unlock-uma', { outfitId }, `unlock:${outfitId}`)
      if (answer?.kind !== 'done') break
      done.push(outfitId)
      // One tap at a time, each with its own operation id: let the screen settle between them, so twenty in a row
      // never pile up as one long chain of updates.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    setBatch(false)
    if (done.length > 0) {
      setPicked([])
      setPicking(false)
      navigate(revealPath(done), { state: { back: true } })
    }
  }

  return (
    <div data-place-page="stable">
      <PlacePageHeader place={place} rest={rest} lines={['A ticket unlocks any Uma into tier 1. Five Uma Shards make a ticket: every scenario gate an Uma reaches pays one.']} />
      <div className={`px-4 pt-2 ${picking ? 'pb-4' : 'pb-24'}`}>
        <AlbumChrome
          title="Roster"
          completion={<>{album.owned} owned · {album.locked} locked</>}
          titleAccessory={
            <span className="inline-flex items-center gap-1.5" data-g2="ticket-note">
              <span aria-label={`Uma Tickets ${note.tickets}, Uma Shards ${Math.min(note.shards, 5)} of 5`}>Uma Tickets {note.text}</span>
              {note.canExchange && (
                <button type="button" disabled={tap.pending !== null} onClick={() => void tap.run('exchange-shards', {}, 'exchange-shards')}
                  className="font-display min-h-11 rounded-sm bg-accent px-3 text-[13px] font-semibold text-accent-ink shadow-1 disabled:opacity-45">
                  Exchange
                </button>
              )}
            </span>
          }
          facets={STABLE_FACETS}
          sorts={STABLE_SORTS}
          presets={PRESETS}
          query={prefs.query}
          counts={result.counts}
          total={result.total}
          parameter={parameter}
          views={prefs.views}
          emptyHint={emptyHint}
          countFor={(draft) => runAlbumQuery(tabRowsOf, STABLE_FACETS, draft).total}
          onQueryChange={prefs.setQuery}
          onParameterChange={setParameter}
          onSaveView={prefs.saveView}
          onDeleteView={prefs.deleteView}
        >
            <div className="flex items-center gap-2">
              <Tabs
                className="flex-1"
                label="Stable tabs"
                value={tab}
                onChange={setTab}
                options={[{ value: 'owned', label: `Owned · ${album.owned}` }, { value: 'locked', label: `Locked · ${album.locked}` }]}
              />
              {tab === 'locked' && (
                <button type="button" aria-pressed={picking} onClick={() => { setPicking((on) => !on); setPicked([]) }}
                  className={`min-h-11 shrink-0 rounded-sm px-3 text-[13px] font-semibold ${picking ? 'bg-accent-wash text-accent-strong' : 'text-ink-soft'}`}>
                  {picking ? 'Cancel' : 'Select'}
                </button>
              )}
            </div>
          <TapNoteLine tap={tap} />
          <AlbumGrid
            rows={entries.map((entry) => byId.get(entry.id)!)} view={prefs.query.view} columns={5}
            selected={(row) => picked.includes(row.id)} renderBadges={racerBadges}
            renderChips={(row) => <span className="text-[11px] text-ink-soft">
              {picking ? picked.includes(row.id) ? 'Picked' : full ? 'No ticket left' : 'Pick to unlock' : row.entry.scenario ?? 'Locked'}
              {row.entry.hallOfFame && <span className="sr-only"> · Hall of Fame</span>}
            </span>}
            onOpen={(row) => {
              if (picking) setPicked((ids) => ids.includes(row.id) ? ids.filter((id) => id !== row.id) : full ? ids : [...ids, row.id])
              else if (row.entry.owned) navigate(profilePath(row.id), { state: { back: true } })
              else setUnlocking(row.entry)
            }}
          />
        </AlbumChrome>
      </div>
      {picking && (
        <div className="sticky bottom-0 z-20 border-t border-hairline bg-panel/95 px-4 py-2 backdrop-blur" data-g2="unlock-bar">
          <Button className="w-full" disabled={picked.length === 0 || batch} onClick={() => void unlockPicked()}>
            {picked.length === 0 ? 'Pick Umas to unlock' : `Unlock ${picked.length} · ${picked.length} Uma Ticket${picked.length === 1 ? '' : 's'}`}
          </Button>
          <p className="mt-1 text-center text-[12px] text-ink-soft">
            {note.tickets === 0 ? 'No Uma Tickets in hand.' : full ? `That uses every Uma Ticket in hand (${note.tickets}).` : `Up to ${note.tickets} with the Uma Tickets in hand.`}
          </p>
        </div>
      )}
      <UnlockSheet
        entry={unlocking}
        onClose={() => setUnlocking(null)}
        onUnlocked={(id) => {
          setUnlocking(null)
          navigate(revealPath([id]), { state: { back: true } })
        }}
      />
    </div>
  )
}
