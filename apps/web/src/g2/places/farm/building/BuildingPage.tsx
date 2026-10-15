// A Farm building's page (docs/rework/07-farm.md §10; docs/rework/11-hub-and-places.md §3.4, §7.1; T140), one for all
// ten, at 390 × 844 top to bottom: the header (level, slots in use, speed, **Upgrade** against stock, (i)); **For your
// targets**, each line opening the job sheet filled in; a card per slot; and **Collect here** and **Repeat here** in
// the thumb zone, whose receipt lists every line and every skip with its reason. The job sheet opens over the page from
// its query (`?job=…`), so the Warehouse, the planner and the session sheet reach it by a link.
import type { CollectAllReceipt, RepeatReceipt } from '@racer/domain/rework/check-in'
import { clockTime } from '@racer/domain/rework/check-in'
import type { FarmBuildingId } from '@racer/domain/rework/farm'
import { MAX_ITEMS_PER_ENTRY, MAX_QUEUE, MIN_ITEMS_PER_ENTRY, SESSION_KIND } from '@racer/domain/rework/work'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { navState } from '../../../hub/nav'
import type { PageProps } from '../../registry'
import { ItemIcon } from '../../../ui/ItemIcon'
import { PlaceHeader } from '../../../ui/PlaceHeader'
import { SlotCard } from '../../../ui/work/SlotCard'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { useTap, useWordsContext, type Tap } from '../../../ui/work/useTap'
import { useWorkView } from '../../../ui/work/view'
import { grouped, itemName, itemsList, showWords, workWords, type WordsContext } from '../../../ui/work/words'
import { readSheetQuery, withoutSheet } from '../job-sheet/model'
import { farmWords } from '../words'
import { buildingView, sheetQuery, type BuildingView, type UpgradeView } from './model'

const JobSheet = lazy(() => import('../job-sheet/JobSheet'))

