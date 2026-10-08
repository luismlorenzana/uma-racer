import './index.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { registerAppUpdates } from './app/register-updates'
import { UpdateNotice } from './app/UpdateNotice'
import { AuthProvider } from './auth/AuthProvider'
import { ContentProvider } from './content/ContentProvider'
import { GameProvider } from './game/GameProvider'
import { isDevPuzzleProofPath } from './app/puzzle-proof-routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false },
  },
})

// Animation features load in a separate chunk; `strict` forbids the heavier `motion.*` components.
const loadMotionFeatures = () => import('./ui/motionFeatures').then((mod) => mod.default)

// Synthetic practice and DEV proofs never boot account/auth/content or register the account service worker.
// Practice still checks the release capability in its own entry component.
const isolatedPuzzleProof = location.pathname === '/puzzles/practice' ||
  import.meta.env.DEV && isDevPuzzleProofPath(location.pathname)
if (!isolatedPuzzleProof) registerAppUpdates()
const app = <LazyMotion features={loadMotionFeatures} strict><RouterProvider router={router} />{!isolatedPuzzleProof && <UpdateNotice />}</LazyMotion>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isolatedPuzzleProof ? app : <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ContentProvider>
          <GameProvider>
            {app}
          </GameProvider>
        </ContentProvider>
      </AuthProvider>
    </QueryClientProvider>}
  </StrictMode>,
)
