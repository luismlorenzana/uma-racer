import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import type { LoadedContent } from './runtime'

let runtimePromise: Promise<typeof import('./runtime')> | undefined

function loadRuntime() {
  runtimePromise ??= import('./runtime')
  return runtimePromise
}

export type ContentState =
  | { status: 'signed-out' }
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; content: LoadedContent }

const ContentContext = createContext<ContentState | null>(null)

// Content is network reference data, so TanStack Query owns loading while the game save remains in Zustand.
export function ContentProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const signedIn = auth.ready && (!auth.authRequired || auth.user !== null)
  const identity = auth.authRequired ? (auth.user?.email ?? 'signed-out') : 'local'
  const query = useQuery({
    queryKey: ['content-runtime', identity],
    queryFn: async () => (await loadRuntime()).contentRuntime.load(),
    enabled: signedIn,
  })

  useEffect(() => {
    if (!signedIn) {
      void runtimePromise?.then(({ contentRuntime }) => contentRuntime.clear())
      queryClient.removeQueries({ queryKey: ['content-runtime'] })
    }
  }, [queryClient, signedIn])

  const value = useMemo<ContentState>(() => {
    if (auth.ready && !signedIn) return { status: 'signed-out' }
    if (query.isError) return { status: 'error', error: query.error }
    if (!query.data) return { status: 'loading' }
    if (query.data.status === 'empty') return { status: 'empty' }
    return { status: 'ready', content: query.data.content }
  }, [auth.ready, query.data, query.error, query.isError, signedIn])

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContent(): ContentState {
  const value = useContext(ContentContext)
  if (!value) throw new Error('useContent must be used within ContentProvider')
  return value
}
