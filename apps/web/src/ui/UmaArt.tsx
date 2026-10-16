// An Uma as still art (docs/game/11-hub-and-places.md §4, §5): `UmaFace` for a pip (her `face`, then her outfit icon,
// then her initial) and `UmaArt` for the plaza (her `chibi` `-a`, then her bust, then her icon, then her initial). The
// chibi's animation waits for phase 5's `outfit-chibis` release (11 §5). Without content (the seeds' mount) both are her
// initial; with it, the art loads in its own chunk, only for Umas on screen.
import { lazy, Suspense } from 'react'
import { useG2Content } from '../app/content'
import { initialOf, useUmaName } from './uma'

const ContentArt = lazy(() => import('./ContentArt'))

function Initial({ name, size, className = '' }: { name: string; size: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`font-display flex items-center justify-center rounded-full bg-sunken font-bold text-ink-soft ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }}
    >
      {initialOf(name)}
    </span>
  )
}

function Art({ outfitId, size, kinds, className }: { outfitId: string; size: number; kinds: readonly ('face' | 'chibi' | 'bust')[]; className?: string }) {
  const content = useG2Content()
  const name = useUmaName(outfitId)
  const initial = <Initial name={name} size={size} className={className} />
  if (content === null) return initial
  return (
    <Suspense fallback={initial}>
      <ContentArt content={content} outfitId={outfitId} kinds={kinds} size={size} fallback={initial} className={className} />
    </Suspense>
  )
}

/** Her face for a pip: decorative, the tile's label names her work. */
export function UmaFace({ outfitId, size }: { outfitId: string; size: number }) {
  return <Art outfitId={outfitId} size={size} kinds={['face']} className="rounded-full" />
}

/** Her still art for the plaza. */
export function UmaArt({ outfitId, size }: { outfitId: string; size: number }) {
  return <Art outfitId={outfitId} size={size} kinds={['chibi', 'bust']} />
}
