// The Trophy Hall (T141; docs/design/badges.md; 11 §3.3): today's badge page and trainer profile, ported on the
// generation-2 catalogue. `/racing/trophy-hall` shows a scope (`?scope=uma|stable|trainer`, the featured Uma's by
// default), `/uma/:umaId` one Uma's badges, `/trainer` the trainer profile. Search, filters, sorts, showcases, titles,
// the G1 trophy wall, the timeline, records and Prestige read today's pure views. Opening it reconciles the flair once
// (the ever-bonded set among it) and marks this device's visit, which clears the counter.
import { Button } from '@luismlorenzana/uma-kit/ui'
import {
  FLAIR_CATEGORIES, awardRefsForState, replaceUmaPreferences, type BadgeSort, type BadgeFilter, type UmaBadgeStateV1,
} from '@racer/domain'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import {
  buildStableBadgeCollection, buildTimelineItems, buildTrophyWall, buildUmaBadgeCollection, filterBadgeItems, sortBadgeItems,
  type BadgeCollectionItem, type StableBadgeItem,
} from './badge-collection-view'
import { buildTrainerBadgeCollection, buildTrainerShowcase } from './trainer-view'
import { Meter } from '../../ui/Meter'
import { NO_RECORDS, useGame, useHub, useNow, useRuntime, type G2Records } from '../../app/game'
import { PlacePageHeader } from '../PlacePageHeader'
import { UmaFace } from '../../ui/UmaArt'
import type { PageProps } from '../registry'
import { useRaceContent } from './content'
import { deviceRows, reconcileFlair } from './flair'
import { readLogs, useRecords } from './records'
import { stripOrder } from './view'
import { badgeRow, eventList, raceRecords, recentFlair, savesOf, trainerBadge, umaBadge, writeSeen } from './trophy'
import { amount, racingWords } from './words'

const SORTS: readonly { value: BadgeSort; label: string }[] = [
  { value: 'recent', label: 'Most recent' }, { value: 'tier', label: 'Highest tier' }, { value: 'closest', label: 'Closest next tier' },
  { value: 'rarest', label: 'Rarest' }, { value: 'alphabetical', label: 'Alphabetical' }, { value: 'category', label: 'Category' },
]
const TIER_TONES: Record<string, string> = {
  bronze: 'border-tier-bronze bg-panel', silver: 'border-tier-silver bg-panel', gold: 'border-tier-gold bg-accent-wash',
  platinum: 'border-tier-platinum bg-panel', rainbow: 'border-accent bg-gradient-to-br from-accent-wash via-panel to-page',
  'one-off': 'border-accent bg-accent-wash', locked: 'border-hairline bg-sunken text-ink-faint',
}
const titleCase = (value: string) => value.split(/[-_:]/).filter(Boolean).map((part) => part[0]!.toLocaleUpperCase() + part.slice(1)).join(' ')
const dateLabel = (value: number) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(value)

type Scope = 'uma' | 'stable' | 'trainer'

function ScopeTabs({ scope, umaId }: { scope: Scope; umaId: string | null }) {
  const tab = (value: Scope, to: string, label: string) => (
    <Link
      key={value}
      to={to}
      replace
      aria-current={scope === value ? 'page' : undefined}
      className={`font-display flex min-h-11 flex-1 items-center justify-center rounded-sm text-sm font-semibold ${scope === value ? 'bg-accent text-accent-ink' : 'bg-panel text-ink'}`}
    >{label}</Link>
  )
  return (
    <nav aria-label={racingWords('scopes')} className="flex gap-1 rounded-md bg-sunken p-1">
      {tab('uma', umaId ? `/racing/trophy-hall/uma/${encodeURIComponent(umaId)}` : '/racing/trophy-hall?scope=uma', racingWords('scope-uma'))}
      {tab('stable', '/racing/trophy-hall?scope=stable', racingWords('scope-stable'))}
      {tab('trainer', '/racing/trophy-hall?scope=trainer', racingWords('scope-trainer'))}
    </nav>
  )
}

