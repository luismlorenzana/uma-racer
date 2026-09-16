import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useContent } from '../content/ContentProvider'
import { clearGameState, setGameLifecycle } from './store'

let runtimePromise: Promise<typeof import('./runtime')> | undefined

function loadRuntime() {
  runtimePromise ??= import('./runtime')
  return runtimePromise
}

function stopRuntime(clear: boolean): void {
  void runtimePromise?.then(({ gameRuntime }) => gameRuntime.stop(clear))
}

export function GameProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const content = useContent()

  useEffect(() => {
    let cancelled = false
    if (!auth.ready) {
      setGameLifecycle('booting')
      return
    }
    if (auth.authRequired && !auth.user) {
      stopRuntime(true)
      clearGameState('signed-out')
      return
    }
    if (content.status !== 'ready') {
      stopRuntime(false)
      setGameLifecycle(content.status === 'error' ? 'error' : 'waiting-content', content.status === 'error' ? content.error.message : null)
      return
    }
    void loadRuntime().then(({ gameRuntime }) => {
      if (!cancelled) void gameRuntime.start(content.content)
    })
    return () => {
      cancelled = true
      stopRuntime(false)
    }
  }, [auth.authRequired, auth.ready, auth.user, content])

  return children
}
