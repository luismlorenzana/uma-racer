// The shell (docs/game/11-hub-and-places.md §2, §6): the account bar on top, the route between, the bottom bar in the
// thumb zone, and the global sheets' host, at 390×844 first with safe areas and `h-dvh`. A full-screen flow inside a
// place route (a slot's `fullScreen(rest)`) hides both bars. While the port boots it is a quiet frame: bars without
// numbers, nothing between. Each page visit is remembered for the start rule.
import { isHubPage, placeOnPage } from '@racer/domain/hub'
import { useEffect } from 'react'
import { Outlet, useParams } from 'react-router'
import { rememberPage } from '../app/start'
import { isFullScreen } from '../places/registry'
import { AccountBar } from './AccountBar'
import { BottomBar } from './BottomBar'
import { SheetHost } from './SheetHost'

export function Shell() {
  const params = useParams()
  const page = isHubPage(params['page']) ? params['page'] : null
  const place = page === null ? undefined : placeOnPage(page, params['place'])
  const fullScreen = isFullScreen(place, params['*'] ?? '')

  useEffect(() => {
    if (page !== null) rememberPage(page)
  }, [page])

  return (
    <div className="flex h-dvh flex-col" data-g2="shell" data-full-screen={fullScreen || undefined}>
      {!fullScreen && <AccountBar />}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
      {!fullScreen && <BottomBar active={page} />}
      <SheetHost />
    </div>
  )
}
