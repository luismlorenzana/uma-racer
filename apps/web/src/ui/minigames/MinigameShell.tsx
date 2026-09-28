// Shared full-screen minigame frame (docs/design/minigame-kit.md#6-the-screen).
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { IconButton } from '../Button'
import { ChevronLeftIcon, QuestionIcon } from '../icons'

export function MinigameShell({
  children,
  playing = false,
  className = '',
}: {
  children: ReactNode
  playing?: boolean
  className?: string
}) {
  const shellRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (playing && shellRef.current) shellRef.current.scrollTop = 0
  }, [playing])

  return (
    <main ref={shellRef} className={`flex h-dvh w-full flex-col bg-stage pt-safe pb-safe text-ink-on-dark ${playing ? 'game-surface overflow-hidden' : 'overflow-y-auto overscroll-contain'} ${className}`}>
      {children}
    </main>
  )
}

export interface MinigameHeadline {
  label: string
  value: ReactNode
  ariaLabel?: string
}

export function MinigameHeader({
  backTo,
  backLabel,
  eyebrow,
  title,
  onGuide,
  guideLabel,
  headline,
  trailing,
}: {
  backTo: string
  backLabel: string
  eyebrow: string
  title: string
  onGuide: () => void
  guideLabel: string
  headline?: MinigameHeadline
  trailing?: ReactNode
}) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-hairline-dark bg-stage/95 px-3 py-2">
      <Link
        to={backTo}
        aria-label={backLabel}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-hairline-dark bg-stage-soft text-ink-on-dark"
      >
        <ChevronLeftIcon size={20} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[9px] font-bold tracking-[0.16em] text-accent uppercase">{eyebrow}</p>
        <h1 className="truncate text-[17px] leading-tight">{title}</h1>
      </div>
      {headline && (
        <div className="shrink-0 rounded-full border border-hairline-dark bg-stage-soft px-2.5 py-1 text-center" aria-label={headline.ariaLabel}>
          <p className="text-[9px] leading-none text-ink-on-dark-soft uppercase">{headline.label}</p>
          <p className="numeral numeral-on-dark mt-0.5 text-[15px] leading-none">{headline.value}</p>
        </div>
      )}
      <IconButton
        onClick={onGuide}
        aria-label={guideLabel}
        className="shrink-0 !border !border-hairline-dark !bg-stage-soft !text-accent !shadow-none"
      >
        <QuestionIcon size={20} />
      </IconButton>
      {trailing}
    </header>
  )
}
