import { m, useReducedMotion } from 'motion/react'
import { Link, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { resolveCollectionReveal } from '../game/collection-view'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { ScreenState } from '../ui/ScreenState'

export function CollectionRevealScreen() {
  const { kind, id } = useParams()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const cards = useGame((state) => state.cards)
  const umas = useGame((state) => state.umas)
  const persistent = useGame((state) => state.persistent)
  const sync = useGame((state) => state.sync)
  const reducedMotion = useReducedMotion()
  if (contentState.status !== 'ready' || status !== 'ready') return <ScreenState title="Opening your new collection item…" detail="Loading the committed local save." />
  const reveal = resolveCollectionReveal(contentState.content, cards, umas, kind, id)
  if (!reveal) return <ScreenState title="Collection item unavailable" detail="This result link is invalid, unowned, or missing private content." action={{ label: 'Open Stable', to: '/stable' }} />
  const isCard = reveal.kind === 'card'
  const identity = isCard ? reveal.template.charName : reveal.template.name
  const subtitle = isCard ? reveal.template.title || 'SSR Support Card' : reveal.template.outfit ?? 'Standard outfit'
  const target = isCard ? `/cards?card=${encodeURIComponent(reveal.id)}` : `/scenario/${encodeURIComponent(reveal.id)}/start`
  const persistenceLabel = !persistent ? 'Memory only · this item will not survive reload'
    : sync.status === 'offline' ? 'Saved locally · offline sync will retry'
      : sync.status === 'pending' || sync.status === 'syncing' ? 'Saved locally · cloud sync pending' : 'Saved locally · synced'
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-violet-950 via-sky-900 to-sky-200 px-6 pt-safe pb-safe text-center">
      <m.div aria-hidden className="absolute h-72 w-72 rounded-full bg-gold/30 blur-3xl" initial={reducedMotion ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.65 }} />
      <m.div className="relative w-full max-w-sm" style={{ transformStyle: 'preserve-3d' }} initial={reducedMotion ? false : { y: 40, opacity: 0, scale: 0.88, rotateY: 82 }} animate={{ y: 0, opacity: 1, scale: 1, rotateY: 0 }} transition={{ type: 'spring', stiffness: 150, damping: 18 }}>
        <p className="text-sm font-extrabold tracking-[0.28em] text-gold uppercase">New {isCard ? 'SSR' : 'Uma'}</p>
        <div className="mx-auto mt-5 w-56 rounded-[2rem] border-4 border-white/80 bg-white/20 p-3 shadow-2xl backdrop-blur-sm">
          <AtlasSprite asset={reveal.asset} alt={identity} className="w-full rounded-[1.4rem] bg-white/20" fallback={<div className="flex h-full items-center justify-center text-7xl">{isCard ? '🃏' : '🐴'}</div>} />
        </div>
        <h1 className="mt-5 text-3xl font-black text-white text-outline">{identity}</h1>
        <p className="mt-1 font-extrabold text-white/85">{subtitle}</p>
        <p className="mt-3 text-sm font-bold text-white/75">{persistenceLabel}</p>
        <Link to={target} replace className="mt-7 flex min-h-12 w-full items-center justify-center rounded-2xl bg-gold px-5 text-lg font-black text-white text-outline shadow-lg">{isCard ? 'Open Card Detail' : 'Choose Lineage'}</Link>
      </m.div>
    </main>
  )
}
