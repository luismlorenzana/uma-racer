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
