// Lazy, read-only T124 Home entry. No aggregate level, old ladder or preparation mutation.
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { gameRuntime } from '../../game/runtime'
import type { FarmKitchenView } from '../../game/farm/kitchen/view'
import { useFarmPresentationNow } from '../../game/farm/presentation-clock'
import { formatFarmTime } from '../../game/farm/kitchen/presentation'
import { useGame } from '../../game/store'
import { Panel } from '../Panel'
import { ChevronRightIcon, StableIcon } from '../icons'

export default function FarmKitchenHomeCard() {
  const [view, setView] = useState<FarmKitchenView | null>(null), [error, setError] = useState(false)
  const now = useFarmPresentationNow(), pending = useGame(state => state.sync.pending), mode = useGame(state => state.farmStats.mode)
  useEffect(() => { let live = true
    void gameRuntime.farmKitchenHost().then(host => host.read()).then(value => { if (live) { setView(value); setError(false) } }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [now, pending, mode])
  const active = view?.mode === 'active'
  const assigned = active ? view.stations.filter(station => station.outfitId).length : 0
  const ready = active ? view.stations.filter(station => (station.legacy?.cycle?.readyAt ?? station.job?.readyAt ?? Infinity) <= now).length : 0
  const deadlines = active ? view.stations.map(station => station.legacy?.cycle?.readyAt ?? station.job?.readyAt ?? Infinity).filter(time => time > now && Number.isFinite(time)) : []
  return <Link to="/farm" aria-label={active ? `Open Stable Kitchen, ${ready} ready, ${assigned} assigned` : 'Open Farm preparation or recovery'}>
    <Panel className={ready ? 'border-accent-strong bg-accent/5' : ''}>
      <div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-sunken"><StableIcon size={32} variant="duotone" /></span>
        <span className="min-w-0 flex-1"><strong className="font-display block text-lg">Stable Kitchen</strong><span className="block text-[12px] text-ink-soft">{active ? `${ready} ready · ${assigned}/30 assigned` : error || view?.mode === 'maintenance' ? 'Recovery needed · keep this save' : view?.mode === 'upgrade' ? 'Protected preparation · Retry / Export' : 'Prepare the archived Farm upgrade'}</span></span><ChevronRightIcon size={20} />
      </div>
      {active && <p className="mt-2 border-t border-hairline pt-2 text-[11px] text-ink-soft">{deadlines.length ? `Next completion in ${formatFarmTime(Math.min(...deadlines) - now)}` : ready ? 'Ready jobs wait for your explicit collection.' : 'Five districts · all 30 stations open'}</p>}
    </Panel>
  </Link>
}
