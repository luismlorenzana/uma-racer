import type { Auth } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // Use the Hosting domain (uma-racer.web.app) so the auth handler is same-origin inside the iOS Home Screen app.
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

// Auth is enabled only when Firebase config is present (prod). Local dev has no config, so the app runs without
// sign-in and the API accepts unauthenticated requests (AUTH_MODE=disabled) — same as uma-planner.
export const firebaseEnabled = Boolean(config.apiKey && config.authDomain)

let authPromise: Promise<Auth> | undefined

/** Loads the Firebase SDK on demand, keeping it out of the startup bundle (game-web-tech.md performance budgets). */
export function loadAuth(): Promise<Auth> {
  authPromise ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(([{ initializeApp }, { getAuth }]) =>
    getAuth(initializeApp(config)),
  )
  return authPromise
}

/**
 * The signed-in owner's Firebase ID token, for the content's and the save's requests; null with auth off, signed out,
 * or when Firebase can't refresh it (a cached content response still works offline, and the save waits).
 */
export async function idToken(): Promise<string | null> {
  if (!firebaseEnabled) return null
  const auth = await loadAuth()
  return auth.currentUser ? auth.currentUser.getIdToken().catch(() => null) : null
}

/** Google sign-in by redirect, which works inside the iOS Home Screen app. A no-op with auth off. */
export async function signIn(): Promise<void> {
  if (!firebaseEnabled) return
  const [auth, { GoogleAuthProvider, signInWithRedirect }] = await Promise.all([loadAuth(), import('firebase/auth')])
  await signInWithRedirect(auth, new GoogleAuthProvider())
}

export async function signOut(): Promise<void> {
  if (!firebaseEnabled) return
  const [auth, { signOut: firebaseSignOut }] = await Promise.all([loadAuth(), import('firebase/auth')])
  await firebaseSignOut(auth)
}
