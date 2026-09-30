// Stable Farm shell, field and management menus (docs/design/farm.md#screen-contract, T084).

import {
  FARM_GROWTH_MS,
  FARM_OUTFIT_LEVEL_REQUIREMENTS,
  FARM_PLOT_IDS,
  FARM_PLOT_LEVEL_REQUIREMENTS,
  FARMING_EXP_PER_HARVEST,
  SCENARIOS,
  farmingXpToNext,
  scenarioForTier,
  type FarmCropDefinition,
  type FarmCropId,
  type FarmPlotId,
  type StatKey,
} from '@racer/domain'
import { FARM_CROPS, farmCropById } from '@racer/domain/farm'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import type { UmaTemplate } from '@racer/domain'
import {
  FarmConflictError,
  getFarmHost,
  type FarmHarvestReceipt,
  type FarmView,
} from '../../game/farm/host'
import { farmPresentationClock, useFarmPresentationNow } from '../../game/farm/presentation-clock'
import { useFarmView } from '../../game/farm/useFarmView'
import {
  buildFarmHomeSummary,
  buildFarmWorkerRows,
  cropAvailability,
  farmPlantConfirmation,
  formatFarmRemaining,
  nextOutfitCropUnlock,
  presentedPlotStatus,
  type FarmWorkerRow,
} from '../../game/farm/view'
import { useGame } from '../../game/store'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Crest } from '../../ui/Crest'
import { Meter } from '../../ui/Meter'
import { PagedGuide, type PagedGuidePage } from '../../ui/PagedGuide'
import { Panel } from '../../ui/Panel'
import { Placeholder } from '../../ui/Placeholder'
import { ScreenState } from '../../ui/ScreenState'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { TypeIcon, TYPE_ICON_COLORS, type TypeIconKind } from '../../ui/TypeIcon'
import { useArt } from '../../ui/album/useArt'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LockedIcon,
  PlusIcon,
  QuestionIcon,
  StableIcon,
  StopwatchIcon,
} from '../../ui/icons'

const STATS: readonly StatKey[] = ['speed', 'stamina', 'power', 'guts', 'wit']
const FARM_NAV = [
  { to: '/farm', label: 'Field', end: true },
  { to: '/farm/workers', label: 'Workers' },
  { to: '/farm/crops', label: 'Crops' },
  { to: '/farm/items', label: 'Items' },
] as const

const GUIDE_PAGES: readonly PagedGuidePage<'assign' | 'wait' | 'harvest' | 'produce'>[] = [
  { id: 'assign', title: 'Build a farm crew', body: <GuideCard>Each plot keeps one owned Uma outfit as its worker. Outfits of the same character are separate workers with separate Farming Levels.</GuideCard> },
  { id: 'wait', title: 'Growth continues offline', body: <GuideCard>Plant an unlocked crop, then come back after twelve hours. Nothing withers, and a ready crop waits until you harvest it.</GuideCard> },
  { id: 'harvest', title: 'Learn with every harvest', body: <GuideCard>Harvesting adds one item and 12 Farming XP. Outfit levels combine into Farm Level, opening more plots and crop rows.</GuideCard> },
  { id: 'produce', title: 'Produce has a purpose', body: <GuideCard>Every crop belongs to one scenario and one stat. Items enter the global inventory for future constellation Produce nodes.</GuideCard> },
]

