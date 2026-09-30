// Read-only Farm loading plus focus refresh; mutations remain explicit FarmHost commands (T084).

import { useCallback, useEffect, useState } from 'react'
import { getFarmHost, type FarmView } from './host'

export type FarmLoadState =
  | { status: 'loading'; view: null; error: null }
  | { status: 'ready'; view: FarmView; error: null }
  | { status: 'error'; view: FarmView | null; error: string }

export function useFarmView(enabled = true): {
  state: FarmLoadState
  setView: (view: FarmView) => void
  reload: () => Promise<FarmView | null>
} {
  const [state, setState] = useState<FarmLoadState>({ status: 'loading', view: null, error: null })
  const reload = useCallback(async () => {
    if (!enabled) return null
    try {
      const view = await getFarmHost().getFarm()
      setState({ status: 'ready', view, error: null })
      return view
    } catch (reason) {
      setState((current) => ({ status: 'error', view: current.view,
        error: reason instanceof Error ? reason.message : 'Farm could not be loaded' }))
      return null
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void reload()
    const refresh = () => { void reload() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled, reload])

  return {
    state,
    setView: (view) => setState({ status: 'ready', view, error: null }),
    reload,
  }
}
