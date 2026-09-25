import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * One piece of art at full size over a dark stage (docs/design/collection.md#art-tiers). Detail surfaces open it from
 * their art; lists never do. A tap anywhere, the close button or Escape closes it. It renders into the body, because
 * the surfaces that open it sit inside stacking contexts (an album's detail area, sticky filter bars) it must cover.
 * Portraits are cut-outs, so the art sits on its own stage rather than letting the page show through.
 */
export function ArtViewer({
  src,
  title,
  subtitle,
  onClose,
}: {
  /** Null keeps the viewer closed. */
  src: string | null
  title: string
  subtitle?: string
  onClose: () => void
}) {
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!src) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])

  return createPortal(
    <AnimatePresence>
      {src && (
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="pt-safe pb-safe fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <div className="pt-safe absolute inset-x-0 top-0 flex justify-end p-3">
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-2xl leading-none text-white"
            >
              ×
            </button>
          </div>
          <m.img
            src={src}
            alt={title}
            draggable={false}
            className="max-h-[76dvh] w-auto max-w-full rounded-lg bg-gradient-to-b from-stage-soft to-stage object-contain shadow-3"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
          />
          <p className="font-display mt-4 text-center text-lg font-bold text-white">{title}</p>
          {subtitle && <p className="text-center text-[13px] text-white/70">{subtitle}</p>}
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** The small corner mark on art that opens the viewer. */
export function ExpandMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-[2px] ${className}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
      </svg>
    </span>
  )
}
