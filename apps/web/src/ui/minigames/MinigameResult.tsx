// Shared saved-result frame (docs/design/minigame-kit.md#2-the-run-lifecycle).
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '../Button'
import { formatTickets } from '../tickets'

export function MinigameResult({
  outcome,
  eyebrow,
  headline,
  reason,
  artwork,
  reward,
  pending = false,
  pendingLabel = 'Saving…',
  error,
  onRetry,
  doneTo,
  again,
}: {
  outcome: 'cleared' | 'lost'
  eyebrow: string
  headline: ReactNode
  reason?: ReactNode
  artwork?: ReactNode
  reward?: ReactNode
  pending?: boolean
  pendingLabel?: string
  error?: string | null
  onRetry?: () => void
  doneTo: string
  again?: { label: string; cost: number; tickets: number; disabled?: boolean; onClick: () => void }
}) {
  const againDisabled = Boolean(again?.disabled) || Boolean(again && again.tickets < again.cost)
  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-3 px-4 py-5 text-center">
      {artwork}
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className={`text-micro ${outcome === 'cleared' ? '!text-accent' : '!text-ink-on-dark-soft'}`}>{eyebrow}</p>
        <h2 className="mt-1 text-3xl">{headline}</h2>
        {reason && <div className="mt-1 text-[14px] text-ink-on-dark-soft">{reason}</div>}
      </div>
      {reward && <div className="w-full rounded-md border border-hairline-dark bg-stage-soft p-4 text-left">{reward}</div>}
      {pending && <p role="status" className="text-[13px] text-ink-on-dark-soft">{pendingLabel}</p>}
      {error && <p role="alert" className="w-full rounded-sm bg-danger/20 px-3 py-2 text-[13px] text-red-100">{error}</p>}
      {error && onRetry && <Button onClick={onRetry}>Retry saving</Button>}
      {!pending && !error && (
        <div className={`mt-auto grid w-full gap-2 ${again ? 'grid-cols-2' : ''}`}>
          <Link to={doneTo} className="font-display flex min-h-12 items-center justify-center rounded-sm border border-hairline-dark px-3 font-semibold text-ink-on-dark">Done</Link>
          {again && (
            <Button disabled={againDisabled} onClick={again.onClick}>
              {again.label} · {formatTickets(again.cost)}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
