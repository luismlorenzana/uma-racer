// Five-district phone Farm, cookbook, planner and Items. Gameplay writes go only through FarmKitchenHost (T122).
import {
  FARM_DISTRICTS,
  FARM_KITCHEN_CATALOGUE,
  FARM_KITCHEN_ENERGY_ID,
  FARM_KITCHEN_ENERGY_MS,
  FARM_KITCHEN_EXP_PER_JOB,
  FARM_KITCHEN_JOB_MS,
  type FarmDistrict,
  type FarmKitchenJob,
  type FarmRecipe,
  type FarmStationId,
} from '@racer/domain/farm/kitchen'
import { useEffect, useMemo, useState, createContext, useContext, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { useStore } from 'zustand'
import type { LoadedContent } from '../../content/runtime'
import type { RacerDb } from '../../game/db'
import type { FarmKitchenHost, FarmMutation } from '../../game/farm/kitchen/host'
import {
  FARM_DISTRICT_PRESENTATION,
  buildFarmCrew,
  buildFarmDistrictSummaries,
  formatFarmTime,
  ingredientChoices,
  maxSuppliedBatch,
  planFarmWishlist,
  recipeAvailability,
  repeatedIngredientChoices,
  spendableStock,
  type FarmCrewRow,
  type FarmWorkerLabel,
} from '../../game/farm/kitchen/presentation'
import {
  DEFAULT_FARM_KITCHEN_PREFERENCES,
  loadFarmKitchenPreferences,
  saveFarmKitchenPreferences,
  type FarmKitchenPreferences,
} from '../../game/farm/kitchen/preferences'
import { createFarmKitchenStore, observeFarmKitchen, publishFarmKitchenView, type FarmKitchenStore } from '../../game/farm/kitchen/store'
import type { FarmKitchenView } from '../../game/farm/kitchen/view'
import { farmKitchenItemDefinitions } from '../../game/items/view'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Crest } from '../../ui/Crest'
import { Meter } from '../../ui/Meter'
import { Panel } from '../../ui/Panel'
import { Placeholder } from '../../ui/Placeholder'
import { ScreenState } from '../../ui/ScreenState'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { useArt } from '../../ui/album/useArt'
import { FarmDistrictSign, FarmFoodMark } from '../../ui/farm/FarmKitchenMarks'
import { ChevronLeftIcon, ChevronRightIcon, QuestionIcon, RetryIcon, StopwatchIcon } from '../../ui/icons'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'
import { FarmKitchenGuide, farmKitchenGuideMemory, type FarmGuidePage } from './FarmKitchenGuide'

export interface FarmKitchenEnvironment {
  database: RacerDb
  host: FarmKitchenHost
  workers: readonly FarmWorkerLabel[]
  content: LoadedContent | null
  isolated: boolean
  root: string
  ownerDebugAllowed: boolean
  advanceProofClock?: (ms: number) => void
}
interface KitchenContextValue {
  environment: FarmKitchenEnvironment
  store: FarmKitchenStore
  view: FarmKitchenView
  crew: FarmCrewRow[]
  preferences: FarmKitchenPreferences
  setPreferences: (next: FarmKitchenPreferences) => void
  busy: string | null
  message: string | null
  claim: { mutation: FarmMutation; job: FarmKitchenJob } | null
  clearClaim: () => void
  action: (key: string, run: (intentId: string, view: FarmKitchenView) => Promise<FarmMutation>) => Promise<FarmMutation | null>
  showGuide: (page?: FarmGuidePage) => void
}
const KitchenContext = createContext<KitchenContextValue | null>(null)
const useKitchen = () => {
  const value = useContext(KitchenContext)
  if (!value) throw new Error('Farm kitchen screen must be inside its shell')
  return value
}
const path = (environment: FarmKitchenEnvironment, child = '') => `${environment.root}${child}`

function WorkerPortrait({ worker, size = 'h-14 w-14' }: { worker: FarmWorkerLabel; size?: string }) {
  const farm = useKitchen(), art = useArt(farm.environment.content, 'chibi', farm.environment.isolated ? null : `${worker.id}-a`)
  return <div className={`${size} shrink-0 overflow-hidden rounded-md border border-hairline bg-sunken`}>
    {art ? <img src={art} alt={`${worker.name}, ${worker.outfit ?? 'standard outfit'}`} className="h-full w-full object-contain" draggable={false} />
      : <Placeholder label={farm.environment.isolated ? 'Invented Uma silhouette' : worker.name} className="text-[8px]" />}
  </div>
}

function useKitchenPreferences(environment: FarmKitchenEnvironment) {
  const [preferences, setLocal] = useState(DEFAULT_FARM_KITCHEN_PREFERENCES)
  useEffect(() => { let live = true; void loadFarmKitchenPreferences(environment.database).then(value => { if (live) setLocal(value) }); return () => { live = false } }, [environment])
  const setPreferences = (next: FarmKitchenPreferences) => { setLocal(next); void saveFarmKitchenPreferences(environment.database, next) }
  return [preferences, setPreferences] as const
}

