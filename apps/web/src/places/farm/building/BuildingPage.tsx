// A Farm building's page (docs/game/07-farm.md §10; docs/game/11-hub-and-places.md §3.4, §7.1; T140, D366), one for
// all ten, compact enough that a building of up to four slots fits 390 × 844 without scrolling: one header row (level,
// slots in use and speed as chips, the **Upgrade** button with its Prize Money, and the (i) help in the title bar);
// **For your targets** as one row of item icons, each opening the job sheet filled in; a 56 pt row per slot
// (`SlotRow`: face in its ring, item, "×10 · 3/10", time left, Collect, Repeat, Speed Tickets and ⋯), a free one a
// dashed "+"; and **Collect here** and **Repeat here** in the thumb zone, whose receipt lists every line and every skip
// with its reason. The job sheet opens over the page from its query (`?job=…`), so the Warehouse, the planner and the
// session sheet reach it by a link.
import type { CollectAllReceipt, RepeatReceipt } from '@racer/domain/check-in'
import { durationText } from '@racer/domain/check-in'
import type { FarmBuildingId } from '@racer/domain/farm'
import { MAX_ITEMS_PER_ENTRY, MAX_QUEUE, MIN_ITEMS_PER_ENTRY, SESSION_KIND } from '@racer/domain/work'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { navState } from '../../../hub/nav'
import type { PageProps } from '../../registry'
import { PlaceHeader } from '../../../ui/PlaceHeader'
import { PlaceStats } from '../../../ui/work/PlaceStats'
import { SlotRow } from '../../../ui/work/SlotRow'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { useTap, useWordsContext, type Tap } from '../../../ui/work/useTap'
import { UpgradeButton } from '../../../ui/work/Upgrade'
import { useWorkView } from '../../../ui/work/view'
import { grouped, itemName, itemsList, showWords, type WordsContext } from '../../../ui/work/words'
import { readSheetQuery, withoutSheet } from '../job-sheet/model'
import { farmWords } from '../words'
import { buildingView, sheetQuery, type BuildingView } from './model'
import { TargetStrip } from './TargetStrip'

const JobSheet = lazy(() => import('../job-sheet/JobSheet'))

