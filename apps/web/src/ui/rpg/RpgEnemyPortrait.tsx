// Exact-pack private opponent art; a missing image is labelled, never a replacement enemy (T097).
import { useEffect, useState } from 'react'
import type { RpgPackIdentity } from '@racer/domain'
import { rpgContentLibrary } from '../../content/rpg'
import type { LoadedContent } from '../../content/runtime'
import { useArt } from '../album/useArt'

export function useRpgPresentation(content: LoadedContent | null, identity?: RpgPackIdentity | null) {
  const [view, setView] = useState<{ hash?: string; names: Record<string, string>; portraits: Record<string, string>; unavailable: boolean }>({ names: {}, portraits: {}, unavailable: false })
  const version = identity?.contentVersion, hash = identity?.contentHash
  useEffect(() => {
    let cancelled = false
    setView({ hash, names: {}, portraits: {}, unavailable: false })
    if (content && version && hash) void rpgContentLibrary(content).presentation({ contentVersion: version, contentHash: hash })
      .then(v => { if (!cancelled) setView({ hash, ...v, unavailable: false }) })
      .catch(() => { if (!cancelled) setView({ hash, names: {}, portraits: {}, unavailable: true }) })
    return () => { cancelled = true }
  }, [content, version, hash])
  return view.hash === hash ? view : { names: {}, portraits: {}, unavailable: false }
}

interface EnemyPortraitProps {
  content: LoadedContent | null; artId?: string; name: string; className?: string
}
export function RpgEnemyPortrait(props: EnemyPortraitProps) {
  // Changing a pack's image identity remounts its loader; never flash the previous version's Blob URL.
  return <EnemyPortraitImage key={props.artId ?? 'missing'} {...props} />
}
function EnemyPortraitImage({ content, artId, name, className = '' }: EnemyPortraitProps) {
  const url = useArt(content, 'priconne', artId ?? null)
  return <span className={`relative block overflow-hidden rounded-sm bg-white/5 ${className}`}>
    {url ? <img src={url} alt={`${name} portrait`} className="h-full w-full object-cover" />
      : <span aria-label={`${name} portrait unavailable`} className="flex h-full items-center justify-center px-0.5 text-center text-[8px] leading-3 text-ink-on-dark-soft">No art</span>}
  </span>
}
