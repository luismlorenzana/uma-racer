// The one session sheet (docs/rework/05-training-hub.md §8, §10; docs/rework/06-cards-and-bonds.md §6, §10; T139), over
// a facility page from its query: **Uma** (T138's picker unless the link names her; Queue for her running session here,
// Recall first for a Farm job), **Room** at the Gym and Dojo, **Unlocks** (her items here with their dish, stock and
// minutes, or at the Dojo the cards picked from T138's Card Library), and **Confirm** (the dishes to reserve, the time
// and each finish), then **Start** or **Add to queue**. A disabled button says why in the rule's words; an `ask`
// re-offers what the stock covers; Start closes to `back` or the facility page.
import { clockTime } from '@racer/domain/check-in'
import type { FacilityId, RoomId } from '@racer/domain/farm'
import type { Place } from '@racer/domain/hub'
import { dojoRoomOf, ROOM_NAMES, type UnlockRef } from '@racer/domain/training'
import { statusOf } from '@racer/domain/work'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { BottomSheet } from '../../../ui/BottomSheet'
import { CheckIcon, LockedIcon } from '../../../ui/icons'
import { TypeIcon } from '../../../ui/TypeIcon'
import { useGame, useRuntime } from '../../../app/game'
import { navState } from '../../../hub/nav'
import { UmaSquare } from '../../../ui/ArtSquare'
import { ItemIcon } from '../../../ui/ItemIcon'
import { duration } from '../../../ui/labels'
import { Sheet } from '../../../ui/Sheet'
import { UmaPicker } from '../../../ui/UmaPicker'
import { RecallSheet } from '../../../ui/work/RecallSheet'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { useTap, useWordsContext } from '../../../ui/work/useTap'
import { useWorkView } from '../../../ui/work/view'
import { grouped, itemsList } from '../../../ui/work/words'
import { CardLibrary } from '../../card-library/CardLibrary'
import { sheetQuery } from '../../farm/building/model'
import { ruleWords } from '../common'
import { bondable } from '../dojo/model'
import { trainingWords } from '../words'
import { openingRoom, sessionUmaRows, sessionView, totalWords, type SessionItem } from './model'
import type { SessionQuery } from './query'

const BUTTON = 'font-display inline-flex min-h-12 items-center justify-center rounded-sm px-4 text-[15px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

const refOf = (ref: UnlockRef): UnlockRef => ({ kind: ref.kind, target: ref.target })

