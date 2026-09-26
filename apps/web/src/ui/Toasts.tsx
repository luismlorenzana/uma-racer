import { AnimatePresence, m } from 'motion/react'
import { useEffect } from 'react'
import { useGame } from '../game/store'
import { TicketIcon } from './icons'

/** Reward toasts that drop in under the top bar (e.g. the daily ticket grant). */
export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  const dismiss = useGame((s) => s.dismissToast)

  useEffect(() => {
    const first = toasts[0]
    if (!first) return
    const timer = setTimeout(() => dismiss(first.id), 2600)
    return () => clearTimeout(timer)
  }, [toasts, dismiss])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.5rem)] z-40 flex flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <m.div
            key={toast.id}
            initial={{ y: -30, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            className="flex items-center gap-2 rounded-full border border-hairline bg-gradient-to-b from-accent to-accent-strong px-5 py-2 text-lg font-semibold text-white text-outline shadow-2"
          >
            {toast.icon === 'ticket' && <TicketIcon size={24} variant="duotone" accent="var(--color-accent-strong)" />}
            {toast.text}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
