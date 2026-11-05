// The shell (docs/game/11-hub-and-places.md §2, §6; T147, T152): uma-kit's frame, account bar and bottom bar, with
// uma-racer's chips, tabs and sheets passed in. The frame is fixed to the screen's edges (not `h-dvh`, which an
// iPhone's Home Screen app can report a status bar short), the account bar on top, the route between, the floating
// bottom bar lifted only by the safe area, and the global sheets' host over all. A full-screen flow inside a place route
// (a slot's `fullScreen(rest)`) hides both bars. While the port boots the bars show no numbers. Each page visit is
// remembered for the start rule.
import { AccountBar, AppFrame, BottomBar, withParam, type BarTab, type CurrencyChip } from '@luismlorenzana/uma-kit/shell'
import { CardsIcon, HomeIcon, RaceIcon, StatsIcon, type IconComponent } from '@luismlorenzana/uma-kit/ui'
import { HUB_PAGE_NAMES, hubWords, isHubPage, placeOnPage, type HubPage, type HubWallet } from '@racer/domain/hub'
import { useEffect } from 'react'
import { Outlet, useLocation, useParams } from 'react-router'
import { useGame, useHub, type RacerSync } from '../app/game'
import { rememberPage } from '../app/start'
import { isFullScreen } from '../places/registry'
import { initialOf } from '../ui/uma'
import { SheetHost } from './SheetHost'

/** The trainer's name on the account bar: generation 3 keeps none of its own. */
export const TRAINER_NAME = 'Trainer'

/** The account bar's two chips (§2.1), each a link to the place that spends it; blank while the save loads. */
export function currencyChips(wallet: HubWallet | null): CurrencyChip[] {
  return [
    {
      key: 'uma-tickets',
      mark: 'currency/uma-ticket',
      value: wallet?.umaTickets ?? null,
      to: '/town/stable',
      label: hubWords('uma-tickets', { n: wallet?.umaTickets ?? '' }),
    },
    {
      key: 'card-tickets',
      // uma-art draws no Card Ticket yet: the kit's cards icon stands in until it does.
      mark: 'currency/card-ticket',
      fallback: <CardsIcon size={16} variant="duotone" />,
      value: wallet?.cardTickets ?? null,
      to: '/town/card-library',
      label: hubWords('card-tickets', { n: wallet?.cardTickets ?? '' }),
    },
  ]
}

/** The Sync chip's words (§2.1, D157): Offline, Sync paused, or Sync in amber (waiting) or red (failing); none when synced. */
const SYNC_WORDS: Readonly<Record<Exclude<RacerSync, 'synced'>, { readonly text: string; readonly label: string }>> = {
  offline: { text: hubWords('offline'), label: hubWords('offline-label') },
  paused: { text: hubWords('sync-paused'), label: hubWords('sync-paused-label') },
  waiting: { text: hubWords('sync'), label: hubWords('sync-waiting-label') },
  failing: { text: hubWords('sync'), label: hubWords('sync-failing-label') },
}

function RacerAccountBar() {
  const sync = useGame((snapshot) => snapshot.sync)
  const view = useHub()
  return (
    <AccountBar
      initial={initialOf(TRAINER_NAME)}
      account={{ to: '/town/account', label: hubWords('trainer', { name: TRAINER_NAME }) }}
      chips={currencyChips(view?.wallet ?? null)}
      sync={sync === 'synced' ? undefined : { state: sync, ...SYNC_WORDS[sync], to: '/town/account?row=sync' }}
    />
  )
}

interface Tab {
  readonly key: string
  readonly to: string
  readonly label: string
  readonly Icon: IconComponent
  readonly raised?: boolean
}

/** The bar's tabs (§2.2): Town Hall · Career · (Career, raised: her careers) · then the kit's Menu. */
const TABS: readonly Tab[] = [
  { key: 'town', to: '/town', label: HUB_PAGE_NAMES.town, Icon: HomeIcon },
  { key: 'career', to: '/career', label: HUB_PAGE_NAMES.career, Icon: StatsIcon },
  { key: 'careers', to: '/career/careers', label: hubWords('career'), Icon: RaceIcon, raised: true },
]

/** The tabs with the current one marked: the raised Career on the Careers place, else the page's own tab. */
export function barTabs(page: HubPage | null, place: string | null): BarTab[] {
  const current = place === 'careers' ? 'careers' : page
  return TABS.map((tab) => ({ key: tab.key, to: tab.to, label: tab.label, Icon: tab.Icon, active: tab.key === current, raised: tab.raised }))
}

function RacerBottomBar({ page, place }: { page: HubPage | null; place: string | null }) {
  const location = useLocation()
  return (
    <BottomBar
      label={hubWords('bar')}
      tabs={barTabs(page, place)}
      menu={{ to: withParam(location, 'sheet', 'menu'), label: hubWords('menu-label'), text: hubWords('menu'), state: { back: true } }}
    />
  )
}

export function RacerShell() {
  const params = useParams()
  const page = isHubPage(params['page']) ? params['page'] : null
  const place = page === null ? undefined : placeOnPage(page, params['place'])
  const fullScreen = isFullScreen(place, params['*'] ?? '')

  useEffect(() => {
    if (page !== null) rememberPage(page)
  }, [page])

  return (
    <AppFrame top={<RacerAccountBar />} bottom={<RacerBottomBar page={page} place={place?.id ?? null} />} overlays={<SheetHost />} fullScreen={fullScreen}>
      <Outlet />
    </AppFrame>
  )
}
