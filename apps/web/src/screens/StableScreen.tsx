import { DISTANCE_CATEGORIES, STATS, STRATEGIES, SURFACES, type StatKey } from '@racer/domain'
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router'
import { useContent } from '../content/ContentProvider'
import {
  EMPTY_UMA_FILTERS,
  filterAndSortUmas,
  joinUma,
  type UmaFilters,
  type UmaSort,
  type UmaViewModel,
} from '../game/view'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BottomSheet } from '../ui/BottomSheet'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'

const FILTER_LABELS = {
  tier: 'Tier',
  surface: 'Surface',
  distance: 'Distance',
  strategy: 'Strategy',
  ready: 'Ready',
} as const

type FilterKind = keyof typeof FILTER_LABELS

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const statLabel = (stat: StatKey) => (stat === 'wit' ? 'Wit' : titleCase(stat))

function Tile({ uma, onPeek }: { uma: UmaViewModel; onPeek: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peeked = useRef(false)
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const start = () => {
    cancel()
    peeked.current = false
    timer.current = setTimeout(() => {
      peeked.current = true
      onPeek()
    }, 500)
  }
  const blockAfterPeek = (event: ReactPointerEvent | React.MouseEvent) => {
    cancel()
    if (peeked.current) {
      event.preventDefault()
    }
  }

  return (
    <article className="relative min-w-0 overflow-hidden rounded-[1.25rem] border-2 border-white bg-white/95 shadow-[var(--shadow-panel)]">
      <Link
        to={`/stable/${encodeURIComponent(uma.save.templateId)}`}
        className="block"
        onPointerDown={start}
        onPointerUp={blockAfterPeek}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => {
          if (peeked.current) {
            event.preventDefault()
            peeked.current = false
          }
        }}
      >
        <div className="relative bg-gradient-to-b from-sky-100 to-white p-2">
          <AtlasSprite
            asset={uma.asset}
            alt={`${uma.template.name} icon`}
            className="w-full rounded-xl bg-sky-50"
            fallback={<div className="flex h-full items-center justify-center text-4xl" aria-hidden>🐴</div>}
          />
          <span className="absolute top-3 left-3 rounded-full bg-ink/75 px-2 py-0.5 text-xs font-extrabold text-white">
            T{uma.tier}
          </span>
          {uma.readyToPromote && (
            <span className="absolute right-2 bottom-2 rounded-full bg-gold px-2 py-1 text-[11px] font-extrabold text-white text-outline">
              Ready!
            </span>
          )}
        </div>
        <div className="px-3 pt-2">
          <p className="truncate font-extrabold">{uma.template.name}</p>
          <p className="truncate text-xs text-ink-soft">{uma.template.outfit ?? 'Standard outfit'}</p>
          <div className="mt-2 flex items-center justify-between text-xs font-extrabold">
            <span>Uma Lv {uma.save.level}</span>
            <span>TL {uma.save.trainingLevel}</span>
          </div>
          <p className="mt-1 truncate text-[11px] font-bold text-sky-deep">{uma.scenario?.name ?? `Scenario tier ${uma.tier}`}</p>
        </div>
      </Link>
      <div className="p-3 pt-2">
        <button
          type="button"
          className="min-h-11 w-full rounded-xl border-2 border-sky/20 bg-sky/10 px-2 text-sm font-extrabold text-sky-deep"
          onClick={onPeek}
        >
          Quick view
        </button>
      </div>
    </article>
  )
}

