import '@fontsource/m-plus-rounded-1c/latin-500.css'
import '@fontsource/m-plus-rounded-1c/latin-800.css'
import './index.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { AuthProvider } from './auth/AuthProvider'
import { bootGame } from './game/store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false },
  },
})

void bootGame()

// Animation features load in a separate chunk; `strict` forbids the heavier `motion.*` components.
const loadMotionFeatures = () => import('./ui/motionFeatures').then((mod) => mod.default)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LazyMotion features={loadMotionFeatures} strict>
          <RouterProvider router={router} />
        </LazyMotion>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