function GuideCard({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-white/15 bg-stage-soft p-5 text-[15px] leading-6 text-ink-on-dark-soft">{children}</div>
}

interface HarvestMoment {
  crop: FarmCropDefinition
  receipt: FarmHarvestReceipt
  outfitLevels: number[]
  farmLevels: number[]
}

interface FarmScreenContextValue {
  view: FarmView
  now: number
  templates: ReadonlyMap<string, UmaTemplate>
  workers: FarmWorkerRow[]
  busy: string | null
  message: string | null
  harvestMoment: HarvestMoment | null
  clearHarvestMoment: () => void
  assign: (plotId: FarmPlotId, templateId: string) => Promise<boolean>
  unassign: (plotId: FarmPlotId) => Promise<boolean>
  plant: (plotId: FarmPlotId, cropId: FarmCropId) => Promise<boolean>
  harvest: (plotId: FarmPlotId, cycleId: string) => Promise<boolean>
}

const FarmScreenContext = createContext<FarmScreenContextValue | null>(null)

function useFarmScreen(): FarmScreenContextValue {
  const context = useContext(FarmScreenContext)
  if (!context) throw new Error('Farm screen must be inside FarmShell')
  return context
}

const crossed = (before: number, after: number): number[] =>
  after > before ? Array.from({ length: after - before }, (_, index) => before + index + 1) : []

function useFarmScrollMemory() {
  const main = useRef<HTMLElement>(null)
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const previousPath = useRef(location.pathname)
  useLayoutEffect(() => {
    const element = main.current
    const previous = previousPath.current
    previousPath.current = location.pathname
    if (!element || previous === location.pathname) return
    positions.current.set(previous, element.scrollTop)
    element.scrollTop = navigationType === 'POP' || location.pathname === '/farm'
      ? positions.current.get(location.pathname) ?? 0
      : 0
  }, [location.pathname, navigationType])
  return { main, onScroll: () => {
    if (main.current) positions.current.set(location.pathname, main.current.scrollTop)
  } }
}

export function FarmShell() {
  const gameStatus = useGame((state) => state.status)
  const persistent = useGame((state) => state.persistent)
  const contentState = useContent()
  const now = useFarmPresentationNow()
  const { state, setView, reload } = useFarmView(gameStatus === 'ready')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [guide, setGuide] = useState(false)
  const [harvestMoment, setHarvestMoment] = useState<HarvestMoment | null>(null)
  const scroll = useFarmScrollMemory()
  const templates = contentState.status === 'ready' ? contentState.content.umas.byId : new Map<string, UmaTemplate>()
  const workers = useMemo(() => state.view ? buildFarmWorkerRows(
    state.view,
    [...templates.values()].filter((template) => state.view?.workers[template.id]).map((template) => ({
      id: template.id, name: template.name, outfit: template.outfit,
    })),
  ) : [], [state.view, templates])

  const explainFailure = async (reason: unknown): Promise<void> => {
    if (reason instanceof FarmConflictError) {
      await reload()
      setMessage('The Farm changed on another screen or device. Its latest state is shown.')
      return
    }
    setMessage(reason instanceof Error ? reason.message : 'The Farm action could not be completed')
  }

  const command = async (key: string, run: () => Promise<FarmView>): Promise<boolean> => {
    if (busy) return false
    setBusy(key)
    setMessage(null)
    try {
      const next = await run()
      farmPresentationClock.refresh()
      setView(next)
      return true
    } catch (reason) {
      await explainFailure(reason)
      return false
    } finally {
      setBusy(null)
    }
  }

  const value = state.view ? {
    view: state.view,
    now,
    templates,
    workers,
    busy,
    message,
    harvestMoment,
    clearHarvestMoment: () => setHarvestMoment(null),
    assign: (plotId: FarmPlotId, templateId: string) => command(`assign:${plotId}`,
      () => getFarmHost().assign({ plotId, templateId, expectedFarmVersion: state.view!.version })),
    unassign: (plotId: FarmPlotId) => command(`unassign:${plotId}`,
      () => getFarmHost().unassign({ plotId, expectedFarmVersion: state.view!.version })),
    plant: (plotId: FarmPlotId, cropId: FarmCropId) => command(`plant:${plotId}`,
      () => getFarmHost().plant({ plotId, cropId, expectedFarmVersion: state.view!.version })),
    harvest: async (plotId: FarmPlotId, cycleId: string) => {
      if (busy) return false
      const plot = state.view!.plots.find((candidate) => candidate.id === plotId)
      const templateId = plot?.templateId
      const crop = plot?.cycle ? farmCropById(plot.cycle.cropId) : null
      const outfitBefore = templateId ? state.view!.workers[templateId]?.level ?? 1 : 1
      const farmBefore = state.view!.farmLevel
      setBusy(`harvest:${plotId}`)
      setMessage(null)
      try {
        const receipt = await getFarmHost().harvest({ plotId, cycleId, expectedFarmVersion: state.view!.version })
        farmPresentationClock.refresh()
        setView(receipt.farm)
        if (crop) setHarvestMoment({ crop, receipt,
          outfitLevels: crossed(outfitBefore, receipt.outfitLevel), farmLevels: crossed(farmBefore, receipt.farmLevel) })
        return true
      } catch (reason) {
        if (reason instanceof FarmConflictError) {
          await explainFailure(reason)
          return false
        }
        const authoritative = await reload()
        const sameCycle = authoritative?.plots.find((candidate) => candidate.id === plotId)?.cycle?.id === cycleId
        if (authoritative && !sameCycle && crop && templateId) {
          const restored = authoritative.workers[templateId]?.level ?? outfitBefore
          setHarvestMoment({ crop, receipt: {
            cycleId, itemId: crop.id, quantity: authoritative.inventory[crop.id] ?? 0, templateId,
            outfitLevel: restored, farmLevel: authoritative.farmLevel, alreadyHarvested: true, farm: authoritative,
          }, outfitLevels: crossed(outfitBefore, restored), farmLevels: crossed(farmBefore, authoritative.farmLevel) })
          setMessage('Harvest restored from the authoritative save.')
          return true
        }
        await explainFailure(reason)
        return false
      } finally {
        setBusy(null)
      }
    },
  } satisfies FarmScreenContextValue : null

  const summary = state.view ? buildFarmHomeSummary(state.view, now) : null

  return (
    <div className="flex h-dvh flex-col bg-page text-ink">
      <header className="pt-safe shrink-0 border-b border-hairline bg-panel/95 px-3 shadow-1 backdrop-blur-lg">
        <div className="flex min-h-14 items-center gap-2">
          <Link to="/" aria-label="Back to Home" className="flex h-11 w-11 items-center justify-center rounded-sm text-ink-soft">
            <ChevronLeftIcon size={24} />
          </Link>
          <StableIcon size={24} variant="duotone" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-bold tracking-tight">Stable Farm</h1>
            <p className="truncate text-[11px] text-ink-soft">
              {summary ? `Farm Lv${summary.farmLevel} · ${summary.nextPlotUnlock}` : 'Opening the field…'}
            </p>
          </div>
          <button type="button" onClick={() => setGuide(true)} className="flex min-h-11 items-center gap-1 rounded-sm px-2 text-[12px] font-semibold text-accent-strong">
            <QuestionIcon size={20} /> How it works
          </button>
        </div>
        <nav aria-label="Farm" className="grid grid-cols-4 rounded-t-sm bg-sunken p-1">
          {FARM_NAV.map((item) => <NavLink key={item.to} to={item.to} end={'end' in item && item.end} className={({ isActive }) =>
            `flex min-h-10 items-center justify-center rounded-xs text-[12px] font-semibold ${isActive ? 'bg-panel text-ink shadow-1' : 'text-ink-soft'}`}>{item.label}</NavLink>)}
        </nav>
      </header>

      <main ref={scroll.main} onScroll={scroll.onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-safe">
        {!persistent && <p className="mb-3 rounded-sm border border-warning/40 bg-warning/10 p-3 text-[12px]">Memory only — this Farm lasts for this browser session.</p>}
        {message && <p role="status" className="mb-3 rounded-sm border border-accent/30 bg-accent/10 p-3 text-[13px]">{message}</p>}
        {state.status === 'loading' && <ScreenState title="Opening Stable Farm…" detail="Loading plots and workers." />}
        {state.status === 'error' && !state.view && <ScreenState title="Farm unavailable" detail={state.error} />}
        {value && <FarmScreenContext.Provider value={value}><Outlet /></FarmScreenContext.Provider>}
      </main>

      <PagedGuide open={guide} pages={GUIDE_PAGES} startAt="assign" titleId="farm-guide-title" finishLabel="Open the field" onClose={() => setGuide(false)} />
    </div>
  )
}

function CropMark({ crop, size = 48 }: { crop: FarmCropDefinition; size?: number }) {
  const color = TYPE_ICON_COLORS[crop.stat as TypeIconKind]
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} role="img" aria-label={`${crop.name}, ${crop.stat} produce`} className="shrink-0">
      <circle cx="28" cy="30" r="19" fill={color.top} stroke={color.rim} strokeWidth="3" />
      <path d="M27 14c-1-7 4-11 11-10-1 7-5 10-11 10Z" fill="#238958" />
      <path d="M27 15c-5-6-10-7-15-3 4 5 9 7 15 3Z" fill="#45aa67" />
      <path d="M20 27c4-5 12-5 16 0M19 35c5 4 13 4 18 0" fill="none" stroke={color.glyph} strokeWidth="3" strokeLinecap="round" opacity=".9" />
    </svg>
  )
}