const BUTTON = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm px-4 text-[14px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

function Upgrade({ upgrade, building, name }: { upgrade: UpgradeView; building: FarmBuildingId; name: string }) {
  const tap = useTap()
  const context = useWordsContext()
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const items = upgrade.items.map((row) => farmWords('upgrade-item', { item: itemName(row.item), have: grouped(row.have), need: grouped(row.need) }))
  const money = farmWords('upgrade-cost', { pm: grouped(upgrade.prizeMoney) })
  const cost = [money, itemsList(upgrade.items.map((row) => ({ item: row.item, qty: row.need })))].join(' and ')
  const run = async () => {
    setAsking(false)
    const answer = await tap.run('upgrade', { building }, `upgrade:${building}`)
    if (answer?.kind === 'done') setDone(answer.receipt.to)
  }
  return (
    <div data-g2="upgrade" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-action="upgrade"
          disabled={upgrade.refusal !== null || tap.pending !== null}
          onClick={() => setAsking(true)}
          className={`${BUTTON} bg-accent text-ink`}
        >
          {farmWords('upgrade', { level: upgrade.to })}
        </button>
        <span className="min-w-0 flex-1 text-[12px] leading-snug font-semibold text-ink-soft">{money}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 text-[12px] leading-snug text-ink-soft">
        {items.map((line, i) => (
          <li key={line} className={upgrade.items[i]!.have < upgrade.items[i]!.need ? 'font-semibold text-danger' : ''}>{line}</li>
        ))}
      </ul>
      {upgrade.refusal !== null && <p className="text-[13px] text-ink-soft">{showWords(upgrade.refusal, context)}</p>}
      {asking && (
        <div role="group" className="flex flex-wrap items-center gap-2 rounded-sm bg-accent-wash p-2 text-[13px]">
          <span className="min-w-0 flex-1">{farmWords('upgrade-ask', { place: name, level: upgrade.to, cost })}</span>
          <button type="button" onClick={() => void run()} className={`${BUTTON} bg-accent text-ink`}>{workWords('yes')}</button>
          <button type="button" onClick={() => setAsking(false)} className="min-h-11 px-3 font-semibold text-ink-soft">{workWords('not-now')}</button>
        </div>
      )}
      {done !== null && <p role="status" className="text-[13px] text-success">{farmWords('upgrade-done', { place: name, level: done })}</p>}
      <TapNoteLine tap={tap} />
    </div>
  )
}

function Header({ model }: { model: BuildingView }) {
  return (
    <section aria-label={model.name} className="space-y-3 border-b border-hairline px-4 py-3">
      <p className="font-display flex flex-wrap gap-x-3 text-[14px] font-semibold tabular-nums">
        <span>{farmWords('level', { level: model.level })}</span>
        <span>{farmWords('slots-in-use', { used: model.used, slots: model.slots })}</span>
        <span>{farmWords('speed', { speed: model.speed })}</span>
      </p>
      {model.upgrade !== null && <Upgrade upgrade={model.upgrade} building={model.building} name={model.name} />}
    </section>
  )
}

function Targets({ model, route }: { model: BuildingView; route: string }) {
  return (
    <section aria-labelledby="farm-targets" className="space-y-2 px-4 py-3">
      <h2 id="farm-targets" className="text-micro">{farmWords('targets-title')}</h2>
      {model.lines.length === 0 && <p className="text-[13px] text-ink-soft">{farmWords('targets-none')}</p>}
      <ul className="space-y-1.5">
        {model.lines.map((line) => (
          <li key={line.line.item} data-target-line={line.line.item} className="rounded-sm bg-sunken/60">
            <Link to={`${route}${line.sheet}`} state={{ back: true }} className="flex min-h-11 items-center gap-2 px-2 py-1.5 text-[13px]">
              <ItemIcon item={line.line.item} decorative />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{itemName(line.line.item)}</span>
                <span className="block text-ink-soft">{line.words}</span>
              </span>
            </Link>
            {line.gate !== null && (
              <p className="flex flex-wrap items-center gap-x-2 px-2 pb-1.5 text-[12px] text-ink-soft">
                <span>{line.gate}</span>
                {line.buy !== null && (
                  <Link to={line.buy.to} state={{ back: true }} className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline">
                    {farmWords('buy-at-exchange', { price: grouped(line.buy.price) })}
                  </Link>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Collect here's and Repeat here's receipt, line by line, every skip with its reason. */
function ReceiptLines({ collected, repeated, context }: { collected: CollectAllReceipt | null; repeated: RepeatReceipt | null; context: WordsContext }) {
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
    lines.push([farmWords('repeated-line', { uma: name(started.outfitId), what, time: clockTime(started.endsAt, context.utcOffsetMin) }), ...notes].join(' · '))
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

function HereActions({ model, tap }: { model: BuildingView; tap: Tap }) {
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
    <div className="pb-safe sticky bottom-0 z-10 space-y-2 border-t border-hairline bg-panel/95 px-4 py-3 backdrop-blur">
      <ReceiptLines collected={collected} repeated={repeated} context={context} />
      <TapNoteLine tap={tap} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <button type="button" data-action="collect-here" disabled={busy || model.ready === 0} onClick={() => void collect()} className={`${BUTTON} w-full bg-accent text-ink`}>
            {model.ready > 0 ? farmWords('collect-here-n', { n: model.ready }) : farmWords('collect-here')}
          </button>
          {model.ready === 0 && <p className="mt-1 text-[12px] text-ink-soft">{farmWords('nothing-to-collect')}</p>}
        </div>
        <div>
          <button type="button" data-action="repeat-here" disabled={busy || model.repeatable.length === 0} onClick={() => void repeat()} className={`${BUTTON} w-full border border-hairline-strong bg-panel text-ink`}>
            {model.repeatable.length > 0 ? farmWords('repeat-here-n', { n: model.repeatable.length }) : farmWords('repeat-here')}
          </button>
          {model.repeatable.length === 0 && <p className="mt-1 text-[12px] text-ink-soft">{farmWords('nothing-to-repeat')}</p>}
        </div>
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
  ]
  return (
    <div data-g2="farm-building" data-place-page={place.id} className="flex min-h-full flex-col">
      <PlaceHeader place={place} rest={rest} lines={help} />
      {model !== null && (
        <>
          <Header model={model} />
          <Targets model={model} route={place.route} />
          <section aria-labelledby="farm-slots" className="flex-1 space-y-2 px-4 py-3">
            <h2 id="farm-slots" className="text-micro">{farmWords('slots-title')}</h2>
            {model.cards.map((card) => (
              <SlotCard
                key={`${card.slot.slot}`}
                card={card}
                startTo={`${place.route}${sheetQuery({ job: null, slot: card.slot.slot })}`}
                queueTo={card.kind === 'held'
                  ? `${place.route}${sheetQuery({ job: card.request.kind === SESSION_KIND ? null : card.request.item, uma: card.outfitId, queue: true, slot: card.slot.slot })}`
                  : undefined}
              />
            ))}
          </section>
          <HereActions model={model} tap={tap} />
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
