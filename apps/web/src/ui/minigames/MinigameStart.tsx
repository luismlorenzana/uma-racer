// Shared free preview and ticket-reservation panel (docs/design/minigame-kit.md#2-the-run-lifecycle).
import type { ReactNode } from 'react'
import { Button } from '../Button'
import { formatTickets } from '../tickets'

export function MinigameStart({
  artwork,
  eyebrow,
  title,
  subtitle,
  stake,
  rules,
  cost,
  tickets,
  resume = false,
  pending = false,
  pendingLabel = 'Reserving…',
  beginLabel = 'Begin',
  error,
  onBegin,
  onGuide,
}: {
  artwork: ReactNode
  eyebrow: string
  title: string
  subtitle?: ReactNode
  stake: ReactNode
  rules: readonly ReactNode[]
  cost: number
  tickets: number
  resume?: boolean
  pending?: boolean
  pendingLabel?: string
  beginLabel?: string
  error?: string | null
  onBegin: () => void
  onGuide: () => void
}) {
  const short = !resume && tickets < cost
  const action = pending
    ? pendingLabel
    : resume
      ? 'Resume'
      : short
        ? `Need ${formatTickets(cost)}`
        : `${beginLabel} · ${formatTickets(cost)}`

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 py-4">
      <div className="mx-auto flex min-h-0 max-w-full justify-center">{artwork}</div>
      <div className="text-center">
        <p className="text-micro !text-accent">{eyebrow}</p>
        <h2 className="text-2xl">{title}</h2>
        {subtitle && <div className="mt-0.5 text-[12px] text-ink-on-dark-soft">{subtitle}</div>}
      </div>
      <div className="rounded-md border border-hairline-dark bg-stage-soft p-3">{stake}</div>
      <ul className="grid gap-1.5 rounded-md border border-hairline-dark bg-stage-soft px-3 py-2.5 text-[13px] leading-snug">
        {rules.map((rule, index) => <li key={index}>{rule}</li>)}
      </ul>
      {error && <p role="alert" className="rounded-sm bg-danger/20 px-3 py-2 text-[13px] text-red-100">{error}</p>}
      <div className="mt-auto grid gap-2">
        <Button className="w-full" disabled={pending || short} onClick={onBegin}>{action}</Button>
        {short && <p className="text-center text-[12px] text-ink-on-dark-soft">You need {formatTickets(cost)}.</p>}
        <Button variant="tertiary" className="w-full !text-ink-on-dark" onClick={onGuide}>How to play</Button>
      </div>
    </section>
  )
}
