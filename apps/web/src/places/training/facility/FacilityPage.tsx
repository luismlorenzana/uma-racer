// A Training facility's page (docs/rework/05-training-hub.md §7, §8; docs/rework/11-hub-and-places.md §3.2; T139), one
// for all four, at 390 × 844 top to bottom: the header (level, slots in use, speed, **Upgrade** with what it adds, (i));
// **Needs here**; a card per slot, by room under its stat or card-type icon at the Gym and Dojo; and **Collect here** in
// the thumb zone. The session sheet opens over the page from its query (`?session=…`), so a slot, a build view's
// Unlock, a Needs line, the planner and the Card Library's Bond all reach it by a link.
import type { CollectAllReceipt } from '@racer/domain/rework/check-in'
import type { FacilityId } from '@racer/domain/rework/farm'
import { SESSION_MAX_UNLOCKS, sessionSeconds } from '@racer/domain/rework/training'
import type { Place } from '@racer/domain/hub'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { TypeIcon } from '../../../ui/TypeIcon'
import { useGame } from '../../../app/game'
import { navState } from '../../../hub/nav'
import { ItemIcon } from '../../../ui/ItemIcon'
import { duration } from '../../../ui/labels'
import { PlaceHeader } from '../../../ui/PlaceHeader'
import { SlotCard } from '../../../ui/work/SlotCard'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { UpgradeControls } from '../../../ui/work/Upgrade'
import { useTap, useWordsContext, type Tap } from '../../../ui/work/useTap'
import { useWorkView } from '../../../ui/work/view'
import { showWords, type WordsContext } from '../../../ui/work/words'
import { dishWords, sessionPath, type Content } from '../common'
import { readSessionQuery, withoutSession } from '../session/query'
import { trainingWords } from '../words'
import { currentUnlock, facilityView, queuedWords, unlockLine, type FacilityView } from './model'

const SessionSheet = lazy(() => import('../session/SessionSheet'))

