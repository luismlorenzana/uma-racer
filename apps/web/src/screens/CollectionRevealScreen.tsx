import { badgeStateId } from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { Link, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { resolveCollectionReveal } from '../game/collection-view'
import { buildUmaFlairSummary } from '../game/flair-view'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { Placeholder } from '../ui/Placeholder'
import { ScreenState } from '../ui/ScreenState'
import { useArt } from '../ui/album/useArt'

export function CollectionRevealScreen() {
  const { kind, id } = useParams()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const cards = useGame((state) => state.cards)
  const umas = useGame((state) => state.umas)
  const badges = useGame((state) => state.badges)
  const flairEvents = useGame((state) => state.flairEvents)
  const persistent = useGame((state) => state.persistent)
  const sync = useGame((state) => state.sync)
  const reducedMotion = useReducedMotion()
  // The reveal shows the large art — the card's illustration, the Uma's portrait — over the icon it replaces.
  const art = useArt(contentState.status === 'ready' ? contentState.content : null, kind === 'card' ? 'card' : 'uma', id ?? null)
  if (contentState.status !== 'ready' || status !== 'ready') return <ScreenState title="Opening your new collection item…" detail="Loading the committed local save." />
  const reveal = resolveCollectionReveal(contentState.content, cards, umas, kind, id)
  if (!reveal) return <ScreenState title="Collection item unavailable" detail="This result link is invalid, unowned, or missing private content." action={{ label: 'Open Stable', to: '/stable' }} />
  const isCard = reveal.kind === 'card'
  const identity = isCard ? reveal.template.charName : reveal.template.name
  const subtitle = isCard ? reveal.template.title || 'SSR Support Card' : reveal.template.outfit ?? 'Standard outfit'
  const target = isCard ? `/cards/${encodeURIComponent(reveal.id)}` : `/stable/${encodeURIComponent(reveal.id)}`
  const badge = !isCard ? badges[badgeStateId(reveal.id)] : null
  const frame = badge?.scope === 'uma' ? buildUmaFlairSummary(contentState.content, badge, flairEvents).frame : null
  const persistenceLabel = !persistent ? 'Memory only · this item will not survive reload'
    : sync.status === 'offline' ? 'Saved locally · offline sync will retry'
      : sync.status === 'pending' || sync.status === 'syncing' ? 'Saved locally · cloud sync pending' : 'Saved locally · synced'
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-stage px-6 pt-safe pb-safe text-center text-ink-on-dark">
      <m.div aria-hidden className="absolute h-72 w-72 rounded-full bg-accent/25 blur-3xl" initial={reducedMotion ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.65 }} />
      <m.div className="relative w-full max-w-sm" style={{ transformStyle: 'preserve-3d' }} initial={reducedMotion ? false : { y: 40, opacity: 0, scale: 0.88, rotateY: 82 }} animate={{ y: 0, opacity: 1, scale: 1, rotateY: 0 }} transition={{ type: 'spring', stiffness: 150, damping: 18 }}>
        <p className="font-display text-[12px] font-semibold tracking-[0.28em] text-accent uppercase">New {isCard ? 'support card' : 'Uma'}</p>
        <div className={`mx-auto mt-5 w-56 rounded-lg border-2 bg-stage-soft p-2 shadow-3 ${frame?.borderClass ?? 'border-accent'}`}>
          <div className={`relative w-full overflow-hidden rounded-md ${isCard ? 'aspect-[3/4] bg-stage' : 'aspect-square bg-gradient-to-b from-stage-soft to-stage'}`}>
            <AtlasSprite
              asset={reveal.asset}
              alt={art ? undefined : identity}
              decorative={Boolean(art)}
              className="absolute inset-x-0 top-1/2 w-full -translate-y-1/2"
              fallback={<Placeholder label={identity} />}
            />
            {art && (
              <m.img
                key={art}
                src={art}
                alt={identity}
                draggable={false}
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className={`absolute inset-0 h-full w-full ${isCard ? 'object-cover' : 'object-contain object-top'}`}
              />
            )}
          </div>
        </div>
        <h1 className="font-display mt-5 text-3xl font-bold">{identity}</h1>
        <p className="mt-1 text-ink-on-dark-soft">{subtitle}</p>
        {frame && <p className="mt-1 text-sm font-semibold text-accent">{frame.label} Prestige frame</p>}
        <p className="mt-3 text-[12px] text-ink-on-dark-soft">{persistenceLabel}</p>
        <Link to={target} replace className="font-display mt-7 flex min-h-12 w-full items-center justify-center rounded-sm bg-accent px-5 text-lg font-semibold text-ink shadow-2">{isCard ? 'Open card' : 'Open profile'}</Link>
      </m.div>
    </main>
  )
}