function Tile({ item, pinMode, pinnable, onPin }: { item: BadgeCollectionItem | StableBadgeItem; pinMode: boolean; pinnable: boolean; onPin: () => void }) {
  const locked = item.tier === null
  return (
    <article className={`[content-visibility:auto] [contain-intrinsic-size:150px] relative min-h-32 overflow-hidden rounded-md border-2 p-2.5 text-ink shadow-1 ${TIER_TONES[item.tier ?? 'locked']}`} data-award={item.awardKey}>
      <p className="text-[10px] font-semibold tracking-wide uppercase opacity-70">{titleCase(item.category)}</p>
      <p className={`leading-tight font-semibold ${locked ? 'text-ink-soft' : ''}`}>{item.label}</p>
      <p className="mt-1 text-[11px] text-ink-soft">{item.description}</p>
      <p className="mt-1 text-xs font-bold">{item.tier ? titleCase(item.tier) : racingWords('locked')} · {item.progressLabel}</p>
      {'holderCount' in item && <p className="text-[11px] font-bold opacity-75">{racingWords('holders', { n: item.holderCount, of: item.ownedUmaCount })}</p>}
      {item.progress !== null && item.nextThreshold !== null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
          <div className="h-full origin-left rounded-full bg-accent-strong" style={{ transform: `scaleX(${Math.max(0.03, item.progress)})` }} />
        </div>
      )}
      {pinMode && pinnable && (
        <button type="button" aria-pressed={item.pinned} onClick={onPin} className={`mt-2 min-h-11 w-full rounded-sm px-2 text-xs font-semibold ${item.pinned ? 'bg-accent text-accent-ink' : 'bg-panel/80'}`}>
          {racingWords(item.pinned ? 'pinned' : 'pin-this')}
        </button>
      )}
    </article>
  )
}

