// Her Needs tab (docs/rework/02-check-ins-and-notifications.md §6 "What it shows"; T142), the body of T138's profile
// at `/town/stable/outfit/:umaId/needs` through `PROFILE_UI.Needs`, under her header and its target toggle: layer
// progress ("Observatory 8/12 · …"); the cascade, dishes then crafted then raw, each line in 02 §6's words with its gate
// and, where the Exchange sells it, **Buy at the Exchange · price**; "about 120 Uma-hours of work"; her three startable
// lines with **Start**; and "3 bonds: pick cards", linking to her Dojo sheet. It plans for her alone and never changes
// the targets.
import { useMemo } from 'react'
import { Link, useLocation } from 'react-router'
import { Panel } from '../../ui/Panel'
import { useGame, useNow } from '../../app/game'
import { ItemIcon } from '../../ui/ItemIcon'
import { TapNoteLine } from '../../ui/work/TapNote'
import { useTaps, useWordsContext } from '../../ui/work/useTap'
import { useWorkView } from '../../ui/work/view'
import { grouped, itemName } from '../../ui/work/words'
import type { ProfileSlotProps } from '../registry'
import { needsView, type LineView } from './model'
import { needsWords } from './words'

const GROUP_TITLE = { dish: 'dishes-short', crafted: 'crafted-short', raw: 'raw-short' } as const

export function Line({ view }: { view: LineView }) {
  return (
    <li data-need-line={view.line.item} className="rounded-sm bg-sunken/60 px-2 py-1.5 text-[13px]">
      <div className="flex items-center gap-2">
        <ItemIcon item={view.line.item} decorative />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{itemName(view.line.item)}</span>
          <span className="block text-ink-soft">{view.words}</span>
        </span>
      </div>
      {view.gate !== null && (
        <p className="flex flex-wrap items-center gap-x-2 pt-1 text-[12px] text-ink-soft">
          <span>{view.gate}</span>
          {view.buy !== null && (
            <Link to={view.buy.to} state={{ back: true }} className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline">
              {needsWords('buy-at-exchange', { price: grouped(view.buy.price) })}
            </Link>
          )}
        </p>
      )}
    </li>
  )
}

export default function NeedsTab({ umaId }: ProfileSlotProps) {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  const work = useWorkView()
  const context = useWordsContext()
  const taps = useTaps()
  const location = useLocation()
  const back = `${location.pathname}${location.search}`
  const owned = state?.umas[umaId] !== undefined
  const view = useMemo(
    () => (state === null || env === null || work === null || !owned ? null : needsView(state, work.settled, umaId, now, env, context, back)),
    [state, env, work, owned, umaId, now, context, back],
  )
  if (view === null) return null
  return (
    <div data-g2="needs-tab" data-uma={umaId} className="space-y-3">
      <Panel className="space-y-1 p-3" aria-label={needsWords('progress')}>
        <h2 className="text-micro">{needsWords('progress')}</h2>
        <p data-g2="layer-progress" className="text-[14px] font-semibold tabular-nums">{view.progress}</p>
        <p className="text-[13px] text-ink-soft">
          {view.unlocksLeft === 0 ? needsWords('nothing-left') : view.unlocksLeft === 1 ? needsWords('unlocks-left-one') : needsWords('unlocks-left', { n: view.unlocksLeft })}
          {view.estimate !== null && <> · <span data-g2="estimate">{view.estimate}</span></>}
        </p>
      </Panel>

      {view.groups.map((group) => (
        <Panel key={group.level} className="space-y-1.5 p-3" aria-label={needsWords(GROUP_TITLE[group.level])} data-level={group.level}>
          <h2 className="text-micro">{needsWords(GROUP_TITLE[group.level])}</h2>
          <ul className="space-y-1.5">{group.lines.map((line) => <Line key={line.line.item} view={line} />)}</ul>
        </Panel>
      ))}

      {view.pickCards !== null && (
        <Link to={view.dojo} state={{ back: true }} data-g2="pick-cards" className="flex min-h-11 items-center rounded-sm border border-hairline-strong bg-panel px-3 text-[14px] font-semibold shadow-1">
          {view.pickCards}
        </Link>
      )}

      {view.unlocksLeft > 0 && (
        <Panel className="space-y-1.5 p-3" aria-label={needsWords('start-title')}>
          <h2 className="text-micro">{needsWords('start-title')}</h2>
          {view.startable.length === 0 && <p className="text-[13px] text-ink-soft">{needsWords('none-startable')}</p>}
          <ul className="space-y-1.5">
            {view.startable.map(({ line, start, words }) => {
              const key = `start:${start.outfitId}:${line.line.item}`
              return (
                <li key={key} data-startable={line.line.item} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ItemIcon item={line.line.item} decorative />
                    <span className="min-w-0 flex-1 text-[13px] tabular-nums">{words}</span>
                    <button
                      type="button"
                      disabled={taps.pending !== null}
                      onClick={() => void taps.run(key, 'start', { outfitId: start.outfitId, slot: start.slot, request: start.request }, 'needs:start')}
                      aria-label={needsWords('start-label', { what: line.label, uma: context.umaName(start.outfitId) || start.outfitId })}
                      className="font-display inline-flex min-h-11 items-center justify-center rounded-sm bg-accent px-4 text-[14px] font-semibold text-ink shadow-1 disabled:opacity-45"
                    >
                      {needsWords('start')}
                    </button>
                  </div>
                  <TapNoteLine tap={taps.line(key)} />
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
    </div>
  )
}
