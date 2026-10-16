// The collection reveal (docs/game/11-hub-and-places.md §6; docs/game/03-uma-progression.md §12; T138): full screen
// outside the shell, today's reveal on her portrait: "New Uma", her name and outfit, "T1 · URA Finale · Racing Lv 1 ·
// Farm Lv 1", and the save's state in 02 §9's words. Open profile; with more to show, Next (2 of 5) and Skip all to the
// Owned tab. Reduced motion: no flip.
import { useReducedMotionSetting } from '@luismlorenzana/uma-kit/ui'
import { m } from 'motion/react'
import { Link, useLocation } from 'react-router'
import { useArt } from '../../ui/album/useArt'
import { useG2Content } from '../../app/content'
import { useGame } from '../../app/game'
import { UmaArt } from '../../ui/UmaArt'
import type { FlowProps } from '../registry'
import { profileLine } from '../stable/model'
import { readRevealQueue, revealPath } from './path'
import { saveWords } from './words'

export default function Reveal({ params }: FlowProps) {
  const umaId = params['umaId'] ?? ''
  const location = useLocation()
  const reduced = useReducedMotionSetting()
  const content = useG2Content()
  const portrait = useArt(content, 'uma', umaId)
  const template = useGame((snapshot) => snapshot.env?.content.umas.get(umaId) ?? null)
  const uma = useGame((snapshot) => snapshot.state?.umas[umaId] ?? null)
  const sync = useGame((snapshot) => snapshot.sync)
  const ready = useGame((snapshot) => snapshot.status === 'ready')
  const queue = readRevealQueue(location.search)
  const profile = `/town/stable/outfit/${encodeURIComponent(umaId)}`
  const button = 'font-display flex min-h-12 w-full items-center justify-center rounded-sm px-5 text-lg font-semibold shadow-2'

  if (ready && (uma === null || template === null)) {
    return (
      <main className="pt-safe pb-safe flex h-dvh flex-col items-center justify-center gap-4 bg-stage px-6 text-center text-ink-on-dark" data-g2="reveal">
        <p className="text-lg">That Uma isn't in your Stable.</p>
        <Link to="/town/stable" replace className={`${button} bg-accent text-ink`}>Open the Stable</Link>
      </main>
    )
  }
  return (
    <main className="pt-safe pb-safe relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-stage px-6 text-center text-ink-on-dark" data-g2="reveal">
      <m.div aria-hidden className="absolute size-72 rounded-full bg-accent/25 blur-3xl" initial={reduced ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.65 }} />
      <m.div
        key={umaId}
        data-flip={reduced ? undefined : ''}
        className="relative w-full max-w-sm"
        style={{ transformStyle: 'preserve-3d' }}
        initial={reduced ? false : { y: 40, opacity: 0, scale: 0.88, rotateY: 82 }}
        animate={{ y: 0, opacity: 1, scale: 1, rotateY: 0 }}
        transition={{ type: 'spring', stiffness: 150, damping: 18 }}
      >
        <p className="font-display text-[12px] font-semibold tracking-[0.28em] text-accent uppercase">New Uma</p>
        <div className="mx-auto mt-5 w-56 rounded-lg border-2 border-accent bg-stage-soft p-2 shadow-3">
          <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-b from-stage-soft to-stage">
            {portrait !== null
              ? <img src={portrait} alt={template?.name ?? ''} draggable={false} className="absolute inset-0 size-full object-contain object-top" />
              : <UmaArt outfitId={umaId} size={160} />}
          </div>
        </div>
        <h1 className="font-display mt-5 text-3xl font-bold">{template?.name}</h1>
        <p className="mt-1 text-ink-on-dark-soft">{template?.outfit ?? 'Standard outfit'}</p>
        {uma !== null && <p className="mt-2 text-[15px] font-semibold" data-g2="reveal-line">{profileLine(uma)}</p>}
        <p className="mt-3 text-[13px] text-ink-on-dark-soft">{saveWords(sync)}</p>
        <div className="mt-7 grid gap-2">
          {queue.then.length > 0 && (
            <Link to={revealPath(queue.then, queue.of)} replace className={`${button} bg-accent text-ink`}>
              Next ({queue.at + 1} of {queue.of})
            </Link>
          )}
          <Link to={profile} replace className={`${button} ${queue.then.length > 0 ? 'border border-hairline-dark bg-stage-soft text-ink-on-dark' : 'bg-accent text-ink'}`}>
            Open profile
          </Link>
          {queue.then.length > 0 && (
            <Link to="/town/stable?tab=owned" replace className={`${button} text-ink-on-dark-soft shadow-none`}>Skip all</Link>
          )}
        </div>
      </m.div>
    </main>
  )
}
