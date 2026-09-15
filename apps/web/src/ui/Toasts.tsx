import { AnimatePresence, m } from 'motion/react'
import { useEffect } from 'react'
import { useGame } from '../game/store'

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
            className="rounded-full border-2 border-white bg-gradient-to-b from-[#ffd65a] to-gold-deep px-5 py-2 text-lg font-extrabold text-white text-outline shadow-[var(--shadow-panel)]"
          >
            {toast.text}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