export function FarmKitchenCommonShell({ environment }: { environment: FarmKitchenEnvironment }) {
  const store = useMemo(createFarmKitchenStore, [environment])
  const state = useStore(store)
  const [preferences, setPreferences] = useKitchenPreferences(environment)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [claim, setClaim] = useState<{ mutation: FarmMutation; job: FarmKitchenJob } | null>(null)
  const [guide, setGuide] = useState<{ open: boolean; page: FarmGuidePage }>({ open: false, page: 'crew' })
  const location = useLocation(), fixedField = location.pathname.includes('/district/')
  useEffect(() => observeFarmKitchen(environment.host, environment.database, store), [environment, store])
  const view = state.view
  useEffect(() => {
    if (!claim || claim.mutation.status !== 'pending') return
    let live = true
    void environment.host.read({ operationIds: [claim.mutation.operationId] }).then(current => {
      if (!live) return
      const receipt = current.receipts[claim.mutation.operationId]
      if (receipt) {
        setClaim(previous => previous?.mutation.operationId === claim.mutation.operationId
          ? { ...previous, mutation: { ...previous.mutation, status: 'applied', receipt, view: current } } : previous)
        setMessage('Collected')
      } else {
        const pending = current.pending.find(row => row.id === claim.mutation.operationId)
        if (pending && pending.status !== 'pending') { setClaim(null); setMessage(pending.reason ?? 'The claim needs attention') }
      }
    }).catch(reason => { if (live) setMessage(reason instanceof Error ? reason.message : 'Could not read the claim result') })
    return () => { live = false }
  }, [environment, claim?.mutation.operationId, claim?.mutation.status, view?.revision.pending])
  const crew = useMemo(() => view ? buildFarmCrew(view, environment.workers) : [], [environment.workers, view])
  const action: KitchenContextValue['action'] = async (key, run) => {
    if (!view || busy) return null
    setBusy(key); setMessage(null)
    try {
      const intentId = await environment.host.createIntent()
      const result = await run(intentId, view)
      publishFarmKitchenView(store, result.view)
      const outcome = result.receipt?.result ?? result.prediction?.result
      if (outcome?.kind === 'claim' && result.status !== 'duplicate') {
        const jobId = outcome.jobId
        const job = view.stations.find(station => station.job?.id === jobId)?.job
        if (job) setClaim({ mutation: result, job })
      }
      setMessage(result.status === 'pending' ? 'Saved locally · pending sync' : result.status === 'rejected' ? result.reason ?? 'Farm request rejected' : 'Farm updated')
      return result
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Farm action could not be completed')
      return null
    } finally { setBusy(null) }
  }
  if (state.status === 'loading' || !view) return <div className="flex h-dvh items-center justify-center bg-page px-4"><ScreenState title="Opening the Farm…" detail="Reading crew, stations and Items." /></div>
  if (state.status === 'error') return <div className="flex h-dvh items-center justify-center bg-page px-4"><ScreenState title="Farm needs attention" detail={state.error ?? 'Reload and retry the compatible Farm generation.'} action={{ label: 'Back Home', to: '/' }} /></div>
  const context: KitchenContextValue = { environment, store, view, crew, preferences, setPreferences, busy, message, claim, clearClaim: () => setClaim(null), action,
    showGuide: (page = 'crew') => setGuide({ open: true, page }) }
  return <KitchenContext.Provider value={context}>
    <div className="flex h-dvh flex-col overflow-hidden bg-page text-ink">
      <header className="pt-safe shrink-0 border-b border-hairline bg-panel/95 px-3 shadow-1 backdrop-blur-lg">
        <div className="flex min-h-14 items-center gap-2">
          <Link to={environment.isolated ? environment.root : '/'} aria-label="Back to Home" className="flex h-11 w-11 items-center justify-center rounded-sm text-ink-soft"><ChevronLeftIcon size={24} /></Link>
          <FarmDistrictSign district="garden" size={38} />
          <div className="min-w-0 flex-1"><h1 className="font-display text-lg font-bold">Stable Kitchen</h1><p className="truncate text-[11px] text-ink-soft">Five districts · 30 open stations</p></div>
          <button type="button" onClick={() => context.showGuide('crew')} className="flex min-h-11 items-center gap-1 rounded-sm px-2 text-[12px] font-semibold text-accent-strong"><QuestionIcon size={20} /> Help</button>
        </div>
        <nav aria-label="Farm kitchen" className="grid grid-cols-4 rounded-t-sm bg-sunken p-1">
          {[{ to: environment.root, label: 'Farm' }, { to: path(environment, '/crew'), label: 'Crew' }, { to: path(environment, '/recipes'), label: 'Recipes' }, { to: path(environment, '/items'), label: 'Items' }].map(({ to, label }) => <Link key={to} to={to} className={`flex min-h-11 items-center justify-center rounded-xs text-[12px] font-semibold ${location.pathname === to || to.endsWith('/recipes') && location.pathname.includes('/wishlist') ? 'bg-panel text-ink shadow-1' : 'text-ink-soft'}`}>{label}</Link>)}
        </nav>
      </header>
      <main className={`min-h-0 flex-1 ${fixedField ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'} px-3 pt-3 pb-safe`}>
        {message && <p role="status" aria-live="polite" className="mb-2 rounded-sm border border-accent/30 bg-accent/10 p-2 text-[12px]">{message}</p>}
        <Outlet />
      </main>
      <ClaimSheet />
      <FarmKitchenGuide open={guide.open} startAt={guide.page} isolated={environment.isolated} close={() => setGuide(current => ({ ...current, open: false }))} />
    </div>
  </KitchenContext.Provider>
}

