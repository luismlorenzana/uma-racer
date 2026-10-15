// The bottom bar (docs/rework/11-hub-and-places.md §2.2): Town Hall · Training · (RACE) · Farm · menu. RACE is raised
// and opens the Racing page. The active page shows by shape (the two-tone icon and the chamfered underline) as well as
// colour. Only Farm and Training carry badges: Umas with something to collect there, hidden at 0, so the bar stays
// quiet.
import { HUB_PAGE_NAMES, hubWords, type HubPage } from '@racer/domain/hub'
import { m } from 'motion/react'
import { Link, useLocation } from 'react-router'
import { CarrotIcon, HomeIcon, RaceIcon, StatsIcon, type IconComponent } from '../../ui/icons'
import { useHub } from '../app/game'
import { MenuIcon } from '../ui/icons'
import { withParam } from './nav'

interface Tab {
  readonly page: HubPage
  readonly label: string
  readonly Icon: IconComponent
  readonly raised?: boolean
}

const TABS: readonly Tab[] = [
  { page: 'town', label: HUB_PAGE_NAMES.town, Icon: HomeIcon },
  { page: 'training', label: HUB_PAGE_NAMES.training, Icon: StatsIcon },
  { page: 'racing', label: hubWords('race'), Icon: RaceIcon, raised: true },
  { page: 'farm', label: HUB_PAGE_NAMES.farm, Icon: CarrotIcon },
]

const PRESS = { duration: 0.12, ease: [0.2, 0, 0, 1] as const }

export function BottomBar({ active }: { active: HubPage | null }) {
  const view = useHub()
  const location = useLocation()
  const badge = (page: HubPage): number => (page === 'farm' ? view?.tabs.farm ?? 0 : page === 'training' ? view?.tabs.training ?? 0 : 0)
  return (
    <nav aria-label={hubWords('bar')} className="pb-safe relative z-20 shrink-0 px-3" data-g2="bottom-bar">
      <div className="mb-2 flex items-end justify-between rounded-lg border border-hairline bg-panel/90 px-1 pt-1.5 pb-1 shadow-2 backdrop-blur-xl">
        {TABS.map((tab) => {
          const isActive = tab.page === active
          const count = badge(tab.page)
          const label = count > 0 ? hubWords('tab-ready', { page: tab.label, n: count }) : tab.label
          return (
            <Link
              key={tab.page}
              to={`/${tab.page}`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-w-0 flex-1 justify-center ${tab.raised ? '-mt-6' : ''}`}
            >
              {tab.raised ? (
                <m.span
                  whileTap={{ scale: 0.94 }}
                  transition={PRESS}
                  className={`flex size-14 flex-col items-center justify-center rounded-full border bg-accent text-ink shadow-2 ${
                    isActive ? 'border-ink/60 ring-2 ring-ink/25' : 'border-accent-strong/30'
                  }`}
                >
                  {/* On the accent disc the flag's tone is the panel white, so the checks still read. */}
                  <tab.Icon size={24} variant="duotone" accent="var(--color-panel)" />
                  <span className="font-display -mt-0.5 text-[10px] font-semibold">{tab.label}</span>
                </m.span>
              ) : (
                <m.span
                  whileTap={{ scale: 0.94 }}
                  transition={PRESS}
                  className="relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 px-1 py-1"
                >
                  <tab.Icon size={24} variant={isActive ? 'duotone' : 'line'} className={isActive ? 'text-ink' : 'text-ink-faint'} />
                  <span className={`whitespace-nowrap text-[11px] font-semibold ${isActive ? 'text-ink' : 'text-ink-faint'}`}>{tab.label}</span>
                  {isActive && <span aria-hidden className="chamfer-tr absolute -bottom-0.5 h-0.5 w-7 bg-accent" />}
                  {count > 0 && (
                    <span aria-hidden className="absolute top-0 right-1 min-w-4 rounded-full bg-success px-1 text-center text-[10px] leading-4 font-bold text-ink-on-dark">
                      {count}
                    </span>
                  )}
                </m.span>
              )}
            </Link>
          )
        })}
        <Link
          to={withParam(location, 'sheet', 'menu')}
          state={{ back: true }}
          aria-label={hubWords('menu-label')}
          className="flex min-h-11 min-w-12 flex-col items-center justify-center gap-0.5 px-1 py-1 text-ink-faint"
        >
          <MenuIcon size={24} />
          <span className="text-[11px] font-semibold">{hubWords('menu')}</span>
        </Link>
      </div>
    </nav>
  )
}
