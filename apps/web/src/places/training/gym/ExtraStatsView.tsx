// Her Extra Stats map at the Gym, full screen (docs/rework/05-training-hub.md §6, §8; docs/rework/11-hub-and-places.md
// §6; T139): 05 §6's grid of 37 nodes, the five stat columns in ring order and the Sun's, a row of singles per layer
// with its Sun and, in scenarios 2 and 3, the Duos between their columns. An open node is a switch for the viewed
// preset (`set-active-nodes`; "Only 9 Extra Stats can be on at once." in the rule's words), under "9 of 9 on"; a locked
// one opens its sheet with what it needs and, when it's next, **Unlock** (a Duo's or Sun's into the first room
// `roomsFor` lists).
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LockedIcon } from '../../../../ui/icons'
import { TypeIcon } from '../../../../ui/TypeIcon'
import { Sheet } from '../../../ui/Sheet'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { useTap } from '../../../ui/work/useTap'
import { BuildFrame, type BuildContext } from '../BuildFrame'
import { unlockPath } from '../common'
import type { BuildViewProps } from '../Page'
import { trainingWords } from '../words'
import { extraView, switched, type ExtraCell } from './model'
import { EXTRA_STATS } from '@racer/domain/rework/training'

const COLUMNS = EXTRA_STATS.length + 1

function Cell({ cell, onSwitch, onOpen, busy }: { cell: ExtraCell; onSwitch: () => void; onOpen: () => void; busy: boolean }) {
  const style = { gridColumn: `${Math.floor(cell.column) + 1} / span 1`, transform: cell.kind === 'duo' ? 'translateX(50%)' : undefined }
  if (cell.state === 'open') {
    const label = trainingWords(cell.on ? 'cell-on' : 'cell-off', { name: cell.name, value: cell.value })
    return (
      <button
        type="button"
        role="switch"
        aria-checked={cell.on}
        aria-label={label}
        disabled={busy}
        onClick={onSwitch}
        data-extra={cell.id}
        data-state={cell.on ? 'on' : 'off'}
        style={style}
        className={`flex min-h-12 flex-col items-center justify-center rounded-sm border text-[12px] font-bold tabular-nums ${cell.on ? 'border-accent bg-accent text-ink shadow-1' : 'border-hairline-strong bg-panel text-ink-soft'}`}
      >
        <span>{cell.value}</span>
        <span className="text-[10px] font-semibold">G{cell.grade}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      aria-label={trainingWords('cell-locked', { name: cell.name, value: cell.value, words: cell.words ?? '' })}
      onClick={onOpen}
      data-extra={cell.id}
      data-state={cell.state}
      style={style}
      className={`flex min-h-12 flex-col items-center justify-center rounded-sm border text-[11px] tabular-nums ${cell.state === 'available' ? 'border-dashed border-accent bg-accent-wash text-ink' : 'border-dashed border-hairline-strong bg-sunken/60 text-ink-soft'}`}
    >
      {cell.state === 'available' ? <span className="font-bold">{cell.value}</span> : <LockedIcon size={16} />}
      <span className="text-[10px] font-semibold">G{cell.grade}</span>
    </button>
  )
}

function ExtraMap({ build }: { build: BuildContext }) {
  const tap = useTap()
  const [opened, setOpened] = useState<string | null>(null)
  const model = useMemo(() => extraView(build.settled, build.uma, build.preset, build.derived, build.now, build.context, build.content), [build])
  const cell = model.cells.find((entry) => entry.id === opened) ?? null
  const flip = (entry: ExtraCell) => void tap.run(
    'set-active-nodes',
    { umaId: build.uma.outfitId, preset: build.preset, nodeIds: switched(model.active, entry.id, !entry.on) },
    `extra:${build.uma.outfitId}`,
  )
  const grid = { display: 'grid', gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`, gap: '6px' }
  return (
    <div className="space-y-3 px-4 py-3" data-g2="extra-view">
      <p className="font-display text-[15px] font-semibold tabular-nums" data-g2="extra-capacity">{trainingWords('capacity', { on: model.on, capacity: model.capacity })}</p>
      <TapNoteLine tap={tap} />
      <div style={grid} aria-hidden className="text-center text-[11px] font-semibold text-ink-soft">
        {EXTRA_STATS.map((stat) => <span key={stat} className="flex justify-center"><TypeIcon type={stat} size={20} /></span>)}
        <span>{trainingWords('sun')}</span>
      </div>
      {model.layers.map((layer) => (
        <section key={layer.layer} aria-label={layer.title} className="space-y-1.5" data-layer={layer.layer}>
          <h3 className="text-micro">{layer.title}</h3>
          <div style={grid}>
            {layer.singles.map((entry) => <Cell key={entry.id} cell={entry} busy={tap.pending !== null} onSwitch={() => flip(entry)} onOpen={() => setOpened(entry.id)} />)}
            {layer.sun !== null && <Cell cell={layer.sun} busy={tap.pending !== null} onSwitch={() => flip(layer.sun!)} onOpen={() => setOpened(layer.sun!.id)} />}
          </div>
          {layer.duos.length > 0 && (
            <div style={grid}>
              {layer.duos.map((entry) => <Cell key={entry.id} cell={entry} busy={tap.pending !== null} onSwitch={() => flip(entry)} onOpen={() => setOpened(entry.id)} />)}
            </div>
          )}
        </section>
      ))}
      <Sheet open={cell !== null} onClose={() => setOpened(null)} label={cell?.name}>
        {cell !== null && (
          <div className="space-y-3 pb-2" data-g2="extra-sheet" data-extra={cell.id}>
            <h2 className="text-lg">{cell.name} · {cell.value}</h2>
            <p className="text-[14px]">{cell.words}</p>
            {cell.state === 'available' && (
              <Link to={unlockPath(build.uma.outfitId, cell.unlock, build.here)} state={{ back: true }} data-action="unlock"
                className="font-display flex min-h-12 items-center justify-center rounded-sm bg-accent font-semibold text-ink shadow-1">
                {trainingWords('unlock')}
              </Link>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}

export default function ExtraStatsView({ place, umaId }: BuildViewProps) {
  return (
    <BuildFrame place={place} umaId={umaId} fullScreen title={(name) => trainingWords('extra-title', { uma: name })}>
      {(build) => <ExtraMap build={build} />}
    </BuildFrame>
  )
}