export function FarmKitchenHubScreen() {
  const farm = useKitchen(), summaries = buildFarmDistrictSummaries(farm.view)
  const pinned = planFarmWishlist(farm.view, farm.preferences.goals)
  const ready = summaries.reduce((sum, item) => sum + item.ready, 0)
  const [collecting, setCollecting] = useState(false), [collection, setCollection] = useState<Awaited<ReturnType<FarmKitchenHost['collectAll']>> | null>(null), [collectionError, setCollectionError] = useState<string | null>(null)
  return <div className="space-y-3 pb-4">
    {farm.environment.advanceProofClock && <Panel className="flex items-center justify-between border-info/30 bg-info/10"><div><p className="text-micro">Isolated proof clock</p><p className="text-[11px] text-ink-soft">Invented DB only · never appears in production</p></div><Button size="sm" variant="secondary" onClick={async () => { farm.environment.advanceProofClock?.(FARM_KITCHEN_JOB_MS); publishFarmKitchenView(farm.store, await farm.environment.host.read()) }}>Advance 6h</Button></Panel>}
    <section className="grid grid-cols-2 gap-2" aria-label="Farm districts">
      {summaries.map((summary, index) => <Link key={summary.id} to={path(farm.environment, `/district/${summary.id}`)} onClick={() => farm.setPreferences({ ...farm.preferences, lastDistrict: summary.id })} className={index === 4 ? 'col-span-2' : ''}>
        <Panel className={`h-full p-3 ${summary.ready ? 'border-accent-strong' : ''}`}>
          <div className="flex items-center gap-2"><FarmDistrictSign district={summary.id} /><div className="min-w-0"><h2 className="font-display font-bold">{FARM_DISTRICT_PRESENTATION[summary.id].name}</h2><p className="truncate text-[10px] text-ink-soft">{FARM_DISTRICT_PRESENTATION[summary.id].detail}</p></div></div>
          <p className="mt-2 text-[11px] font-semibold">{summary.assigned}/6 crew · {summary.busy} busy · {summary.ready} ready</p>
          <p className="mt-1 text-[10px] text-ink-soft">{summary.pending ? `${summary.pending} pending sync` : summary.ready ? `${summary.ready} ready to collect` : summary.nextFinishAt ? `Next ${formatFarmTime(summary.nextFinishAt - farm.view.now)}` : 'Choose a worker and recipe'}</p>
        </Panel>
      </Link>)}
    </section>
    {ready > 0 && <Button className="w-full" disabled={collecting} onClick={async () => {
      if (farm.busy || collecting) return
      setCollecting(true); setCollectionError(null)
      try { const intentId = await farm.environment.host.createIntent(); const result = await farm.environment.host.collectAll({ intentId, expectedRevision: farm.view.revision }); publishFarmKitchenView(farm.store, result.view); setCollection(result) }
      catch (reason) { setCollectionError(reason instanceof Error ? reason.message : 'Could not collect the ready jobs') }
      finally { setCollecting(false) }
    }}>Collect all ready · {ready}</Button>}
    {collectionError && <p role="alert" className="text-sm text-danger">{collectionError}</p>}
    {collection && <Panel aria-live="polite"><p className="text-micro">Collect all result</p><p className="mt-1 text-[12px] font-semibold">{collection.succeeded} succeeded · {collection.pending} pending · {collection.failed} failed</p>{collection.jobs.map(job => <p key={job.operationId} className="mt-1 truncate text-[10px] text-ink-soft">{job.stationId}: {job.name} · {job.status}{job.reason ? ` · ${job.reason}` : ''}</p>)}</Panel>}
    <Panel><div className="flex items-center justify-between"><div><p className="text-micro">Pinned meals</p><h2 className="font-display text-lg font-bold">Shopping list</h2></div><Link to={path(farm.environment, '/wishlist')} className="flex min-h-11 items-center font-semibold text-accent-strong">Plan <ChevronRightIcon size={20} /></Link></div>
      {pinned.length ? <div className="mt-2 space-y-2">{pinned.map(goal => <div key={goal.id} className="flex items-center gap-2 border-t border-hairline pt-2"><FarmFoodMark food={FARM_KITCHEN_CATALOGUE.foodsById.get(goal.recipe.outputItemId)!} size={38} /><span className="min-w-0 flex-1 text-[12px]"><strong className="block truncate">{goal.recipe.name} ×{goal.target}</strong><span className="text-ink-soft">{goal.ownedMeals} owned · {goal.needs.reduce((n, need) => n + need.missing, 0)} ingredient shortage</span></span></div>)}</div>
        : <p className="mt-2 text-[12px] text-ink-soft">Pin up to three meal goals from Recipes. Stock is shared honestly across them.</p>}
    </Panel>
    <Panel className="flex items-center justify-between"><div><p className="text-micro">Farm Energy</p><p className="font-display text-2xl font-bold">{farm.view.items[FARM_KITCHEN_ENERGY_ID]?.canonical ?? 0}</p></div>{farm.environment.ownerDebugAllowed && <Button size="sm" variant="secondary" onClick={() => void farm.action('grant-energy', (intentId, view) => farm.environment.host.grantEnergy({ intentId, expectedRevision: view.revision, ownerDebugConfirmed: true }))}>Grant 50 Energy</Button>}</Panel>
  </div>
}

