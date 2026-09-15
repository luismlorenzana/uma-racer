import { Outlet } from 'react-router'
import { TabBar } from './TabBar'
import { TopBar } from './TopBar'
import { Toasts } from '../ui/Toasts'

/** Tab-screen chrome: currencies on top, content in the middle, thumb-zone tab bar at the bottom. */
export function AppShell() {
  return (
    <div className="flex h-dvh flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto overscroll-contain px-4 pb-28">
        <Outlet />
      </main>
      <TabBar />
      <Toasts />
    </div>
  )
}
