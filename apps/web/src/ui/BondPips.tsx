import { MAX_LIMIT_BREAK } from '@racer/domain'

/**
 * A card's bond in one scenario: four pips, filled to its limit break (D127). "Bond" is the on-screen name for
 * what the save calls a limit break (M016).
 */
export function BondPips({ value, onDark = false, className = '' }: { value: number; onDark?: boolean; className?: string }) {
  return (
    <span role="img" aria-label={value >= MAX_LIMIT_BREAK ? 'Max bond' : `Bond ${value} of ${MAX_LIMIT_BREAK}`} className={`flex gap-0.5 ${className}`}>
      {Array.from({ length: MAX_LIMIT_BREAK }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 w-2.5 rounded-xs ${index < value ? 'bg-accent' : onDark ? 'bg-white/35' : 'bg-hairline-strong'}`}
        />
      ))}
    </span>
  )
}
