// The app's routes (docs/game/11-hub-and-places.md §7): `/` is the start rule; `/:page` a page's map, with
// `?peek=:place` for a Peek and `?sheet=menu` for the menu, so Back closes either; `/:page/:place/*` a place's
// sub-pages, then its Page; and anything else goes to `/`.
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { RacerShell } from '../hub/RacerShell'
import { LiveGates } from './gates'
import { Root } from './Root'
import { PageRoute, PlaceRoute, StartRoute } from './routes'

export const ROUTES: RouteObject[] = [
  {
    element: <Root />,
    children: [
      {
        element: <RacerShell />,
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

export const createRouter = (basename?: string) => createBrowserRouter(ROUTES, basename === undefined ? {} : { basename })

/** The live router (`main.tsx`): the same routes inside uma-kit's boot gates (SD4, `gates.tsx`). */
export const createLiveRouter = () => createBrowserRouter([{ element: <LiveGates />, children: ROUTES }])