/** Search, the status and category filters, the sort, then the grid. */
function Collection<T extends BadgeCollectionItem | StableBadgeItem>({ items, pinMode = false, pinnable = () => false, onPin = () => {} }: {
  items: readonly T[]
  pinMode?: boolean
  pinnable?: (item: T) => boolean
  onPin?: (item: T) => void
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'earned' | 'locked'>('all')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<BadgeSort>('tier')
  const filters: BadgeFilter[] = [
    ...(status === 'all' ? [] : [{ kind: 'status' as const, value: status }]),
    ...(category === '' ? [] : [{ kind: 'category' as const, value: category }]),
  ]
  const shown = sortBadgeItems(filterBadgeItems(items, query, filters), sort)
  return (
    <section className="flex flex-col gap-2">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={racingWords('search')}
        aria-label={racingWords('search')}
        className="min-h-11 rounded-sm border border-hairline bg-panel px-3 text-[15px]"
      />
      <div className="grid grid-cols-3 gap-1.5">
        <select aria-label={racingWords('filter-all')} value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="min-h-11 rounded-sm border border-hairline bg-panel px-1 text-[13px]">
          <option value="all">{racingWords('filter-all')}</option>
          <option value="earned">{racingWords('filter-earned')}</option>
          <option value="locked">{racingWords('filter-locked')}</option>
        </select>
        <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-11 rounded-sm border border-hairline bg-panel px-1 text-[13px]">
          <option value="">{racingWords('filter-all')}</option>
          {FLAIR_CATEGORIES.map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}
        </select>
        <select aria-label={racingWords('sort')} value={sort} onChange={(event) => setSort(event.target.value as BadgeSort)} className="min-h-11 rounded-sm border border-hairline bg-panel px-1 text-[13px]">
          {SORTS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {shown.map((item) => <Tile key={item.awardKey} item={item} pinMode={pinMode} pinnable={pinnable(item)} onPin={() => onPin(item)} />)}
      </div>
    </section>
  )
}

function UmaScope({ umaId }: { umaId: string }) {
  const { game } = useRuntime()
  const state = useGame((snapshot) => snapshot.state)!
  const records = useContext(RecordsContext)
  const now = useNow()
  const content = useRaceContent()!
  const [pinMode, setPinMode] = useState(false)
  const badge = umaBadge(records, umaId)
  const strip = stripOrder(state, (id) => content.umas.byId.get(id)?.name ?? id, now)
    .sort((a, b) => b.lifetime - a.lifetime || a.name.localeCompare(b.name))
  const races = raceRecords(state, records)
  const events = eventList(records)
  const collection = badge ? buildUmaBadgeCollection(content, badge, events, races) : null
  const refs = new Set(badge ? awardRefsForState(badge) : [])
  const write = (next: UmaBadgeStateV1) => void game.writeDevice?.({ badges: badgeRow(next) })
  const togglePin = (item: BadgeCollectionItem) => {
    if (!badge) return
    const [first, ...others] = badge.preferences.showcaseGroups
    const inGroup = badge.preferences.showcaseGroups.some((group) => group.awardRefs.includes(item.awardKey))
    const groups = inGroup
      ? badge.preferences.showcaseGroups.map((group) => ({ ...group, awardRefs: group.awardRefs.filter((ref) => ref !== item.awardKey) }))
      : [{ ...first!, awardRefs: [...first!.awardRefs, item.awardKey] }, ...others]
    write(replaceUmaPreferences(badge, { ...badge.preferences, showcaseGroups: groups }))
  }
  const titles = badge?.awards.titles ?? []
  const labelOf = (key: string) => collection?.items.find((item) => item.awardKey === key)?.label ?? titleCase(key.replace(/^title:/, ''))
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={racingWords('choose-uma')} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {strip.map((tile) => (
          <Link
            key={tile.umaId}
            to={`/racing/trophy-hall/uma/${encodeURIComponent(tile.umaId)}`}
            replace
            role="radio"
            aria-checked={tile.umaId === umaId}
            aria-label={tile.name}
            className={`flex min-h-11 w-16 shrink-0 flex-col items-center rounded-md border p-1 ${tile.umaId === umaId ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}
          >
            <UmaFace outfitId={tile.umaId} size={36} />
            <span className="block w-full truncate text-center text-[10px] font-semibold">{tile.name}</span>
          </Link>
        ))}
      </div>
      {!badge || !collection ? <p className="py-6 text-center text-[13px] text-ink-soft">{racingWords('no-badge-state')}</p> : (
        <>
          <div className={`rounded-md border-2 p-3 ${collection.frame.borderClass} ${collection.frame.backgroundClass}`} data-g2="uma-summary">
            <p className="font-display text-lg font-semibold">{content.umas.byId.get(umaId)?.name ?? umaId}</p>
            <p className="text-[13px] font-semibold">{racingWords('prestige', { n: amount(collection.prestige) })} · {collection.frame.label}</p>
            <p className="text-[13px] text-ink-soft">{racingWords('earned-count', { earned: collection.earnedCount, total: collection.visibleCount })}</p>
            {collection.activeTitle && <p className="mt-1 text-[13px]"><span className="font-semibold">{racingWords('active-title')}:</span> {labelOf(collection.activeTitle)}</p>}
          </div>
          <section aria-label={racingWords('showcase')} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[15px] font-semibold">{racingWords('showcase')}</h2>
              <Button variant="secondary" size="sm" onClick={() => setPinMode((on) => !on)}>{racingWords(pinMode ? 'done-pinning' : 'pin-badges')}</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {collection.pinnedRefs.map((ref) => <span key={ref} className="rounded-full bg-accent-wash px-2 py-1 text-[12px] font-semibold">{labelOf(ref)}</span>)}
            </div>
          </section>
          {titles.length > 0 && (
            <section aria-label={racingWords('titles')} className="flex flex-col gap-1.5">
              <h2 className="font-display text-[15px] font-semibold">{racingWords('titles')}</h2>
              {titles.map((title) => (
                <div key={title.awardKey} className="flex min-h-11 items-center gap-2 rounded-sm bg-sunken px-3">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{labelOf(title.awardKey)}</span>
                  {badge.preferences.activeTitleId === title.awardKey
                    ? <span className="text-[12px] text-accent-strong">{racingWords('active-title')}</span>
                    : <Button variant="secondary" size="sm" onClick={() => write(replaceUmaPreferences(badge, { ...badge.preferences, activeTitleId: title.awardKey }))}>{racingWords('set-title')}</Button>}
                </div>
              ))}
            </section>
          )}
          <Collection items={collection.items} pinMode={pinMode} pinnable={(item) => refs.has(item.awardKey)} onPin={togglePin} />
          <TrophyWall badge={badge} />
          <Timeline badge={badge} />
        </>
      )}
    </div>
  )
}

function TrophyWall({ badge }: { badge: UmaBadgeStateV1 }) {
  const state = useGame((snapshot) => snapshot.state)!
  const records = useContext(RecordsContext)
  const content = useRaceContent()!
  const wall = buildTrophyWall(content, badge, raceRecords(state, records))
  if (wall.length === 0) return null
  return (
    <section aria-label={racingWords('trophy-wall')} className="flex flex-col gap-1.5">
      <h2 className="font-display text-[15px] font-semibold">{racingWords('trophy-wall')}</h2>
      <div className="grid grid-cols-2 gap-2">
        {wall.map((trophy) => (
          <div key={trophy.awardKey} className="rounded-md border-2 border-tier-gold bg-accent-wash p-2">
            <p className="truncate text-[13px] font-semibold">{trophy.label}</p>
            <p className="text-[11px] text-ink-soft">{racingWords('trophy-count', { n: trophy.count })} · {dateLabel(trophy.lastEarnedAt)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Timeline({ badge }: { badge: UmaBadgeStateV1 }) {
  const state = useGame((snapshot) => snapshot.state)!
  const records = useContext(RecordsContext)
  const content = useRaceContent()!
  const items = buildTimelineItems(content, badge, eventList(records), raceRecords(state, records)).slice(0, 20)
  if (items.length === 0) return null
  return (
    <section aria-label={racingWords('timeline')} className="flex flex-col gap-1">
      <h2 className="font-display text-[15px] font-semibold">{racingWords('timeline')}</h2>
      <ol className="grid gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex min-h-11 items-center gap-2 rounded-sm bg-sunken px-3 text-[13px]">
            <span className="min-w-0 flex-1 truncate font-semibold">{item.label}</span>
            <span className="shrink-0 text-[11px] text-ink-soft">{item.kindLabel} · {dateLabel(item.earnedAt)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function StableScope() {
  const state = useGame((snapshot) => snapshot.state)!
  const records = useContext(RecordsContext)
  const content = useRaceContent()!
  const saves = savesOf(state)
  const owned = Object.values(saves).map((save) => ({ save, state: umaBadge(records, save.templateId) }))
  const collection = buildStableBadgeCollection(content, owned, eventList(records), raceRecords(state, records))
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] font-semibold text-ink-soft">{racingWords('earned-count', { earned: collection.earnedCount, total: collection.visibleCount })}</p>
      <Collection items={collection.items} />
    </div>
  )
}

function TrainerScope({ profile }: { profile: boolean }) {
  const state = useGame((snapshot) => snapshot.state)!
  const records = useContext(RecordsContext)
  const content = useRaceContent()!
  const trainer = trainerBadge(records)
  if (!trainer) return <p className="py-6 text-center text-[13px] text-ink-soft">{racingWords('no-flair')}</p>
  const saves = savesOf(state)
  const races = raceRecords(state, records)
  const collection = buildTrainerBadgeCollection(content, trainer, saves, races)
  const meters = [
    { label: racingWords('cards-bonded', { n: collection.counts.bondedCards, of: collection.counts.catalogCards }), value: collection.counts.bondedCards / Math.max(1, collection.counts.catalogCards) },
    { label: racingWords('umas-owned', { n: collection.counts.ownedUmas, of: collection.counts.catalogUmas }), value: collection.counts.ownedUmas / Math.max(1, collection.counts.catalogUmas) },
  ]
  const showcase = buildTrainerShowcase(content, trainer, records.badges, saves, eventList(records), races)
  const recent = recentFlair(content, records)
  return (
    <div className="flex flex-col gap-3" data-g2={profile ? 'trainer-profile' : 'trainer-scope'}>
      <div className="rounded-md border border-hairline bg-panel p-3">
        <p className="font-display text-lg font-semibold">{collection.displayName}</p>
        <p className="text-[13px] text-ink-soft">{racingWords('badge-stages', { n: collection.counts.badgeStages })} · {racingWords('earned-count', { earned: collection.earnedCount, total: collection.visibleCount })}</p>
        <div className="mt-2 grid gap-2">
          {meters.map((meter) => (
            <div key={meter.label}>
              <p className="text-[12px] font-semibold">{meter.label}</p>
              <Meter value={meter.value} color="linear-gradient(90deg,#2fa8f5,#8e6cef)" height={8} />
            </div>
          ))}
        </div>
      </div>
      {collection.records.length > 0 && (
        <section aria-label={racingWords('records')} className="flex flex-col gap-1">
          <h2 className="font-display text-[15px] font-semibold">{racingWords('records')}</h2>
          {collection.records.map((record) => (
            <div key={record.kind} className="flex min-h-11 items-center gap-2 rounded-sm bg-sunken px-3 text-[13px]">
              <span className="min-w-0 flex-1 truncate">{record.label}</span>
              <span className="shrink-0 font-semibold">{record.valueLabel} · {record.umaName}</span>
            </div>
          ))}
        </section>
      )}
      {profile && showcase.length > 0 && (
        <section aria-label={racingWords('showcase')} className="flex flex-wrap gap-1.5">
          {showcase.map((entry) => <span key={entry.ref} className="rounded-full bg-accent-wash px-2 py-1 text-[12px] font-semibold">{entry.label} · {entry.ownerLabel}</span>)}
        </section>
      )}
      {profile && recent.length > 0 && (
        <section aria-label={racingWords('recent-flair')} className="flex flex-col gap-1">
          <h2 className="font-display text-[15px] font-semibold">{racingWords('recent-flair')}</h2>
          {recent.map((entry) => (
            <p key={entry.id} className="flex min-h-9 items-center gap-2 rounded-sm bg-sunken px-3 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-semibold">{entry.label}</span>
              <span className="shrink-0 text-[11px] text-ink-soft">{entry.owner}</span>
            </p>
          ))}
        </section>
      )}
      <h2 className="font-display text-[15px] font-semibold">{racingWords('achievements')}</h2>
      <Collection items={collection.items} />
    </div>
  )
}

/** The page's records, read once per publish at the top and shared by every section. */
const RecordsContext = createContext<G2Records>(NO_RECORDS)

/** Once per visit: the flair reconciled on the account as it stands, and this device's visit remembered. */
function useVisit() {
  const { game } = useRuntime()
  const ready = useGame((snapshot) => snapshot.status === 'ready' && snapshot.state !== null)
  const content = useRaceContent()
  const done = useRef(false)
  useEffect(() => {
    if (!ready || content === null || done.current) return
    done.current = true
    const now = game.now()
    writeSeen(now)
    void readLogs(game).then((logs) => {
      const { state, env, badges } = game.getSnapshot()
      const change = reconcileFlair({ state: state!, records: { ...logs, badges: badges ?? {} }, content, env: env!, now })
      if (Object.keys(change.badges).length > 0 || change.events.length > 0) return game.writeDevice?.(deviceRows(change))
    }).catch(() => {
      // A reconcile that fails leaves the stored flair as it is; the next commit or visit tries again.
    })
  }, [ready, content, game])
}

export default function TrophyHall({ place, rest }: PageProps) {
  const [params] = useSearchParams()
  const hub = useHub()
  const state = useGame((snapshot) => snapshot.state)
  const content = useRaceContent()
  const records = useRecords()
  useVisit()
  const parts = rest.split('/').filter(Boolean)
  const fallbackUma = hub?.featured ?? Object.keys(state?.umas ?? {})[0] ?? null
  const scope: Scope = parts[0] === 'trainer' ? 'trainer' : parts[0] === 'uma' ? 'uma' : (params.get('scope') as Scope | null) ?? 'uma'
  const umaId = parts[0] === 'uma' ? parts[1] ?? null : fallbackUma
  const title = parts[0] === 'trainer' ? racingWords('trainer-profile') : undefined
  const body = (() => {
    if (!state || !content || !records) return null
    if (parts[0] === 'uma' && (umaId === null || !state.umas[umaId])) return <Navigate to="/racing/trophy-hall" replace />
    if (parts.length > 0 && parts[0] !== 'uma' && parts[0] !== 'trainer') return <Navigate to="/racing/trophy-hall" replace />
    if (scope === 'trainer') return <TrainerScope profile={parts[0] === 'trainer'} />
    if (scope === 'stable') return <StableScope />
    return umaId ? <UmaScope umaId={umaId} /> : <p className="py-6 text-center text-[13px] text-ink-soft">{racingWords('no-flair')}</p>
  })()
  return (
    <div data-place-page="trophy-hall" className="pb-6">
      <PlacePageHeader place={place} rest={rest} title={title} />
      <div className="flex flex-col gap-3 p-3">
        <ScopeTabs scope={scope} umaId={umaId} />
        {scope !== 'trainer' || parts[0] === 'trainer' ? null : (
          <Link to="/racing/trophy-hall/trainer" state={{ back: true }} className="font-display flex min-h-11 items-center justify-center rounded-sm border border-hairline bg-panel text-sm font-semibold">{racingWords('trainer-profile')}</Link>
        )}
        <RecordsContext.Provider value={records ?? NO_RECORDS}>{body}</RecordsContext.Provider>
      </div>
    </div>
  )
}

