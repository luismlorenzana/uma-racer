import {
  BADGE_TIERS,
  DISTANCE_CATEGORIES,
  FLAIR_CATEGORIES,
  RACE_GRADES,
  SCENARIOS,
  STRATEGIES,
  SURFACES,
  TRAINER_SAVED_VIEW_ID_PREFIX,
  badgeStateId,
  decodeBadgeFilters,
  encodeBadgeFilters,
  flairContentCoverage,
  isTrainerSavedBadgeView,
  moveItem,
  moveShowcaseRefs,
  removeShowcaseGroup,
  type BadgeFilterKind,
  type BadgePreferences,
  type BadgeSort,
  type FlairEventKind,
  type UmaBadgeStateV1,
  type RaceResultRecord,
} from '@racer/domain'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { listFlairTimeline, listRaceHistory, saveBadgePreferences } from '../game/actions'
import {
  buildStableBadgeCollection,
  buildTimelineItems,
  buildTrophyWall,
  buildUmaBadgeCollection,
  filterBadgeItems,
  parseBadgeRoute,
  resolveBadgeUmaId,
  serializeBadgeRoute,
  sortBadgeItems,
  type BadgeCollectionItem,
  type BadgeRouteState,
  type BadgeScope,
  type StableBadgeItem,
} from '../game/badge-collection-view'
import type { FlairTimelineCursor } from '../game/badge-preferences'
import { buildTrainerBadgeCollection } from '../game/trainer-view'
import { useGame } from '../game/store'
import { umaIdsByLevel } from '../game/uma-order'
import { joinUma } from '../game/view'
import { UmaPickerSheet } from '../ui/album/UmaPickerSheet'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BottomSheet } from '../ui/BottomSheet'
import {
  ArrowDownIcon, ArrowUpIcon, BurstIcon, CheckIcon, ChevronDownIcon, CloseIcon, CrownIcon, DistanceIcon, GoalIcon,
  LineageIcon, MoveToIcon, QuestionIcon, ScenarioIcon, SparkIcon, StableIcon, StatsIcon, StopwatchIcon, StrategyPaceIcon,
  TitleIcon, TrophyIcon, TurfIcon, VenueIcon, type IconComponent, type IconSize,
} from '../ui/icons'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'
import { SaveErrorState } from '../ui/SaveErrorState'

const SORT_OPTIONS: { value: BadgeSort; label: string }[] = [
  { value: 'recent', label: 'Most recent' }, { value: 'tier', label: 'Highest tier' },
  { value: 'closest', label: 'Closest next tier' }, { value: 'rarest', label: 'Rarest' },
  { value: 'alphabetical', label: 'Alphabetical' }, { value: 'category', label: 'Category' },
]
const TIER_TONES: Record<string, string> = {
  bronze: 'border-tier-bronze bg-panel text-ink', silver: 'border-tier-silver bg-panel text-ink',
  gold: 'border-tier-gold bg-accent-wash text-ink', platinum: 'border-tier-platinum bg-panel text-ink',
  rainbow: 'border-accent bg-gradient-to-br from-accent-wash via-panel to-page text-ink', 'one-off': 'border-accent bg-accent-wash text-ink',
  locked: 'border-hairline bg-sunken text-ink-faint',
}
const GLYPHS: Record<string, IconComponent> = {
  victories: CrownIcon, surface: TurfIcon, distance: DistanceIcon, strategy: StrategyPaceIcon, venue: VenueIcon,
  'race-feat': BurstIcon, stats: StatsIcon, scenario: ScenarioIcon, training: StopwatchIcon, skills: SparkIcon,
  goals: GoalIcon, lineage: LineageIcon, title: TitleIcon, trophy: TrophyIcon, missing: QuestionIcon,
}
function CategoryGlyph({ category, size }: { category: string; size: IconSize }) {
  const Glyph = GLYPHS[category] ?? SparkIcon
  return <Glyph size={size} />
}
const titleCase = (value: string) => value.split(/[-_:]/).filter(Boolean).map((part) => part[0]!.toLocaleUpperCase() + part.slice(1)).join(' ')
const dateLabel = (value: number | null) => value === null ? 'Not earned' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
const isStableItem = (item: BadgeCollectionItem | StableBadgeItem): item is StableBadgeItem => 'holderCount' in item

