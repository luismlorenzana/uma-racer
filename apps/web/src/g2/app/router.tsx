// The new game's routes (docs/rework/11-hub-and-places.md §7): `/` is the start rule; `/:page` a page grid, with
// `?peek=:place` for a Peek and `?sheet=menu | featured | check-in` for a global sheet, so Back closes either;
// `/:page/:place/*` a place's sub-pages, then its Page; `/collection/reveal/uma/:umaId` the full-screen reveal; and
// today's routes redirected by `redirects.ts`. Anything else goes to `/`.
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
          { path: ':page', element: <PageRoute /> },
          { path: ':page/:place/*', element: <PlaceRoute /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const createG2Router = (basename: string) => createBrowserRouter(G2_ROUTES, { basename })
