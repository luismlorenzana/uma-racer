// Shared full-screen, swipeable minigame guide shell (D178).
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { CloseIcon } from './icons'

export interface PagedGuidePage<Id extends string> {
  id: Id
  title: string
  body: ReactNode
}

interface PagedGuideProps<Id extends string> {
  open: boolean
  pages: readonly PagedGuidePage<Id>[]
  startAt: Id
  titleId: string
  finishLabel: string
  onClose: () => void
}

/** One reusable guide model for both minigames: one page, swipe or buttons, safe-area controls and reduced motion. */
export function PagedGuide<Id extends string>({
  open,
  pages,
  startAt,
  titleId,
  finishLabel,
  onClose,
}: PagedGuideProps<Id>) {
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const startIndex = Math.max(0, pages.findIndex((page) => page.id === startAt))

  useEffect(() => {
    if (open) setIndex(startIndex)
  }, [open, startIndex])

  const go = (next: number) => {
    if (next < 0 || next >= pages.length) return
    setDirection(next > index ? 1 : -1)
    setIndex(next)
  }
  const page = pages[index]
  if (!page) return null
  const last = index === pages.length - 1

  return (
    <AnimatePresence>
      {open && (
        <m.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex flex-col bg-stage text-ink-on-dark pt-safe"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
        >
          <header className="flex items-center gap-2 px-4 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-micro text-accent">How to play · {index + 1} of {pages.length}</p>
              <h2 id={titleId} className="truncate text-xl font-semibold">{page.title}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close the guide" className="flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-hairline-dark bg-stage-soft">
              <CloseIcon size={20} />
            </button>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <m.section
                key={page.id}
                custom={direction}
                className="absolute inset-0 overflow-y-auto overscroll-contain px-4 pb-4"
                initial={reducedMotion ? { opacity: 0 } : { x: `${direction * 100}%`, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { x: `${direction * -100}%`, opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.2, 0, 0, 1] }}
                drag={reducedMotion ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) go(index + 1)
                  else if (info.offset.x > 60) go(index - 1)
                }}
              >
                <div className="grid gap-3 pt-1">{page.body}</div>
              </m.section>
            </AnimatePresence>
          </div>

          <footer className="grid gap-2 px-4 pt-2 pb-safe">
            <div className="flex justify-center gap-1.5" aria-hidden>
              {pages.map((entry, dot) => <span key={entry.id} className={`h-1.5 rounded-full transition-[width] ${dot === index ? 'w-5 bg-accent' : 'w-1.5 bg-white/25'}`} />)}
            </div>
            <div className="grid grid-cols-[1fr_1.4fr] gap-2 pb-2">
              <Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)}>Back</Button>
              <Button onClick={() => last ? onClose() : go(index + 1)}>{last ? finishLabel : 'Next'}</Button>
            </div>
          </footer>
        </m.div>
      )}
    </AnimatePresence>
  )
}