function ItemRow({ item, here, onToggle }: { item: SessionItem; here: string; onToggle: () => void }) {
  const lockedLine = item.words
  if (item.state !== 'available') {
    return (
      <li data-unlock={item.key} data-state={item.state} aria-label={[item.name, item.dish, lockedLine].filter(Boolean).join('. ')} className="flex min-h-12 items-center gap-2 rounded-sm bg-sunken/40 px-2 py-1.5 text-[13px] text-ink-soft">
        <span aria-hidden className="flex size-6 shrink-0 items-center justify-center"><LockedIcon size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{item.name}</span>
          {item.dish !== null && <span className="block">{item.dish}</span>}
          {lockedLine !== null && <span className="block">{lockedLine}</span>}
        </span>
      </li>
    )
  }
  const empty = item.stock <= 0 && !item.picked
  const details = [item.dish, empty ? null : trainingWords('stock', { n: grouped(Math.max(0, item.stock)) }), duration(item.seconds)].filter(Boolean).join(' · ')
  return (
    <li data-unlock={item.key} data-state={empty ? 'no-stock' : 'available'} className="flex items-center gap-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.picked}
        aria-label={`${item.name}, ${details}`}
        disabled={!item.pickable}
        onClick={onToggle}
        className={`flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left disabled:opacity-60 ${item.picked ? 'bg-accent-wash ring-1 ring-accent' : 'bg-sunken/50'}`}
      >
        <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-xs border ${item.picked ? 'border-accent bg-accent text-ink' : 'border-hairline-strong bg-panel'}`}>
          {item.picked && <CheckIcon size={16} />}
        </span>
        {item.dishId !== null && <ItemIcon item={item.dishId} decorative className={empty ? 'opacity-45' : ''} />}
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{item.name}</span>
          <span className="block text-[12px] text-ink-soft">{details}</span>
          {item.picked && item.stock <= 0 && <span className="block text-[12px] font-semibold text-danger">{trainingWords('no-stock')}</span>}
        </span>
      </button>
      {item.dishId !== null && item.stock <= 0 && (
        <Link
          to={`/farm/kitchen${sheetQuery({ job: item.dishId, back: here })}`}
          state={{ back: true }}
          aria-label={trainingWords('cook', { dish: item.dish ?? '' })}
          data-action="cook"
          className="inline-flex min-h-12 shrink-0 items-center rounded-sm border border-hairline-strong bg-panel px-2 text-[12px] font-semibold text-ink-soft"
        >
          {trainingWords('no-stock')}
        </Link>
      )}
    </li>
  )
}

export default function SessionSheet({ place, facility, query, onClose }: {
  place: Place
  facility: FacilityId
  query: SessionQuery
  onClose: () => void
}) {
  const view = useWorkView()
  const { game } = useRuntime()
  const context = useWordsContext()
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const tap = useTap()
  const location = useLocation()
  const navigate = useNavigate()
  const [uma, setUma] = useState<string | null>(query.uma)
  const [roomChosen, setRoomChosen] = useState<RoomId | null>(null)
  const [picks, setPicks] = useState<readonly UnlockRef[] | null>(null)
  // The picker opens at once when the link names nobody and there's somebody to pick.
  const [picking, setPicking] = useState(() => query.uma === null && Object.keys(game.getSnapshot().state?.umas ?? {}).length > 0)
  const [addingCard, setAddingCard] = useState(false)
  const [recalling, setRecalling] = useState<string | null>(null)

  const room = view === null || content === null ? null : roomChosen ?? openingRoom(view, facility, query, content)
  const model = useMemo(
    () => (view === null || content === null ? null : sessionView(view, { facility, umaId: uma, room, picks, query }, context, content)),
    [view, facility, uma, room, picks, query, context, content],
  )
  const rows = useMemo(() => (view === null ? new Map() : sessionUmaRows(view, facility, room, context)), [view, facility, room, context])
  const canBond = useMemo(() => {
    const her = uma === null ? undefined : view?.settled.umas[uma]
    return view === null || content === null || her === undefined ? null : bondable(view.settled, her, content)
  }, [view, content, uma])
  const pickedCards = model?.picks.map((entry) => entry.target).join(',') ?? ''
  const eligible = useMemo(() => {
    const taken = new Set(pickedCards.split(','))
    return (cardId: string) => {
      const card = content?.cards.get(cardId)
      return card !== undefined && canBond !== null && dojoRoomOf(card.type) === room && canBond(cardId) && !taken.has(cardId)
    }
  }, [content, canBond, room, pickedCards])
  if (view === null || content === null || model === null) return null

  const here = `${location.pathname}${location.search}`
  const time = (at: number) => clockTime(at, context.utcOffsetMin)
  const title = trainingWords(model.mode === 'queue' ? 'sheet-queue-title' : 'sheet-title', { place: place.name })
  const noUmas = Object.keys(view.settled.umas).length === 0
  const name = uma === null ? '' : context.umaName(uma) || uma
  const current = model.picks.map(refOf)

  const leave = () => {
    if (query.back === null) onClose()
    else if (navState(location).back === true) navigate(-1)
    else navigate(query.back, { replace: true })
  }
  const go = async () => {
    if (model.action.mode === 'blocked' || model.action.refusal !== null) return
    const answer = model.action.mode === 'queue'
      ? await tap.run('queue', model.action.input, `session:${facility}`)
      : await tap.run('start', model.action.input, `session:${facility}`)
    if (answer?.kind === 'done') leave()
  }
  const pickUma = (id: string) => {
    setUma(id)
    setPicks(null)
    tap.clear()
  }
  const toggle = (item: SessionItem) => {
    setPicks(item.picked ? current.filter((ref) => `${ref.kind}:${ref.target}` !== item.key) : [...current, item.ref])
    tap.clear()
  }
  const chooseRoom = (next: RoomId) => {
    setRoomChosen(next)
    setPicks(facility === 'dojo' ? [] : null)
    tap.clear()
  }
  const recalled = () => {
    const id = recalling
    setRecalling(null)
    const now = game.getSnapshot().state
    if (id !== null && now !== null && statusOf(now.work[id], game.now()) !== 'working') pickUma(id)
  }

  const action = model.action
  const blocked = action.mode === 'blocked' ? action.words : action.refusal === null ? null : ruleWords(action.refusal, context, content)
  const label = model.mode === 'queue' ? trainingWords('add-to-queue') : trainingWords('start')

  return (
    <>
      <BottomSheet open onClose={onClose} label={title}>
        <div data-g2="session-sheet" data-facility={facility} className="space-y-4 pb-2">
          <h2 className="text-lg">{title}</h2>

          <section aria-labelledby="session-uma" className="space-y-2">
            <h3 id="session-uma" className="text-micro">{trainingWords('uma-title')}</h3>
            {noUmas ? (
              <p className="text-[14px]">
                {trainingWords('no-umas')}{' '}
                <Link to="/town/stable?tab=locked" className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline">{trainingWords('open-stable')}</Link>
              </p>
            ) : model.unknown !== null ? (
              <p className="text-[14px]" data-g2="unknown-uma">
                {model.unknown}{' '}
                <button type="button" onClick={() => setPicking(true)} className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline">{trainingWords('pick-uma')}</button>
              </p>
            ) : uma === null ? (
              <button type="button" onClick={() => setPicking(true)} data-action="pick-uma" className={`${BUTTON} w-full border border-hairline-strong bg-panel text-ink`}>
                {trainingWords('pick-uma')}
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-sm bg-sunken/50 p-2" data-chosen-uma={uma}>
                <span className="w-11 shrink-0"><UmaSquare outfitId={uma} name={name} tight /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{name}</span>
                  <span className="block text-[12px] text-ink-soft">{rows.get(uma)?.line ?? ''}</span>
                </span>
                <button type="button" onClick={() => setPicking(true)} aria-label={trainingWords('change-uma')} className="min-h-11 px-2 text-[13px] font-semibold text-accent-strong">
                  {trainingWords('change')}
                </button>
              </div>
            )}
          </section>

          {model.rooms.length > 0 && (
            <section aria-labelledby="session-room" className="space-y-2">
              <h3 id="session-room" className="text-micro">{trainingWords('room-title')}</h3>
              <div role="radiogroup" aria-labelledby="session-room" className="grid grid-cols-3 gap-1.5">
                {model.rooms.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={option === model.room}
                    onClick={() => chooseRoom(option)}
                    className={`flex min-h-11 items-center justify-center gap-1.5 rounded-sm border px-1 text-[13px] font-semibold ${option === model.room ? 'border-accent bg-accent-wash text-ink' : 'border-hairline-strong bg-panel text-ink-soft'}`}
                  >
                    <TypeIcon type={option === 'friend-group' ? 'friend' : option} size={16} />
                    {ROOM_NAMES[option]}
                  </button>
                ))}
              </div>
            </section>
          )}

          {model.uma !== null && (
            <section aria-labelledby="session-unlocks" className="space-y-2">
              <h3 id="session-unlocks" className="text-micro">{trainingWords(facility === 'dojo' ? 'bonds-title' : 'unlocks-title')}</h3>
              <ul className="space-y-1" data-g2="session-unlocks">
                {model.items.map((item) => <ItemRow key={item.key} item={item} here={here} onToggle={() => toggle(item)} />)}
              </ul>
              {facility === 'dojo' && (
                <button type="button" onClick={() => setAddingCard(true)} data-action="add-card" className={`${BUTTON} w-full border border-hairline-strong bg-panel text-ink`}>
                  {trainingWords('add-card')}
                </button>
              )}
            </section>
          )}

          {model.picks.length > 0 && (
            <section aria-labelledby="session-confirm" className="space-y-1.5 text-[13px]" data-g2="session-confirm">
              <h3 id="session-confirm" className="text-micro">{trainingWords('confirm-title')}</h3>
              <p>{trainingWords('reserves', { items: itemsList(model.confirm.dishes) })}</p>
              <p className="font-semibold">{totalWords(model.confirm)}</p>
              <ol className="space-y-0.5 text-ink-soft tabular-nums">
                {model.confirm.finishes.map((finish, i) => <li key={i}>{trainingWords('finish-at', { what: finish.name, time: time(finish.at) })}</li>)}
              </ol>
            </section>
          )}

          <div className="space-y-1.5">
            <button type="button" data-action="session-go" disabled={blocked !== null || tap.pending !== null} onClick={() => void go()} className={`${BUTTON} w-full bg-accent text-ink`}>
              {label}
            </button>
            {blocked !== null && <p data-g2="session-why" className="text-[13px] text-ink-soft">{blocked}</p>}
            <TapNoteLine tap={tap} onDone={leave} />
          </div>
        </div>
      </BottomSheet>

      <UmaPicker
        open={picking}
        onClose={() => setPicking(false)}
        title={trainingWords('picker-title', { place: place.name })}
        selectedIds={uma === null ? [] : [uma]}
        sorts={[{
          key: 'here',
          label: trainingWords('picker-sort'),
          direction: 'desc',
          value: (entry) => rows.get(entry.id)?.order ?? 0,
          describe: (entry) => rows.get(entry.id)?.line ?? null,
        }]}
        defaultSort="here"
        describe={(entry) => rows.get(entry.id)?.line ?? null}
        disabledReason={(entry) => rows.get(entry.id)?.reason ?? null}
        action={(entry) => {
          const row = rows.get(entry.id)
          if (row?.canQueue) {
            return (
              <button type="button" onClick={() => { pickUma(entry.id); setPicking(false) }} data-action="picker-queue"
                className="font-display mt-1 min-h-11 w-full rounded-sm bg-accent px-3 text-[13px] font-semibold text-ink shadow-1">
                {trainingWords('queue')}
              </button>
            )
          }
          if (row?.farmJob) {
            return (
              <button type="button" onClick={() => { setPicking(false); setRecalling(entry.id) }} data-action="picker-recall"
                className="font-display mt-1 min-h-11 w-full rounded-sm border border-danger/40 bg-panel px-3 text-[13px] font-semibold text-danger">
                {trainingWords('recall')}
              </button>
            )
          }
          return null
        }}
        onPick={pickUma}
      />

      {recalling !== null && <RecallSheet outfitId={recalling} open onClose={recalled} />}

      {facility === 'dojo' && uma !== null && canBond !== null && (
        <Sheet open={addingCard} onClose={() => setAddingCard(false)} label={trainingWords('pick-card-title', { uma: name })}>
          {addingCard && (
            <CardLibrary
              mode="pick"
              umaId={uma}
              title={trainingWords('pick-card-title', { uma: name })}
              eligible={eligible}
              onPick={(cardId) => {
                setPicks([...current, { kind: 'bond', target: cardId }])
                setAddingCard(false)
                tap.clear()
              }}
            />
          )}
        </Sheet>
      )}
    </>
  )
}
