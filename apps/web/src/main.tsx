// The app's entry (T143; docs/rework/11-hub-and-places.md; docs/rework/13-removals-and-plan-changes.md §6): the game on
// the private content and the owner's account. From the outside in:
// - TanStack Query for the content, the auth provider (Firebase loaded lazily) and the content provider;
// - the motion root (`LazyMotion strict`, so only `m.*` draws, and the reduced-motion setting);
// - the session (`app/session.tsx`): the device save opened on the content with the first-boot wipe and the purge call,
//   its requests on the owner's token, sync following the auth state;
// - the live router (`app/router.tsx`, with the old app's redirects), and the update prompt, registered as before.
// Dev builds mount the synthetic seeds instead at `/dev/seeds/*` (`dev/main.tsx`); a production build holds none of it.
import './index.css'
import './g2/g2.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { registerAppUpdates } from './app/register-updates'
import { UpdateNotice } from './app/UpdateNotice'
import { AuthProvider } from './auth/AuthProvider'
import { ContentProvider } from './content/ContentProvider'
import { MotionRoot } from './g2/app/motion'
import { createG2Router, SEEDS_PATH } from './g2/app/router'
import { SessionProvider } from './g2/app/session'

const root = createRoot(document.getElementById('root')!)

if (import.meta.env.DEV && (location.pathname === SEEDS_PATH || location.pathname.startsWith(`${SEEDS_PATH}/`))) {
  void import('./g2/dev/main').then(({ mountSeeds }) => mountSeeds(root))
} else {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false },
    },
  })
  const router = createG2Router()
  registerAppUpdates()
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ContentProvider>
            <MotionRoot>
              <SessionProvider>
                <RouterProvider router={router} />
              </SessionProvider>
              <UpdateNotice />
            </MotionRoot>
          </ContentProvider>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
