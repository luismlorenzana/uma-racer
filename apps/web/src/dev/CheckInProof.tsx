// The check-in's dev proof (T142; docs/rework/11-hub-and-places.md §7.2's rule for new proofs: under `/dev/`, beside
// what it proves), at `/dev/seeds/dev/check-in` in dev builds only, on T137's seeds: the size chips for a grade-1 gather,
// craft, cook and session from the seed's clock (`?at=09:00` marks "Fits 13:00", `?at=23:00` "Overnight"), every queue
// with its finish times and warnings, every stopped queue's card, and the ways into the summary. Synthetic seeds only.
import { clockTime, nextCheckIn, queueStopped } from '@racer/domain/check-in'
import { farmItemSeconds } from '@racer/domain/farm'
import { sessionSeconds } from '@racer/domain/training'
import { useState } from 'react'
import { Link } from 'react-router'
import { useGame, useHub } from '../app/game'
import { QueueChips } from '../ui/work/QueueChips'
import { SizeChips } from '../ui/work/SizeChips'
import { StoppedQueueCard } from '../ui/work/StoppedQueueCard'
import { useWordsContext } from '../ui/work/useTap'
import { useWorkView } from '../ui/work/view'

const TEN = Array.from({ length: 10 })
const KINDS = [
  { id: 'gather', label: 'Gather, grade 1', seconds: TEN.map(() => farmItemSeconds('gather', 1)) },
  { id: 'craft', label: 'Craft, grade 1', seconds: TEN.map(() => farmItemSeconds('craft', 1)) },
  { id: 'cook', label: 'Cook, grade 1', seconds: TEN.map(() => farmItemSeconds('cook', 1)) },
  { id: 'session', label: 'Session, grade 1', seconds: TEN.map(() => sessionSeconds(1)) },
] as const

const LINK = 'font-display inline-flex min-h-11 items-center rounded-sm border border-hairline-strong bg-panel px-3 text-[14px] font-semibold shadow-1'

function Chips({ label, start, seconds }: { label: string; start: number; seconds: readonly number[] }) {
  const [size, setSize] = useState<number | null>(null)
  return (
    <div data-proof-kind={label} className="space-y-1">
      <h3 className="text-[13px] font-semibold">{label}</h3>
      <SizeChips start={start} itemSeconds={seconds} max={10} value={size} onChange={setSize} />
    </div>
  )
}

export default function CheckInProof() {
  const view = useWorkView()
  const hub = useHub()
  const context = useWordsContext()
  const names = useGame((snapshot) => snapshot.env?.content.umas)
  if (view === null) return null
  const { settled, now, env } = view
  const times = settled.profile.checkIns
  const timing = { times, utcOffsetMin: context.utcOffsetMin }
  const queued = Object.values(settled.work).filter((row) => row.queue.length > 0).sort((a, b) => (a.outfitId < b.outfitId ? -1 : 1))
  const stopped = Object.values(settled.work).flatMap((row) => {
    const queue = row.dropped === null ? null : queueStopped(settled, row.outfitId, now, env, timing)
    return queue === null ? [] : [queue]
  })
  return (
    <div data-g2="check-in-proof" className="absolute inset-0 overflow-y-auto overscroll-contain">
      <div className="space-y-5 px-4 py-3 pb-24">
        <header className="space-y-1">
          <h1 className="text-lg">Check-in proof</h1>
          <p className="text-[13px] text-ink-soft tabular-nums">
            {`Clock ${clockTime(now, context.utcOffsetMin)} · next check-in ${clockTime(nextCheckIn(now, times, context.utcOffsetMin), context.utcOffsetMin)}`}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to="?sheet=check-in" state={{ back: true, collect: (hub?.ready ?? 0) > 0 }} className={LINK}>
              {(hub?.ready ?? 0) > 0 ? `Collect all · ${hub!.ready} ready` : 'Open the check-in'}
            </Link>
            <Link to="?sheet=check-in" state={{ back: true }} className={LINK}>Check-in without collecting</Link>
            <Link to="/town/stable/needs" state={{ back: true }} className={LINK}>Needs of every Uma</Link>
          </div>
        </header>

        <section aria-labelledby="proof-sizes" className="space-y-3">
          <h2 id="proof-sizes" className="text-micro">Size chips from the clock</h2>
          {KINDS.map((kind) => <Chips key={kind.id} label={kind.label} start={now} seconds={kind.seconds} />)}
        </section>

        <section aria-labelledby="proof-queues" className="space-y-3">
          <h2 id="proof-queues" className="text-micro">Queues ({queued.length})</h2>
          {queued.map((row) => (
            <div key={row.outfitId} data-proof-queue={row.outfitId} className="space-y-1">
              <h3 className="text-[13px] font-semibold">{names?.get(row.outfitId)?.name ?? row.outfitId}</h3>
              <QueueChips outfitId={row.outfitId} />
            </div>
          ))}
        </section>

        <section aria-labelledby="proof-stopped" className="space-y-3">
          <h2 id="proof-stopped" className="text-micro">Queue stopped ({stopped.length})</h2>
          {stopped.map((queue) => <StoppedQueueCard key={queue.outfitId} queue={queue} />)}
        </section>
      </div>
    </div>
  )
}
