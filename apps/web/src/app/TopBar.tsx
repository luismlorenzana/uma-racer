import { Link } from 'react-router'
import { useGame } from '../game/store'
import { CountUp } from '../ui/CountUp'
import { Pill } from '../ui/Pill'

/** Changes waiting this long since the last good sync are worth a look even without an error. */
const STALE_SYNC_MS = 24 * 60 * 60 * 1000

export function TopBar() {
  const tickets = useGame((s) => s.profile?.tickets ?? 0)
  const cardCoupons = useGame((s) => s.profile?.cardCoupons ?? 0)
  const umaCoupons = useGame((s) => s.profile?.umaCoupons ?? 0)
  const sync = useGame((s) => s.sync)
  // A failing or long-stalled cloud sync is otherwise silent: say so where it is always seen (D157).
  const stalled = sync.pending > 0 && sync.lastSuccessAt !== null && Date.now() - sync.lastSuccessAt > STALE_SYNC_MS
  const syncWarning = sync.status === 'error' ? 'Sync failing' : stalled ? 'Not synced' : null

  return (
    <header className="pt-safe sticky top-0 z-20 px-4">
      <div className="flex items-center justify-between py-2">
        <Link to="/settings" className="font-display whitespace-nowrap text-[17px] font-bold tracking-tight text-ink">
          Uma Racer
        </Link>
        {/* TODO(T032): currency icons come from the original set. */}
        <div className="flex items-center gap-1.5">
          {syncWarning && (
            <Link
              to="/settings"
              className={`flex min-h-8 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-bold ${sync.status === 'error' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}`}
              aria-label={`${syncWarning}: open Settings for details`}
              title={syncWarning}
            >
              ⚠ Sync
            </Link>
          )}
          <Pill icon="🎫" data-testid="tickets">
            <CountUp value={tickets} />
          </Pill>
          <Pill icon="🃏">{cardCoupons}</Pill>
          <Pill icon="🐴">{umaCoupons}</Pill>
        </div>
      </div>
    </header>
  )
}
