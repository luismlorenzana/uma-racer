// A place's uma-art building as a CSS sprite at 2× (docs/rework/11-hub-and-places.md §10.1, §11): a 96 × 96 box on the
// pinned atlas, its background twice the atlas's size and positioned from the index, pixels kept crisp. A frame the
// release doesn't draw yet (§10.3) is a plain sunken square. Imported only by lazy chunks, so the atlas never weighs
// on the entry.
import atlasUrl from '@luismlorenzana/uma-art/buildings/atlas.png?url'
import atlas from '@luismlorenzana/uma-art/buildings/atlas.json'

/** Whole-number scale: 48 px frames drawn at 96 pt. */
export const SPRITE_SCALE = 2

const FRAMES: Readonly<Record<string, { readonly x: number; readonly y: number; readonly w: number; readonly h: number }>> = atlas.frames

export function BuildingSprite({ frame, className = '' }: { frame: string | null; className?: string }) {
  const at = frame === null ? undefined : FRAMES[frame]
  if (at === undefined) return <span aria-hidden data-sprite="plain" className={`block size-24 rounded-md border border-hairline bg-sunken ${className}`} />
  return (
    <span
      aria-hidden
      data-sprite={frame}
      className={`block size-24 ${className}`}
      style={{
        backgroundImage: `url(${atlasUrl})`,
        backgroundSize: `${atlas.width * SPRITE_SCALE}px ${atlas.height * SPRITE_SCALE}px`,
        backgroundPosition: `-${at.x * SPRITE_SCALE}px -${at.y * SPRITE_SCALE}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  )
}
