// Her lineage at the Lineage Hall, in the shell (docs/game/05-training-hub.md §3, §5, §8; T139): 05 §5's map, parents
// A and B above with their grandparents below, each slot locked, open or filled in the viewed preset, with its unique
// and two golds as moons and their states; a locked item names its dish and blocker, and the next ones carry **Unlock**.
// Filling or changing a slot opens T138's Uma picker (owned Umas, never herself, a refused pick in the rule's words,
// sorted by lifetime Uma Level, with Adds one tap away), and runs `set-lineage`.
import { LockedIcon } from '@luismlorenzana/uma-kit/ui'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { FaceTile } from '@luismlorenzana/uma-kit/album'
import { RacerUmaPicker as UmaPicker } from '../../../ui/racerAlbum'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { useTap } from '../../../ui/work/useTap'
import { BuildFrame, type BuildContext } from '../BuildFrame'
import { unlockPath } from '../common'
import type { BuildViewProps } from '../Page'
import { trainingWords } from '../words'
import { lineagePicks, lineageView, withoutSlot, type LineageItem, type LineageSlotId, type LineageSlotView } from './model'

/** One unlock's line: open, or what it needs with **Unlock** when it's next. */
function ItemLine({ item, label, build }: { item: LineageItem; label: string; build: BuildContext }) {
  if (item.state === 'open') return <p className="text-[12px]">{label}</p>
  return (
    <div className="space-y-1 text-[12px] text-ink-soft" data-locked={item.unlock.kind}>
      <p className="flex items-start gap-1"><LockedIcon size={16} className="shrink-0" /><span><span className="font-semibold text-ink">{label}</span> · {item.words}</span></p>
      {item.state === 'available' && (
        <Link to={unlockPath(build.uma.outfitId, item.unlock, build.here)} state={{ back: true }} data-action="unlock"
          className="font-display inline-flex min-h-11 items-center rounded-sm bg-accent px-3 text-[13px] font-semibold text-accent-ink shadow-1">
          {trainingWords('unlock')}
        </Link>
      )}
    </div>
  )
}

