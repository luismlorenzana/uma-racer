// The roster view (docs/rework/02-check-ins-and-notifications.md §6 "What it shows"; T142), the Stable's `needs`
// sub-page: the targets in allocation order with up, down and remove (`set-targets`), or "Automatic: the five furthest
// behind" when none is marked; then `rosterTotals`: unlocks left per Uma, each opening her Needs tab, and the dishes
// short across the roster by family and grade. Big-picture only: place lists stay with the targets.
import { hubWords } from '@racer/domain/hub'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowDownIcon, ArrowUpIcon, CloseIcon } from '../../ui/icons'
import { useGame, useNow } from '../../app/game'
import { PlaceHeader } from '../../ui/PlaceHeader'
import { UmaFace } from '../../ui/UmaArt'
import { TapNoteLine } from '../../ui/work/TapNote'
import { useTap, useWordsContext } from '../../ui/work/useTap'
import { useWorkView } from '../../ui/work/view'
import { needsLink } from '../check-in/model'
import type { SubPageProps } from '../registry'
import { Line } from './NeedsTab'
import { movedTarget, rosterView } from './model'
import { needsWords } from './words'

const ICON = 'flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-soft disabled:opacity-30'

function Row({ outfitId, children, trailing }: { outfitId: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <li data-roster={outfitId} className="flex items-center gap-1 rounded-sm bg-sunken/60 pl-2">
      <Link to={needsLink(outfitId)} state={{ back: true }} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1">
        <span className="block size-8 shrink-0 overflow-hidden rounded-full bg-panel"><UmaFace outfitId={outfitId} size={32} /></span>
        <span className="min-w-0 flex-1 text-[14px]">{children}</span>
      </Link>
      {trailing}
    </li>
  )
}

export default function RosterNeeds({ place, rest }: SubPageProps) {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  const work = useWorkView()
  const context = useWordsContext()
  const tap = useTap()
  const view = useMemo(
    () => (state === null || env === null || work === null ? null : rosterView(state, work.settled, now, env, context)),
    [state, env, work, now, context],
  )
  const name = (outfitId: string) => context.umaName(outfitId) || outfitId
  const busy = tap.pending !== null
  const set = (outfitIds: readonly string[]) => void tap.run('set-targets', { outfitIds }, 'targets')
  return (
    <div data-g2="roster-needs" className="flex min-h-full flex-col">
      <PlaceHeader place={place} rest={rest} title={hubWords('menu-needs')} />
      {view !== null && (
        <div className="space-y-4 px-4 py-3">
          <section aria-labelledby="roster-targets" className="space-y-1.5">
            <h2 id="roster-targets" className="text-micro">{needsWords('targets')}</h2>
            {view.marked.length === 0 && <p data-g2="automatic" className="text-[13px] font-semibold text-ink-soft">{needsWords('automatic')}</p>}
            {view.marked.length === 0 && view.automatic.length === 0 && <p className="text-[13px] text-ink-soft">{needsWords('no-targets')}</p>}
            <ol className="space-y-1.5">
              {view.marked.map((outfitId, i) => (
                <Row
                  key={outfitId}
                  outfitId={outfitId}
                  trailing={(
                    <>
                      <button type="button" disabled={busy || i === 0} onClick={() => set(movedTarget(view.marked, outfitId, -1))} aria-label={needsWords('up', { uma: name(outfitId) })} className={ICON}><ArrowUpIcon size={20} /></button>
                      <button type="button" disabled={busy || i === view.marked.length - 1} onClick={() => set(movedTarget(view.marked, outfitId, 1))} aria-label={needsWords('down', { uma: name(outfitId) })} className={ICON}><ArrowDownIcon size={20} /></button>
                      <button type="button" disabled={busy} onClick={() => set(view.marked.filter((id) => id !== outfitId))} aria-label={needsWords('remove-label', { uma: name(outfitId) })} className={ICON}><CloseIcon size={20} /></button>
                    </>
                  )}
                >
                  <span className="font-semibold">{i + 1}. {name(outfitId)}</span>
                </Row>
              ))}
              {view.automatic.map((outfitId, i) => (
                <Row key={outfitId} outfitId={outfitId}><span className="text-ink-soft">{i + 1}. {name(outfitId)}</span></Row>
              ))}
            </ol>
            <TapNoteLine tap={tap} />
          </section>

          <section aria-labelledby="roster-unlocks" className="space-y-1.5">
            <h2 id="roster-unlocks" className="text-micro">{needsWords('roster-unlocks')}</h2>
            <ul className="space-y-1.5">
              {view.order.map((entry) => (
                <Row key={entry.outfitId} outfitId={entry.outfitId}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{name(entry.outfitId)}</span>
                    <span className="shrink-0 text-[13px] text-ink-soft tabular-nums">{needsWords('roster-line', { n: entry.unlocksLeft })}</span>
                  </span>
                </Row>
              ))}
            </ul>
          </section>

          <section aria-labelledby="roster-dishes" className="space-y-1.5">
            <h2 id="roster-dishes" className="text-micro">{needsWords('roster-dishes')}</h2>
            {view.dishes.length === 0 && <p className="text-[13px] text-ink-soft">{needsWords('roster-dishes-none')}</p>}
            <ul className="space-y-1.5">{view.dishes.map((line) => <Line key={line.line.item} view={line} />)}</ul>
          </section>
        </div>
      )}
    </div>
  )
}
