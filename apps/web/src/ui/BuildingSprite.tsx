// A place's uma-art building in the DOM (docs/game/11-hub-and-places.md §10.1, §10.3): a 96 × 96 box on the pinned atlas,
// its background twice the atlas's size and positioned from the index, pixels kept crisp. A frame the pinned release
// doesn't draw yet (§10.3's four new drawings) is the map's code placeholder (`hub/scene/markers.ts`) as SVG in its
// page's palette, never an empty box. Imported only by lazy chunks, so the atlas never weighs on the entry.
import atlasUrl from '@luismlorenzana/uma-art/buildings/atlas.png?url'
import atlas from '@luismlorenzana/uma-art/buildings/atlas.json'
import type { HubPage } from '@racer/domain/hub'
import { useMemo } from 'react'
import { drawMarker, MARKER_BASE, svgPen } from '../hub/scene/markers'
import { PALETTES } from '../hub/scene/palettes'

/** Whole-number scale: 48 px frames drawn at 96 pt. */
export const SPRITE_SCALE = 2

const FRAMES: Readonly<Record<string, { readonly x: number; readonly y: number; readonly w: number; readonly h: number }>> = atlas.frames

/** A marker's box on the map: a 48 px frame at 1.5 CSS px per art pixel, its ground line at 44. */
const BOX = 72
const GROUND = 66

function Placeholder({ frame, page, className }: { frame: string; page: HubPage; className: string }) {
  const shapes = useMemo(() => {
    const pen = svgPen()
    drawMarker(pen, frame, BOX / 2, GROUND - MARKER_BASE, PALETTES[page])
    return pen.shapes
  }, [frame, page])
  return (
    <svg aria-hidden data-sprite="placeholder" data-frame={frame} viewBox={`0 0 ${BOX} ${BOX}`} className={`block size-24 overflow-visible ${className}`}>
      {shapes.map((shape, i) => shape.kind === 'rect'
        ? <rect key={i} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} fill={shape.fill} fillOpacity={shape.opacity} />
        : shape.kind === 'ellipse'
          ? <ellipse key={i} cx={shape.x} cy={shape.y} rx={shape.rx} ry={shape.ry} fill={shape.fill} fillOpacity={shape.opacity} />
          : <polygon key={i} points={shape.points} fill={shape.fill} fillOpacity={shape.opacity} />)}
    </svg>
  )
}

export function BuildingSprite({ frame, page, className = '' }: { frame: string | null; page: HubPage; className?: string }) {
  const at = frame === null ? undefined : FRAMES[frame]
  if (at === undefined) return <Placeholder frame={frame ?? ''} page={page} className={className} />
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
