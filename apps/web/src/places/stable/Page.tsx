// The Stable (docs/game/11-hub-and-places.md §3.1; docs/game/04-tiers-and-promotion.md §6; Collection "Uma album",
// D176, D181): the roster in the shared album chrome, Owned and Locked tabs with counts, the ticket note with the Shard
// exchange, Unlock in a sheet, and the Locked tab's multi-select that unlocks up to the tickets in hand, then reveals
// them in turn. Each profile (`outfit/:umaId`, `/skills`, `/needs`) is its own chunk.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { VirtualGrid } from '../../ui/album/VirtualGrid'
import { AlbumChrome } from '../../ui/album/AlbumChrome'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Crest } from '../../ui/Crest'
import { CheckIcon, LockedIcon } from '../../ui/icons'
import { runAlbumQuery } from '../../ui/album/query'
import { useGame } from '../../app/game'
import { useAlbumPrefs } from '../../ui/albumPrefs'
import { UmaSquare } from '../../ui/ArtSquare'
import { TargetIcon } from '../../ui/icons'
import { PlaceHeader } from '../../ui/PlaceHeader'
import { Tabs } from '../../ui/Tabs'
import { TapNoteLine, useTap } from '../../ui/work'
import type { PageProps } from '../registry'
import {
  buildStableAlbum, openingTab, queryStable, STABLE_ALBUM, STABLE_DEFAULT_QUERY, STABLE_FACETS, STABLE_SORTS, ticketNote, unlockBlocked,
  type StableEntry, type StableTab,
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

/** The tile's words for VoiceOver: her name, tier and level, and its state (11 §12). */
function tileLabel(entry: StableEntry): string {
  if (!entry.owned) return `${entry.name}, locked`
  const parts = [entry.name, entry.level!]
  if (entry.ready === 'advance') parts.push('ready to advance')
  if (entry.ready === 'promote') parts.push('ready to promote')
  if (entry.target) parts.push('planner target')
  if (entry.hallOfFame) parts.push('Hall of Fame')
  if (entry.isNew) parts.push('new')
  return parts.join(', ')
}

function Tile({ entry, list, picking, picked, full, onOpen }: {
  entry: StableEntry
  list: boolean
  picking: boolean
  picked: boolean
  /** No ticket left for another pick. */
  full: boolean
  onOpen: () => void
}) {
  const marks = (
    <span className="flex items-center gap-1">
      {entry.ready !== null && <span aria-hidden data-ready-dot className="size-2.5 rounded-full bg-success shadow-1" />}
      {entry.target && <span aria-hidden className="rounded-full bg-panel/90 text-accent-strong shadow-1"><TargetIcon size={16} /></span>}
    </span>
  )
  const art = (
    <UmaSquare
      outfitId={entry.id}
      name={entry.name}
      dimmed={!entry.owned}
      tight={list}
      className={`${entry.hallOfFame ? 'border-2 border-tier-gold' : ''} ${picked ? 'outline outline-2 outline-offset-1 outline-accent' : ''}`}
      overlay={list ? undefined : entry.owned
        ? <><Crest>T{entry.uma!.tier}</Crest>{entry.isNew && <Crest tone="accent">NEW</Crest>}</>
        : <Crest><LockedIcon size={16} title="Locked" /></Crest>}
      corner={list ? undefined : picking ? <Crest tone={picked ? 'accent' : 'neutral'}>{picked ? <CheckIcon size={16} title="Picked" /> : <span className="size-4" />}</Crest> : marks}
    />
  )
  const label = tileLabel(entry)
  const body = list ? (
    <span className="flex min-h-14 w-full items-center gap-3 rounded-sm border border-hairline bg-panel p-2 text-left">
      <span className="w-12 shrink-0">{art}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold">{entry.name}</span>
          {entry.isNew && <Crest tone="accent">NEW</Crest>}
        </span>
        <span className="block truncate text-[12px] text-ink-soft">{entry.owned ? entry.scenario : 'Locked'}</span>
      </span>
      <span className="shrink-0 text-right text-[12px] font-semibold">{entry.level ?? ''}</span>
      {!picking && marks}
    </span>
  ) : (
    <span className="block w-full min-w-0 text-left">
      {art}
      <span className="font-display block truncate px-0.5 pt-1 text-[12px] font-semibold">{entry.name}</span>
      <span className="block truncate px-0.5 text-[11px] text-ink-soft">{entry.level ?? 'Locked'}</span>
    </span>
  )
  if (entry.owned && !picking) {
    return (
      <Link to={`/town/stable/outfit/${encodeURIComponent(entry.id)}`} state={{ back: true }} aria-label={label} className="block" data-uma={entry.id}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" aria-label={label} aria-pressed={picking ? picked : undefined} disabled={picking && !picked && full} onClick={onOpen}
      className="block w-full disabled:opacity-60" data-uma={entry.id}>
      {body}
    </button>
  )
}

/** Unlock · 1 Uma Ticket, or why not (04 §6). */
function UnlockSheet({ entry, onClose, onUnlocked }: { entry: StableEntry | null; onClose: () => void; onUnlocked: (id: string) => void }) {
  const profile = useGame((snapshot) => snapshot.state?.profile ?? null)
  const tap = useTap()
  if (entry === null || profile === null) return <BottomSheet open={false} onClose={onClose}>{null}</BottomSheet>
  const blocked = unlockBlocked(profile, entry.name)
  const key = `unlock:${entry.id}`
  const unlock = async () => {
    const answer = await tap.run('unlock-uma', { outfitId: entry.id }, key)
    if (answer?.kind === 'done') onUnlocked(entry.id)
  }
  return (
    <BottomSheet open onClose={onClose} label={entry.name}>
      <div className="flex items-center gap-3 pb-3">
        <span className="w-24 shrink-0"><UmaSquare outfitId={entry.id} name={entry.name} dimmed /></span>
        <div className="min-w-0">
          <h2 data-sheet-heading tabIndex={-1} className="font-display text-xl font-bold outline-none">{entry.name}</h2>
          {entry.outfit && <p className="text-[13px] text-ink-soft">{entry.outfit}</p>}
          <p className="mt-1 text-[13px] text-ink-soft">Joins at tier 1, scenario 1, Racing Lv 1 and Farm Lv 1.</p>
        </div>
      </div>
      <Button className="w-full" size="lg" disabled={blocked !== null || tap.pending === key} onClick={() => void unlock()}>
        Unlock · 1 Uma Ticket
      </Button>
      {blocked !== null && (
        <p className="mt-2 text-[13px] text-ink-soft" data-reason>{blocked.reason} {blocked.shards}.</p>
      )}
      <TapNoteLine tap={tap} className="mt-2" />
    </BottomSheet>
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

  if (state === null || album === null) return <PlaceHeader place={place} rest={rest} />
  const note = ticketNote(state.profile)
  const { result, entries, emptyHint } = queryStable(album, tab, prefs.query)
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
      <PlaceHeader place={place} rest={rest} lines={['A ticket unlocks any Uma into tier 1. Five Uma Shards make a ticket: every scenario gate an Uma reaches pays one.']} />
      <div className={`px-4 pt-2 ${picking ? 'pb-4' : 'pb-24'}`}>
        <AlbumChrome
          title="Roster"
          completion={<>{album.owned} owned · {album.locked} locked</>}
          titleAccessory={
            <span className="inline-flex items-center gap-1.5" data-g2="ticket-note">
              <span aria-label={`Uma Tickets ${note.tickets}, Uma Shards ${Math.min(note.shards, 5)} of 5`}>Uma Tickets {note.text}</span>
              {note.canExchange && (
                <button type="button" disabled={tap.pending !== null} onClick={() => void tap.run('exchange-shards', {}, 'exchange-shards')}
                  className="font-display min-h-11 rounded-sm bg-accent px-3 text-[13px] font-semibold text-ink shadow-1 disabled:opacity-45">
                  Exchange
                </button>
              )}
            </span>
          }
          segment={
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
          <TapNoteLine tap={tap} />
          <VirtualGrid
            items={entries}
            columns={prefs.query.view === 'list' ? 1 : prefs.query.view === 'icons' ? 3 : 2}
            rowHeight={prefs.query.view === 'list' ? 68 : prefs.query.view === 'icons' ? 160 : 220}
            keyOf={(entry) => entry.id}
            renderItem={(entry) => (
              <Tile
                entry={entry}
                list={prefs.query.view === 'list'}
                picking={picking}
                picked={picked.includes(entry.id)}
                full={full}
                onOpen={() => {
                  if (!picking) setUnlocking(entry)
                  else setPicked((ids) => (ids.includes(entry.id) ? ids.filter((id) => id !== entry.id) : full ? ids : [...ids, entry.id]))
                }}
              />
            )}
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
