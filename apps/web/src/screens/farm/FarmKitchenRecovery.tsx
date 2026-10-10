// T124 release boundary: explicit archived preparation and retained Retry/Export, never fake empty success.
import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { Link } from 'react-router'
import type { FarmKitchenEnvironment } from './FarmKitchenScreen'
import type { FarmKitchenView } from '../../game/farm/kitchen/view'
import { readFarmCutoverRecovery, type FarmCutoverRecovery } from '../../game/farm/kitchen/cutover'
import { Button } from '../../ui/Button'
import { Panel } from '../../ui/Panel'

export function FarmKitchenRecovery({ environment, view, error, reload }: {
  environment: FarmKitchenEnvironment; view: FarmKitchenView | null; error: string | null; reload(): Promise<void>
}) {
  const [working, setWorking] = useState(false), [message, setMessage] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<FarmCutoverRecovery | null>(null)
  useEffect(() => { const subscription = liveQuery(() => readFarmCutoverRecovery(environment.database)).subscribe({
    next: setRecovery, error: reason => setMessage(reason instanceof Error ? reason.message : 'Recovery evidence must be retained'),
  }); return () => subscription.unsubscribe() }, [environment.database])
  const upgrade = !error && (view?.mode === 'legacy' || view?.mode === 'upgrade')
  const control = view?.control
  const run = async (action: () => Promise<void>) => {
    if (working) return
    setWorking(true); setMessage(null)
    try { await action() } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Keep this device and Retry or Export') }
    finally { setWorking(false) }
  }
  return <div className="h-dvh overflow-y-auto bg-page px-4 pt-safe pb-safe text-ink">
    <Link to={environment.isolated ? environment.root : '/'} className="flex min-h-11 items-center font-semibold text-accent-strong">Back to Home</Link>
    <Panel className="mt-4 space-y-3">
      <h1 className="font-display text-2xl font-bold">{upgrade ? 'Prepare Stable Kitchen' : 'Farm needs recovery'}</h1>
      <p className="text-sm text-ink-soft">{error ?? recovery?.message ?? view?.message ?? 'Retain this save. No unsupported generation will reopen the old writer.'}</p>
      {upgrade && <>
        <p className="text-sm">This one-time upgrade resets every outfit’s Farm Level to 1 and clears old Extra Stats purchases and active builds. All 30 stations open.</p>
        <p className="text-sm text-ink-soft">Cards, racing, CL, Inspiration, RPG, Puzzles and Items stay. Existing crop jobs keep their deadlines and can be collected once for their old crop, with 0 new Farm EXP.</p>
        <p className="text-sm text-ink-soft">A verified private whole-account archive is kept on this device before any reset. Download it here or in Settings; never publish it. Connect and let pending changes sync first.</p>
      </>}
      <p role="status" aria-live="polite" className="text-sm font-semibold">{working ? 'Saving protected steps… keep this device open' : control ? `${control.phase} · ${control.nextOutfitIndex}/${control.outfitCount} outfits prepared` : 'No reset has been acknowledged'}</p>
      {message && <p role="alert" className="text-sm text-danger">{message}</p>}
      <Button className="w-full" disabled={working} onClick={() => void run(async () => {
        if (upgrade) {
          if (!await environment.host.prepareUpgrade()) {
            const state = await readFarmCutoverRecovery(environment.database)
            setMessage(state?.message ?? 'Finish current commits, reconnect and Retry. Original intents remain saved.')
          }
        }
        await reload()
      })}>{working ? 'Preparing…' : upgrade ? control || recovery ? 'Retry protected preparation' : 'Archive and prepare Farm' : 'Retry reading Farm'}</Button>
      <Button variant="secondary" className="w-full" disabled={working} onClick={() => void run(async () => {
        await environment.host.exportRecovery(); setMessage('Private recovery download requested. The original archive stays on its capturing device; nothing was restored.')
      })}>Export private recovery</Button>
    </Panel>
  </div>
}

export function FarmResetNotice({ environment }: { environment: FarmKitchenEnvironment }) {
  const [archive, setArchive] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null)
  useEffect(() => { let live = true; void readFarmCutoverRecovery(environment.database).then(state => {
    if (live && state?.phase === 'active') setArchive(state.archiveId)
  }).catch(() => {}); return () => { live = false } }, [environment.database])
  return <Panel className="space-y-2 border-info/30 bg-info/5">
    <p className="text-micro">Farm generation active</p>
    <p className="text-[12px] text-ink-soft">Farm levels and old Extra Stats were reset once. Other progression and Items were preserved. Existing crop jobs finish as Legacy Produce with 0 new EXP.</p>
    <p className="text-[12px] text-ink-soft">{archive ? 'The private pre-reset archive is retained on this device, also downloadable in Settings.' : 'The original pre-reset archive stays on the device that prepared the Farm.'}</p>
    <Button variant="secondary" onClick={() => void environment.host.exportRecovery().then(() => setMessage('Private recovery download requested; no restore.')).catch(reason => setMessage(String(reason)))}>Export private Farm recovery</Button>
    {message && <p role="status" className="text-[12px]">{message}</p>}
  </Panel>
}
