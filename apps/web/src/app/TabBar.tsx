import { m } from 'motion/react'
import { NavLink } from 'react-router'

const TABS = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/stable', label: 'Stable', icon: '🐴' },
  { to: '/race', label: 'Race', icon: '🏁', primary: true },
  { to: '/cards', label: 'Cards', icon: '🃏' },
  { to: '/badges', label: 'Badges', icon: '🏅' },
] as const

/** Bottom tab bar in the thumb zone, with the Race tab raised in the center (docs/design/ux.md#navigation). */
export function TabBar() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 px-3">
      <div className="mb-2 flex items-end justify-between rounded-[1.6rem] border-2 border-white/80 bg-white/90 px-2 pt-1.5 pb-1 shadow-[var(--shadow-panel)] backdrop-blur">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="flex flex-1 justify-center">
            {({ isActive }) =>
              'primary' in tab ? (
                <m.span
                  whileTap={{ scale: 0.9 }}
                  className="-mt-7 flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-white bg-gradient-to-b from-gold to-gold-deep text-2xl shadow-[0_5px_0_#b47a06,0_10px_18px_rgb(0_0_0/0.18)]"
                >
                  <span aria-hidden>{tab.icon}</span>
                  <span className="-mt-0.5 text-[10px] font-extrabold text-white text-outline">{tab.label}</span>
                </m.span>
              ) : (
                <m.span
                  whileTap={{ scale: 0.88 }}
                  className={`flex min-h-11 min-w-14 flex-col items-center justify-center rounded-2xl px-2 py-1 ${isActive ? 'bg-sky/15' : ''}`}
                >
                  <m.span
                    aria-hidden
                    animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.15 : 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className="text-xl"
                  >
                    {tab.icon}
                  </m.span>
                  <span className={`text-[11px] font-extrabold ${isActive ? 'text-sky-deep' : 'text-ink-soft'}`}>{tab.label}</span>
                </m.span>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