function BadgeTile({ item, pinMode, selected, onOpen, onToggle }: {
  item: BadgeCollectionItem | StableBadgeItem
  pinMode: boolean
  selected: boolean
  onOpen: () => void
  onToggle: () => void
}) {
  const locked = item.tier === null
  return <article className={`[content-visibility:auto] [contain-intrinsic-size:180px] relative min-h-44 overflow-hidden rounded-md border-2 p-3 shadow-1 ${TIER_TONES[item.tier ?? 'locked']}`}>
    <button type="button" onClick={onOpen} className="flex min-h-11 w-full items-start gap-2 text-left">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border-2 border-current ${locked ? 'opacity-45' : ''}`} aria-hidden><CategoryGlyph category={item.category} size={24} /></span>
      <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">{titleCase(item.category)}</span><span className={`block font-semibold leading-tight ${locked ? 'blur-[2px] select-none' : ''}`}>{item.label}</span></span>
    </button>
    <p className="mt-2 text-xs font-bold">{item.tier ? titleCase(item.tier) : 'Locked'} · {item.progressLabel}</p>
    {isStableItem(item) && <p className="mt-1 text-[11px] font-bold opacity-75">{item.holderCount} / {item.ownedUmaCount} Umas · {item.rarityPercent}%</p>}
    {item.progress !== null && item.nextThreshold !== null && <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel/70"><div className="h-full rounded-full bg-current opacity-70" style={{ width: `${Math.max(3, item.progress * 100)}%` }} /></div>}
    {pinMode && item.tier !== null && <button type="button" aria-pressed={selected || item.pinned} onClick={onToggle} className={`mt-2 min-h-11 w-full rounded-sm px-3 text-xs font-semibold ${selected || item.pinned ? 'bg-accent text-ink' : 'bg-panel/80'}`}>{selected ? <span className="inline-flex items-center gap-1"><CheckIcon size={16} />Selected</span> : item.pinned ? 'Pinned' : 'Select to pin'}</button>}
  </article>
}

function ScopeButton({ scope, current, disabled, onClick }: { scope: BadgeScope; current: BadgeScope; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} aria-pressed={scope === current} onClick={onClick} className={`min-h-11 flex-1 rounded-sm px-2 text-sm font-semibold ${scope === current ? 'bg-accent text-ink' : 'bg-panel'} disabled:opacity-45`}>{titleCase(scope)}{disabled ? ' · Soon' : ''}</button>
}

interface FilterOption { kind: BadgeFilterKind; value: string | number; label: string }

export function BadgesScreen() {
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const profile = useGame((state) => state.profile)
  const owned = useGame((state) => state.umas)
  const badges = useGame((state) => state.badges)
  const flairEvents = useGame((state) => state.flairEvents)
  const persistent = useGame((state) => state.persistent)
  const pushToast = useGame((state) => state.pushToast)
  const [searchParams, setSearchParams] = useSearchParams()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [pinMode, setPinMode] = useState(false)
  const [selectedPins, setSelectedPins] = useState<Set<string>>(new Set())
  const [destinationGroup, setDestinationGroup] = useState('default')
  const [showcaseOpen, setShowcaseOpen] = useState(false)
  const [viewsOpen, setViewsOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [groupAction, setGroupAction] = useState<{ id: string; mode: 'rename' | 'delete' } | null>(null)
  const [viewRenameId, setViewRenameId] = useState<string | null>(null)
  const [titleOpen, setTitleOpen] = useState(false)
  const [hiddenSelectionOpen, setHiddenSelectionOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pageEvents, setPageEvents] = useState<(Awaited<ReturnType<typeof listFlairTimeline>>['items'][number])[]>([])
  const [timelineCursor, setTimelineCursor] = useState<FlairTimelineCursor | null>(null)
  const [timelineHasMore, setTimelineHasMore] = useState(false)
  const [raceHistory, setRaceHistory] = useState<RaceResultRecord[]>([])

  // Highest level first, as every Uma list is (D181); the page opens on the featured Uma, else the first of these.
  const ownedIds = useMemo(() => contentState.status === 'ready'
    ? umaIdsByLevel(owned, contentState.content, Object.keys(owned).filter((id) => contentState.content.umas.byId.has(id))) : [], [contentState, owned])
  const route = useMemo(() => parseBadgeRoute(`?${searchParams.toString()}`, new Set(ownedIds)), [ownedIds, searchParams])
  const umaId = resolveBadgeUmaId(route.umaId, ownedIds, profile?.featuredUmaId ?? null)
  const umaState = umaId ? badges[badgeStateId(umaId)] : null
  const trainerState = badges.trainer
  // The picker's line under each Uma: her awards and frame, built only while it is open.
  const pickerNotes = useMemo(() => {
    if (!pickerOpen || contentState.status !== 'ready') return null
    return new Map(ownedIds.map((id) => {
      const state = badges[badgeStateId(id)]
      const view = state?.scope === 'uma' ? buildUmaBadgeCollection(contentState.content, state, flairEvents) : null
      return [id, `${view?.earnedCount ?? 0} awards · ${view?.frame.label ?? 'Plain'}`]
    }))
  }, [badges, contentState, flairEvents, ownedIds, pickerOpen])

  const replaceRoute = (next: Partial<Omit<BadgeRouteState, 'unavailable'>>) => {
    const resolved = { ...route, ...next }
    setSearchParams(serializeBadgeRoute({
      scope: resolved.scope, umaId: resolved.umaId, query: resolved.query, filters: resolved.filters,
      sort: resolved.sort, detail: resolved.detail, timelineKind: resolved.timelineKind,
    }).slice(1), { replace: true })
  }

  useEffect(() => {
    if (route.scope === 'uma' && umaId && route.umaId !== umaId) replaceRoute({ umaId })
  // replaceRoute intentionally derives the latest typed URL state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.scope, route.umaId, umaId])

  useEffect(() => {
    setPageEvents([])
    setTimelineCursor(null)
    setTimelineHasMore(false)
    if (!umaId || status !== 'ready') return
    let active = true
    void listFlairTimeline(umaId, null, route.timelineKind, 24).then((page) => {
      if (!active) return
      setPageEvents(page.items)
      setTimelineCursor(page.nextCursor)
      setTimelineHasMore(page.nextCursor !== null)
    }).catch((reason: unknown) => { if (active) pushToast(reason instanceof Error ? reason.message : 'Could not load flair history') })
    return () => { active = false }
  }, [pushToast, route.timelineKind, status, umaId])

  useEffect(() => {
    if (status !== 'ready') return
    let active = true
    void listRaceHistory(10_000).then((rows) => { if (active) setRaceHistory(rows) }).catch(() => undefined)
    return () => { active = false }
  }, [status])

  const umaCollection = useMemo(() => contentState.status === 'ready' && umaState?.scope === 'uma'
    ? buildUmaBadgeCollection(contentState.content, umaState, flairEvents, raceHistory) : null, [contentState, flairEvents, raceHistory, umaState])
  const stableCollection = useMemo(() => contentState.status === 'ready'
    ? buildStableBadgeCollection(contentState.content, Object.values(owned).map((save) => {
      const state = badges[badgeStateId(save.templateId)]
      return { save, state: state?.scope === 'uma' ? state : null }
    }), flairEvents, raceHistory) : null, [badges, contentState, flairEvents, owned, raceHistory])
  const trainerCollection = useMemo(() => contentState.status === 'ready' && trainerState?.scope === 'trainer'
    ? buildTrainerBadgeCollection(contentState.content, trainerState, owned, raceHistory) : null,
  [contentState, owned, raceHistory, trainerState])
  const collection = route.scope === 'stable' ? stableCollection : route.scope === 'trainer' ? trainerCollection : umaCollection
  const coverage = useMemo(() => contentState.status === 'ready'
    ? flairContentCoverage(contentState.content.races.items) : null, [contentState])
  const visible = useMemo(() => collection ? sortBadgeItems(filterBadgeItems(collection.items, route.query, route.filters), route.sort) : [], [collection, route.filters, route.query, route.sort])
  const detail = route.detail && collection ? collection.items.find((item) => item.awardKey === route.detail) ?? null : null
  const preferenceState = route.scope === 'uma' ? umaState : trainerState
  const preferences = preferenceState?.preferences
  const savedViews = useMemo(() => (preferences?.savedViews ?? []).filter((view) =>
    route.scope === 'trainer' ? isTrainerSavedBadgeView(view) : route.scope === 'stable' ? !isTrainerSavedBadgeView(view) : true),
  [preferences?.savedViews, route.scope])

  const commit = async (desired: BadgePreferences, message: string) => {
    if (!preferenceState || busy) return
    if (message === 'Group deleted; pins moved to default' && groupAction === null) {
      const deleted = preferences?.showcaseGroups.find((group) => !desired.showcaseGroups.some((candidate) => candidate.id === group.id))
      if (deleted) {
        setGroupAction({ id: deleted.id, mode: 'delete' })
        return
      }
    }
    setBusy(true)
    try {
      const result = await saveBadgePreferences(preferenceState.scope === 'trainer' ? 'trainer' : badgeStateId(preferenceState.umaId), desired)
      pushToast(result.changed ? message : 'Already up to date')
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not save Badge preferences')
    } finally {
      setBusy(false)
    }
  }

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to view Badges" detail="Your private flair archive stays behind your account." action={{ label: 'Open Settings', to: '/settings' }} />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before browsing Badges." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <SaveErrorState detail={lifecycleError} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile) return <ScreenState title="Opening Badges…" detail="Loading private content and your flair archive." />
  if (ownedIds.length === 0 && route.scope !== 'trainer') return <ScreenState title="No owned Uma yet" detail="Add an Uma to your Stable before collecting flair." action={{ label: 'Open Stable', to: '/stable' }} />
  if (route.scope === 'uma' && (!umaId || !umaState)) return <ScreenState title="Badge state is missing" detail="This Uma is preserved, but its Badge entity could not be loaded. The page will not reseed it." action={{ label: 'Back to Stable', to: '/stable' }} />
  if (!collection || !preferences) return <ScreenState title="Badge archive unavailable" detail="The saved Badge schema may be newer than this app." />

  const selectedUma = umaId ? owned[umaId] : null
  const selectedJoin = selectedUma ? joinUma(selectedUma, contentState.content) : null
  const standardFilterOptions: FilterOption[] = [
    ...FLAIR_CATEGORIES.map((value) => ({ kind: 'category' as const, value, label: `Category · ${titleCase(value)}` })),
    ...[...BADGE_TIERS, 'one-off', 'title', 'trophy', 'goal-ribbon', 'honors'].map((value) => ({ kind: 'type' as const, value, label: `Type · ${titleCase(value)}` })),
    ...SURFACES.map((value) => ({ kind: 'surface' as const, value, label: `Surface · ${titleCase(value)}` })),
    ...DISTANCE_CATEGORIES.map((value) => ({ kind: 'distance' as const, value, label: `Distance · ${titleCase(value)}` })),
    ...STRATEGIES.map((value) => ({ kind: 'strategy' as const, value, label: `Strategy · ${titleCase(value)}` })),
    ...['challenge', 'impossible', 'unorthodox'].map((value) => ({ kind: 'aptitude' as const, value, label: `Aptitude · ${titleCase(value)}` })),
    ...RACE_GRADES.map((value) => ({ kind: 'grade' as const, value, label: `Grade · ${value.toUpperCase()}` })),
    ...SCENARIOS.map((scenario, index) => ({ kind: 'scenario' as const, value: String(index + 1), label: `Scenario · ${scenario.name}` })),
    ...['earned', 'locked', 'progress', 'complete', 'untracked'].map((value) => ({ kind: 'status' as const, value, label: `Status · ${titleCase(value)}` })),
    ...['yes', 'no'].map((value) => ({ kind: 'pinned' as const, value, label: `Pinned · ${value}` })),
    { kind: 'earned-after' as const, value: Date.now() - 30 * 86_400_000, label: 'Earned date · last 30 days' },
    ...[...new Set(collection.items.map((item) => item.venue).filter((value): value is string => Boolean(value)))].sort().map((value) => ({ kind: 'venue' as const, value, label: `Venue · ${titleCase(value)}` })),
    ...(route.scope === 'stable' ? [
      ...['common', 'uncommon', 'rare', 'elite'].map((value) => ({ kind: 'rarity' as const, value, label: `Rarity · ${titleCase(value)}` })),
      ...ownedIds.map((value) => ({ kind: 'uma' as const, value, label: `Uma · ${contentState.content.umas.byId.get(value)?.name ?? value}` })),
    ] : []),
  ]
  const filterOptions: FilterOption[] = route.scope === 'trainer' ? [
    ...['collection', 'stable', 'journey'].map((value) => ({ kind: 'category' as const, value, label: `Category · ${titleCase(value)}` })),
    ...[...BADGE_TIERS, 'one-off'].map((value) => ({ kind: 'type' as const, value, label: `Type · ${titleCase(value)}` })),
    ...['earned', 'locked', 'progress', 'complete'].map((value) => ({ kind: 'status' as const, value, label: `Status · ${titleCase(value)}` })),
    ...['yes', 'no'].map((value) => ({ kind: 'pinned' as const, value, label: `Pinned · ${value}` })),
    { kind: 'earned-after', value: Date.now() - 30 * 86_400_000, label: 'Earned date · last 30 days' },
  ] : standardFilterOptions
  const setFilter = (option: FilterOption) => {
    replaceRoute({ filters: [...route.filters.filter((filter) => filter.kind !== option.kind), { kind: option.kind, value: option.value }] })
    setFilterOpen(false)
  }
  const toggleSelected = (awardKey: string) => setSelectedPins((current) => {
    const next = new Set(current)
    if (next.has(awardKey)) next.delete(awardKey)
    else next.add(awardKey)
    return next
  })
  const pinOne = (item: BadgeCollectionItem | StableBadgeItem) => {
    if (route.scope === 'stable' || !preferenceState) return
    const groups = item.pinned
      ? preferences.showcaseGroups.map((group) => ({ ...group, awardRefs: group.awardRefs.filter((ref) => ref !== item.awardKey) }))
      : moveShowcaseRefs(preferences.showcaseGroups, [item.awardKey], destinationGroup)
    void commit({ ...preferences, showcaseGroups: groups }, item.pinned ? 'Pin removed' : 'Badge pinned')
  }
  const commitBulkPin = (refs: string[]) => {
    if (route.scope === 'stable' || refs.length === 0) return
    void commit({ ...preferences, showcaseGroups: moveShowcaseRefs(preferences.showcaseGroups, refs, destinationGroup) }, `${refs.length} awards pinned`)
      .then(() => {
        setSelectedPins(new Set())
        setHiddenSelectionOpen(false)
      })
  }
  const bulkPin = () => {
    if (route.scope === 'stable' || selectedPins.size === 0) return
    const visibleKeys = new Set(visible.map((item) => item.awardKey))
    if ([...selectedPins].some((awardKey) => !visibleKeys.has(awardKey))) {
      setHiddenSelectionOpen(true)
      return
    }
    commitBulkPin([...selectedPins])
  }
  const submitNamed = (event: FormEvent, kind: 'group' | 'view') => {
    event.preventDefault()
    const name = draftName.trim()
    if (!name) return
    if (kind === 'group') {
      const groups = [...preferences.showcaseGroups, { id: `group-${Date.now()}`, name, awardRefs: [] }]
      void commit({ ...preferences, showcaseGroups: groups }, 'Showcase group created').then(() => setDraftName(''))
    } else {
      const idPrefix = route.scope === 'trainer' ? TRAINER_SAVED_VIEW_ID_PREFIX : 'view-'
      const views = [...preferences.savedViews, { id: `${idPrefix}${Date.now()}`, name, filters: encodeBadgeFilters(route.filters), sort: route.sort }]
      void commit({ ...preferences, savedViews: views }, 'View saved').then(() => setDraftName(''))
    }
  }
  const timeline = umaState?.scope === 'uma' ? buildTimelineItems(contentState.content, umaState, pageEvents, raceHistory) : []
  const trophies = umaState?.scope === 'uma' ? buildTrophyWall(contentState.content, umaState, raceHistory) : []

  return <div className="flex flex-col gap-3 pt-2">
    <Panel className="bg-gradient-to-br from-accent-wash to-panel">
      <div className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Badges</h1><p className="text-sm font-bold text-ink-soft">{collection.earnedCount} / {collection.visibleCount} visible awards</p></div>{route.scope === 'uma' && umaCollection && <div className={`rounded-sm border-2 px-3 py-2 text-center ${umaCollection.frame.borderClass} ${umaCollection.frame.backgroundClass}`}><p className="flex items-center justify-center gap-1 font-semibold"><umaCollection.frame.Glyph size={16} variant={umaCollection.frame.glyphVariant} />{umaCollection.prestige}</p><p className="text-[10px] font-bold">{umaCollection.frame.label} frame</p></div>}</div>
      <div className="mt-3 flex gap-2 rounded-md bg-sunken p-1"><ScopeButton scope="uma" current={route.scope} onClick={() => replaceRoute({ scope: 'uma', filters: route.scope === 'trainer' ? [] : route.filters.filter((filter) => filter.kind !== 'rarity' && filter.kind !== 'uma'), sort: route.sort === 'rarest' ? 'recent' : route.sort, detail: null })} /><ScopeButton scope="stable" current={route.scope} onClick={() => replaceRoute({ scope: 'stable', filters: route.scope === 'trainer' ? [] : route.filters, detail: null })} /><ScopeButton scope="trainer" current={route.scope} onClick={() => replaceRoute({ scope: 'trainer', filters: [], sort: route.sort === 'rarest' ? 'recent' : route.sort, detail: null })} /></div>
      {route.scope === 'uma' && selectedJoin?.status === 'ready' && <button type="button" onClick={() => setPickerOpen(true)} className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-md bg-panel p-2 text-left shadow-1"><AtlasSprite asset={selectedJoin.value.asset} decorative className={`h-12 w-12 shrink-0 rounded-sm border-2 ${umaCollection?.frame.borderClass ?? 'border-hairline'}`} fallback={<div className="flex h-full items-center justify-center text-ink-faint"><StableIcon size={24} /></div>} /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{selectedJoin.value.template.name}</span><span className="block text-xs font-bold text-ink-soft">Uma Lv {selectedJoin.value.save.level} · {umaCollection?.activeTitle ? collection.items.find((item) => item.awardKey === umaCollection.activeTitle)?.label ?? umaCollection.activeTitle : 'No active title'}</span></span><ChevronDownIcon size={20} className="text-ink-soft" /></button>}
      {route.scope === 'stable' && stableCollection && <p className="mt-3 rounded-sm bg-panel p-3 text-sm font-bold">{stableCollection.ownedUmaCount} known Umas · {stableCollection.completionPercent}% Stable completion</p>}
      {route.scope === 'trainer' && trainerCollection && <Link to="/trainer" className="mt-3 flex min-h-11 items-center justify-between rounded-sm bg-panel px-3 text-sm font-semibold"><span>{trainerCollection.displayName} · {trainerCollection.earnedCount} achievements</span><span>Profile →</span></Link>}
      {coverage && <p className={`mt-2 rounded-sm p-2 text-xs font-bold ${coverage.coveredSeries === 0 ? 'bg-accent-wash text-accent-strong' : 'bg-panel text-ink-soft'}`}>{coverage.coveredSeries === 0 ? 'Race-series coverage is not published yet; set titles are temporarily unavailable.' : `Race-series coverage · ${coverage.coveredSeries}/${coverage.totalSeries} series · ${coverage.mainVenues}/10 main venues`}</p>}
      {!persistent && <p className="mt-2 rounded-sm bg-accent-wash p-2 text-xs font-semibold">Memory only — edits last for this session and cannot sync.</p>}
      {route.unavailable.length > 0 && <p className="mt-2 rounded-sm bg-accent-wash p-2 text-xs font-bold">Some filters are unavailable: {route.unavailable.join(', ')}</p>}
    </Panel>

    <div className="grid grid-cols-[1fr_auto] gap-2"><label className="flex min-h-11 items-center rounded-sm bg-panel px-3"><span className="sr-only">Search Badges</span><input value={route.query} onChange={(event) => replaceRoute({ query: event.target.value })} placeholder="Search visible awards" className="w-full bg-transparent text-sm font-bold outline-none" /></label><button type="button" onClick={() => setFilterOpen(true)} className="min-h-11 rounded-sm bg-panel px-4 text-sm font-semibold">Filter {route.filters.length ? `· ${route.filters.length}` : ''}</button></div>
    {route.filters.length > 0 && <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{route.filters.map((filter) => <button key={filter.kind} type="button" onClick={() => replaceRoute({ filters: route.filters.filter((row) => row.kind !== filter.kind) })} aria-label={`Remove filter ${titleCase(filter.kind)}: ${titleCase(String(filter.value))}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-accent px-3 text-xs font-semibold text-white">{titleCase(filter.kind)}: {titleCase(String(filter.value))}<CloseIcon size={16} /></button>)}</div>}
    <div className="flex gap-2"><button type="button" onClick={() => setSortOpen(true)} className="min-h-11 flex-1 rounded-sm bg-panel px-3 text-sm font-semibold">Sort · {SORT_OPTIONS.find((item) => item.value === route.sort)?.label}</button>{route.scope === 'uma' && <button type="button" onClick={() => setTitleOpen(true)} className="min-h-11 rounded-sm bg-panel px-3 text-sm font-semibold">Title</button>}{route.scope !== 'stable' && <button type="button" aria-pressed={pinMode} onClick={() => { setPinMode((value) => !value); setSelectedPins(new Set()) }} className={`min-h-11 rounded-sm px-3 text-sm font-semibold ${pinMode ? 'bg-accent text-ink' : 'bg-panel'}`}>Pin</button>}<button type="button" onClick={() => setViewsOpen(true)} className="min-h-11 rounded-sm bg-panel px-3 text-sm font-semibold">Views</button></div>
    {pinMode && route.scope !== 'stable' && <Panel className="border-accent/40 bg-accent-wash"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{selectedPins.size} selected</p><button type="button" onClick={() => setSelectedPins(new Set(visible.filter((item) => item.tier !== null).map((item) => item.awardKey)))} className="min-h-11 px-2 text-xs font-semibold">Select visible ({visible.filter((item) => item.tier !== null).length})</button></div><label className="mt-2 block text-xs font-bold">Destination group<select value={destinationGroup} onChange={(event) => setDestinationGroup(event.target.value)} className="mt-1 min-h-11 w-full rounded-sm bg-panel px-3 font-semibold">{preferences.showcaseGroups.map((group) => <option key={group.id} value={group.id}>{group.name ?? 'Default showcase'}</option>)}</select></label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={selectedPins.size === 0 || busy} onClick={bulkPin} className="min-h-11 rounded-sm bg-accent px-3 text-sm font-semibold text-white disabled:opacity-45">Pin selected</button><button type="button" onClick={() => setShowcaseOpen(true)} className="min-h-11 rounded-sm bg-panel px-3 text-sm font-semibold">Manage showcase</button></div></Panel>}

    {visible.length > 0 ? <div className="grid grid-cols-2 gap-3">{visible.map((item) => <BadgeTile key={item.awardKey} item={item} pinMode={pinMode} selected={selectedPins.has(item.awardKey)} onOpen={() => replaceRoute({ detail: item.awardKey })} onToggle={() => item.pinned && !selectedPins.has(item.awardKey) ? pinOne(item) : toggleSelected(item.awardKey)} />)}</div> : <Panel className="text-center"><p className="font-semibold">{collection.earnedCount === 0 ? 'No awards yet' : 'No Badges match these filters'}</p><p className="mt-1 text-sm text-ink-soft">{collection.earnedCount === 0 ? 'Race and train to begin the archive.' : 'Search and filters only inspect visible definitions.'}</p>{route.filters.length > 0 && <button type="button" onClick={() => replaceRoute({ filters: [], query: '' })} className="mt-3 min-h-11 rounded-sm bg-accent px-4 font-semibold text-white">Clear filters</button>}</Panel>}

    {route.scope === 'uma' && trophies.length > 0 && <Panel><h2 className="text-lg font-semibold">G1 Trophy wall</h2><div className="mt-3 grid grid-cols-2 gap-2">{trophies.map((trophy) => <button key={trophy.awardKey} type="button" onClick={() => replaceRoute({ detail: trophy.awardKey })} className="min-h-24 rounded-sm border-2 border-accent bg-accent-wash p-3 text-left"><TrophyIcon size={24} className="text-accent-strong" /><span className="block text-sm font-semibold">{trophy.label}</span><span className="block text-xs font-bold">× {trophy.count} · {dateLabel(trophy.lastEarnedAt)}</span></button>)}</div></Panel>}

    {route.scope === 'uma' && <Panel><div className="flex items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Flair timeline</h2><p className="text-xs text-ink-soft">Newest award first</p></div><select aria-label="Timeline kind" value={route.timelineKind ?? ''} onChange={(event) => replaceRoute({ timelineKind: event.target.value ? event.target.value as FlairEventKind : null })} className="min-h-11 rounded-sm bg-panel px-2 text-xs font-semibold"><option value="">All kinds</option>{(['badge-tier', 'one-off', 'goal-ribbon', 'honors', 'title', 'trophy-earned'] as FlairEventKind[]).map((kind) => <option key={kind} value={kind}>{titleCase(kind)}</option>)}</select></div><div className="mt-3 grid gap-2">{timeline.map((event) => <div key={event.id} className="rounded-sm bg-panel p-3"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">{event.label}</p><time className="shrink-0 text-[10px] font-bold">{dateLabel(event.earnedAt)}</time></div><p className="text-xs font-bold text-accent-strong">{event.kindLabel} · {titleCase(event.stage)}{event.retroactive ? ' · Retroactive' : ''}</p><p className="text-[11px] text-ink-soft">{event.historyLabel}</p>{event.source?.to ? <Link to={event.source.to} className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-accent-strong">{event.source.label} →</Link> : event.source && <p className="mt-1 text-[11px] font-bold text-ink-soft">{event.source.label}{event.source.safeId ? ` · ${event.source.safeId}` : ''}</p>}</div>)}</div>{timeline.length === 0 && <p className="mt-3 text-sm text-ink-soft">No timeline events in this view.</p>}{timelineHasMore && <button type="button" className="mt-3 min-h-11 w-full rounded-sm bg-panel font-semibold" onClick={() => { if (!umaId || !timelineCursor) return; void listFlairTimeline(umaId, timelineCursor, route.timelineKind, 24).then((page) => { setPageEvents((rows) => [...rows, ...page.items]); setTimelineCursor(page.nextCursor); setTimelineHasMore(page.nextCursor !== null) }).catch((reason: unknown) => pushToast(reason instanceof Error ? reason.message : 'Could not load more history')) }}>Load more</button>}</Panel>}

    <UmaPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choose an Uma" content={contentState.content} candidateIds={ownedIds} selectedIds={umaId ? [umaId] : []} selectedLabel="Showing" describe={(entry) => pickerNotes?.get(entry.id) ?? null} onPick={(id) => replaceRoute({ umaId: id, detail: null })} />

    <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)}><div className="max-h-[76dvh] overflow-y-auto"><div className="sticky top-0 z-10 flex items-center justify-between bg-panel pb-2"><h2 className="text-xl font-semibold">Add a filter</h2><button type="button" onClick={() => { replaceRoute({ filters: [] }); setFilterOpen(false) }} className="min-h-11 px-2 text-sm font-semibold">Clear all</button></div><div className="grid gap-2">{filterOptions.map((option) => <button key={`${option.kind}:${option.value}`} type="button" onClick={() => setFilter(option)} className={`min-h-11 rounded-sm border-2 px-3 text-left text-sm font-semibold ${route.filters.some((filter) => filter.kind === option.kind && filter.value === option.value) ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}>{option.label}</button>)}</div></div></BottomSheet>

    <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)}><h2 className="mb-3 text-xl font-semibold">Sort Badges</h2><div className="grid gap-2">{SORT_OPTIONS.filter((option) => route.scope === 'stable' || option.value !== 'rarest').map((option) => <button key={option.value} type="button" onClick={() => { replaceRoute({ sort: option.value }); setSortOpen(false) }} className={`min-h-11 rounded-sm border-2 px-3 text-left font-semibold ${route.sort === option.value ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}>{option.label}</button>)}</div></BottomSheet>

    <BottomSheet open={detail !== null} onClose={() => replaceRoute({ detail: null })}>{detail && <div className="max-h-[76dvh] overflow-y-auto"><div className="flex gap-3"><span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border-2 ${TIER_TONES[detail.tier ?? 'locked']}`} aria-hidden><CategoryGlyph category={detail.category} size={32} /></span><div><p className="text-xs font-semibold uppercase text-accent-strong">{titleCase(detail.kind)}</p><h2 className="text-xl font-semibold">{detail.label}</h2><p className="text-sm font-bold">{detail.tier ? titleCase(detail.tier) : 'Locked'} · {detail.points} Prestige</p></div></div><p className="mt-4 text-sm">{detail.description}</p><div className="mt-3 rounded-sm bg-panel p-3"><p className="text-xs font-semibold uppercase text-ink-soft">Criterion</p><p className="font-bold">{detail.criterionLabel}</p><p className="mt-1 text-sm">{detail.progressLabel} · {detail.historyLabel}</p>{detail.thresholds.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{detail.thresholds.map((threshold, index) => <span key={threshold} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${index <= detail.tierIndex ? 'bg-accent text-ink' : 'bg-sunken'}`}>{BADGE_TIERS[index] ? titleCase(BADGE_TIERS[index]!) : 'Earned'} · {threshold}</span>)}</div>}</div><p className="mt-3 text-xs font-bold text-ink-soft">Earned: {dateLabel(detail.earnedAt)} · Tags: {detail.tags.join(', ') || 'none'}</p>{detail.source?.to ? <Link to={detail.source.to} className="mt-2 flex min-h-11 items-center font-semibold text-accent-strong">{detail.source.label} →</Link> : detail.source && <p className="mt-2 rounded-sm bg-sunken p-2 text-xs font-bold">{detail.source.label}{detail.source.safeId ? ` · ${detail.source.safeId}` : ''}</p>}{route.scope !== 'stable' && detail.tier !== null && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => pinOne(detail)} className="min-h-11 rounded-sm bg-accent px-3 font-semibold text-white">{detail.pinned ? 'Unpin' : 'Pin award'}</button>{detail.kind === 'title' && <button type="button" disabled={busy} onClick={() => void commit({ ...preferences, activeTitleId: preferences.activeTitleId === detail.awardKey ? null : detail.awardKey }, preferences.activeTitleId === detail.awardKey ? 'Active title cleared' : 'Active title updated')} className="min-h-11 rounded-sm bg-panel px-3 font-semibold">{preferences.activeTitleId === detail.awardKey ? 'Clear title' : 'Use title'}</button>}</div>}{isStableItem(detail) && <div className="mt-3"><h3 className="font-semibold">Holders · {detail.holderCount} / {detail.ownedUmaCount}</h3>{detail.holders.map((holder) => <button key={holder.umaId} type="button" onClick={() => replaceRoute({ scope: 'uma', umaId: holder.umaId, filters: [], sort: 'recent' })} className="mt-1 flex min-h-11 w-full items-center justify-between rounded-sm bg-panel px-3 text-sm font-bold"><span>{holder.name}</span><span>{holder.tier ? titleCase(holder.tier) : '—'}</span></button>)}</div>}</div>}</BottomSheet>

    <BottomSheet open={showcaseOpen} onClose={() => setShowcaseOpen(false)}><div className="max-h-[76dvh] overflow-y-auto"><h2 className="text-xl font-semibold">Manage showcase</h2><p className="text-xs text-ink-soft">Drag is optional. Move controls are always available.</p>{preferences.showcaseGroups.map((group, groupIndex) => <div key={group.id} className="mt-3 rounded-md bg-panel p-3" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const ref = event.dataTransfer.getData('text/plain'); if (ref) void commit({ ...preferences, showcaseGroups: moveShowcaseRefs(preferences.showcaseGroups, [ref], group.id) }, 'Pin moved') }}><div className="flex items-center gap-1"><p className="min-w-0 flex-1 truncate font-semibold">{group.name ?? 'Default showcase'} · {group.awardRefs.length}</p><button type="button" aria-label={`Move ${group.name ?? 'default'} up`} disabled={groupIndex <= 1} onClick={() => void commit({ ...preferences, showcaseGroups: moveItem(preferences.showcaseGroups, groupIndex, groupIndex - 1) }, 'Groups reordered')} className="min-h-11 min-w-11 rounded-lg bg-sunken font-semibold"><ArrowUpIcon size={20} className="mx-auto" /></button><button type="button" aria-label={`Move ${group.name ?? 'default'} down`} disabled={groupIndex === 0 || groupIndex === preferences.showcaseGroups.length - 1} onClick={() => void commit({ ...preferences, showcaseGroups: moveItem(preferences.showcaseGroups, groupIndex, groupIndex + 1) }, 'Groups reordered')} className="min-h-11 min-w-11 rounded-lg bg-sunken font-semibold"><ArrowDownIcon size={20} className="mx-auto" /></button>{group.id !== 'default' && <button type="button" aria-label={`Delete ${group.name}`} onClick={() => void commit({ ...preferences, showcaseGroups: removeShowcaseGroup(preferences.showcaseGroups, group.id, 'move-to-default') }, 'Group deleted; pins moved to default')} className="min-h-11 min-w-11 rounded-lg bg-danger/10 font-semibold text-danger"><CloseIcon size={20} className="mx-auto" /></button>}</div><div className="mt-2 grid gap-1">{group.awardRefs.map((ref, index) => <div key={ref} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', ref)} className="flex min-h-11 items-center gap-1 rounded-sm bg-accent-wash px-2"><span className="min-w-0 flex-1 truncate text-xs font-bold">{collection.items.find((item) => item.awardKey === ref)?.label ?? ref}</span><button type="button" aria-label={`Move ${ref} up`} disabled={index === 0} onClick={() => { const groups = preferences.showcaseGroups.map((entry) => entry.id === group.id ? { ...entry, awardRefs: moveItem(entry.awardRefs, index, index - 1) } : entry); void commit({ ...preferences, showcaseGroups: groups }, 'Pins reordered') }} className="min-h-11 min-w-11 font-semibold"><ArrowUpIcon size={20} className="mx-auto" /></button><button type="button" aria-label={`Move ${ref} down`} disabled={index === group.awardRefs.length - 1} onClick={() => { const groups = preferences.showcaseGroups.map((entry) => entry.id === group.id ? { ...entry, awardRefs: moveItem(entry.awardRefs, index, index + 1) } : entry); void commit({ ...preferences, showcaseGroups: groups }, 'Pins reordered') }} className="min-h-11 min-w-11 font-semibold"><ArrowDownIcon size={20} className="mx-auto" /></button><button type="button" aria-label={`Move ${ref} to next group`} disabled={preferences.showcaseGroups.length < 2} onClick={() => { const target = preferences.showcaseGroups[(groupIndex + 1) % preferences.showcaseGroups.length]!.id; void commit({ ...preferences, showcaseGroups: moveShowcaseRefs(preferences.showcaseGroups, [ref], target) }, 'Pin moved') }} className="min-h-11 min-w-11 font-semibold"><MoveToIcon size={20} className="mx-auto" /></button></div>)}</div></div>)}<form onSubmit={(event) => submitNamed(event, 'group')} className="mt-3 flex gap-2"><input value={draftName} maxLength={40} onChange={(event) => setDraftName(event.target.value)} placeholder="New group name" className="min-h-11 min-w-0 flex-1 rounded-sm bg-panel px-3 font-bold" /><button disabled={preferences.showcaseGroups.length >= 21 || !draftName.trim()} className="min-h-11 rounded-sm bg-accent px-4 font-semibold text-white disabled:opacity-45">Add</button></form></div></BottomSheet>

    <BottomSheet open={viewsOpen} onClose={() => setViewsOpen(false)}><div className="max-h-[76dvh] overflow-y-auto"><h2 className="text-xl font-semibold">Saved views</h2><p className="text-xs text-ink-soft">Views save filters and sort for this scope, never search or selection.</p><div className="mt-3 grid gap-2">{savedViews.map((view) => <div key={view.id} className="flex min-h-12 items-center gap-2 rounded-sm bg-panel p-2"><button type="button" onClick={() => { const decoded = decodeBadgeFilters(view.filters); const compatible = (decoded ?? []).filter((filter) => route.scope === 'stable' || (filter.kind !== 'rarity' && filter.kind !== 'uma')); const valid = compatible.filter((filter) => filter.kind === 'earned-after' || filterOptions.some((option) => option.kind === filter.kind && option.value === filter.value)); const unavailable = !decoded || valid.length !== (decoded?.length ?? 0); replaceRoute({ filters: valid, sort: route.scope !== 'stable' && view.sort === 'rarest' ? 'recent' : view.sort, query: '', detail: null }); setViewsOpen(false); if (unavailable) pushToast('Some saved filters are unavailable') }} className="min-h-11 min-w-0 flex-1 truncate text-left font-semibold">{view.name}<span className="block text-[10px] font-bold text-ink-soft">{view.filters.length} filters · {titleCase(view.sort)}</span></button><button type="button" aria-label={`Delete ${view.name}`} onClick={() => void commit({ ...preferences, savedViews: preferences.savedViews.filter((candidate) => candidate.id !== view.id) }, 'Saved view deleted')} className="min-h-11 min-w-11 rounded-lg bg-danger/10 font-semibold text-danger"><CloseIcon size={20} className="mx-auto" /></button></div>)}</div><form onSubmit={(event) => submitNamed(event, 'view')} className="mt-3 flex gap-2"><input value={draftName} maxLength={40} onChange={(event) => setDraftName(event.target.value)} placeholder="Save current view" className="min-h-11 min-w-0 flex-1 rounded-sm bg-panel px-3 font-bold" /><button disabled={savedViews.length >= 20 || !draftName.trim()} className="min-h-11 rounded-sm bg-accent px-4 font-semibold text-white disabled:opacity-45">Save</button></form></div></BottomSheet>
    {route.scope !== 'stable' && preferences.showcaseGroups.length > 1 && <Panel>
      <h2 className="font-semibold">Showcase group settings</h2>
      <div className="mt-2 grid gap-2">{preferences.showcaseGroups.slice(1).map((group) => <div key={group.id} className="flex min-h-11 items-center gap-2 rounded-sm bg-panel px-2"><span className="min-w-0 flex-1 truncate text-sm font-bold">{group.name} · {group.awardRefs.length}</span><button type="button" onClick={() => { setDraftName(group.name ?? ''); setGroupAction({ id: group.id, mode: 'rename' }) }} className="min-h-11 px-2 text-xs font-semibold">Rename</button><button type="button" onClick={() => setGroupAction({ id: group.id, mode: 'delete' })} className="min-h-11 px-2 text-xs font-semibold text-danger">Delete</button></div>)}</div>
    </Panel>}

    {savedViews.length > 0 && <Panel>
      <h2 className="font-semibold">Saved view names</h2>
      <div className="mt-2 grid gap-2">{savedViews.map((view) => <div key={view.id} className="flex min-h-11 items-center gap-2 rounded-sm bg-panel px-2"><span className="min-w-0 flex-1 truncate text-sm font-bold">{view.name}</span><button type="button" onClick={() => { setDraftName(view.name); setViewRenameId(view.id) }} className="min-h-11 px-2 text-xs font-semibold">Rename</button></div>)}</div>
    </Panel>}

    <BottomSheet open={hiddenSelectionOpen} onClose={() => setHiddenSelectionOpen(false)}>
      <h2 className="text-xl font-semibold">Some selections are hidden</h2>
      <p className="mt-2 text-sm text-ink-soft">The current filters hide {[...selectedPins].filter((awardKey) => !visible.some((item) => item.awardKey === awardKey)).length} selected awards. Choose exactly what to pin.</p>
      <div className="mt-3 grid gap-2">
        <button type="button" onClick={() => commitBulkPin([...selectedPins])} className="min-h-11 rounded-sm bg-accent px-3 font-semibold text-white">Pin all {selectedPins.size} selections</button>
        <button type="button" onClick={() => { const refs = [...selectedPins].filter((awardKey) => visible.some((item) => item.awardKey === awardKey)); if (refs.length) commitBulkPin(refs); else { setSelectedPins(new Set()); setHiddenSelectionOpen(false) } }} className="min-h-11 rounded-sm bg-panel px-3 font-semibold">Drop hidden and pin visible</button>
      </div>
    </BottomSheet>

    <BottomSheet open={groupAction !== null} onClose={() => setGroupAction(null)}>
      {groupAction?.mode === 'rename' ? <form onSubmit={(event) => { event.preventDefault(); const groups = preferences.showcaseGroups.map((group) => group.id === groupAction.id ? { ...group, name: draftName } : group); void commit({ ...preferences, showcaseGroups: groups }, 'Group renamed').then(() => { setGroupAction(null); setDraftName('') }) }}><h2 className="text-xl font-semibold">Rename group</h2><input autoFocus value={draftName} maxLength={40} onChange={(event) => setDraftName(event.target.value)} className="mt-3 min-h-11 w-full rounded-sm bg-panel px-3 font-bold" /><button disabled={!draftName.trim()} className="mt-3 min-h-11 w-full rounded-sm bg-accent font-semibold text-white disabled:opacity-45">Save name</button></form> : groupAction && <div><h2 className="text-xl font-semibold">Delete this group?</h2><p className="mt-2 text-sm text-ink-soft">Choose what happens to its pins. This never deletes earned awards.</p><div className="mt-3 grid gap-2"><button type="button" onClick={() => { void commit({ ...preferences, showcaseGroups: removeShowcaseGroup(preferences.showcaseGroups, groupAction.id, 'move-to-default') }, 'Group deleted; pins moved to default').then(() => setGroupAction(null)) }} className="min-h-11 rounded-sm bg-accent px-3 font-semibold text-white">Move pins to default</button><button type="button" onClick={() => { void commit({ ...preferences, showcaseGroups: removeShowcaseGroup(preferences.showcaseGroups, groupAction.id, 'unpin') }, 'Group and pins removed').then(() => setGroupAction(null)) }} className="min-h-11 rounded-sm bg-danger/10 px-3 font-semibold text-danger">Unpin and delete</button></div></div>}
    </BottomSheet>

    <BottomSheet open={viewRenameId !== null} onClose={() => setViewRenameId(null)}>
      <form onSubmit={(event) => { event.preventDefault(); const savedViews = preferences.savedViews.map((view) => view.id === viewRenameId ? { ...view, name: draftName } : view); void commit({ ...preferences, savedViews }, 'Saved view renamed').then(() => { setViewRenameId(null); setDraftName('') }) }}><h2 className="text-xl font-semibold">Rename saved view</h2><input autoFocus value={draftName} maxLength={40} onChange={(event) => setDraftName(event.target.value)} className="mt-3 min-h-11 w-full rounded-sm bg-panel px-3 font-bold" /><button disabled={!draftName.trim()} className="mt-3 min-h-11 w-full rounded-sm bg-accent font-semibold text-white disabled:opacity-45">Save name</button></form>
    </BottomSheet>

    <BottomSheet open={titleOpen} onClose={() => setTitleOpen(false)}>
      <div className="max-h-[76dvh] overflow-y-auto">
        <h2 className="text-xl font-semibold">Active title</h2>
        <button type="button" onClick={() => { void commit({ ...preferences, activeTitleId: null }, 'Active title cleared'); setTitleOpen(false) }} className={`mt-3 min-h-11 w-full rounded-sm px-3 text-left font-semibold ${preferences.activeTitleId === null ? 'bg-accent text-ink' : 'bg-panel'}`}>No active title</button>
        <div className="mt-2 grid gap-2">{collection.items.filter((item) => item.kind === 'title' && item.tier !== null).map((item) => <button key={item.awardKey} type="button" onClick={() => { void commit({ ...preferences, activeTitleId: item.awardKey }, 'Active title updated'); setTitleOpen(false) }} className={`min-h-11 rounded-sm px-3 text-left font-semibold ${preferences.activeTitleId === item.awardKey ? 'bg-accent text-ink' : 'bg-panel'}`}>{item.label}</button>)}</div>
      </div>
    </BottomSheet>
  </div>
}