function WorkerArt({ worker, className = '' }: { worker: FarmWorkerRow; className?: string }) {
  const contentState = useContent()
  const url = useArt(contentState.status === 'ready' ? contentState.content : null, 'chibi', `${worker.id}-a`)
  return <div className={`overflow-hidden bg-sunken ${className}`}>
    {url ? <img src={url} alt={`${worker.name}, ${worker.outfit ?? 'standard outfit'}, standing`} draggable={false} className="h-full w-full object-contain" />
      : <Placeholder label={`${worker.name} · ${worker.outfit ?? 'Standard outfit'}`} className="text-[9px]" />}
  </div>
}

function WorkerProgress({ worker }: { worker: FarmWorkerRow }) {
  const maximum = worker.xpToNext
  return <div>
    <div className="flex items-center justify-between text-[11px] text-ink-soft">
      <span>Farming Lv{worker.progress.level}</span>
      <span>{maximum === 0 ? 'MAX' : `${worker.progress.exp} / ${maximum} XP`}</span>
    </div>
    <div className="mt-1"><Meter value={maximum === 0 ? 1 : worker.progress.exp / maximum} color="var(--color-accent)" height={5} /></div>
  </div>
}

function OutfitPicker({ open, plotId, onClose }: { open: boolean; plotId: FarmPlotId | null; onClose: () => void }) {
  const farm = useFarmScreen()
  const current = plotId ? farm.view.plots.find((plot) => plot.id === plotId)?.templateId : null
  return <BottomSheet open={open} onClose={onClose}>
    <h2 className="font-display text-xl font-bold">Choose an outfit</h2>
    <p className="mt-1 text-[12px] text-ink-soft">Every owned outfit learns separately. A worker already on another plot stays there.</p>
    <div className="mt-3 grid gap-2">
      {farm.workers.map((worker) => {
        const elsewhere = worker.plotId !== null && worker.plotId !== plotId
        return <button key={worker.id} type="button" disabled={elsewhere || farm.busy !== null} onClick={() => {
          if (!plotId) return
          void farm.assign(plotId, worker.id).then((ok) => { if (ok) onClose() })
        }} className="flex min-h-20 items-center gap-3 rounded-sm border border-hairline bg-panel p-2 text-left shadow-1 disabled:opacity-45">
          <WorkerArt worker={worker} className="h-16 w-16 shrink-0 rounded-xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{worker.name}</span>
            <span className="block truncate text-[11px] text-ink-soft">{worker.outfit ?? 'Standard outfit'}</span>
            <span className="mt-1 block text-[11px] font-semibold text-accent-strong">Farming Lv{worker.progress.level}{worker.plotId ? ` · ${worker.plotId.replace('plot-', 'Plot ')}` : ' · Available'}</span>
          </span>
          {current === worker.id ? <Crest tone="accent">Current</Crest> : <ChevronRightIcon size={20} className="text-ink-faint" />}
        </button>
      })}
      {farm.workers.length === 0 && <p className="rounded-sm bg-sunken p-4 text-sm text-ink-soft">No owned outfits are available.</p>}
    </div>
  </BottomSheet>
}

