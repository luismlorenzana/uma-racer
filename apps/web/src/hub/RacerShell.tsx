// The shell (docs/game/11-hub-and-places.md §2, §6; T147): uma-kit's frame, account bar and bottom bar, with uma-racer's
// chips, tabs and sheets passed in. The frame is fixed to the screen's edges (not `h-dvh`, which an iPhone's Home Screen
// app can report a status bar short), the account bar on top, the route between, the floating bottom bar lifted only by
// the safe area, and the global sheets' host over all. A full-screen flow inside a place route (a slot's
// `fullScreen(rest)`) hides both bars. While the port boots the bars show no numbers. Each page visit is remembered for
// the start rule.
import { AccountBar, AppFrame, BottomBar, withParam, type BarTab, type CurrencyChip } from '@luismlorenzana/uma-kit/shell'
import { CarrotIcon, HomeIcon, RaceIcon, StatsIcon, type IconComponent } from '@luismlorenzana/uma-kit/ui'
import { HUB_PAGE_NAMES, hubWords, isHubPage, placeOnPage, type HubPage, type HubWallet } from '@racer/domain/hub'
import { useEffect } from 'react'
import { Outlet, useLocation, useParams } from 'react-router'
import { useGame, useHub, type G2Sync } from '../app/game'
import { rememberPage } from '../app/start'
import { isFullScreen } from '../places/registry'
import { initialOf } from '../ui/uma'
import { SheetHost } from './SheetHost'

/** The account bar's three chips (§2.1), each a link to the place that sells or spends it; blank while the save loads. */
export function currencyChips(wallet: HubWallet | null): CurrencyChip[] {
  const shards = wallet === null ? null : Math.min(wallet.shards, wallet.shardsPerTicket)
  return [
    {
      key: 'prize-money',
      mark: 'currency/prize-money',
      value: wallet?.prizeMoney ?? null,
      to: '/town/exchange',
      label: hubWords('prize-money', { n: wallet?.prizeMoney.toLocaleString('en-US') ?? '' }),
    },
    {
      key: 'speed-tickets',
      mark: 'currency/speed-ticket',
      value: wallet?.speedTickets ?? null,
      to: '/town/exchange?row=speed-tickets',
      label: hubWords('speed-tickets', { n: wallet?.speedTickets ?? '' }),
    },
    {
      key: 'uma-tickets',
      mark: 'currency/uma-ticket',
      value: wallet?.umaTickets ?? null,
      // The Shards toward the next ticket, gold once there are enough for one.
      extra: wallet === null ? undefined : (
        <span className={wallet.ticketReady ? 'text-accent-strong' : 'text-ink-soft'}>{' · '}{shards}/{wallet.shardsPerTicket}</span>
      ),
      to: '/town/stable?tab=locked',
      label: hubWords('uma-tickets', { n: wallet?.umaTickets ?? '', shards: shards ?? '', per: wallet?.shardsPerTicket ?? '' }),
    },
  ]
}

/** The Sync chip's words (§2.1, D157): Offline, Sync paused, or Sync in amber (waiting) or red (failing); none when synced. */
const SYNC_WORDS: Readonly<Record<Exclude<G2Sync, 'synced'>, { readonly text: string; readonly label: string }>> = {
  offline: { text: hubWords('offline'), label: hubWords('offline-label') },
  paused: { text: hubWords('sync-paused'), label: hubWords('sync-paused-label') },
  waiting: { text: hubWords('sync'), label: hubWords('sync-waiting-label') },
  failing: { text: hubWords('sync'), label: hubWords('sync-failing-label') },
}

function RacerAccountBar() {
  const name = useGame((snapshot) => snapshot.trainerName)
  const sync = useGame((snapshot) => snapshot.sync)
  const view = useHub()
  return (
    <AccountBar
      initial={name ? initialOf(name) : ''}
      account={{ to: '/town/account', label: hubWords('trainer', { name }) }}
      chips={currencyChips(view?.wallet ?? null)}
      sync={sync === 'synced' ? undefined : { state: sync, ...SYNC_WORDS[sync], to: '/town/account?row=sync' }}
    />
  )
}

/** The bar's tabs (§2.2): Town Hall · Training · (RACE, raised) · Farm. */
const TABS: readonly { readonly page: HubPage; readonly label: string; readonly Icon: IconComponent; readonly raised?: boolean }[] = [
  { page: 'town', label: HUB_PAGE_NAMES.town, Icon: HomeIcon },
  { page: 'training', label: HUB_PAGE_NAMES.training, Icon: StatsIcon },
  { page: 'racing', label: hubWords('race'), Icon: RaceIcon, raised: true },
  { page: 'farm', label: HUB_PAGE_NAMES.farm, Icon: CarrotIcon },
]

/** Only Farm and Training carry badges: Umas with something to collect there, hidden at 0, so the bar stays quiet. */
export function barTabs(active: HubPage | null, badges: { readonly farm: number; readonly training: number } | null): BarTab[] {
  return TABS.map((tab) => {
    const badge = tab.page === 'farm' ? badges?.farm ?? 0 : tab.page === 'training' ? badges?.training ?? 0 : 0
    return {
      key: tab.page,
      to: `/${tab.page}`,
      label: tab.label,
      Icon: tab.Icon,
      active: tab.page === active,
      raised: tab.raised,
      badge,
      badgeLabel: hubWords('tab-ready', { page: tab.label, n: badge }),
    }
  })
}

function RacerBottomBar({ active }: { active: HubPage | null }) {
  const view = useHub()
  const location = useLocation()
  return (
    <BottomBar
      label={hubWords('bar')}
      tabs={barTabs(active, view?.tabs ?? null)}
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
    <AppFrame top={<RacerAccountBar />} bottom={<RacerBottomBar active={page} />} overlays={<SheetHost />} fullScreen={fullScreen}>
      <Outlet />
    </AppFrame>
  )
}
