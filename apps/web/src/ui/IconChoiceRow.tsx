// One row of icon-only buttons for a single choice among four: running styles, distances, distance presets (D251).

import type { ReactNode } from 'react'

export interface IconChoice<T extends string> {
  value: T
  /** The full name, read by VoiceOver and shown nowhere else. */
  name: string
  icon: ReactNode
  /** A small corner mark, such as her aptitude grade for this choice. */
  badge?: string
}

export function IconChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className = '',
}: {
  /** The group's name, read by VoiceOver. */
  label: string
  options: readonly IconChoice<T>[]
  value: T | null
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-1.5 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.badge ? `${option.name}, ${option.badge}` : option.name}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`relative flex min-h-14 items-center justify-center rounded-sm border transition-transform active:scale-[0.97] disabled:opacity-50 ${
              selected ? 'border-accent bg-accent-wash shadow-1' : 'border-hairline bg-panel'
            }`}
          >
            {option.icon}
            {option.badge && (
              <span aria-hidden className={`absolute top-1 right-1 rounded-full px-1 font-display text-[10px] leading-4 font-bold ${
                selected ? 'bg-accent text-white' : 'bg-sunken text-ink-soft'
              }`}>{option.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