function SlotCard({ slot, build, onFill }: { slot: LineageSlotView; build: BuildContext; onFill: () => void }) {
  const tap = useTap()
  const name = slot.filler === null ? null : build.context.umaName(slot.filler) || slot.filler
  const title = trainingWords(slot.grandparent ? 'grandparent' : 'parent', { letter: slot.letter })
  const open = slot.item.state === 'open'
  return (
    <article aria-label={title} data-slot={slot.slot} data-state={open ? (slot.filler === null ? 'open' : 'filled') : 'locked'}
      className={`space-y-2 rounded-md border p-2 ${open ? 'border-hairline bg-panel shadow-1' : 'border-dashed border-hairline-strong bg-panel/60'}`}>
      <h3 className="font-display text-[14px] font-bold">{title}</h3>
      {!open ? <ItemLine item={slot.item} label={trainingWords('slot-label', { letter: slot.letter })} build={build} /> : (
        <>
          {slot.filler === null ? <p className="text-[12px] text-ink-soft">{trainingWords('slot-empty')}</p> : (
            <div className="flex items-center gap-2">
              <FaceTile round outfitId={slot.filler} label={name!} size={36} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{name}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={onFill} data-action="fill"
              className="font-display min-h-11 flex-1 rounded-sm bg-accent px-2 text-[13px] font-semibold text-accent-ink shadow-1">
              {slot.filler === null ? trainingWords('fill', { letter: slot.letter }) : trainingWords('refill', { letter: slot.letter })}
            </button>
            {slot.filler !== null && (
              <button type="button" disabled={tap.pending !== null} data-action="empty"
                onClick={() => void tap.run('set-lineage', { umaId: build.uma.outfitId, preset: build.preset, lineage: withoutSlot(build.uma, build.preset, slot.slot) }, `lineage:${build.uma.outfitId}`)}
                className="min-h-11 rounded-sm border border-hairline-strong bg-panel px-2 text-[13px] font-semibold text-ink-soft disabled:opacity-45">
                {trainingWords('empty', { letter: slot.letter })}
              </button>
            )}
          </div>
          <TapNoteLine tap={tap} />
        </>
      )}
      <div className="space-y-1 border-t border-hairline pt-1.5">
        <ItemLine item={slot.unique.item} build={build}
          label={slot.unique.skill === null ? trainingWords('unique-none') : trainingWords('unique-line', { skill: slot.unique.skill })} />
        {slot.golds.map((gold) => (
          <div key={gold.index} data-gold={gold.index + 1}>
            <ItemLine item={gold.item} build={build}
              label={gold.skill === null ? trainingWords('gold-none', { n: gold.index + 1 }) : trainingWords('gold-line', { n: gold.index + 1, skill: gold.skill })} />
            {gold.warning !== null && <p className="text-[12px] font-semibold text-warning" data-g2="gold-warning">{gold.warning}</p>}
          </div>
        ))}
      </div>
    </article>
  )
}

function Lineage({ build }: { build: BuildContext }) {
  const tap = useTap()
  const [filling, setFilling] = useState<LineageSlotId | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const slots = useMemo(() => lineageView(build.settled, build.uma, build.preset, build.now, build.context, build.content), [build])
  const picks = useMemo(
    () => (filling === null ? new Map() : lineagePicks(build.settled, build.uma, build.preset, filling, build.derived, build.now, build.context, build.content)),
    [filling, build],
  )
  const bySlot = new Map(slots.map((slot) => [slot.slot, slot]))
  const column = (ids: readonly LineageSlotId[]) => (
    <div className="space-y-2">
      {ids.map((id) => <SlotCard key={id} slot={bySlot.get(id)!} build={build} onFill={() => setFilling(id)} />)}
    </div>
  )
  const letter = filling === null ? '' : bySlot.get(filling)!.letter
  const pick = (umaId: string) => {
    const chosen = picks.get(umaId)
    if (chosen === undefined || filling === null) return
    void tap.run('set-lineage', { umaId: build.uma.outfitId, preset: build.preset, lineage: chosen.lineage }, `lineage:${build.uma.outfitId}`).then((answer) => {
      setDone(answer?.kind === 'done' ? trainingWords('lineage-done', { uma: build.context.umaName(umaId) || umaId, letter }) : null)
    })
  }
  return (
    <div className="space-y-3 px-4 py-3" data-g2="lineage-view">
      <div className="grid grid-cols-2 gap-2">
        {column(['parent0', 'parent0-gp0', 'parent0-gp1'])}
        {column(['parent1', 'parent1-gp0', 'parent1-gp1'])}
      </div>
      {done !== null && <p role="status" className="text-[13px] text-success">{done}</p>}
      <TapNoteLine tap={tap} />
      <UmaPicker
        open={filling !== null}
        onClose={() => setFilling(null)}
        title={trainingWords('lineage-picker', { letter })}
        candidateIds={[...picks.keys()]}
        selectedIds={filling === null ? [] : [bySlot.get(filling)!.filler].filter((id): id is string => id !== null)}
        sorts={[{
          key: 'adds',
          label: trainingWords('lineage-sort'),
          direction: 'desc',
          value: (entry) => {
            const one = picks.get(entry.id)
            return one === undefined ? 0 : one.grades * 100 + one.skills
          },
          describe: (entry) => picks.get(entry.id)?.line ?? null,
        }]}
        describe={(entry) => picks.get(entry.id)?.line ?? null}
        disabledReason={(entry) => picks.get(entry.id)?.refusal ?? null}
        onPick={pick}
      />
    </div>
  )
}

export default function LineageView({ place, umaId }: BuildViewProps) {
  return (
    <BuildFrame place={place} umaId={umaId} title={(name) => trainingWords('lineage-title', { uma: name })}>
      {(build) => <Lineage build={build} />}
    </BuildFrame>
  )
}