const BUTTON = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm px-4 text-[14px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

function Header({ model }: { model: FacilityView }) {
  return (
    <section aria-label={model.name} className="space-y-3 border-b border-hairline px-4 py-3">
      <p className="font-display flex flex-wrap gap-x-3 text-[14px] font-semibold tabular-nums" data-g2="facility-header">
        <span>{trainingWords('level', { level: model.level })}</span>
        <span>{trainingWords('slots-in-use', { used: model.used, slots: model.slots })}</span>
        {model.speed > 1 && <span>{trainingWords('speed', { speed: model.speed })}</span>}
      </p>
      {model.upgrade !== null && <UpgradeControls upgrade={model.upgrade} building={model.facility} name={model.name} adds />}
    </section>
  )
}

function Needs({ model, noUmas }: { model: FacilityView; noUmas: boolean }) {
  return (
    <section aria-labelledby="training-needs" className="space-y-2 px-4 py-3">
      <h2 id="training-needs" className="text-micro">{trainingWords('needs-title')}</h2>
      {noUmas ? (
        <p className="text-[13px]" data-g2="no-umas">
          {trainingWords('no-umas')}{' '}
          <Link to="/town/stable?tab=locked" state={{ back: true }} className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline">{trainingWords('open-stable')}</Link>
        </p>
      ) : model.lines.length === 0 && <p className="text-[13px] text-ink-soft">{trainingWords('needs-none')}</p>}
      <ul className="space-y-1.5">
        {model.lines.map((line) => (
          <li key={`${line.outfitId}:${line.pick === null ? 'unlocks' : 'pick'}`} data-needs-line={line.outfitId} className="flex flex-wrap items-center gap-2 rounded-sm bg-sunken/60 px-2 py-1.5 text-[13px]">
            {line.pick !== null
              ? <Link to={line.pick} state={{ back: true }} className="flex min-h-11 min-w-0 flex-1 items-center font-semibold underline decoration-hairline-strong">{line.words}</Link>
              : <span className="min-w-0 flex-1">{line.words}</span>}
            {line.cook !== null && (
              <Link
                to={line.cook.to}
                state={{ back: true }}
                aria-label={trainingWords('cook', { dish: dishWords(line.cook.dish) })}
                className="inline-flex min-h-11 items-center gap-1 rounded-sm border border-hairline-strong bg-panel px-2 text-[12px] font-semibold"
              >
                <ItemIcon item={line.cook.dish} decorative />
                {trainingWords('cook-short')}
              </Link>
            )}
            {line.start !== null && (
              <Link to={line.start} state={{ back: true }} className={`${BUTTON} bg-accent text-ink`} data-action="needs-start">{trainingWords('start')}</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Slots({ model, content }: { model: FacilityView; content: Content | null }) {
  const view = useWorkView()
  const facility = model.facility
  return (
    <section aria-labelledby="training-slots" className="flex-1 space-y-3 px-4 py-3">
      <h2 id="training-slots" className="text-micro">{trainingWords('slots-title')}</h2>
      {model.rooms.map((room) => (
        <div key={room.room ?? 'all'} className="space-y-2" data-room={room.room ?? undefined}>
          {room.room !== null && (
            <h3 className="flex items-center gap-2 text-[14px] font-semibold">
              <TypeIcon type={room.room === 'friend-group' ? 'friend' : room.room} size={20} />
              {trainingWords('room', { room: room.name ?? '' })}
            </h3>
          )}
          {room.cards.map((card) => {
            const held = card.kind === 'held' ? currentUnlock(view?.settled.work[card.outfitId], card) : null
            const line = held === null ? null : unlockLine(held.ref, held.dishId, content)
            return (
              <SlotCard
                key={`${room.room ?? ''}:${card.slot.slot}`}
                card={card}
                farmLevel={false}
                startLabel={trainingWords('start-session')}
                startTo={sessionPath(facility, { room: room.room, slot: card.slot.slot })}
                queueTo={card.kind === 'held' ? sessionPath(facility, { uma: card.outfitId, room: room.room, queue: true }) : undefined}
                queueLabel={(request) => queuedWords(request, content)}
                what={held === null || line === null ? undefined : { icon: <ItemIcon item={held.dishId} decorative />, line, name: line }}
              />
            )
          })}
        </div>
      ))}
    </section>
  )
}

/** Collect here's receipt, line by line: what each Uma opened, or why a line was skipped. */
function ReceiptLines({ receipt, context }: { receipt: CollectAllReceipt | null; context: WordsContext }) {
  if (receipt === null) return null
  const name = (outfitId: string | null) => (outfitId === null ? '' : context.umaName(outfitId) || outfitId)
  const lines = receipt.lines.map((line) => (line.words !== null
    ? trainingWords('skipped-line', { uma: name(line.outfitId), words: showWords(line.words, context) })
    : line.unlocks.length === 1
      ? trainingWords('collected-line-one', { uma: name(line.outfitId) })
      : trainingWords('collected-line', { uma: name(line.outfitId), n: line.unlocks.length })))
  if (lines.length === 0) lines.push(trainingWords('nothing-to-collect'))
  return (
    <ul role="status" data-g2="here-receipt" className="space-y-0.5 text-[13px] text-ink">
      {lines.map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  )
}

function CollectHere({ model, tap }: { model: FacilityView; tap: Tap }) {
  const context = useWordsContext()
  const [receipt, setReceipt] = useState<CollectAllReceipt | null>(null)
  const collect = async () => {
    const answer = await tap.run('collect-all', { places: [model.facility], shown: model.readySlots }, `here:${model.facility}`)
    setReceipt(answer?.kind === 'done' ? (answer.receipt as CollectAllReceipt) : null)
  }
  return (
    <div className="pb-safe sticky bottom-0 z-10 space-y-2 border-t border-hairline bg-panel/95 px-4 py-3 backdrop-blur">
      <ReceiptLines receipt={receipt} context={context} />
      <TapNoteLine tap={tap} />
      <button type="button" data-action="collect-here" disabled={tap.pending !== null || model.ready === 0} onClick={() => void collect()} className={`${BUTTON} w-full bg-accent text-ink`}>
        {model.ready > 0 ? trainingWords('collect-here-n', { n: model.ready }) : trainingWords('collect-here')}
      </button>
      {model.ready === 0 && <p className="text-[12px] text-ink-soft">{trainingWords('nothing-to-collect')}</p>}
    </div>
  )
}

export default function FacilityPage({ place }: { place: Place }) {
  const facility = place.id as FacilityId
  const view = useWorkView()
  const context = useWordsContext()
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const tap = useTap()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const model = useMemo(() => (view === null ? null : facilityView(view, facility, context)), [view, facility, context])
  const query = readSessionQuery(params, facility)

  const closeSheet = () => {
    if (navState(location).back === true) navigate(-1)
    else navigate(`${place.route}${withoutSession(location.search)}`, { replace: true })
  }
  const help = [
    trainingWords('help', { max: SESSION_MAX_UNLOCKS }),
    ...(model !== null && model.rooms.length > 1 ? [trainingWords('help-rooms')] : []),
    trainingWords('help-time', { minutes: duration(sessionSeconds(1, model?.speed ?? 1)) }),
  ]
  return (
    <div data-g2="training-facility" data-place-page={place.id} className="flex min-h-full flex-col">
      <PlaceHeader place={place} lines={help} />
      {model !== null && (
        <>
          <Header model={model} />
          <Needs model={model} noUmas={Object.keys(view?.settled.umas ?? {}).length === 0} />
          <Slots model={model} content={content} />
          <CollectHere model={model} tap={tap} />
        </>
      )}
      {query !== null && (
        <Suspense fallback={null}>
          <SessionSheet place={place} facility={facility} query={query} onClose={closeSheet} />
        </Suspense>
      )}
    </div>
  )
}
