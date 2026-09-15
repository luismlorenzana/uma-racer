import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setTokenProvider } from '../api/client'
import { firebaseEnabled, loadAuth } from './firebase'

export interface AuthUser {
  name: string | null
  email: string | null
}

interface AuthState {
  ready: boolean
  authRequired: boolean
  user: AuthUser | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// Same contract as uma-planner's AuthProvider; the Firebase SDK is imported lazily after first render.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(firebaseEnabled ? null : { name: 'Local Dev', email: null })
  const [ready, setReady] = useState(!firebaseEnabled)

  useEffect(() => {
    if (!firebaseEnabled) {
      setTokenProvider(async () => null)
      return
    }
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    setTokenProvider(async () => {
      const auth = await loadAuth()
      // A cached content response is still usable offline even if Firebase cannot refresh an expired token.
      return auth.currentUser ? auth.currentUser.getIdToken().catch(() => null) : null
    })
    void Promise.all([loadAuth(), import('firebase/auth')]).then(([auth, { onAuthStateChanged }]) => {
      if (cancelled) return
      unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u ? { name: u.displayName, email: u.email } : null)
        setReady(true)
      })
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      authRequired: firebaseEnabled,
      signIn: async () => {
        if (!firebaseEnabled) return
        const [auth, { GoogleAuthProvider, signInWithRedirect }] = await Promise.all([loadAuth(), import('firebase/auth')])
        await signInWithRedirect(auth, new GoogleAuthProvider())
      },
      signOut: async () => {
        if (!firebaseEnabled) return
        const [auth, { signOut }] = await Promise.all([loadAuth(), import('firebase/auth')])
        await signOut(auth)
      },
    }),
    [ready, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
