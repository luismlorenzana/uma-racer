// The live session (T143, SD4; docs/game/11-hub-and-places.md §2.4, docs/game/architecture.md "Getting in"): getting
// in is uma-kit's `BootGates` (splash → sign-in → boot → start page; uma-racer has no first-launch step), and this
// provider is what the gates' boot runs.
// - The boot waits for the private content (`ContentProvider`, on the owner's token), opens the device save on it
//   (`bootSaveGame`, local first) and waits for its first snapshot. A page holds
//   one save, so a later content version or a second render keeps it.
// - Then the start rule (`start.ts`) reads the opened save: a new account opens the Stable's Locked tab, a pending tap
//   the Farm, else the last page.
// - A boot that stops says why in the content diagnostics' plain words, or the save's, and its button does what helps:
//   Try again reloads the content, Switch account signs out (the sign-in gate follows), and a save that couldn't open
//   reloads the page. Nothing is ever cleared.
// - The save's requests carry the owner's Firebase ID token, and sync follows the auth state. With auth off (local
//   dev) the phone acts signed in. Account's Sign out is the kit's; the art reads the loaded content.
import { useAuth } from '@luismlorenzana/uma-kit/auth'
import { hubWords } from '@racer/domain/hub'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useContent, type ContentState } from '../content/ContentProvider'
import type { ContentDiagnostic } from '../content/diagnostics'
import type { LoadedContent } from '../content/view'
import { authOn, ownerSignIn, ownerSignOut, ownerToken } from './auth'
import { bootSaveGame, type G2Boot } from './boot'
import { G2ContentContext } from './content'
import type { G2Game, G2Snapshot } from './game'
import { GameProvider } from './GameProvider'
import { startPath } from './start'

/** Why the boot stopped: the gate's words, its button's label, and what the button does on the next attempt. */
export interface BootFailure {
  readonly words: string
  readonly retry: string
  readonly then: 'retry' | 'sign-out' | 'reload'
}

/** What `BootGates` runs (`gates.tsx`): the boot, the start page it found, and the last failure's words. */
export interface SessionGates {
  boot(): Promise<{ readonly firstLaunch: boolean }>
  startPath(): string
  readonly failure: BootFailure | null
}

const SessionGatesContext = createContext<SessionGates | null>(null)

export const useSessionGates = (): SessionGates | null => useContext(SessionGatesContext)

class ContentFailure extends Error {
  constructor(readonly diagnostic: ContentDiagnostic) {
    super(diagnostic.message)
  }
}

class SaveFailure extends Error {}

/** A failure's words and button, in the diagnostics' and the save's plain words. */
export function failureOf(error: unknown): BootFailure {
  if (error instanceof ContentFailure) {
    const { title, message, action } = error.diagnostic
    return {
      words: `${title}. ${message}`,
      retry: action?.label ?? hubWords('try-again'),
      then: action?.kind === 'sign-out' || action?.kind === 'sign-in' ? 'sign-out' : 'retry',
    }
  }
  const words = error instanceof SaveFailure && error.message !== '' ? error.message : hubWords('save-error-reason')
  return { words, retry: hubWords('try-again'), then: 'reload' }
}

/** The port's first opened snapshot: ready, or why it couldn't open. */
function opened(game: G2Game): Promise<G2Snapshot> {
  return new Promise((resolve) => {
    let unsubscribe: (() => void) | null = null
    let done = false
    const check = () => {
      const snapshot = game.getSnapshot()
      if (done || snapshot.status === 'booting') return
      done = true
      unsubscribe?.()
      resolve(snapshot)
    }
    unsubscribe = game.subscribe(check)
    check()
  })
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const content = useContent()
  const signedIn = auth.ready && (!auth.authRequired || auth.user !== null)
  const loaded = content.status === 'ready' ? content.content : null
  const [booted, setBooted] = useState<G2Boot | null>(null)
  const [failure, setFailure] = useState<BootFailure | null>(null)
  const signedInNow = useRef(signedIn)
  signedInNow.current = signedIn
  const contentNow = useRef<ContentState>(content)
  contentNow.current = content
  const lastFailure = useRef<BootFailure | null>(null)
  const start = useRef('/town')
  const waiting = useRef(new Set<() => void>())

  useEffect(() => {
    for (const wake of [...waiting.current]) wake()
  }, [content])
  useEffect(() => booted?.save?.setSignedIn(signedIn), [booted, signedIn])

  /** The loaded content, once it has loaded; its diagnostic when it can't. */
  const contentReady = useCallback(() => new Promise<LoadedContent>((resolve, reject) => {
    const check = () => {
      const now = contentNow.current
      if (now.status === 'ready') resolve(now.content)
      else if (now.status === 'empty' || now.status === 'error') reject(new ContentFailure(now.diagnostic))
      else return
      waiting.current.delete(check)
    }
    waiting.current.add(check)
    check()
  }), [])

  const signOut = auth.signOut
  const boot = useCallback(async (): Promise<{ readonly firstLaunch: boolean }> => {
    const last = lastFailure.current
    lastFailure.current = null
    setFailure(null)
    if (last?.then === 'reload') {
      window.location.reload()
      return new Promise<never>(() => {})
    }
    if (last?.then === 'sign-out') {
      await signOut()
      throw new Error('Signed out to switch account')
    }
    try {
      const now = contentNow.current
      if (last?.then === 'retry' && (now.status === 'empty' || now.status === 'error')) await now.retry()
      const content = await contentReady()
      const result = await bootSaveGame(content, {
        token: ownerToken,
        signedIn: signedInNow.current,
        ...(authOn ? { signIn: ownerSignIn, signOut: ownerSignOut } : {}),
      })
      setBooted(result)
      const snapshot = await opened(result.game)
      if (snapshot.status === 'error' || snapshot.state === null || snapshot.env === null) throw new SaveFailure(snapshot.words ?? '')
      start.current = startPath(result.rules.hubView(snapshot.state, result.game.now(), snapshot.env))
      return { firstLaunch: false }
    } catch (error) {
      const next = failureOf(error)
      lastFailure.current = next
      setFailure(next)
      throw error
    }
  }, [contentReady, signOut])

  const gates = useMemo<SessionGates>(() => ({ boot, startPath: () => start.current, failure }), [boot, failure])

  return (
    <SessionGatesContext.Provider value={gates}>
      <G2ContentContext.Provider value={loaded}>
        <GameProvider {...(booted === null ? {} : { game: booted.game, rules: booted.rules })}>{children}</GameProvider>
      </G2ContentContext.Provider>
    </SessionGatesContext.Provider>
  )
}