function CropPicker({ open, plotId, onClose }: { open: boolean; plotId: FarmPlotId | null; onClose: () => void }) {
  const farm = useFarmScreen()
  const [stat, setStat] = useState<'all' | StatKey>('all')
  const [tier, setTier] = useState(1)
  const [selected, setSelected] = useState<FarmCropDefinition | null>(null)
  const plot = farm.view.plots.find((candidate) => candidate.id === plotId)
  const worker = farm.workers.find((candidate) => candidate.id === plot?.templateId)
  const crops = FARM_CROPS.filter((crop) => crop.scenarioTier === tier && (stat === 'all' || crop.stat === stat))
  const readyAt = farm.now + FARM_GROWTH_MS
  return <BottomSheet open={open} onClose={onClose}>
    <h2 className="font-display text-xl font-bold">Plant a crop</h2>
    <p className="mt-1 text-[12px] text-ink-soft">{worker ? `${worker.name} · Farming Lv${worker.progress.level}` : 'Assign an outfit first.'}</p>
    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
      <label className="text-[11px] font-semibold text-ink-soft">Scenario
        <select value={tier} onChange={(event) => { setTier(Number(event.target.value)); setSelected(null) }} className="mt-1 min-h-11 w-full rounded-sm border border-hairline-strong bg-panel px-2 text-[13px] text-ink">
          {SCENARIOS.map((scenario) => <option key={scenario.tier} value={scenario.tier}>{scenario.tier} · {scenario.name}</option>)}
        </select>
      </label>
      <div className="self-end"><Crest>Farm Lv{farm.view.farmLevel}</Crest></div>
    </div>
    <SegmentedControl className="mt-3" size="sm" label="Crop stat" value={stat} onChange={(value) => { setStat(value); setSelected(null) }} options={[
      { value: 'all', label: 'All' }, ...STATS.map((value) => ({ value, label: value.slice(0, 3).toUpperCase() })),
    ]} />
    <div className="mt-3 grid gap-2">
      {crops.map((crop) => {
        const availability = worker ? cropAvailability(crop, worker.progress, farm.view.farmLevel) : null
        const locked = !availability?.available
        const reason = availability && !availability.available
          ? [availability.farmLevelRequired ? `Farm Lv${availability.farmLevelRequired}` : null,
            availability.outfitLevelRequired ? `Outfit Lv${availability.outfitLevelRequired}` : null].filter(Boolean).join(' · ')
          : null
        return <button key={crop.id} type="button" disabled={locked} onClick={() => setSelected(crop)} className={`flex min-h-16 items-center gap-3 rounded-sm border p-2 text-left ${selected?.id === crop.id ? 'border-accent bg-accent/10' : 'border-hairline bg-panel'} disabled:opacity-45`}>
          <CropMark crop={crop} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">{crop.name}</span>
            <span className="flex items-center gap-1 text-[11px] text-ink-soft"><TypeIcon type={crop.stat} size={16} />{crop.stat} · {scenarioForTier(crop.scenarioTier)?.name}</span>
            {reason && <span className="block text-[10px] font-semibold text-danger">Locked: {reason}</span>}
          </span>
          <span className="text-[12px] font-semibold">×{farm.view.inventory[crop.id] ?? 0}</span>
        </button>
      })}
    </div>
    {selected && plotId && worker && <div className="sticky bottom-0 mt-3 rounded-md border border-accent/35 bg-panel p-3 shadow-3">
      <p className="text-[12px] leading-5">{farmPlantConfirmation({ workerName: worker.name, outfit: worker.outfit, crop: selected, plotId, readyAt })}</p>
      <Button className="mt-2 w-full" disabled={farm.busy !== null} onClick={() => void farm.plant(plotId, selected.id).then((ok) => { if (ok) onClose() })}>
        {farm.busy === `plant:${plotId}` ? 'Planting…' : `Plant ${selected.name}`}
      </Button>
    </div>}
  </BottomSheet>
}

