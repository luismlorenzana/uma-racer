import { m } from 'motion/react'
import { NavLink } from 'react-router'
import { BadgesIcon, CardsIcon, HomeIcon, RaceIcon, StableIcon } from '../ui/icons'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/stable', label: 'Stable', Icon: StableIcon },
  { to: '/race', label: 'Race', Icon: RaceIcon, primary: true },
  { to: '/cards', label: 'Cards', Icon: CardsIcon },
  { to: '/badges', label: 'Badges', Icon: BadgesIcon },
] as const

/** Bottom tab bar in the thumb zone, with the Race tab raised in the centre (docs/design/visual-system.md#components). */
export function TabBar() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 px-3">
      <div className="mb-2 flex items-end justify-between rounded-lg border border-hairline bg-panel/85 px-2 pt-1.5 pb-1 shadow-2 backdrop-blur-xl">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="flex flex-1 justify-center">
            {({ isActive }) =>
              'primary' in tab ? (
                <m.span
                  whileTap={{ scale: 0.94 }}
                  transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
                  className="-mt-6 flex h-14 w-14 flex-col items-center justify-center rounded-full border border-accent-strong/30 bg-accent text-ink shadow-2"
                >
                  {/* On the accent disc the flag's tone is the panel white, so the checks still read. */}
                  <tab.Icon size={24} variant="duotone" accent="var(--color-panel)" />
                  <span className="font-display -mt-0.5 text-[10px] font-semibold text-ink">{tab.label}</span>
                </m.span>
              ) : (
                <m.span
                  whileTap={{ scale: 0.94 }}
                  transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
                  className="relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 px-2 py-1"
                >
                  {/* Line at rest, the illustrated two-tone when active: the state is shape as well as colour. */}
                  <tab.Icon size={24} variant={isActive ? 'duotone' : 'line'} className={isActive ? 'text-ink' : 'text-ink-faint'} />
                  <span className={`text-[11px] font-semibold ${isActive ? 'text-ink' : 'text-ink-faint'}`}>{tab.label}</span>
                  {isActive && (
                    <m.span
                      layoutId="tab-underline"
                      className="chamfer-tr absolute -bottom-0.5 h-0.5 w-7 bg-accent"
                      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                    />
                  )}
                </m.span>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
