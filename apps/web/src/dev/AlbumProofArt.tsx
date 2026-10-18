// SB6 phone proof, opt-in on /dev/seeds/*?art=synthetic: invented SVG faces and busts through the real racer art port.
// No private packs, owner save, auth, network or production module. Ordinary seeds still use initials.
import { useMemo, type ReactNode } from 'react'
import { G2ContentContext } from '../app/content'
import { useGame } from '../app/game'
import type { ArtKind } from '../content/runtime'
import { devRaceContent } from '../places/racing/content'

function inventedArt(kind: ArtKind, id: string): string {
  const hue = [...id].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7) % 360
  const bust = kind === 'bust'
  const drawing = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="hsl(${hue} 30% 85%)"/><path d="M${bust ? 18 : 6} 128Q20 80 64 ${bust ? 84 : 105}Q108 80 ${bust ? 110 : 122} 128" fill="hsl(${hue} 50% 40%)"/><ellipse cx="64" cy="${bust ? 52 : 65}" rx="${bust ? 28 : 44}" ry="${bust ? 34 : 51}" fill="#f5ceb3"/><path d="M${bust ? 34 : 18} ${bust ? 48 : 62}Q25 0 64 6Q110 0 ${bust ? 94 : 110} ${bust ? 48 : 62}L64 30Z" fill="hsl(${hue} 35% 24%)"/><g fill="#263244"><circle cx="${bust ? 54 : 48}" cy="${bust ? 53 : 68}" r="3"/><circle cx="${bust ? 74 : 80}" cy="${bust ? 53 : 68}" r="3"/></g><path d="M55 ${bust ? 67 : 90}Q64 ${bust ? 75 : 99}73 ${bust ? 67 : 90}" stroke="#ae6970" fill="none" stroke-width="3"/><text x="5" y="122" font-family="sans-serif" font-size="13" fill="white">${bust ? 'BUST' : kind === 'chibi' ? 'PLAZA' : 'FACE'}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(drawing)}`
}

export function AlbumProofArt({ children }: { children: ReactNode }) {
  const env = useGame((snapshot) => snapshot.env)
  const content = useMemo(() => {
    if (env === null) return null
    const content = devRaceContent(env)
    content.art = { has: (kind) => kind === 'face' || kind === 'bust' || kind === 'chibi', load: async (kind, id) => inventedArt(kind, id) }
    return content
  }, [env])
  return <G2ContentContext.Provider value={content}>{children}</G2ContentContext.Provider>
}
