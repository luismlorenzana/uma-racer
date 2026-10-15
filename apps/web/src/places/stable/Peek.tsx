// The Stable's Peek (docs/rework/11-hub-and-places.md §3.1; T138): the featured Uma first, "23 Umas · T1 21 · T2 2", the
// Umas ready to advance or promote, and the Uma Tickets in hand.
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useGame, useHub } from '../../app/game'
import type { PeekProps } from '../registry'
import { FeaturedUmaCard } from './Featured'
import { readyUmas, rosterLine, ticketNote } from './model'

export default function StablePeek(_: PeekProps) {
  const view = useHub()
  const state = useGame((snapshot) => snapshot.state)
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const ready = useMemo(() => (state === null || content === null ? [] : readyUmas(state, content)), [state, content])
  if (state === null || content === null) return null
  const note = ticketNote(state.profile)
  return (
    <div className="space-y-3" data-g2="stable-peek">
      <div className="flex items-center gap-3">
        <FeaturedUmaCard umaId={view?.featured ?? null} />
        <div className="min-w-0 text-[14px]">
          <p className="font-semibold" data-g2="roster-line">{rosterLine(state)}</p>
          <p className="text-ink-soft">Uma Tickets {note.text}</p>
        </div>
      </div>
      {ready.length > 0 && (
        <section aria-label="Ready to advance or promote">
          <h3 className="text-micro mb-1">Ready to advance or promote</h3>
          <ul className="grid gap-1">
            {ready.map(({ uma, ready: kind }) => (
              <li key={uma.outfitId}>
                <Link to={`/racing/scenario-gate/${encodeURIComponent(uma.outfitId)}`} state={{ back: true }}
                  className="flex min-h-11 items-center justify-between rounded-sm bg-sunken/60 px-3 text-[13px] font-semibold">
                  <span className="truncate">{content.umas.get(uma.outfitId)?.name}</span>
                  <span className="text-success">{kind === 'advance' ? 'Advance' : 'Promote'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
