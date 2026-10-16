// The synthetic seeds' mount (T137, T143), dev builds only: `src/main.tsx` loads this module behind
// `import.meta.env.DEV` for any path under `SEEDS_PATH` (`/dev/seeds/*`), so a production build holds none of it
// (scripts/check-size.mjs refuses one that does). The app's own routes under that basename, over the in-memory port on
// `@racer/domain/sim`'s invented seeds (`?seed=busy | fresh | quiet | gate | promote | tired | spent | stopped`, `?at=HH:MM`),
// or the device save on the seeds' content with `?save=device` (`&wipe` adds the wipe and the purge). It mounts no auth,
// content or service worker, so art falls back to each Uma's initial (uma-art's atlases are the app's own, so the Hub
// map and the bars draw as on the phone). The dev proofs sit under it too
// (`/dev/seeds/dev/check-in`).
import { KitArtProvider, MotionRoot } from '@luismlorenzana/uma-kit/ui'
import { StrictMode } from 'react'
import type { Root } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { RACER_ART } from '../app/art'
import { GameProvider } from '../app/GameProvider'
import { createG2Router, SEEDS_PATH } from '../app/router'
import { bootGame } from './boot'

export function mountSeeds(root: Root): void {
  const router = createG2Router(SEEDS_PATH)
  const boot = () => bootGame(location.search)
  root.render(
    <StrictMode>
      <MotionRoot>
        <KitArtProvider art={RACER_ART}>
          <GameProvider boot={boot}>
            <RouterProvider router={router} />
          </GameProvider>
        </KitArtProvider>
      </MotionRoot>
    </StrictMode>,
  )
}
