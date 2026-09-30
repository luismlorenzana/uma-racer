// Compact, read-only Home entry for Stable Farm (docs/design/farm.md#screen-contract, T084).

import { Link } from 'react-router'
import { useFarmPresentationNow } from '../../game/farm/presentation-clock'
import { useFarmView } from '../../game/farm/useFarmView'
import { buildFarmHomeSummary } from '../../game/farm/view'
import { useGame } from '../../game/store'
import { Crest } from '../Crest'
import { Panel } from '../Panel'
import { ChevronRightIcon, StableIcon, StopwatchIcon } from '../icons'

export function FarmHomeCard() {
  const enabled = useGame((state) => state.status === 'ready')
  const { state } = useFarmView(enabled)
  const now = useFarmPresentationNow()
  const summary = state.view ? buildFarmHomeSummary(state.view, now) : null
  return <Link to="/farm" aria-label={summary ? `Open Stable Farm, Farm level ${summary.farmLevel}, ${summary.ready} ready` : 'Open Stable Farm'}>
    <Panel className={`relative overflow-hidden transition-colors ${summary && summary.ready > 0 ? 'border-accent-strong bg-accent/5' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-sunken"><StableIcon size={32} variant="duotone" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2"><span className="font-display text-lg font-bold">Stable Farm</span>{summary && <Crest tone="accent">Lv {summary.farmLevel}</Crest>}</span>
          <span className="mt-1 block text-[12px] text-ink-soft">
            {summary ? `${summary.ready} ready · ${summary.working} working · ${summary.unlocked}/6 plots open` : state.status === 'error' ? 'Tap to retry from the Farm' : 'Opening the field…'}
          </span>
        </span>
        <ChevronRightIcon size={20} className="mt-3 shrink-0 text-ink-faint" />
      </div>
      {summary && <div className="mt-3 grid grid-cols-[auto_1fr] items-start gap-x-2 border-t border-hairline pt-2 text-[11px]">
        <StopwatchIcon size={16} className="text-ink-faint" />
        <span><span className="font-semibold">{summary.deadlineLabel}</span><span className="block text-ink-soft">Next: {summary.nextPlotUnlock} · {summary.nextCropUnlock}</span></span>
      </div>}
    </Panel>
  </Link>
}
