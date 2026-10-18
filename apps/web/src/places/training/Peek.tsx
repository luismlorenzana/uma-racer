// A Training facility's Peek (docs/game/11-hub-and-places.md §3.2; T139, D366): its level, slots in use and speed as
// chips; its held slots as the Farm's compact rows (`PeekRow`: face in its ring, dish, "×3 · 1/3" and how long is left,
// or Done), then how many are free; the Umas with unlocks left here in their open layers; and the facility's dishes in
// the Warehouse (Vegetables, Mushrooms, or the Gym's stat, Duo and Feast dishes), or at the Dojo the bonds left this
// layer (`layerProgress`). A finished row's **Collect** opens its unlocks; the Peek's Enter opens the page.
import type { FacilityId } from '@racer/domain/farm'
import { useMemo } from 'react'
import type { PeekProps } from '../registry'
import { ItemIcon } from '../../ui/ItemIcon'
import { useGame } from '../../app/game'
import { PlaceStats } from '../../ui/work/PlaceStats'
import { PeekRow } from '../../ui/work/SlotRow'
import { useWordsContext } from '../../ui/work/useTap'
import { useWorkView } from '../../ui/work/view'
import { grouped } from '../../ui/work/words'
import { currentUnlock, dishFamilyName, facilityDishes, facilityView, leftHere, peekNoun, unlockLine } from './facility/model'
import { trainingWords } from './words'

/** Names a Peek lists before "and N more". */
export const PEEK_NAMES = 3

export default function TrainingPeek({ place }: PeekProps) {
  const facility = place.id as FacilityId
  const view = useWorkView()
  const context = useWordsContext()
  const model = useMemo(() => (view === null ? null : facilityView(view, facility, context)), [view, facility, context])
  const left = useMemo(() => (view === null ? [] : leftHere(view, facility)), [view, facility])
  const dishes = useMemo(() => (view === null ? [] : facilityDishes(view, facility)), [view, facility])
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  if (model === null) return null
  const cards = model.rooms.flatMap((room) => room.cards)
  const held = cards.flatMap((card) => (card.kind === 'held' ? [card] : []))
  const free = cards.length - held.length
  const noun = peekNoun(facility)
  const name = (outfitId: string) => context.umaName(outfitId) || outfitId
  return (
    <div data-g2="training-peek" className="space-y-3 pb-1">
      <PlaceStats level={model.level} used={model.used} slots={model.slots} speed={model.speed} />
      <ul aria-label={trainingWords('slots-title')} className="space-y-1.5">
        {held.map((card) => {
          const now = currentUnlock(view?.settled.work[card.outfitId], card)
          const line = now === null ? null : unlockLine(now.ref, now.dishId, content)
          return (
            <PeekRow
              key={`${card.slot.room ?? ''}:${card.slot.slot}`}
              card={card}
              what={now === null || line === null ? undefined : { icon: now.dishId === null ? null : <ItemIcon item={now.dishId} decorative />, name: line }}
            />
          )
        })}
        {free > 0 && <li className="text-[13px] text-ink-soft">{free === 1 ? trainingWords('peek-free-one') : trainingWords('peek-free', { n: free })}</li>}
      </ul>
      {facility === 'dojo' ? (
        <section aria-label={trainingWords('peek-bonds')}>
          <h3 className="text-micro mb-1">{trainingWords('peek-bonds')}</h3>
          {left.length === 0
            ? <p className="text-[12px] text-ink-soft">{trainingWords('peek-left-none', { noun })}</p>
            : (
              <ul className="space-y-0.5 text-[12px]">
                {left.slice(0, PEEK_NAMES).map((entry) => <li key={entry.outfitId}>{trainingWords('peek-bonds-line', { uma: name(entry.outfitId), n: entry.left })}</li>)}
                {left.length > PEEK_NAMES && <li className="text-ink-soft">{trainingWords('peek-left', { n: left.length, noun })}</li>}
              </ul>
            )}
        </section>
      ) : (
        <>
          <p className="text-[12px] text-ink-soft" data-g2="peek-left">
            {left.length === 0 ? trainingWords('peek-left-none', { noun })
              : left.length === 1 ? trainingWords('peek-left-one', { noun }) : trainingWords('peek-left', { n: left.length, noun })}
            {left.length > 0 && `: ${left.slice(0, PEEK_NAMES).map((entry) => `${name(entry.outfitId)} ${entry.left}`).join(', ')}`}
          </p>
          <section aria-label={trainingWords('peek-dishes', { family: dishFamilyName(facility) })}>
            <h3 className="text-micro mb-1">{trainingWords('peek-dishes', { family: dishFamilyName(facility) })}</h3>
            {dishes.length === 0 ? <p className="text-[12px] text-ink-soft">{trainingWords('peek-dishes-none')}</p> : (
              <ul className="flex flex-wrap gap-1.5">
                {dishes.map((dish) => (
                  <li key={dish.item} className="flex items-center gap-1 rounded-sm bg-sunken/60 py-0.5 pr-2 pl-0.5 text-[12px] tabular-nums" aria-label={`${dish.words}: ${grouped(dish.count)}`}>
                    <ItemIcon item={dish.item} decorative />
                    <span aria-hidden>×{grouped(dish.count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
