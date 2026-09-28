import { m } from 'motion/react'

/**
 * Stat / progress bar in a sunken track. `spring` (default) fills with a slight overshoot for discrete changes like
 * stat gains; `linear` tracks continuously updating values (race HUD) without oscillation. `marker` draws a cap tick
 * (0–1), used for the 1200 soft cap (docs/design/visual-system.md#components).
 */
export function Meter({
  value,
  color,
  marker,
  height = 6,
  motion = 'spring',
  trackClassName = 'bg-sunken',
}: {
  value: number
  color: string
  marker?: number
  height?: number
  motion?: 'spring' | 'linear'
  trackClassName?: string
}) {
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div className={`relative w-full overflow-hidden rounded-full ${trackClassName}`} style={{ height }}>
      {motion === 'spring' ? (
        <m.div
          className="h-full rounded-full"
          style={{ background: color, transformOrigin: 'left' }}
          initial={false}
          animate={{ scaleX: clamped }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        />
      ) : (
        // Compositor-driven CSS transition: smooth at any frame rate, never overshoots.
        <div
          className="h-full rounded-full"
          style={{ background: color, transformOrigin: 'left', transform: `scaleX(${clamped})`, transition: 'transform 120ms linear' }}
        />
      )}
      {marker !== undefined && (
        <div className="absolute top-0 h-full w-px bg-ink/35" style={{ left: `${Math.min(1, marker) * 100}%` }} />
      )}
    </div>
  )
}