function PlotPanel({ plotId, onAssign, onPlant, onDetail }: {
  plotId: FarmPlotId
  onAssign: (id: FarmPlotId) => void
  onPlant: (id: FarmPlotId) => void
  onDetail: (id: FarmPlotId) => void
}) {
  const farm = useFarmScreen()
  const plot = farm.view.plots.find((candidate) => candidate.id === plotId)!
  const status = presentedPlotStatus(plot, farm.view.farmLevel, farm.now)
  const number = FARM_PLOT_IDS.indexOf(plotId) + 1
  const worker = farm.workers.find((candidate) => candidate.id === plot.templateId)
  const crop = plot.cycle ? farmCropById(plot.cycle.cropId) : plot.lastCropId ? farmCropById(plot.lastCropId) : null
  const accessible = [`Plot ${number}`, worker ? `${worker.name}, ${worker.outfit ?? 'standard outfit'}` : 'no worker',
    crop ? `${crop.name}, ${crop.stat}, ${scenarioForTier(crop.scenarioTier)?.name ?? `scenario ${crop.scenarioTier}`}` : 'no crop', status,
    plot.cycle ? formatFarmRemaining(plot.cycle.readyAt, farm.now) : ''].filter(Boolean).join(', ')
  if (status === 'locked') return <Panel aria-label={accessible} className="flex min-h-44 flex-col items-center justify-center border-dashed bg-sunken/60 text-center">
    <LockedIcon size={32} className="text-ink-faint" />
    <p className="mt-2 font-display text-sm font-bold">Plot {number}</p>
    <p className="text-[11px] text-ink-soft">Opens at Farm Lv{FARM_PLOT_LEVEL_REQUIREMENTS[number - 1]}</p>
  </Panel>
  if (status === 'unassigned') return <Panel aria-label={accessible} className="flex min-h-44 flex-col items-center justify-between text-center">
    <div><p className="text-micro">Plot {number} · Unassigned</p><div className="mx-auto mt-2 h-10 w-20 rounded-[50%] border-2 border-dashed border-[#8b6847] bg-[#d6b080]/55" aria-hidden /></div>
    <Button size="sm" className="mt-3 w-full" onClick={() => onAssign(plotId)}><PlusIcon size={16} />Assign outfit</Button>
  </Panel>
  if (!worker) return <Panel aria-label={accessible} className="min-h-44"><p className="text-sm text-danger">Saved worker content is unavailable. The assignment is preserved.</p></Panel>
  const progress = plot.cycle ? Math.max(0, Math.min(1, (farm.now - plot.cycle.plantedAt) / (plot.cycle.readyAt - plot.cycle.plantedAt))) : 0
  return <Panel aria-label={accessible} className={`relative min-h-56 overflow-hidden p-2 ${status === 'ready' ? 'border-accent-strong shadow-2' : ''}`}>
    <div className="flex items-start justify-between gap-1"><p className="text-micro">Plot {number} · {status === 'ready' ? 'Ready' : status === 'growing' ? 'Growing' : 'Idle'}</p><Crest>Lv{worker.progress.level}</Crest></div>
    <div className="mt-1 flex gap-2">
      <WorkerArt worker={worker} className="h-20 w-16 shrink-0 rounded-xs" />
      <div className="min-w-0 flex-1 pt-1">
        <p className="truncate text-[13px] font-semibold">{worker.name}</p>
        <p className="truncate text-[10px] text-ink-soft">{worker.outfit ?? 'Standard outfit'}</p>
        {crop && <div className="mt-1 flex items-center gap-1"><CropMark crop={crop} size={28} /><span className="truncate text-[11px]">{crop.name}</span></div>}
      </div>
    </div>
    {status === 'idle' ? <div className="mt-2 grid grid-cols-2 gap-1">
      <Button size="sm" className="col-span-2" disabled={farm.busy !== null} onClick={() => onPlant(plotId)}>Plant{crop ? ' again' : ''}</Button>
      <button type="button" disabled={farm.busy !== null} onClick={() => onAssign(plotId)} className="min-h-11 rounded-sm px-1 text-[11px] font-semibold text-ink-soft disabled:opacity-45">Change</button>
      <button type="button" disabled={farm.busy !== null} onClick={() => void farm.unassign(plotId)} className="min-h-11 rounded-sm px-1 text-[11px] font-semibold text-danger disabled:opacity-45">Remove</button>
    </div> : <>
      <div className="mt-2"><Meter value={status === 'ready' ? 1 : progress} color="var(--color-accent)" height={6} /></div>
      <p className="mt-1 text-center text-[11px] font-semibold">{formatFarmRemaining(plot.cycle!.readyAt, farm.now)}</p>
      {status === 'ready' ? <Button size="sm" className="mt-2 w-full" disabled={farm.busy !== null} onClick={() => void farm.harvest(plotId, plot.cycle!.id)}>
        {farm.busy === `harvest:${plotId}` ? 'Harvesting…' : 'Harvest +1'}
      </Button> : <button type="button" onClick={() => onDetail(plotId)} className="mt-1 min-h-11 w-full text-[11px] font-semibold text-accent-strong">Details</button>}
    </>}
  </Panel>
}

