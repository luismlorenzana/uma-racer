// Production adapter only. The common T122 screens and proof do not import account runtime state.
import { useEffect, useMemo, useState } from 'react'
import { useContent } from '../../content/ContentProvider'
import { db } from '../../game/db'
import type { FarmKitchenHost } from '../../game/farm/kitchen/host'
import { gameRuntime } from '../../game/runtime'
import { useGame } from '../../game/store'
import { ScreenState } from '../../ui/ScreenState'
import { FarmKitchenCommonShell, type FarmKitchenEnvironment } from './FarmKitchenScreen'

export function FarmKitchenProductionShell() {
  const contentState = useContent(), umas = useGame(state => state.umas), persistent = useGame(state => state.persistent)
  const status = useGame(state => state.status), gameError = useGame(state => state.error)
  const contentReady = contentState.status === 'ready'
  const [host, setHost] = useState<FarmKitchenHost | null>(null), [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setHost(null); setError(null)
    // Full-screen routes can mount before GameProvider has loaded the durable save. Never acquire an old
    // generation (or permanently remember its not-ready rejection) on a direct link or refresh.
    if (status === 'ready' && persistent && contentReady) {
      void gameRuntime.farmKitchenHost().then(value => { if (live) setHost(value) }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : String(reason)) })
    }
    return () => { live = false }
  }, [status, persistent, contentReady])
  const environment = useMemo<FarmKitchenEnvironment | null>(() => {
    if (!host || contentState.status !== 'ready') return null
    return { database: db, host, content: contentState.content, isolated: false, root: '/farm', ownerDebugAllowed: true,
      workers: Object.keys(umas).map(id => { const template = contentState.content.umas.byId.get(id); return { id, name: template?.name ?? 'Owned Uma', outfit: template?.outfit ?? null } }) }
  }, [contentState, host, umas])
  if (status === 'signed-out' || contentState.status === 'signed-out') return <div className="flex h-dvh items-center justify-center bg-page px-4"><ScreenState title="Sign in to open Farm" detail="Your local Farm stays untouched while signed out." action={{ label: 'Open Settings', to: '/settings' }} /></div>
  if (contentState.status === 'error' || contentState.status === 'empty' || status === 'error') return <div className="flex h-dvh items-center justify-center bg-page px-4"><ScreenState title="Farm needs attention" detail={gameError ?? (contentState.status === 'error' || contentState.status === 'empty' ? contentState.diagnostic.message : 'The save could not be opened. No Farm preparation was started.')} action={{ label: 'Open Settings', to: '/settings' }} /></div>
  if (status !== 'ready' || !contentReady) return <div className="flex h-dvh items-center justify-center bg-page px-4"><ScreenState title="Opening Stable Kitchen…" detail="Loading verified content and your durable save. Farm preparation never starts automatically." /></div>
  if (!persistent) return <div className="flex h-dvh items-center justify-center bg-page px-4"><ScreenState title="Persistent Farm unavailable" detail="The kitchen only opens against durable device storage. Reload after storage is available." action={{ label: 'Back Home', to: '/' }} /></div>
  if (!environment) return <div className="flex h-dvh items-center justify-center bg-page px-4"><ScreenState title={error ? 'Farm unavailable' : 'Opening Stable Kitchen…'} detail={error ?? (contentState.status === 'ready' ? 'Reading the protected Farm generation.' : 'Loading verified Uma content.')} action={error ? { label: 'Back Home', to: '/' } : undefined} /></div>
  return <FarmKitchenCommonShell environment={environment} />
}
