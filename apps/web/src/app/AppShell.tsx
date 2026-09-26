import { useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import { TabBar } from './TabBar'
import { TopBar } from './TopBar'
import { Toasts } from '../ui/Toasts'

/**
 * The shell's content area scrolls, not the window, so it keeps its own memory: a page opened by a link starts at the
 * top, Back returns to where you were, and a change of query on the same page (filters, sort) keeps your place.
 */
function useScrollMemory() {
  const main = useRef<HTMLElement>(null)
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const current = useRef({ key: location.key, path: location.pathname })

  useLayoutEffect(() => {
    const element = main.current
    const previous = current.current
    current.current = { key: location.key, path: location.pathname }
    if (!element || previous.path === location.pathname) return
    element.scrollTop = navigationType === 'POP' ? positions.current.get(location.key) ?? 0 : 0
  }, [location.key, location.pathname, navigationType])

  const onScroll = () => {
    if (main.current) positions.current.set(current.current.key, main.current.scrollTop)
  }
  return { main, onScroll }
}

/** Tab-screen chrome: currencies on top, content in the middle, thumb-zone tab bar at the bottom. */
export function AppShell() {
  const { main, onScroll } = useScrollMemory()
  return (
    <div className="flex h-dvh flex-col">
      <TopBar />
      <main ref={main} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain px-4 pb-28">
        <Outlet />
      </main>
      <TabBar />
      <Toasts />
    </div>
  )
}
