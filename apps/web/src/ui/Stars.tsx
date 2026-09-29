import { MAX_STARS } from '@racer/domain'

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z'

/** A card's stars in one scenario, 0★–3★, filled up to its count (D200). */
export function Stars({ value, onDark = false, className = '' }: { value: number; onDark?: boolean; className?: string }) {
  return (
    <span role="img" aria-label={value >= MAX_STARS ? `${MAX_STARS} stars, max` : `${value} of ${MAX_STARS} stars`} className={`flex gap-px ${className}`}>
      {Array.from({ length: MAX_STARS }, (_, index) => (
        <svg
          key={index}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`h-3 w-3 ${index < value ? 'text-accent' : onDark ? 'text-white/30' : 'text-hairline-strong'}`}
        >
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      ))}
    </span>
  )
}
