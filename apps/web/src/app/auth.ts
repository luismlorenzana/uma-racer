// The owner's sign-in (SD4; docs/game/architecture.md "Getting in"): uma-kit's `/auth` with this game's Firebase
// config. Auth is on only when the build has a config (production); local dev has none, so the app runs as `local-dev`
// and the API accepts it (`AUTH_MODE=disabled`). The SDK loads by `import()` inside the kit, never in the entry chunk.
import { firebaseEnabled, idToken, signIn, signOut, type FirebaseConfig } from '@luismlorenzana/uma-kit/auth'

export const FIREBASE: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // The Hosting domain (uma-racer.web.app), so the auth handler is same-origin inside the iOS Home Screen app.
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

export const authOn = firebaseEnabled(FIREBASE)

/** The signed-in owner's ID token for the content's and the save's requests; null with auth off, signed out or offline. */
export const ownerToken = (): Promise<string | null> => idToken(FIREBASE)

export const ownerSignIn = (): Promise<void> => signIn(FIREBASE)
export const ownerSignOut = (): Promise<void> => signOut(FIREBASE)
