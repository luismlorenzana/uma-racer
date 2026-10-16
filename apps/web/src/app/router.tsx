// The app's routes (docs/game/11-hub-and-places.md §7): `/` is the start rule; `/:page` a page's map, with
// `?peek=:place` for a Peek and `?sheet=menu | featured | check-in` for a global sheet, so Back closes either;
// `/:page/:place/*` a place's sub-pages, then its Page; `/collection/reveal/uma/:umaId` the full-screen reveal; and
// the old app's routes redirected by `redirects.ts`. Anything else, deleted paths included, goes to `/`. The live router
// has no basename; the seeds' mount (dev builds only) serves the same routes under `SEEDS_PATH`.
import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, useLocation, useParams, type RouteObject } from 'react-router'
import { Shell } from '../hub/Shell'
import { REDIRECTS, redirectPath } from './redirects'
import { Root } from './Root'
import { PageRoute, PlaceRoute, RevealRoute, StartRoute } from './routes'

function Redirect({ to }: { to: string }) {
  const params = useParams()
  const location = useLocation()
  if (to === '/') return <Navigate to="/" replace />
  return <Navigate to={{ pathname: redirectPath(to, params), search: location.search, hash: location.hash }} replace />
}

// Dev proofs (§7.2: new proofs live under `/dev/`, beside the places they prove), in dev builds only, so a production
// build drops them and their chunks. T142's shows the check-in's pieces, on the seeds at `/dev/seeds/dev/check-in`.
const DEV_ROUTES: RouteObject[] = import.meta.env.DEV
  ? [{ path: 'dev/check-in', element: <DevProof Proof={lazy(() => import('../dev/CheckInProof'))} /> }]
  : []

function DevProof({ Proof }: { Proof: ComponentType }) {
  return <Suspense fallback={null}><Proof /></Suspense>
}

export const G2_ROUTES: RouteObject[] = [
  {
    element: <Root />,
    children: [
      ...REDIRECTS.map((row): RouteObject => ({ path: row.from.slice(1), element: <Redirect to={row.to} /> })),
      { path: 'collection/reveal/uma/:umaId', element: <RevealRoute /> },
      {
        element: <Shell />,
        children: [
          { index: true, element: <StartRoute /> },
          ...DEV_ROUTES,
          { path: ':page', element: <PageRoute /> },
          { path: ':page/:place/*', element: <PlaceRoute /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

/** Where dev builds mount the synthetic seeds (`dev/main.tsx`); in production it is an unknown path, so `/`. */
export const SEEDS_PATH = '/dev/seeds'

/**
 * Whether a path is the seeds' mount: its root, with or without the trailing slash, and anything under it. The root
 * runs the start rule under the mount, as `/` does on the live router (T145).
 */
export const isSeedsPath = (pathname: string): boolean => pathname === SEEDS_PATH || pathname.startsWith(`${SEEDS_PATH}/`)

export const createG2Router = (basename?: string) => createBrowserRouter(G2_ROUTES, basename === undefined ? {} : { basename })
