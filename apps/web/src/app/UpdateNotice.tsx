import { useSyncExternalStore } from 'react'
import { appUpdateLifecycle } from './update-lifecycle'

export function useAppUpdate() {
  return useSyncExternalStore(appUpdateLifecycle.subscribe, appUpdateLifecycle.getSnapshot, appUpdateLifecycle.getSnapshot)
}

export function UpdateNotice() {
  const update = useAppUpdate()
  if (update.status === 'current') return null
  const busy = update.activeActions > 0
  const working = update.status === 'activating' || update.status === 'restarting'

  return (
    <aside
      role="status"
      aria-label="App update ready"
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex min-h-14 items-center gap-3 rounded-sm border border-accent/40 bg-ink px-4 py-2 text-white shadow-3"
    >
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold">Update ready</p>
        <p className="text-xs text-white/70">
          {busy ? 'Your current action will finish and save first.' : working ? 'Preparing the new build…' : 'Restart to use the new build.'}
        </p>
      </div>
      {!working && (
        <button
          type="button"
          onClick={() => appUpdateLifecycle.requestRestart()}
          className="font-display min-h-11 shrink-0 rounded-sm bg-accent px-4 text-sm font-bold text-ink"
        >
          Restart
        </button>
      )}
    </aside>
  )
}
