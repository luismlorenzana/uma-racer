// The live session (T143; docs/rework/13-removals-and-plan-changes.md §6 "The web save as built"; docs/rearchitecture/
// 07-data-reset.md §3): the auth and content providers feed the game.
// - Once the private content is ready, `bootSaveGame` opens the device save: the first-boot wipe, the purge call, local
//   first. A page holds one save, so a later content version or a second render keeps it.
// - The save's requests carry the signed-in owner's Firebase ID token, and sync follows the auth state: paused while
//   signed out, so play goes on and the Sync chip says so. With auth off (local dev) the phone acts signed in, as before.
// - Account's Sign in and Sign out are the provider's, and the art reads the loaded content (`G2ContentContext`).
// - Before the save has opened, a signed-out phone or content that can't load gets one full-screen panel with its way
//   on, in the content diagnostics' plain words; while the content loads, the shell's quiet frame.
import { Button, Panel } from '@luismlorenzana/uma-kit/ui'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SaveGame } from '../save'
import { useAuth } from '../auth/AuthProvider'
import { firebaseEnabled, idToken, signIn, signOut } from '../auth/firebase'
import { useContent, type ContentState } from '../content/ContentProvider'
import { bootSaveGame } from './boot'
import { G2ContentContext } from './content'
import { GameProvider } from './GameProvider'

type Unready = Extract<ContentState, { status: 'signed-out' | 'empty' | 'error' }>

function SessionGate({ content }: { content: Unready }) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const { diagnostic } = content
  const act = async () => {
    const action = diagnostic.action
    if (action === null) return
    setBusy(true)
    try {
      if (action.kind === 'sign-in') await auth.signIn()
      else if (action.kind === 'sign-out') await auth.signOut()
      else if (content.status !== 'signed-out') await content.retry()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="pt-safe pb-safe flex h-dvh items-center px-4" data-g2="session-gate" data-gate={diagnostic.code}>
      <Panel className="w-full text-center" role="alert">
        <p className="font-display text-lg font-bold">{diagnostic.title}</p>
        <p className="mt-1 text-sm text-ink-soft">{diagnostic.message}</p>
        {diagnostic.action !== null && (
          <div className="mt-4 flex justify-center">
            <Button disabled={busy} onClick={() => void act()}>{diagnostic.action.label}</Button>
          </div>
        )}
      </Panel>
    </div>
  )
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const content = useContent()
  const signedIn = auth.ready && (!auth.authRequired || auth.user !== null)
  const loaded = content.status === 'ready' ? content.content : null
  const [save, setSave] = useState<SaveGame | null>(null)
  const signedInNow = useRef(signedIn)
  signedInNow.current = signedIn

  const boot = useMemo(() => loaded === null ? undefined : async () => {
    const booted = await bootSaveGame(loaded, {
      token: idToken,
      signedIn: signedInNow.current,
      ...(firebaseEnabled ? { signIn, signOut } : {}),
    })
    setSave(booted.save ?? null)
    return booted
  }, [loaded])

  useEffect(() => save?.setSignedIn(signedIn), [save, signedIn])

  if (save === null && (content.status === 'signed-out' || content.status === 'empty' || content.status === 'error')) {
    return <SessionGate content={content} />
  }
  return (
    <G2ContentContext.Provider value={loaded}>
      <GameProvider boot={boot}>{children}</GameProvider>
    </G2ContentContext.Provider>
  )
}
