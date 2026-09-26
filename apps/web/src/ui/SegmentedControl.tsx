import { m } from 'motion/react'

/** Sunken track, raised thumb. Two to four mutually exclusive options; `sm` fits a toolbar row. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className = '',
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'md' | 'sm'
  className?: string
}) {
  return (
    <div role="tablist" aria-label={label} className={`flex gap-1 rounded-sm bg-sunken ${size === 'sm' ? 'p-0.5' : 'p-1'} ${className}`}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`relative flex-1 rounded-xs font-semibold ${size === 'sm' ? 'min-h-8 px-2 text-[12px]' : 'min-h-10 text-[13px]'}`}
          >
            {active && (
              <m.span
                layoutId={`segment-${label}`}
                className="absolute inset-0 rounded-xs bg-panel shadow-1"
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              />
            )}
            <span className={`relative ${active ? 'text-ink' : 'text-ink-soft'}`}>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
