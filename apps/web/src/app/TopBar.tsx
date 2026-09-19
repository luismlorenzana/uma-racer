import { Link } from 'react-router'
import { useGame } from '../game/store'
import { CountUp } from '../ui/CountUp'
import { Pill } from '../ui/Pill'

export function TopBar() {
  const tickets = useGame((s) => s.profile?.tickets ?? 0)
  const cardCoupons = useGame((s) => s.profile?.cardCoupons ?? 0)
  const umaCoupons = useGame((s) => s.profile?.umaCoupons ?? 0)

  return (
    <header className="pt-safe sticky top-0 z-20 px-4">
      <div className="flex items-center justify-between py-2">
        <Link to="/settings" className="font-display text-[17px] font-bold tracking-tight text-ink">
          Uma Racer
        </Link>
        {/* TODO(T032): currency icons come from the original set. */}
        <div className="flex items-center gap-1.5">
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