export function FarmFieldScreen() {
  const farm = useFarmScreen()
  const reducedMotion = useReducedMotion()
  const [assignPlot, setAssignPlot] = useState<FarmPlotId | null>(null)
  const [cropPlot, setCropPlot] = useState<FarmPlotId | null>(null)
  const [detailPlot, setDetailPlot] = useState<FarmPlotId | null>(null)
  const detail = farm.view.plots.find((plot) => plot.id === detailPlot)
  const detailCrop = detail?.cycle ? farmCropById(detail.cycle.cropId) : null
  const detailWorker = farm.workers.find((worker) => worker.id === detail?.templateId)
  const summary = buildFarmHomeSummary(farm.view, farm.now)
  return <div className="pb-4">
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <div><p className="font-display text-lg font-bold">Your field</p><p className="text-[11px] text-ink-soft">{summary.ready} ready · {summary.working} working · {summary.unlocked}/6 open</p></div>
      <Crest tone={summary.ready > 0 ? 'accent' : 'neutral'}>{summary.deadlineLabel}</Crest>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {FARM_PLOT_IDS.map((plotId) => <PlotPanel key={plotId} plotId={plotId} onAssign={setAssignPlot} onPlant={setCropPlot} onDetail={setDetailPlot} />)}
    </div>
    <OutfitPicker open={assignPlot !== null} plotId={assignPlot} onClose={() => setAssignPlot(null)} />
    <CropPicker open={cropPlot !== null} plotId={cropPlot} onClose={() => setCropPlot(null)} />
    <BottomSheet open={detailPlot !== null} onClose={() => setDetailPlot(null)}>
      <h2 className="font-display text-xl font-bold">Growing details</h2>
      {detail?.cycle && detailCrop && detailWorker && <div className="mt-3 grid gap-3">
        <div className="flex items-center gap-3"><CropMark crop={detailCrop} /><div><p className="font-semibold">{detailCrop.name} · {detailCrop.stat}</p><p className="text-[12px] text-ink-soft">For {scenarioForTier(detailCrop.scenarioTier)?.name}</p></div></div>
        <dl className="grid gap-2 rounded-sm bg-sunken p-3 text-[13px]">
          <div className="flex justify-between gap-3"><dt>Worker</dt><dd className="text-right font-semibold">{detailWorker.name} · {detailWorker.outfit ?? 'Standard outfit'}</dd></div>
          <div className="flex justify-between gap-3"><dt>Planted</dt><dd className="text-right font-semibold">{new Date(detail.cycle.plantedAt).toLocaleString()}</dd></div>
          <div className="flex justify-between gap-3"><dt>Ready</dt><dd className="text-right font-semibold">{new Date(detail.cycle.readyAt).toLocaleString()}</dd></div>
          <div className="flex justify-between gap-3"><dt>Remaining</dt><dd className="text-right font-semibold">{formatFarmRemaining(detail.cycle.readyAt, farm.now)}</dd></div>
        </dl>
        <p className="text-[12px] text-ink-soft">This crop cannot be cancelled or edited. It will wait safely when ready.</p>
      </div>}
    </BottomSheet>
    <AnimatePresence>
      {farm.harvestMoment && <m.div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end bg-ink/45 p-3 pb-safe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <m.div className="w-full rounded-lg border border-accent/40 bg-panel p-5 text-center shadow-3" initial={reducedMotion ? false : { y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: reducedMotion ? 0 : .24 }}>
          <CropMark crop={farm.harvestMoment.crop} size={66} />
          <h2 className="font-display mt-1 text-xl font-bold">+1 {farm.harvestMoment.crop.name}</h2>
          <p className="text-[13px] text-ink-soft">Now {farm.harvestMoment.receipt.quantity} in Items · +{FARMING_EXP_PER_HARVEST} Farming XP</p>
          {farm.harvestMoment.outfitLevels.map((level) => <p key={`outfit-${level}`} className="mt-2 font-semibold text-accent-strong">Farming Level {level} reached</p>)}
          {farm.harvestMoment.farmLevels.map((level) => <p key={`farm-${level}`} className="font-semibold text-accent-strong">Farm Level {level} reached</p>)}
          <Button className="mt-4 w-full" onClick={farm.clearHarvestMoment}>Back to field</Button>
        </m.div>
      </m.div>}
    </AnimatePresence>
  </div>
}

