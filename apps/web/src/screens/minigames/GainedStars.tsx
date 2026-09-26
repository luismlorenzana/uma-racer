import { MAX_STARS } from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'

/** The card's stars after the run, the one just earned popping in. */
export function GainedStars({ before, after, onDark = false }: { before: number; after: number; onDark?: boolean }) {
  const reducedMotion = useReducedMotion()
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${after} of ${MAX_STARS} stars`}>
      {Array.from({ length: MAX_STARS }, (_, index) => {
        const filled = index < after
        const gained = index >= before && filled
        return (
          <m.svg
            key={index}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={`h-6 w-6 ${filled ? 'text-accent' : onDark ? 'text-white/25' : 'text-hairline-strong'}`}
            initial={gained && !reducedMotion ? { opacity: 0, scale: 0.35 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.24, delay: gained && !reducedMotion ? index * 0.06 : 0 }}
          >
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="currentColor" />
          </m.svg>
        )
      })}
    </span>
  )
}
