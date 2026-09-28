// Shared minigame meter with accessible values and token colours (docs/design/minigame-kit.md#7-visual-identity).
import { Meter } from '../Meter'

const TONE = {
  accent: 'var(--color-accent)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
} as const

export function MinigameGauge({
  label,
  value,
  maximum,
  tone,
}: {
  label: string
  value: number
  maximum: number
  tone: keyof typeof TONE
}) {
  const clamped = Math.max(0, Math.min(maximum, value))
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={clamped}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px] font-bold tracking-[0.08em] uppercase">
        <span>{label}</span>
        <span className="numeral numeral-on-dark text-xs">{clamped}/{maximum}</span>
      </div>
      <Meter value={maximum <= 0 ? 0 : clamped / maximum} color={TONE[tone]} height={8} motion="linear" trackClassName="bg-black/35" />
    </div>
  )
}
