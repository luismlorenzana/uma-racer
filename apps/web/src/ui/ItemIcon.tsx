// An item's icon (docs/game/11-hub-and-places.md §10.3, §11; docs/game/08-item-catalogue-and-recipes.md §9, §10;
// T140, D366): the catalogue's `art` frame from uma-art's `items` or `dishes` atlas, a CSS sprite with its pixels kept
// crisp, named for VoiceOver ("Warm-Up Tonic, grade 1"). 32 pt is the cell; the compact Farm and Training rows also draw
// it at 16 and 24 pt in chips and badges. The Speed Ticket is the `items` atlas's `speed-ticket` frame (uma-art 2.7.0),
// and every tonic (D375, A04) its own id's frame there (uma-art 2.10.0). An item a release lacks is its name on a plain
// tile. Imported only by lazy chunks, so neither atlas weighs on the entry.
import { itemById, type ItemDef } from '@racer/domain/items'
import dishesUrl from '@luismlorenzana/uma-art/dishes/atlas.png?url'
import dishes from '@luismlorenzana/uma-art/dishes/atlas.json'
import itemsUrl from '@luismlorenzana/uma-art/items/atlas.png?url'
import items from '@luismlorenzana/uma-art/items/atlas.json'

/** uma-art's item and dish cells are 32 px. */
export const ITEM_CELL = 32

type Frames = Readonly<Record<string, { readonly x: number; readonly y: number }>>

const ATLASES = {
  items: { url: itemsUrl, width: items.width, height: items.height, frames: items.frames as Frames },
  dishes: { url: dishesUrl, width: dishes.width, height: dishes.height, frames: dishes.frames as Frames },
} as const

/**
 * The frame a definition is drawn with, or null: the catalogue's own, else the `items` atlas's frame of its id (the Speed
 * Ticket, a tonic) once a release ships it.
 */
export function itemFrame(def: ItemDef | undefined): { readonly atlas: keyof typeof ATLASES; readonly x: number; readonly y: number } | null {
  if (def === undefined) return null
  const byId = (def.kind === 'ticket' || def.kind === 'tonic') && ATLASES.items.frames[def.id] !== undefined
  const art = def.art ?? (byId ? { atlas: 'items' as const, frame: def.id } : null)
  const at = art === null ? undefined : ATLASES[art.atlas].frames[art.frame]
  return art === null || at === undefined ? null : { atlas: art.atlas, x: at.x, y: at.y }
}

/** "Warm-Up Tonic, grade 1"; the Speed Ticket, which has no grade, by its name. */
export function itemLabel(def: ItemDef | undefined, id: string): string {
  if (def === undefined) return id
  return def.kind === 'ticket' ? def.name : `${def.name}, grade ${def.grade}`
}

/** The scale that draws an icon at `size` points, for frames that ask by size (uma-kit's shelves: 32 and 64). */
export const itemIconScale = (size: number): 0.5 | 0.75 | 1 | 2 => (size >= 64 ? 2 : size >= 32 ? 1 : size >= 24 ? 0.75 : 0.5)

export function ItemIcon({ item, scale = 1, decorative = false, className = '' }: {
  item: string
  /** 1 draws 32 pt and 2 draws 64 pt; 0.5 and 0.75 draw a chip's 16 pt and a badge's 24 pt (D366). */
  scale?: 0.5 | 0.75 | 1 | 2
  /** True beside a visible name, so VoiceOver doesn't read it twice. */
  decorative?: boolean
  className?: string
}) {
  const def = itemById(item)
  const size = ITEM_CELL * scale
  const frame = itemFrame(def)
  const label = decorative ? undefined : itemLabel(def, item)
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label }
  if (frame === null) {
    return (
      <span
        {...a11y}
        data-item-icon={item}
        data-sprite="plain"
        className={`inline-flex shrink-0 items-center justify-center rounded-xs border border-hairline bg-sunken text-center text-[9px] leading-tight font-semibold text-ink-soft ${className}`}
        style={{ width: size, height: size }}
      >
        <span aria-hidden className="px-0.5">{def?.name ?? item}</span>
      </span>
    )
  }
  const atlas = ATLASES[frame.atlas]
  return (
    <span
      {...a11y}
      data-item-icon={item}
      data-sprite={frame.atlas}
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${atlas.url})`,
        backgroundSize: `${atlas.width * scale}px ${atlas.height * scale}px`,
        backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  )
}
