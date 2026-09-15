import { m } from 'motion/react'

/**
 * Stat / progress bar. `spring` (default) fills with a slight overshoot for discrete changes like stat gains;
 * `linear` tracks continuously updating values (race HUD) without spring oscillation. `marker` draws a cap line (0–1).
 */
export function Meter({
  value,
  color,
  marker,
  height = 10,
  motion = 'spring',
}: {
  value: number
  color: string
  marker?: number
  height?: number
  motion?: 'spring' | 'linear'
}) {
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-ink/10" style={{ height }}>
      {motion === 'spring' ? (
        <m.div
          className="h-full rounded-full"
          style={{ background: color, transformOrigin: 'left' }}
          initial={false}
          animate={{ scaleX: clamped }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        />
      ) : (
        // Compositor-driven CSS transition: smooth at any frame rate, never overshoots.
        <div
          className="h-full rounded-full"
          style={{ background: color, transformOrigin: 'left', transform: `scaleX(${clamped})`, transition: 'transform 120ms linear' }}
        />
      )}
      {marker !== undefined && (
        <div className="absolute top-0 h-full w-0.5 bg-ink/50" style={{ left: `${Math.min(1, marker) * 100}%` }} />
      )}
    </div>
  )
}