function StationTile({ stationId }: { stationId: FarmStationId }) {
  const farm = useKitchen(), station = farm.view.stations.find(row => row.id === stationId)!
  const worker = station.outfitId ? farm.crew.find(row => row.id === station.outfitId) : null
  const recipe = station.job ? FARM_KITCHEN_CATALOGUE.recipesById.get(station.job.recipeId) : null
  const food = recipe ? FARM_KITCHEN_CATALOGUE.foodsById.get(recipe.outputItemId) : null
  const [picker, setPicker] = useState(false), [recipes, setRecipes] = useState(false), [detail, setDetail] = useState(false)
  const number = stationId.split('-').at(-1)
  const primary = station.status === 'empty' ? 'Assign' : station.status === 'idle' ? 'Choose' : station.status === 'ready' ? 'Collect' : 'Details'
  const act = () => {
    if (station.status === 'empty') setPicker(true)
    else if (station.status === 'idle') setRecipes(true)
    else if (station.status === 'ready' && station.job) void farm.action(`claim:${station.id}`, (intentId, view) => farm.environment.host.claim({ intentId, expectedRevision: view.revision, stationId: station.id, outfitId: station.job!.outfitId, jobId: station.job!.id, recipeId: station.job!.recipeId }))
    else setDetail(true)
  }
  return <>
    <article className="flex min-h-0 flex-col rounded-md border border-hairline bg-panel p-2 shadow-1" aria-label={`Station ${number}, ${station.status}`}>
      <div className="flex min-h-0 flex-1 gap-2">
        {worker ? <WorkerPortrait worker={worker} size="h-12 w-12" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-sunken text-micro text-ink-faint">{number}</div>}
        <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold" title={worker ? `${worker.name} · ${worker.outfit ?? 'Standard'}` : undefined}>{worker?.name ?? `Open station ${number}`}</p>
          <p className="text-[9px] text-ink-soft">{worker ? `Farm Lv${worker.level}` : 'No worker assigned'}</p>
          <div className="mt-1 flex items-center gap-1">{food && <FarmFoodMark food={food} size={28} />}<span className="line-clamp-2 text-[9px] leading-3 text-ink-soft">{food?.name ?? (worker ? 'Ready for a recipe' : 'Assign any owned outfit')}</span></div>
        </div>
      </div>
      <p className={`mt-1 truncate text-center text-[9px] font-semibold ${station.status === 'ready' ? 'text-success' : station.pending ? 'text-warning' : 'text-ink-soft'}`}>{station.pending ? 'Pending sync' : station.status === 'busy' ? formatFarmTime(station.remainingMs) : station.status === 'ready' ? 'Ready to collect' : station.status === 'idle' ? 'Idle' : 'Open'}</p>
      <button type="button" disabled={farm.busy !== null} onClick={act} className="mt-1 min-h-11 rounded-sm border border-hairline-strong bg-sunken px-2 text-[12px] font-bold text-accent-strong disabled:opacity-45">{primary}</button>
    </article>
    <WorkerPicker open={picker} stationId={station.id} close={() => setPicker(false)} />
    <RecipePicker open={recipes} stationId={station.id} close={() => setRecipes(false)} />
    <StationDetail open={detail} stationId={station.id} close={() => setDetail(false)} />
  </>
}

export function FarmKitchenDistrictScreen() {
  const farm = useKitchen(), params = useParams(), district = FARM_DISTRICTS.includes(params.districtId as FarmDistrict) ? params.districtId as FarmDistrict : null
  const navigate = useNavigate()
  if (!district) return <ScreenState title="District unavailable" detail="That Farm district does not exist." action={{ label: 'Back to Farm', to: farm.environment.root }} />
  const stations = farm.view.stations.filter(row => row.id.startsWith(`${district}-`))
  return <div className="flex h-full min-h-0 flex-col pb-1">
    <div className="mb-2 flex shrink-0 items-center gap-2"><FarmDistrictSign district={district} size={38} /><div className="min-w-0 flex-1"><h2 className="font-display text-lg font-bold">{FARM_DISTRICT_PRESENTATION[district].name}</h2><p className="truncate text-[10px] text-ink-soft">All six stations are open · recipe levels still apply</p></div>
      <button type="button" onClick={() => { const next = FARM_DISTRICTS[(FARM_DISTRICTS.indexOf(district) + 1) % FARM_DISTRICTS.length]!; farm.setPreferences({ ...farm.preferences, lastDistrict: next }); navigate(path(farm.environment, `/district/${next}`)) }} className="min-h-11 rounded-sm border border-hairline bg-panel px-3 text-[11px] font-semibold">Next district</button></div>
    <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2">{stations.map(station => <StationTile key={station.id} stationId={station.id} />)}</div>
  </div>
}

function Sheet({ open, close, children }: { open: boolean; close: () => void; children: ReactNode }) {
  return open ? <RpgModalFocus onClose={close}><BottomSheet open onClose={close}>{children}</BottomSheet></RpgModalFocus> : null
}

function WorkerPicker({ open, stationId, close }: { open: boolean; stationId: FarmStationId; close: () => void }) {
  const farm = useKitchen(), station = farm.view.stations.find(row => row.id === stationId)!, current = farm.crew.find(row => row.id === station.outfitId)
  const assign = (worker: FarmCrewRow) => void farm.action(`assign:${stationId}`, (intentId, view) => farm.environment.host.assign({ intentId, expectedRevision: view.revision, stationId, outfitId: worker.id })).then(result => { if (result) close() })
  return <Sheet open={open} close={close}><h2 className="font-display text-xl font-bold">Crew for {FARM_DISTRICT_PRESENTATION[stationId.split('-')[0] as FarmDistrict].name} {stationId.split('-')[1]}</h2><p className="mt-1 text-[12px] text-ink-soft">Choose an available outfit or explicitly move an idle one here. Busy and Ready workers must finish first.</p>
    {current && <Button variant="destructive" size="sm" className="mt-3 w-full" onClick={() => void farm.action(`remove:${stationId}`, (intentId, view) => farm.environment.host.remove({ intentId, expectedRevision: view.revision, stationId })).then(result => { if (result) close() })}>Remove {current.name}</Button>}
    {(['available', 'working'] as const).map(section => <section key={section} className="mt-4"><p className="text-micro">{section === 'available' ? 'Available' : 'Working'}</p><div className="mt-2 space-y-2">{farm.crew.filter(worker => section === 'available' ? worker.status === 'available' : worker.status !== 'available').map(worker => {
      const locked = worker.status === 'busy' || worker.status === 'ready'
      return <div key={worker.id} className="flex min-h-16 items-center gap-2 rounded-md border border-hairline p-2"><WorkerPortrait worker={worker} /><span className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{worker.name}</strong><span className="block truncate text-[10px] text-ink-soft">{worker.outfit ?? 'Standard'} · Farm Lv{worker.level}</span><span className="text-[10px] font-semibold text-accent-strong">{worker.stationId ? `${worker.status} at ${worker.stationId}` : 'Available'}</span></span>
        {locked ? <Link to={path(farm.environment, `/district/${worker.stationId!.split('-')[0]}`)} onClick={close} className="flex min-h-11 items-center px-2 text-[11px] font-semibold text-accent-strong">View</Link>
          : <button type="button" disabled={farm.busy !== null || worker.id === current?.id} onClick={() => assign(worker)} className="min-h-11 rounded-sm bg-accent px-3 text-[11px] font-bold disabled:opacity-45">{worker.stationId ? `Move here` : 'Assign'}</button>}</div>})}
      {!farm.crew.some(worker => section === 'available' ? worker.status === 'available' : worker.status !== 'available') && <p className="rounded-sm bg-sunken p-3 text-[12px] text-ink-soft">No {section} outfits.</p>}</div></section>)}
  </Sheet>
}

function RecipePicker({ open, stationId, close }: { open: boolean; stationId: FarmStationId; close: () => void }) {
  const farm = useKitchen(), station = farm.view.stations.find(row => row.id === stationId)!, worker = station.outfitId ? farm.crew.find(row => row.id === station.outfitId) : null
  const district = stationId.split('-')[0] as FarmDistrict
  const [block, setBlock] = useState(1), [selected, setSelected] = useState<FarmRecipe | null>(null), [quantity, setQuantity] = useState(1)
  const [choices, setChoices] = useState<Record<string, string>>({}), [limit, setLimit] = useState(24)
  useEffect(() => { if (open) { setSelected(null); setQuantity(1); setLimit(24) } }, [open, stationId])
  const recipes = FARM_KITCHEN_CATALOGUE.recipes.filter(recipe => recipe.district === district && recipe.block === block)
  const choose = (recipe: FarmRecipe) => { const next = ingredientChoices(recipe, farm.view.items); setSelected(recipe); setChoices(next); setQuantity(Math.max(1, maxSuppliedBatch(recipe, farm.view.items, next))) }
  const availability = selected && worker ? recipeAvailability(farm.view, selected, worker.level, quantity, choices) : null
  return <Sheet open={open} close={close}><h2 className="font-display text-xl font-bold">Choose a {FARM_DISTRICT_PRESENTATION[district].name} recipe</h2><p className="mt-1 text-[12px] text-ink-soft">{worker ? `${worker.name} · Farm Lv${worker.level}` : 'Assign a worker first'} · fixed {FARM_KITCHEN_JOB_MS / 3_600_000}h · {FARM_KITCHEN_EXP_PER_JOB} EXP on claim</p>
    <div className="mt-3 flex gap-1 overflow-x-auto pb-1">{FARM_KITCHEN_CATALOGUE.blocks.map(value => <button key={value} type="button" onClick={() => { setBlock(value); setSelected(null) }} className={`min-h-11 min-w-14 rounded-full border px-3 text-[12px] font-semibold ${block === value ? 'border-accent bg-accent/10' : 'border-hairline bg-panel'}`}>Block {value}</button>)}</div>
    {!selected ? <div className="mt-3 space-y-2">{recipes.slice(0, limit).map(recipe => {
      const food = FARM_KITCHEN_CATALOGUE.foodsById.get(recipe.outputItemId)!
      const preliminary = worker ? recipeAvailability(farm.view, recipe, worker.level, 1, ingredientChoices(recipe, farm.view.items)) : null
      return <button key={recipe.id} type="button" onClick={() => choose(recipe)} className="flex min-h-16 w-full items-center gap-3 rounded-md border border-hairline bg-panel p-2 text-left"><FarmFoodMark food={food} /><span className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{recipe.name}</strong><span className="block text-[10px] text-ink-soft">{recipe.kind} · Farm Lv{recipe.requiredLevel} · yields {recipe.outputPerQuantity}</span>{preliminary?.reason && <span className="block text-[10px] font-semibold text-warning">{preliminary.reason}</span>}</span><ChevronRightIcon size={20} /></button>})}{recipes.length > limit && <Button variant="secondary" className="w-full" onClick={() => setLimit(current => current + 30)}>Show more recipes</Button>}</div>
      : <div className="mt-3"><button type="button" onClick={() => setSelected(null)} className="min-h-11 text-[12px] font-semibold text-accent-strong">← Back to recipes</button><div className="flex items-center gap-3"><FarmFoodMark food={FARM_KITCHEN_CATALOGUE.foodsById.get(selected.outputItemId)!} size={60} /><div><h3 className="font-display text-lg font-bold">{selected.name}</h3><p className="text-[11px] text-ink-soft">Output ×{selected.outputPerQuantity * quantity} · ready in {FARM_KITCHEN_JOB_MS / 3_600_000}h</p></div></div>
        <p className="mt-3 text-micro">Batch</p><div className="mt-1 grid grid-cols-4 gap-2">{Array.from({ length: selected.maxQuantity }, (_, i) => i + 1).map(value => <button key={value} type="button" onClick={() => setQuantity(value)} className={`min-h-11 rounded-sm border text-[13px] font-bold ${quantity === value ? 'border-accent bg-accent/10' : 'border-hairline'}`}>×{value}</button>)}</div>
        {selected.inputs.map(slot => <div key={slot.id} className="mt-3"><p className="text-[11px] font-semibold">{slot.stage} {slot.stat} · {slot.amount * quantity} needed</p><div className="mt-1 space-y-1">{FARM_KITCHEN_CATALOGUE.foods.filter(food => food.stage === slot.stage && food.stat === slot.stat && food.block === selected.block && (slot.fixedItemId === null || food.id === slot.fixedItemId)).map(food => <button key={food.id} type="button" onClick={() => setChoices(current => ({ ...current, [slot.id]: food.id }))} className={`flex min-h-11 w-full items-center gap-2 rounded-sm border px-2 text-left ${choices[slot.id] === food.id ? 'border-accent bg-accent/10' : 'border-hairline'}`}><span className="min-w-0 flex-1 truncate text-[11px]">{food.name}</span><span className="text-[10px]">{spendableStock(farm.view.items[food.id])} spendable · {farm.view.items[food.id]?.incoming ?? 0} pending</span></button>)}</div></div>)}
        {availability?.reason && <p className="mt-3 rounded-sm bg-warning/10 p-3 text-[12px] font-semibold text-warning">{availability.reason}{availability.href && <Link to={path(farm.environment, availability.href.replace('/farm', ''))} onClick={close} className="ml-1 underline">Open help</Link>}</p>}
        <Button className="mt-4 w-full" disabled={!availability?.enabled || farm.busy !== null} onClick={() => {
          if (!farmKitchenGuideMemory(farm.environment.isolated).seen()) { farm.showGuide('production'); return }
          void farm.action(`start:${stationId}`, (intentId, view) => farm.environment.host.start({ intentId, expectedRevision: view.revision, stationId, outfitId: station.outfitId!, recipeId: selected.id, quantity, choices })).then(result => { if (result) close() })
        }}>Start exact batch</Button>
      </div>}
  </Sheet>
}

function StationDetail({ open, stationId, close }: { open: boolean; stationId: FarmStationId; close: () => void }) {
  const farm = useKitchen(), station = farm.view.stations.find(row => row.id === stationId), energy = farm.view.items[FARM_KITCHEN_ENERGY_ID]?.canonical ?? 0
  if (!station?.job) return null
  const used = Math.min(station.remainingMs, FARM_KITCHEN_ENERGY_MS), wasted = FARM_KITCHEN_ENERGY_MS - used
  return <Sheet open={open} close={close}><h2 className="font-display text-xl font-bold">Running job</h2><p className="mt-1 text-sm">{FARM_KITCHEN_CATALOGUE.recipesById.get(station.job.recipeId)?.name}</p><p className="mt-3 flex items-center gap-2 text-[13px]"><StopwatchIcon size={20} /> {formatFarmTime(station.remainingMs)} remaining</p>
    <Panel className="mt-3"><p className="text-micro">Use Energy ·1</p><p className="mt-1 text-[12px]">Before {formatFarmTime(station.remainingMs)} · after {formatFarmTime(station.remainingMs - used)}{wasted ? ` · ${Math.ceil(wasted / 60_000)}m wasted` : ''}</p><p className="mt-1 text-[11px] text-ink-soft">{energy} Energy canonical. EXP and output still wait for Claim.</p></Panel>
    <Button className="mt-3 w-full" disabled={!energy || station.status !== 'busy'} onClick={() => void farm.action(`energy:${stationId}`, (intentId, view) => farm.environment.host.spendEnergy({ intentId, expectedRevision: view.revision, stationId, outfitId: station.job!.outfitId, jobId: station.job!.id, confirmedWastedMs: wasted })).then(result => { if (result) close() })}>Use Energy ·1</Button>
  </Sheet>
}

export function FarmKitchenCrewScreen() {
  const farm = useKitchen()
  return <div className="pb-4"><h2 className="font-display text-xl font-bold">Farm crew</h2><p className="mt-1 text-[12px] text-ink-soft">Every outfit levels independently. Busy or Ready workers finish before moving.</p>{(['working', 'available'] as const).map(section => <section key={section} className="mt-4"><p className="text-micro">{section}</p><div className="mt-2 space-y-2">{farm.crew.filter(worker => section === 'working' ? worker.stationId : !worker.stationId).map(worker => <Panel key={worker.id} className="flex items-center gap-3 p-2"><WorkerPortrait worker={worker} /><div className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{worker.name}</strong><span className="block truncate text-[10px] text-ink-soft">{worker.outfit ?? 'Standard outfit'} · {worker.stationId ?? 'Available'}</span><div className="mt-1 flex items-center gap-2"><span className="text-[10px] font-semibold">Farm Lv{worker.level}</span><div className="flex-1"><Meter value={(worker.totalExp % 24) / 24} color="var(--color-accent)" height={5} /></div></div></div>{worker.stationId && <Link to={path(farm.environment, `/district/${worker.stationId.split('-')[0]}`)} className="flex min-h-11 items-center px-2 text-accent-strong"><ChevronRightIcon size={20} /></Link>}</Panel>)}</div></section>)}</div>
}

export function FarmKitchenRecipesScreen() {
  const farm = useKitchen(), [block, setBlock] = useState(1), [limit, setLimit] = useState(32)
  const meals = FARM_KITCHEN_CATALOGUE.recipes.filter(recipe => recipe.kind === 'cooking' && recipe.block === block)
  const cookbook = farm.view.recipes[`b${block}`]
  const pin = (recipe: FarmRecipe) => {
    if (farm.preferences.goals.some(goal => goal.recipeId === recipe.id)) return
    if (farm.preferences.goals.length >= 3) return
    farm.setPreferences({ ...farm.preferences, goals: [...farm.preferences.goals, { id: `wish-${recipe.id}`, recipeId: recipe.id, quantity: 4, choices: ingredientChoices(recipe, farm.view.items) }] })
  }
  return <div className="pb-4"><div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-bold">Cookbook</h2><p className="text-[12px] text-ink-soft">16 meals per block · first claims become recipes made</p></div><Link to={path(farm.environment, '/wishlist')} className="flex min-h-11 items-center font-semibold text-accent-strong">Wishlist</Link></div>
    <div className="mt-3 flex gap-1 overflow-x-auto">{FARM_KITCHEN_CATALOGUE.blocks.map(value => <button key={value} onClick={() => { setBlock(value); setLimit(32) }} className={`min-h-11 min-w-16 rounded-full border px-3 text-[12px] font-semibold ${value === block ? 'border-accent bg-accent/10' : 'border-hairline bg-panel'}`}>Block {value}</button>)}</div>
    <div className="mt-3 grid grid-cols-2 gap-2">{meals.slice(0, limit).map(recipe => { const made = cookbook?.canonical.cookbook[recipe.id]?.count ?? 0, pending = !made && !!cookbook?.projected.cookbook[recipe.id]
      return <Panel key={recipe.id} className="p-2"><div className="flex items-center gap-2"><FarmFoodMark food={FARM_KITCHEN_CATALOGUE.foodsById.get(recipe.outputItemId)!} size={42} /><div className="min-w-0"><strong className="line-clamp-2 text-[11px]">{recipe.name}</strong><span className="block text-[9px] text-ink-soft">{made ? `${made} claimed` : pending ? 'First prep pending' : 'Not prepared'}</span></div></div><button type="button" disabled={farm.preferences.goals.length >= 3 || farm.preferences.goals.some(goal => goal.recipeId === recipe.id)} onClick={() => pin(recipe)} className="mt-2 min-h-11 w-full rounded-sm border border-hairline text-[11px] font-semibold text-accent-strong disabled:opacity-45">{farm.preferences.goals.some(goal => goal.recipeId === recipe.id) ? 'Pinned' : 'Pin ×4'}</button></Panel>})}</div>
    {meals.length > limit && <Button variant="secondary" className="mt-3 w-full" onClick={() => setLimit(current => current + 32)}>Show more</Button>}
    <Panel className="mt-3"><p className="text-micro">Legacy produce</p><p className="mt-1 text-[12px] text-ink-soft">Old crops remain in global Items and keep their labels. New raw, processed and meal stock never replaces them.</p><Link to={path(farm.environment, '/items')} className="mt-2 flex min-h-11 items-center font-semibold text-accent-strong">Open Items</Link></Panel>
  </div>
}

export function FarmKitchenWishlistScreen() {
  const farm = useKitchen(), plans = planFarmWishlist(farm.view, farm.preferences.goals)
  return <div className="pb-4"><div className="flex items-center gap-2"><Link to={path(farm.environment, '/recipes')} className="flex h-11 w-11 items-center justify-center"><ChevronLeftIcon size={24} /></Link><div><h2 className="font-display text-xl font-bold">Wishlist & shopping</h2><p className="text-[11px] text-ink-soft">Canonical stock is allocated once, top to bottom.</p></div></div>
    {plans.map(plan => <Panel key={plan.id} className="mt-3"><div className="flex items-center gap-2"><FarmFoodMark food={FARM_KITCHEN_CATALOGUE.foodsById.get(plan.recipe.outputItemId)!} /><div className="min-w-0 flex-1"><h3 className="truncate font-display font-bold">{plan.recipe.name} ×{plan.target}</h3><p className="text-[10px] text-ink-soft">{plan.ownedMeals} already owned · {plan.remainingMeals} to cook</p></div><button type="button" onClick={() => farm.setPreferences({ ...farm.preferences, goals: farm.preferences.goals.filter(goal => goal.id !== plan.id) })} className="min-h-11 px-2 text-[11px] font-semibold text-danger">Remove</button></div>
      <div className="mt-2 space-y-1">{plan.needs.map(need => <div key={need.item.id} className="grid grid-cols-[1fr_auto] gap-2 border-t border-hairline pt-2 text-[10px]"><span className="truncate">{need.item.name}</span><span>{need.allocated}/{need.required} stock · {need.incoming} pending · {need.missing} short{need.rawJobs ? ` · ${need.rawJobs} raw job` : ''}</span></div>)}</div>{plan.recipe.signature === 'sun' && <p className="mt-2 rounded-sm bg-warning/10 p-2 text-[11px] font-semibold text-warning">Sun burden: ten ingredient slots per meal. Build every stat lane before promising this batch.</p>}
    </Panel>)}
    {!plans.length && <ScreenState title="No pinned meals" detail="Pin up to three goals from the Cookbook." action={{ label: 'Open Recipes', to: path(farm.environment, '/recipes') }} />}
  </div>
}

export function FarmKitchenItemsScreen() {
  const farm = useKitchen(), [visibility, setVisibility] = useState<'owned' | 'all'>('owned'), [limit, setLimit] = useState(60)
  const definitions = useMemo(farmKitchenItemDefinitions, [])
  const known = useMemo(() => definitions.filter(def =>
    (farm.preferences.stage === 'all' || def.food.stage === farm.preferences.stage) &&
    (farm.preferences.block === 'all' || def.food.block === Number(farm.preferences.block)) &&
    (farm.preferences.stat === 'all' || def.food.stat === farm.preferences.stat) &&
    (visibility === 'all' || (farm.view.items[def.id]?.canonical ?? 0) > 0)),
  [definitions, farm.preferences.block, farm.preferences.stage, farm.preferences.stat, farm.view.items, visibility])
  const other = Object.entries(farm.view.items).filter(([id, stock]) => !FARM_KITCHEN_CATALOGUE.foodsById.has(id) && stock.canonical > 0)
  return <div className="pb-4"><h2 className="font-display text-xl font-bold">Global Items</h2><p className="mt-1 text-[12px] text-ink-soft">Canonical is spendable. Reserved, pending and ready stay separate.</p>
    <div className="mt-3 flex items-end gap-2"><SegmentedControl className="min-w-0 flex-1 [&>button]:min-h-11" label="Inventory visibility" value={visibility} onChange={setVisibility} options={[{ value: 'owned', label: 'Owned' }, { value: 'all', label: 'All' }]} /><button type="button" onClick={() => farm.setPreferences({ ...farm.preferences, density: farm.preferences.density === 'compact' ? 'comfortable' : 'compact' })} className="min-h-11 rounded-sm border border-hairline px-3 text-[10px] font-semibold">{farm.preferences.density === 'compact' ? 'Comfortable' : 'Compact'}</button></div>
    <div className="mt-2 flex gap-1 overflow-x-auto">{(['all', 'raw', 'processed', 'meal', 'energy'] as const).map(stage => <button key={stage} type="button" onClick={() => farm.setPreferences({ ...farm.preferences, stage })} className={`min-h-11 rounded-full border px-3 text-[11px] font-semibold capitalize ${farm.preferences.stage === stage ? 'border-accent bg-accent/10' : 'border-hairline bg-panel'}`}>{stage}</button>)}</div>
    <div className="mt-2 flex gap-1 overflow-x-auto"><button type="button" onClick={() => farm.setPreferences({ ...farm.preferences, block: 'all' })} className={`min-h-11 rounded-full border px-3 text-[11px] font-semibold ${farm.preferences.block === 'all' ? 'border-accent bg-accent/10' : 'border-hairline'}`}>All blocks</button>{FARM_KITCHEN_CATALOGUE.blocks.map(block => <button key={block} type="button" onClick={() => farm.setPreferences({ ...farm.preferences, block: String(block) as `${number}` })} className={`min-h-11 min-w-12 rounded-full border px-2 text-[11px] font-semibold ${farm.preferences.block === String(block) ? 'border-accent bg-accent/10' : 'border-hairline'}`}>B{block}</button>)}</div>
    <div className="mt-2 flex gap-1 overflow-x-auto">{(['all', 'speed', 'stamina', 'power', 'guts', 'wit'] as const).map(stat => <button key={stat} type="button" onClick={() => farm.setPreferences({ ...farm.preferences, stat })} className={`min-h-11 rounded-full border px-3 text-[11px] font-semibold capitalize ${farm.preferences.stat === stat ? 'border-accent bg-accent/10' : 'border-hairline'}`}>{stat}</button>)}</div>
    <div className="mt-3 space-y-2">{known.slice(0, limit).map(def => { const stock = farm.view.items[def.id]
      return <Panel key={def.id} className={`flex items-center gap-3 p-2 ${farm.preferences.density === 'compact' ? 'min-h-14' : 'min-h-16'}`}><FarmFoodMark food={def.food} size={farm.preferences.density === 'compact' ? 34 : 44} /><span className="min-w-0 flex-1"><strong className="block truncate text-[12px]">{def.name}</strong><span className="block text-[9px] text-ink-soft capitalize">{def.food.stage}{def.food.scenarioIndex ? ` · Scenario ${def.food.scenarioIndex}` : ''}{def.food.block ? ` · Block ${def.food.block}` : ''}{def.food.stat ? ` · ${def.food.stat}` : ''}</span><span className="text-[9px]">Canonical {stock?.canonical ?? 0} · reserved {stock?.reserved ?? 0} · pending {stock?.incoming ?? 0}</span></span><Crest>×{stock?.canonical ?? 0}</Crest></Panel>})}</div>
    {known.length > limit && <Button variant="secondary" className="mt-3 w-full" onClick={() => setLimit(current => current + 60)}>Show 60 more</Button>}
    {other.length > 0 && <section className="mt-5"><p className="text-micro">Legacy Produce & other materials</p><div className="mt-2 space-y-2">{other.map(([id, stock]) => <Panel key={id} className="flex min-h-14 items-center justify-between p-3"><span className="min-w-0"><strong className="block truncate text-[12px]">{id.startsWith('produce:') ? 'Legacy Produce' : 'Preserved global Item'}</strong><span className="block max-w-[240px] truncate text-[9px] text-ink-soft">{id}</span></span><Crest>×{stock.canonical}</Crest></Panel>)}</div></section>}
  </div>
}

function ClaimSheet() {
  const farm = useKitchen(), navigate = useNavigate(), result = farm.claim?.mutation.receipt?.result, job = farm.claim?.job
  if (!result || result.kind !== 'claim') return null
  const food = FARM_KITCHEN_CATALOGUE.foodsById.get(result.output.itemId)!
  return <Sheet open close={farm.clearClaim}><div className="text-center"><div className="mx-auto w-fit"><FarmFoodMark food={food} size={76} /></div><p className="mt-3 text-micro">Collected</p><h2 className="font-display text-2xl font-bold">{food.name} ×{result.output.amount}</h2><p className="mt-2 text-sm">Farm Lv{result.beforeLevel} → Lv{result.afterLevel} · +{result.expAward} EXP</p></div>
    {result.levelsCrossed.length > 0 && <p className="mt-3 rounded-sm bg-accent/10 p-3 text-[12px] font-semibold">Levels crossed: {result.levelsCrossed.join(', ')}</p>}
    {result.milestones.map(item => <p key={`${item.block}:${item.kind}`} className="mt-2 text-[12px] font-semibold">Opened Block {item.block} {item.kind}</p>)}
    {result.firstPrepared.map(id => <p key={id} className="mt-2 text-[12px] font-semibold">First prepared: {FARM_KITCHEN_CATALOGUE.recipesById.get(id)?.name}</p>)}
    <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => { farm.clearClaim(); navigate(path(farm.environment, `/district/${job!.stationId.split('-')[0]}`)) }}>Choose recipe</Button><Button disabled={farm.busy !== null} onClick={() => { const recipe = FARM_KITCHEN_CATALOGUE.recipesById.get(job!.recipeId)!; const choices = repeatedIngredientChoices(recipe, job!); void farm.action(`repeat:${job!.stationId}`, (intentId, view) => farm.environment.host.start({ intentId, expectedRevision: view.revision, stationId: job!.stationId, outfitId: job!.outfitId, recipeId: job!.recipeId, quantity: job!.quantity, choices })).then(next => { if (next) farm.clearClaim() }) }}>Repeat exact batch</Button><Button variant="secondary" onClick={farm.clearClaim}>Done</Button><Button onClick={() => { farm.clearClaim(); navigate(path(farm.environment, '/items')) }}>Items</Button></div>
  </Sheet>
}

export function FarmKitchenLegacySectionRedirect() {
  const farm = useKitchen(), section = Number(useParams().section), district = section === 1 ? 'garden' : section === 2 ? 'orchard' : section === 3 ? 'barn' : null
  return district ? <Navigate to={path(farm.environment, `/district/${district}`)} replace /> : <Navigate to={farm.environment.root} replace />
}

export function FarmKitchenRetryScreen() {
  const farm = useKitchen()
  return <ScreenState title="Farm page unavailable" detail="This named Farm page is not part of the current kitchen." action={{ label: 'Back to Farm', to: farm.environment.root }} />
}
