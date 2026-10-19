import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useAuth } from '@luismlorenzana/uma-kit/auth'
import {
  diagnoseContentError,
  diagnoseLoadedContent,
  EMPTY_BUCKET_CONTENT,
  SIGNED_OUT_CONTENT,
  type ContentDiagnostic,
} from './diagnostics'
import type { LoadedContent } from './view'

let runtimePromise: Promise<typeof import('./master')> | undefined

function loadRuntime() {
  runtimePromise ??= import('./master')
  return runtimePromise
}

export type ContentState =
  | { status: 'signed-out'; diagnostic: ContentDiagnostic }
  | { status: 'loading' }
  | { status: 'empty'; diagnostic: ContentDiagnostic; retry: () => Promise<void> }
  | { status: 'error'; error: Error; diagnostic: ContentDiagnostic; retry: () => Promise<void> }
  | { status: 'ready'; content: LoadedContent; diagnostic: ContentDiagnostic; retry: () => Promise<void> }

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

  const retry = useCallback(async () => {
    await query.refetch()
  }, [query])

  const value = useMemo<ContentState>(() => {
    if (auth.ready && !signedIn) return { status: 'signed-out', diagnostic: SIGNED_OUT_CONTENT }
    if (query.isError) return { status: 'error', error: query.error, diagnostic: diagnoseContentError(query.error), retry }
    if (!query.data) return { status: 'loading' }
    if (query.data.status === 'empty') return { status: 'empty', diagnostic: EMPTY_BUCKET_CONTENT, retry }
    return { status: 'ready', content: query.data.content, diagnostic: diagnoseLoadedContent(query.data.content), retry }
  }, [auth.ready, query.data, query.error, query.isError, retry, signedIn])

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContent(): ContentState {
  const value = useContext(ContentContext)
  if (!value) throw new Error('useContent must be used within ContentProvider')
  return value
}
