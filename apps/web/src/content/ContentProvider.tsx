import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useAuth } from '@luismlorenzana/uma-kit/auth'
import { ContentProvider as SharedContentProvider, createContentClient } from '@luismlorenzana/uma-kit/content'
import {
  diagnoseContentError,
  diagnoseLoadedContent,
  SIGNED_OUT_CONTENT,
  type ContentDiagnostic,
} from './diagnostics'
import type { LoadedContent } from './view'

let runtimePromise: Promise<typeof import('../app/contentRuntime')> | undefined

function loadRuntime() {
  runtimePromise ??= import('../app/contentRuntime')
  return runtimePromise
}

export type ContentState =
  | { status: 'signed-out'; diagnostic: ContentDiagnostic }
  | { status: 'loading' }
  | { status: 'empty'; diagnostic: ContentDiagnostic; retry: () => Promise<void> }
  | { status: 'error'; error: Error; diagnostic: ContentDiagnostic; retry: () => Promise<void> }
  | { status: 'ready'; content: LoadedContent; diagnostic: ContentDiagnostic; retry: () => Promise<void> }

const ContentContext = createContext<ContentState | null>(null)
const bootClient = createContentClient({ token: async () => null, cache: null })

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

  const retry = useCallback(async () => {
    await query.refetch()
  }, [query.refetch])

  const loaded = useMemo(() => query.data ? { ...query.data.value, origin: query.data.origin } : null, [query.data])

  const value = useMemo<ContentState>(() => {
    if (auth.ready && !signedIn) return { status: 'signed-out', diagnostic: SIGNED_OUT_CONTENT }
    if (query.isError) return { status: 'error', error: query.error, diagnostic: diagnoseContentError(query.error), retry }
    if (!loaded) return { status: 'loading' }
    return { status: 'ready', content: loaded, diagnostic: diagnoseLoadedContent(loaded), retry }
  }, [auth.ready, loaded, query.error, query.isError, retry, signedIn])

  return <SharedContentProvider client={query.data?.client ?? bootClient}><ContentContext.Provider value={value}>{children}</ContentContext.Provider></SharedContentProvider>
}

export function useContent(): ContentState {
  const value = useContext(ContentContext)
  if (!value) throw new Error('useContent must be used within ContentProvider')
  return value
}