const BUTTON = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-[14px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

/** Collect here's and Repeat here's receipt, line by line, every skip with its reason. */
function ReceiptLines({ collected, repeated, context, now }: { collected: CollectAllReceipt | null; repeated: RepeatReceipt | null; context: WordsContext; now: number }) {
  const name = (outfitId: string | null) => (outfitId === null ? '' : context.umaName(outfitId) || outfitId)
  const lines: string[] = []
  for (const line of collected?.lines ?? []) {
    if (line.words !== null) lines.push(farmWords('skipped-line', { uma: name(line.outfitId), words: showWords(line.words, context) }))
    else {
      const exp = Math.round(line.farmExp / 4)
      lines.push(`${farmWords('collected-line', { uma: name(line.outfitId), items: itemsList(line.items) })}${exp > 0 ? ` · ${farmWords('collected-farm-exp', { n: grouped(exp) })}` : ''}`)
    }
  }
  if (collected !== null && collected.lines.length === 0) lines.push(farmWords('nothing-to-collect'))
  for (const started of repeated?.started ?? []) {
    const what = started.request.kind === SESSION_KIND ? '' : `${itemName(started.request.item)} ×${started.request.count}`
    const notes = started.notes.map((note) => showWords(note, context))
    lines.push([farmWords('repeated-line', { uma: name(started.outfitId), what, time: durationText(started.endsAt - now) }), ...notes].join(' · '))
  }
  for (const skipped of repeated?.skipped ?? []) lines.push(farmWords('skipped-line', { uma: name(skipped.outfitId), words: showWords(skipped.words, context) }))
  if (repeated !== null && repeated.started.length + repeated.skipped.length === 0) lines.push(farmWords('nothing-to-repeat'))
  if (lines.length === 0) return null
  return (
    <ul role="status" data-g2="here-receipt" className="space-y-0.5 text-[13px] text-ink">
      {lines.map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  )
}

/** Collect here and Repeat here, compact, in the thumb zone; off, they say why on the button itself. */
function HereActions({ model, tap, now }: { model: BuildingView; tap: Tap; now: number }) {
  const context = useWordsContext()
  const [collected, setCollected] = useState<CollectAllReceipt | null>(null)
  const [repeated, setRepeated] = useState<RepeatReceipt | null>(null)
  const collect = async () => {
    setRepeated(null)
    const answer = await tap.run('collect-all', { places: [model.building], shown: model.readySlots }, `here:${model.building}`)
    setCollected(answer?.kind === 'done' ? (answer.receipt as CollectAllReceipt) : null)
  }
  const repeat = async () => {
    setCollected(null)
    const answer = await tap.run('repeat', { places: [model.building], utcOffsetMin: context.utcOffsetMin }, `here:${model.building}`)
    setRepeated(answer?.kind === 'done' ? (answer.receipt as RepeatReceipt) : null)
  }
  const busy = tap.pending !== null
  return (
    <div className="pb-safe sticky bottom-0 z-10 space-y-1.5 border-t border-hairline bg-panel/95 px-4 py-2 backdrop-blur">
      <ReceiptLines collected={collected} repeated={repeated} context={context} now={now} />
      <TapNoteLine tap={tap} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" data-action="collect-here" disabled={busy || model.ready === 0} onClick={() => void collect()} className={`${BUTTON} w-full bg-accent text-ink`}>
          {model.ready > 0 ? farmWords('collect-here-n', { n: model.ready }) : farmWords('nothing-to-collect')}
        </button>
        <button type="button" data-action="repeat-here" disabled={busy || model.repeatable.length === 0} onClick={() => void repeat()} className={`${BUTTON} w-full border border-hairline-strong bg-panel text-ink`}>
          {model.repeatable.length > 0 ? farmWords('repeat-here-n', { n: model.repeatable.length }) : farmWords('nothing-to-repeat')}
        </button>
      </div>
    </div>
  )
}

export default function BuildingPage({ place, rest }: PageProps) {
  const building = place.id as FarmBuildingId
  const view = useWorkView()
  const context = useWordsContext()
  const tap = useTap()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const model = useMemo(() => (view === null ? null : buildingView(view, building, context)), [view, building, context])
  const query = readSheetQuery(params)

  if (rest !== '') return <Navigate to={place.route} replace />
  const closeSheet = () => {
    if (navState(location).back === true) navigate(-1)
    else navigate(`${place.route}${withoutSheet(location.search)}`, { replace: true })
  }
  const help = [
    farmWords('help', { min: MIN_ITEMS_PER_ENTRY, max: MAX_ITEMS_PER_ENTRY, queue: MAX_QUEUE }),
    farmWords(model?.family === null ? 'help-station' : 'help-site'),
    farmWords('help-icons'),
  ]
  return (
    <div data-g2="farm-building" data-place-page={place.id} className="flex min-h-full flex-col">
      <PlaceHeader place={place} rest={rest} lines={help} />
      {model !== null && view !== null && (
        <>
          <section aria-label={model.name} data-g2="farm-header" className="flex min-h-13 items-center gap-2 border-b border-hairline px-4 py-1">
            <PlaceStats level={model.level} used={model.used} slots={model.slots} speed={model.speed} className="flex-1" />
            {model.upgrade !== null && <UpgradeButton upgrade={model.upgrade} building={model.building} name={model.name} />}
          </section>
          <TargetStrip lines={model.lines} sheetTo={(line) => `${place.route}${line.sheet}`} className="px-4 pt-2.5" />
          <section aria-labelledby="farm-slots" className="flex-1 space-y-1.5 px-4 py-2.5">
            <h2 id="farm-slots" className="sr-only">{farmWords('slots-title')}</h2>
            {model.cards.map((card) => (
              <SlotRow
                key={card.slot.slot}
                card={card}
                repeat
                startTo={`${place.route}${sheetQuery({ job: null, slot: card.slot.slot })}`}
                queueTo={card.kind === 'held'
                  ? `${place.route}${sheetQuery({ job: card.request.kind === SESSION_KIND ? null : card.request.item, uma: card.outfitId, queue: true, slot: card.slot.slot })}`
                  : undefined}
              />
            ))}
          </section>
          <HereActions model={model} tap={tap} now={view.now} />
        </>
      )}
      {query !== null && (
        <Suspense fallback={null}>
          <JobSheet place={place} building={building} query={query} onClose={closeSheet} />
        </Suspense>
      )}
    </div>
  )
}
