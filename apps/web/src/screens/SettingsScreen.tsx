import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { MAX_FARM_PLOTS, flairContentCoverage } from '@racer/domain'
import { Link } from 'react-router'
import { APP_BUILD_ID } from '../app/build'
import { useAppUpdate } from '../app/UpdateNotice'
import { useAuth } from '../auth/AuthProvider'
import { useContent } from '../content/ContentProvider'
import { useGame } from '../game/store'
import { Button } from '../ui/Button'
import { grantDevResources, hastenFarmCrops } from '../game/actions'
import { Panel } from '../ui/Panel'
import { readFarmSaveSummary, type FarmSaveSummary } from '../game/farm/diagnostics'
import { PUZZLES_RELEASE_ENABLED } from '../game/puzzles/capability'
import { PuzzleBackupButton } from '../ui/puzzles/PuzzleBackupButton'
import { FARM_KITCHEN_RELEASE_ENABLED } from '../game/farm/kitchen/capability'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-ink-soft">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

export function SettingsScreen() {
  const auth = useAuth()
  const [granting, setGranting] = useState(false)
  const [farmNote, setFarmNote] = useState<string | null>(null)
  const persistent = useGame((s) => s.persistent)
  const gameStatus = useGame((s) => s.status)
  const sync = useGame((s) => s.sync)
  const orphanedUmas = useGame((s) => s.orphanedUmaIds.length)
  const orphanedCards = useGame((s) => s.orphanedCardIds.length)
  const reduced = useReducedMotion()
  const content = useContent()
  const update = useAppUpdate()
  const [farmSummary, setFarmSummary] = useState<FarmSaveSummary | null>(null)
  const [farmReadError, setFarmReadError] = useState<string | null>(null)
  useEffect(() => {
    if (gameStatus !== 'ready') { setFarmSummary(null); return }
    let active = true
    void readFarmSaveSummary().then((summary) => { if (active) { setFarmSummary(summary); setFarmReadError(null) } }).catch(() => { if (active) { setFarmSummary(null); setFarmReadError('Recovery needed · open Farm') } })
    return () => { active = false }
  }, [gameStatus, sync.pending])
  const contentLabel =
    content.status === 'signed-out'
      ? 'Sign in first'
      : content.status === 'error'
        ? 'Unavailable'
        : content.status === 'empty'
          ? 'Not imported'
          : content.status === 'ready'
            ? `${content.content.manifest.version} · ${content.content.origin === 'offline-cache' ? 'offline' : 'network'}`
            : '…'
  const contentCounts =
    content.status === 'ready'
      ? `${content.content.umas.items.length} Umas · ${content.content.cards.items.length} cards · ${content.content.skills.items.length} skills · ${content.content.races.items.length} races · ${content.content.courses.items.length} courses · 2 atlases`
      : '—'
  const coverage = content.status === 'ready' ? flairContentCoverage(content.content.races.items) : null
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
  const updateLabel = update.status === 'current'
    ? 'Current'
    : update.activeActions > 0
      ? 'Ready · waiting for save'
      : update.status === 'ready'
        ? 'Ready · restart available'
        : 'Restarting'
  const diagnostic = content.status === 'loading' ? null : content.diagnostic
  const runDiagnosticAction = async () => {
    if (!diagnostic?.action) return
    if (diagnostic.action.kind === 'retry' && 'retry' in content) await content.retry()
    else if (diagnostic.action.kind === 'sign-in') await auth.signIn()
    else if (diagnostic.action.kind === 'sign-out') await auth.signOut()
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="font-display px-1 text-2xl font-bold tracking-tight text-ink">Settings</h1>

      <Panel>
        <h2 className="text-sm font-semibold">Playtesting</h2>
        <p className="mt-1 text-[12px] text-ink-soft">
          Tops up the account so a loop can be exercised without waiting on the daily grant. Every grant is
          recorded in the ledger as <code>dev-grant</code>, so balance work can filter it out — nothing in
          ordinary play ever produces one. {FARM_KITCHEN_RELEASE_ENABLED ? 'Farm Energy advances only one explicitly selected job; it gives no EXP or output before collection.' : 'The Farm button brings every crop still growing 30 minutes closer.'}
        </p>
        <div className="mt-3 grid gap-2">
          <Button
            variant="secondary"
            disabled={granting || gameStatus !== 'ready'}
            onClick={() => {
              setGranting(true)
              void grantDevResources({ tickets: 10, cardCoupons: 0, umaCoupons: 0, umaShards: 0 })
                .finally(() => setGranting(false))
            }}
          >
            {granting ? 'Granting…' : '+10 tickets'}
          </Button>
          <Button
            variant="secondary"
            disabled={granting || gameStatus !== 'ready'}
            onClick={() => {
              setGranting(true)
              void grantDevResources({ tickets: 50, cardCoupons: 5, umaCoupons: 5, umaShards: 10 })
                .finally(() => setGranting(false))
            }}
          >
            {granting ? 'Granting…' : '+50 tickets · 5+5 coupons · 10 shards'}
          </Button>
          <Button
            variant="secondary"
            disabled={granting || gameStatus !== 'ready'}
            onClick={() => {
              setGranting(true)
              setFarmNote(null)
              void (FARM_KITCHEN_RELEASE_ENABLED ? import('../game/runtime').then(async ({ gameRuntime }) => {
                const host = await gameRuntime.farmKitchenHost(), view = await host.read()
                const result = await host.grantEnergy({ intentId: await host.createIntent(), expectedRevision: view.revision, ownerDebugConfirmed: true })
                return result.status === 'pending' ? '50 Energy saved locally · pending sync. No job was accelerated.' : '50 Energy acknowledged. Spend on a chosen job in Farm.'
              }) : hastenFarmCrops(30).then(plots => plots === 0 ? 'No Farm crops are growing.' : `${plots} growing ${plots === 1 ? 'crop is' : 'crops are'} now due 30 minutes sooner.`))
                .then(setFarmNote)
                .catch(error => setFarmNote(error instanceof Error ? error.message : 'The Farm could not be changed. Prepare it first.'))
                .finally(() => setGranting(false))
            }}
          >
            {granting ? 'Working…' : FARM_KITCHEN_RELEASE_ENABLED ? 'Debug · Grant 50 Farm Energy' : 'Farm: growing crops −30 min'}
          </Button>
          {farmNote && <p role="status" className="px-1 text-[12px] text-ink-soft">{farmNote}</p>}
        </div>
      </Panel>
      <Panel>
        <Row label="App build" value={APP_BUILD_ID} />
        <Row label="App update" value={updateLabel} />
        <Row label="Signed in as" value={auth.user?.email ?? auth.user?.name ?? '—'} />
        <Row label="Local save" value={persistent ? 'IndexedDB' : 'Memory only'} />
        <Row label="Save state" value={gameStatus} />
        <Row label="Farm save" value={farmReadError ?? (farmSummary?.kitchen ? `${farmSummary.kitchen.phase} · ${farmSummary.unlockedPlots} stations · ${farmSummary.readyPlots} ready` : farmSummary?.farmPresent ? `Lv${farmSummary.farmLevel} · ${farmSummary.unlockedPlots}/${MAX_FARM_PLOTS} plots · ${farmSummary.readyPlots} ready` : FARM_KITCHEN_RELEASE_ENABLED ? 'Preparation needed · open Farm' : 'Not opened')} />
        {farmSummary?.kitchen && <Row label="Farm records" value={`${farmSummary.kitchen.workers} workers · ${farmSummary.kitchen.pending} pending · ${farmSummary.kitchen.recovery} need review`} />}
        <Row label="Global Items" value={farmSummary ? `${farmSummary.itemStacks} stacks · ${farmSummary.totalItems} items · ${farmSummary.itemMovements} movements` : '—'} />
        <Row label="Cloud sync" value={`${sync.status}${sync.pending ? ` · ${sync.pending} pending` : ''}`} />
        <Row label="Last synced" value={sync.lastSuccessAt ? new Date(sync.lastSuccessAt).toLocaleString() : '—'} />
        {(orphanedUmas > 0 || orphanedCards > 0) && <Row label="Missing references" value={`${orphanedUmas} Umas · ${orphanedCards} cards`} />}
        {sync.error && <p className="border-t border-accent-100 pt-2 text-xs font-bold text-danger">{sync.error}</p>}
        <Row label="Content packs" value={contentLabel} />
        {diagnostic && diagnostic.code !== 'ready' && (
          <div className="border-t border-accent-100 pt-2 text-xs">
            <p className="font-bold">{diagnostic.title}</p>
            <p className="mt-1 text-ink-soft">{diagnostic.message}</p>
            {diagnostic.action && (
              <button type="button" onClick={() => void runDiagnosticAction()} className="mt-2 min-h-11 rounded-sm border border-line px-3 font-bold">
                {diagnostic.action.label}
              </button>
            )}
          </div>
        )}
        {coverage && <Row label="Flair coverage" value={`${coverage.coveredSeries}/${coverage.totalSeries} series · ${coverage.mainVenues}/10 venues`} />}
        <div className="border-t border-accent-100 pt-2 text-right text-xs font-bold text-ink-soft">{contentCounts}</div>
        <Row label="Home Screen app" value={standalone ? 'Yes' : 'No (Safari tab)'} />
        <Row label="Reduced motion" value={reduced ? 'On' : 'Off'} />
      </Panel>
      {gameStatus === 'ready' && <Link to="/trainer" className="flex min-h-11 items-center justify-center rounded-sm bg-panel px-4 font-semibold text-accent-strong shadow-1">Open Trainer profile</Link>}
      {PUZZLES_RELEASE_ENABLED && persistent && <Panel><PuzzleBackupButton light /></Panel>}
      {(FARM_KITCHEN_RELEASE_ENABLED || farmSummary?.kitchen) && persistent && <Panel>
        <Link to="/farm" className="flex min-h-11 items-center font-semibold text-accent-strong">Open Farm · preparation and recovery</Link>
        <Button variant="secondary" disabled={granting} onClick={() => {
          setGranting(true)
          void import('../game/runtime').then(async ({ gameRuntime }) => (await gameRuntime.farmKitchenHost()).exportRecovery())
            .then(() => setFarmNote('Private Farm recovery exported. Keep it off public repositories.'))
            .catch(error => setFarmNote(error instanceof Error ? error.message : 'Recovery export failed; keep this device'))
            .finally(() => setGranting(false))
        }}>Export private Farm recovery</Button>
      </Panel>}
      {auth.authRequired && (
        <Button variant="secondary" onClick={() => (auth.user ? auth.signOut() : auth.signIn())}>
          {auth.user ? 'Sign out' : 'Sign in with Google'}
        </Button>
      )}
      <p className="px-1 text-center text-xs text-ink-soft">
        Tip: on iPhone, turn off Safari → Advanced → Feature Flags → “Prefer Page Rendering Updates near 60fps” for 120 Hz.
      </p>
    </div>
  )
}
