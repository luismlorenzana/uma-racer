// The account bar (docs/game/11-hub-and-places.md §2.1): the trainer's initial, Prize Money, Speed Tickets, Uma
// Tickets with the Shards toward the next one, and the Sync chip when anything isn't synced (D157). Every chip is a
// 44 pt link to the place that sells or spends it. Numbers fill in when the game chunk arrives and move by a CSS
// transition when they change.
import { hubWords, type HubView } from '@racer/domain/hub'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { OfflineIcon, TicketIcon, UmaCouponIcon, WarningIcon } from '../ui/icons'
import { useGame, useHub, type G2Sync } from '../app/game'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { CoinIcon } from '../ui/icons'
import { initialOf } from '../ui/uma'

function Chip({ to, label, children, className = '' }: { to: string; label: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} state={{ back: true }} aria-label={label} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center">
      <span aria-hidden className={`flex h-8 items-center gap-1 rounded-full border border-hairline bg-panel/90 px-2 text-[13px] text-ink shadow-1 ${className}`}>
        {children}
      </span>
    </Link>
  )
}

/** The chip's words and look (§2.1): Offline, Sync paused, or Sync in amber (waiting) or red (failing); none when synced. */
const SYNC: Readonly<Record<Exclude<G2Sync, 'synced'>, { text: string; label: string; tone: string; icon: ReactNode }>> = {
  offline: { text: hubWords('offline'), label: hubWords('offline-label'), tone: 'text-ink-soft', icon: <OfflineIcon size={16} /> },
  paused: { text: hubWords('sync-paused'), label: hubWords('sync-paused-label'), tone: 'text-ink-soft', icon: null },
  waiting: { text: hubWords('sync'), label: hubWords('sync-waiting-label'), tone: 'border-warning/40 bg-warning/15 text-warning', icon: <WarningIcon size={16} /> },
  failing: { text: hubWords('sync'), label: hubWords('sync-failing-label'), tone: 'border-danger/40 bg-danger/15 text-danger', icon: <WarningIcon size={16} /> },
}

const blank = <span className="inline-block h-3 w-5 rounded-full bg-sunken" />

export function AccountBar() {
  const name = useGame((snapshot) => snapshot.trainerName)
  const sync = useGame((snapshot) => snapshot.sync)
  const view: HubView | null = useHub()
  const wallet = view?.wallet ?? null
  const chip = sync === 'synced' ? null : SYNC[sync]
  return (
    <header className="pt-safe relative z-20 border-b border-hairline bg-panel/95 backdrop-blur" data-g2="account-bar">
      <div className="flex items-center gap-0.5 px-1">
        <Link to="/town/account" state={{ back: true }} aria-label={hubWords('trainer', { name })} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center">
          <span aria-hidden className="font-display flex size-8 items-center justify-center rounded-full bg-accent text-[15px] font-bold text-ink shadow-1">
            {name ? initialOf(name) : ''}
          </span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-0.5">
          <Chip to="/town/exchange" label={hubWords('prize-money', { n: wallet?.prizeMoney.toLocaleString('en-US') ?? '' })}>
            <CoinIcon size={20} variant="duotone" />
            <span className="font-display font-semibold">{wallet ? <AnimatedNumber value={wallet.prizeMoney} /> : blank}</span>
          </Chip>
          <Chip to="/town/exchange?row=speed-tickets" label={hubWords('speed-tickets', { n: wallet?.speedTickets ?? '' })}>
            <TicketIcon size={20} variant="duotone" />
            <span className="font-display font-semibold">{wallet ? <AnimatedNumber value={wallet.speedTickets} /> : blank}</span>
          </Chip>
          <Chip
            to="/town/stable?tab=locked"
            label={hubWords('uma-tickets', { n: wallet?.umaTickets ?? '', shards: wallet ? Math.min(wallet.shards, wallet.shardsPerTicket) : '', per: wallet?.shardsPerTicket ?? '' })}
          >
            <UmaCouponIcon size={20} variant="duotone" />
            <span className="font-display font-semibold">
              {wallet ? (
                <>
                  <AnimatedNumber value={wallet.umaTickets} />
                  <span className={wallet.ticketReady ? 'text-accent-strong' : 'text-ink-soft'}>
                    {' · '}{Math.min(wallet.shards, wallet.shardsPerTicket)}/{wallet.shardsPerTicket}
                  </span>
                </>
              ) : blank}
            </span>
          </Chip>
          {chip !== null && (
            <Chip to="/town/account?row=sync" label={chip.label} className={`font-semibold ${chip.tone}`}>
              {chip.icon}
              <span className="whitespace-nowrap text-[12px]">{chip.text}</span>
            </Chip>
          )}
        </div>
      </div>
    </header>
  )
}