function WorkerRoster({ onAssign }: { onAssign: (worker: FarmWorkerRow) => void }) {
  const farm = useFarmScreen()
  const groups = [
    { label: 'Working', workers: farm.workers.filter((worker) => worker.plotId !== null) },
    { label: 'Available', workers: farm.workers.filter((worker) => worker.plotId === null) },
  ]
  return <div className="grid gap-4">{groups.map((group) => <section key={group.label}>
    <h2 className="text-micro mb-2 px-1">{group.label} · {group.workers.length}</h2>
    <div className="grid gap-2">{group.workers.map((worker) => <Panel key={worker.id} className="p-2">
      <div className="flex items-center gap-3"><WorkerArt worker={worker} className="h-20 w-16 shrink-0 rounded-xs" /><div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{worker.name}</p><p className="truncate text-[11px] text-ink-soft">{worker.outfit ?? 'Standard outfit'}{worker.plotId ? ` · ${worker.plotId.replace('plot-', 'Plot ')}` : ''}</p>
        <div className="mt-2"><WorkerProgress worker={worker} /></div>
        <p className="mt-1 text-[10px] text-ink-faint">{nextOutfitCropUnlock(worker.progress.level)}</p>
      </div></div>
      {worker.plotId === null && <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => onAssign(worker)}>Choose a plot</Button>}
    </Panel>)}</div>
  </section>)}</div>
}

export function FarmWorkersScreen() {
  const farm = useFarmScreen()
  const [assigning, setAssigning] = useState<FarmWorkerRow | null>(null)
  const availablePlots = farm.view.plots.filter((plot) => {
    const status = presentedPlotStatus(plot, farm.view.farmLevel, farm.now)
    return status === 'unassigned' || status === 'idle'
  })
  return <div className="pb-4"><div className="mb-3 px-1"><h2 className="font-display text-lg font-bold">Farm workers</h2><p className="text-[12px] text-ink-soft">Every owned outfit appears separately and keeps its own level.</p></div>
    <WorkerRoster onAssign={setAssigning} />
    <BottomSheet open={assigning !== null} onClose={() => setAssigning(null)}>
      <h2 className="font-display text-xl font-bold">Choose a plot</h2><p className="mt-1 text-[12px] text-ink-soft">Assign {assigning?.name} · {assigning?.outfit ?? 'Standard outfit'}.</p>
      <div className="mt-3 grid gap-2">{availablePlots.map((plot) => <Button key={plot.id} variant="secondary" disabled={farm.busy !== null} onClick={() => {
        if (!assigning) return
        void farm.assign(plot.id, assigning.id).then((ok) => { if (ok) setAssigning(null) })
      }}>{plot.id.replace('plot-', 'Plot ')} · {plot.templateId ? 'Replace idle worker' : 'Open'}</Button>)}</div>
      {availablePlots.length === 0 && <p className="mt-3 rounded-sm bg-sunken p-3 text-sm text-ink-soft">No unlocked idle plot is available.</p>}
    </BottomSheet>
  </div>
}

