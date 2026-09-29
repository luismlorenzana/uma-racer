import { AnimatePresence, m, useDragControls, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { CloseIcon } from './icons'

/**
 * Bottom sheet for pickers and confirmations (docs/design/ux.md#navigation). Dragging starts only from the grab
 * handle, so taps on buttons inside the sheet are never swallowed by the drag gesture. The sheet never grows past the
 * screen: its content scrolls under a fixed header whose close button and handle are always in reach.
 */
export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const dragControls = useDragControls()
  const reducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            className="fixed inset-0 z-40 bg-ink/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <m.div
            role="dialog"
            className="pb-safe fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-lg border-t border-hairline bg-panel text-ink shadow-3"
            initial={reducedMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="relative shrink-0">
              <div
                className="flex h-8 cursor-grab touch-none items-center justify-center"
                onPointerDown={(event) => dragControls.start(event)}
                aria-hidden
              >
                <div className="h-1.5 w-12 rounded-full bg-ink/20" />
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute top-0 right-1 flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
              >
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
