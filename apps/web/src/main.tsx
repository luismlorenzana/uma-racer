// The app's entry (T143, T147; docs/rework/13-removals-and-plan-changes.md §6, docs/game/architecture.md): the game on
// the private content and the owner's account. First uma-kit's setup (`app/kit.ts`: the device-key prefix and the
// stored Appearance on `<html>`), then from the outside in:
// - TanStack Query for the content, uma-kit's auth provider with the game's Firebase config (`app/auth.ts`; the SDK
//   loaded lazily) and the content provider, whose requests carry the owner's token;
// - the kit's motion root (`LazyMotion strict`, so only `m.*` draws, and the reduced-motion setting) and its art
//   provider (uma-art's atlases, `app/art.ts`);
// - the session (`app/session.tsx`): the boot uma-kit's gates run (the device save opened on the content with the
//   first-boot wipe and the purge call), its requests on the owner's token, sync following the auth state;
// - the live router (`app/router.tsx`: the routes inside the kit's `BootGates`, with the old app's redirects), and the
//   kit's update prompt, fed by vite-plugin-pwa's `registerSW` (SD4).
// Dev builds mount the synthetic seeds instead at `/dev/seeds/*` (`dev/main.tsx`); a production build holds none of it.
import './index.css'

import { AuthProvider } from '@luismlorenzana/uma-kit/auth'
import { UpdateNotice, watchAppUpdates } from '@luismlorenzana/uma-kit/places'
import { KitArtProvider, MotionRoot } from '@luismlorenzana/uma-kit/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { registerSW } from 'virtual:pwa-register'
import { setTokenProvider } from './api/client'
import { RACER_ART } from './app/art'
import { FIREBASE, ownerToken } from './app/auth'
import { setupKit } from './app/kit'
import { ContentProvider } from './content/ContentProvider'
import { createLiveRouter, isSeedsPath } from './app/router'
import { SessionProvider } from './app/session'

setupKit()
const root = createRoot(document.getElementById('root')!)

if (import.meta.env.DEV && isSeedsPath(location.pathname)) {
  void import('./dev/main').then(({ mountSeeds }) => mountSeeds(root))
} else {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false },
    },
  })
  const router = createLiveRouter()
  setTokenProvider(ownerToken)
  watchAppUpdates(registerSW)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider config={FIREBASE}>
          <ContentProvider>
            <MotionRoot>
              <KitArtProvider art={RACER_ART}>
                <SessionProvider>
                  <RouterProvider router={router} />
                </SessionProvider>
                <UpdateNotice />
              </KitArtProvider>
            </MotionRoot>
          </ContentProvider>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