export function FarmCropsScreen() {
  const farm = useFarmScreen()
  const [stat, setStat] = useState<'all' | StatKey>('all')
  const [tier, setTier] = useState<'all' | number>('all')
  const [workerId, setWorkerId] = useState(farm.workers[0]?.id ?? '')
  const [pickingWorker, setPickingWorker] = useState(false)
  const worker = farm.workers.find((candidate) => candidate.id === workerId) ?? farm.workers[0]
  const crops = FARM_CROPS.filter((crop) => (stat === 'all' || crop.stat === stat) && (tier === 'all' || crop.scenarioTier === tier))
  return <div className="pb-4"><div className="mb-3 px-1"><h2 className="font-display text-lg font-bold">Crop catalog</h2><p className="text-[12px] text-ink-soft">70 crops · five stats across fourteen scenarios.</p></div>
    <button type="button" onClick={() => setPickingWorker(true)} className="mb-3 flex min-h-12 w-full items-center justify-between rounded-sm border border-hairline bg-panel px-3 text-left shadow-1">
      <span><span className="text-micro block">Check outfit requirements</span><span className="text-[13px] font-semibold">{worker ? `${worker.name} · Farming Lv${worker.progress.level}` : 'No owned outfit'}</span></span><ChevronRightIcon size={20} />
    </button>
    <div className="grid grid-cols-2 gap-2">
      <label className="text-[11px] font-semibold text-ink-soft">Scenario<select value={tier} onChange={(event) => setTier(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-sm border border-hairline-strong bg-panel px-2 text-[13px] text-ink"><option value="all">All scenarios</option>{SCENARIOS.map((scenario) => <option key={scenario.tier} value={scenario.tier}>{scenario.tier} · {scenario.name}</option>)}</select></label>
      <label className="text-[11px] font-semibold text-ink-soft">Stat<select value={stat} onChange={(event) => setStat(event.target.value as 'all' | StatKey)} className="mt-1 min-h-11 w-full rounded-sm border border-hairline-strong bg-panel px-2 text-[13px] text-ink"><option value="all">All stats</option>{STATS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    <div className="mt-3 grid gap-2">{crops.map((crop) => {
      const availability = worker ? cropAvailability(crop, worker.progress, farm.view.farmLevel) : null
      return <Panel key={crop.id} className="flex items-center gap-3 p-2"><CropMark crop={crop} size={46} /><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold">{crop.name}</p><p className="flex items-center gap-1 text-[11px] text-ink-soft"><TypeIcon type={crop.stat} size={16} />{scenarioForTier(crop.scenarioTier)?.name} · {crop.stat}</p><p className={`mt-1 text-[10px] font-semibold ${availability?.available ? 'text-accent-strong' : 'text-danger'}`}>{availability?.available ? 'Ready to plant' : `Farm Lv${crop.farmLevelRequired} · Outfit Lv${crop.outfitLevelRequired}`}</p></div><span className="text-[12px] font-semibold">×{farm.view.inventory[crop.id] ?? 0}</span></Panel>
    })}</div>
    <BottomSheet open={pickingWorker} onClose={() => setPickingWorker(false)}><h2 className="font-display text-xl font-bold">Check crop access</h2><div className="mt-3 grid gap-2">{farm.workers.map((entry) => <button key={entry.id} type="button" onClick={() => { setWorkerId(entry.id); setPickingWorker(false) }} className="flex min-h-14 items-center justify-between rounded-sm border border-hairline bg-panel px-3 text-left"><span><span className="block text-[13px] font-semibold">{entry.name}</span><span className="block text-[11px] text-ink-soft">{entry.outfit ?? 'Standard outfit'} · Farming Lv{entry.progress.level}</span></span>{entry.id === worker?.id && <Crest tone="accent">Selected</Crest>}</button>)}</div></BottomSheet>
  </div>
}

export function FarmItemsPlaceholderScreen() {
  const farm = useFarmScreen()
  const total = Object.values(farm.view.inventory).reduce((sum, quantity) => sum + quantity, 0)
  return <div className="pb-4"><Panel className="text-center"><CropMark crop={FARM_CROPS[0]!} size={64} /><h2 className="font-display mt-2 text-lg font-bold">Global Items</h2><p className="mt-1 text-[13px] text-ink-soft">{total} harvested item{total === 1 ? '' : 's'} are safely stored. The complete inventory browser arrives in the next Farm task.</p><Link to="/farm" className="mt-4 inline-flex min-h-11 items-center gap-1 font-semibold text-accent-strong">Return to Field <ChevronRightIcon size={20} /></Link></Panel></div>
}