function OptionButton({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`min-h-12 rounded-2xl border-2 px-4 text-left font-extrabold ${
        selected ? 'border-sky bg-sky text-white text-outline' : 'border-white bg-white text-ink shadow-sm'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function StableScreen() {
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const error = useGame((state) => state.error)
  const persistent = useGame((state) => state.persistent)
  const owned = useGame((state) => state.umas)
  const orphaned = useGame((state) => state.orphanedUmaIds)
  const [filters, setFilters] = useState<UmaFilters>(EMPTY_UMA_FILTERS)
  const [sort, setSort] = useState<UmaSort>('name')
  const [filterSheet, setFilterSheet] = useState<FilterKind | null>(null)
  const [sortOpen, setSortOpen] = useState(false)
  const [peek, setPeek] = useState<UmaViewModel | null>(null)

  const views = useMemo(() => {
    if (contentState.status !== 'ready') return []
    return Object.values(owned).flatMap((save) => {
      const joined = joinUma(save, contentState.content)
      return joined.status === 'ready' ? [joined.value] : []
    })
  }, [contentState, owned])
  const shown = useMemo(() => filterAndSortUmas(views, filters, sort), [filters, sort, views])
  const tiers = useMemo(() => [...new Set(views.map((uma) => uma.tier))].sort((a, b) => a - b), [views])

  if (contentState.status === 'signed-out' || status === 'signed-out') {
    return <ScreenState title="Sign in to open your Stable" detail="Your private roster stays behind your account." action={{ label: 'Open Settings', to: '/settings' }} />
  }
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish a private content version before creating a save." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={error ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready') return <ScreenState title="Opening your Stable…" detail="Loading private content and your local save." />

  const activeLabel = (kind: FilterKind): string => {
    if (kind === 'ready') return filters.ready ? 'Ready only' : 'All readiness'
    const value = filters[kind]
    return value === null ? 'All' : kind === 'tier' ? `Tier ${value}` : titleCase(String(value))
  }
  const reset = () => setFilters(EMPTY_UMA_FILTERS)
  const options = (() => {
    if (filterSheet === 'tier') return tiers.map((value) => ({ value, label: `Tier ${value}` }))
    if (filterSheet === 'surface') return SURFACES.map((value) => ({ value, label: titleCase(value) }))
    if (filterSheet === 'distance') return DISTANCE_CATEGORIES.map((value) => ({ value, label: titleCase(value) }))
    if (filterSheet === 'strategy') return STRATEGIES.map((value) => ({ value, label: titleCase(value) }))
    return []
  })()

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-end justify-between px-1">
        <div>
          <h1 className="text-2xl font-extrabold text-white text-outline">Stable</h1>
          <p className="text-sm font-bold text-ink-soft">{Object.keys(owned).length} owned Umas</p>
        </div>
        <button type="button" className="min-h-11 rounded-2xl bg-white/90 px-4 text-sm font-extrabold shadow-sm" onClick={() => setSortOpen(true)}>
          Sort ↕
        </button>
      </div>

      {!persistent && <Panel className="border-amber-300 bg-amber-50 py-3 text-sm font-bold">Memory only — changes will not survive a reload or sync.</Panel>}
      {orphaned.length > 0 && <Panel className="py-3 text-sm font-bold">{orphaned.length} owned Uma record{orphaned.length === 1 ? '' : 's'} are waiting for matching content.</Panel>}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Stable filters">
        {(Object.keys(FILTER_LABELS) as FilterKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            className={`min-h-11 shrink-0 rounded-full border-2 px-3 text-sm font-extrabold ${
              activeLabel(kind).startsWith('All') ? 'border-white bg-white/85' : 'border-sky bg-sky text-white text-outline'
            }`}
            onClick={() => {
              if (kind === 'ready') setFilters((current) => ({ ...current, ready: !current.ready }))
              else setFilterSheet(kind)
            }}
          >
            {FILTER_LABELS[kind]}: {activeLabel(kind)}
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((uma) => <Tile key={uma.save.templateId} uma={uma} onPeek={() => setPeek(uma)} />)}
        </div>
      ) : (
        <Panel className="text-center">
          <p className="font-extrabold">No owned Umas match these filters.</p>
          <button type="button" className="mt-3 min-h-11 rounded-2xl bg-sky px-5 font-extrabold text-white text-outline" onClick={reset}>Reset filters</button>
        </Panel>
      )}

      <BottomSheet open={filterSheet !== null} onClose={() => setFilterSheet(null)}>
        {filterSheet && (
          <div>
            <h2 className="mb-3 text-xl font-extrabold">{FILTER_LABELS[filterSheet]}</h2>
            {filterSheet === 'ready' ? null : (
              <div className="grid gap-2">
                <OptionButton
                  selected={filters[filterSheet] === null}
                  label="All"
                  onClick={() => {
                    setFilters((current) => ({ ...current, [filterSheet]: null }))
                    setFilterSheet(null)
                  }}
                />
                {options.map((option) => (
                  <OptionButton
                    key={String(option.value)}
                    selected={filters[filterSheet] === option.value}
                    label={option.label}
                    onClick={() => {
                      setFilters((current) => ({ ...current, [filterSheet]: option.value }))
                      setFilterSheet(null)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)}>
        <h2 className="mb-3 text-xl font-extrabold">Sort Stable</h2>
        <div className="grid gap-2">
          {([
            ['name', 'Name'],
            ['uma-level', 'Uma Level'],
            ['training-level', 'Training Level'],
          ] as const).map(([value, label]) => (
            <OptionButton key={value} selected={sort === value} label={label} onClick={() => { setSort(value); setSortOpen(false) }} />
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={peek !== null} onClose={() => setPeek(null)}>
        {peek && (
          <div>
            <div className="flex items-center gap-3">
              <AtlasSprite asset={peek.asset} alt={`${peek.template.name} icon`} className="h-20 w-20 shrink-0 rounded-2xl bg-sky-50" fallback={<div className="flex h-full items-center justify-center text-3xl">🐴</div>} />
              <div className="min-w-0">
                <h2 className="truncate text-xl font-extrabold">{peek.template.name}</h2>
                <p className="text-sm font-bold text-ink-soft">Uma Lv {peek.save.level} · TL {peek.save.trainingLevel}</p>
                <p className="text-sm text-sky-deep">{peek.scenario?.name ?? `Tier ${peek.tier}`}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-1">
              {STATS.map((stat) => (
                <div key={stat} className="rounded-xl bg-white p-2 text-center">
                  <p className="text-[10px] font-bold text-ink-soft">{statLabel(stat)}</p>
                  <p className="font-extrabold">{peek.save.stats[stat]}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm font-bold text-ink-soft">
              A/S strengths: {[...SURFACES.map((key) => [titleCase(key), peek.save.aptitudes.surface[key]] as const), ...DISTANCE_CATEGORIES.map((key) => [titleCase(key), peek.save.aptitudes.distance[key]] as const), ...STRATEGIES.map((key) => [titleCase(key), peek.save.aptitudes.strategy[key]] as const)].filter(([, grade]) => grade === 'A' || grade === 'S').map(([label, grade]) => `${label} ${grade}`).join(' · ') || 'None yet'}
            </p>
            <Link to={`/stable/${encodeURIComponent(peek.save.templateId)}`} className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-sky px-5 font-extrabold text-white text-outline">Open profile</Link>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
