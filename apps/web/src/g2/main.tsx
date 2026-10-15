// The new game's dev mount (T137): `g2.html` at `/dev/g2/*`, answered by a dev-only rewrite in `vite.config.ts`, so it
// never reaches `dist`. Like today's isolated proofs it mounts no auth, content or service worker, so art falls back to
// each Uma's initial; the game is the in-memory port over `rework/sim`'s synthetic seeds (`?seed=busy | fresh | quiet`).
// T143 makes this app the entry and mounts the providers.
import '../index.css'
import './g2.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { bootGame } from './app/boot'
import { GameProvider } from './app/GameProvider'
import { MotionRoot } from './app/motion'
import { createG2Router } from './app/router'

const router = createG2Router('/dev/g2')
const boot = () => bootGame(location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionRoot>
      <GameProvider boot={boot}>
        <RouterProvider router={router} />
      </GameProvider>
    </MotionRoot>
  </StrictMode>,
)
