// An item's icon (docs/rework/11-hub-and-places.md §10.3, §11; docs/rework/08-item-catalogue-and-recipes.md §9, §10;
// T140): the catalogue's `art` frame from uma-art's `items` or `dishes` atlas, a CSS sprite at a whole-number scale with
// its pixels kept crisp, named for VoiceOver ("Carrot Salad, grade 1"). The Speed Ticket has no frame in the pinned
// release (08 §9), so until one ships it is its name on a plain tile. Imported only by lazy chunks, so neither atlas
// weighs on the entry.
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

/** The frame a definition is drawn with, or null: the catalogue's own, else the release's `speed-ticket` once it ships. */
export function itemFrame(def: ItemDef | undefined): { readonly atlas: keyof typeof ATLASES; readonly x: number; readonly y: number } | null {
  if (def === undefined) return null
  const art = def.art ?? (def.kind === 'ticket' && ATLASES.items.frames[def.id] !== undefined ? { atlas: 'items' as const, frame: def.id } : null)
  const at = art === null ? undefined : ATLASES[art.atlas].frames[art.frame]
  return art === null || at === undefined ? null : { atlas: art.atlas, x: at.x, y: at.y }
}

/** "Carrot Salad, grade 1"; the Speed Ticket, which has no grade, by its name. */
export function itemLabel(def: ItemDef | undefined, id: string): string {
  if (def === undefined) return id
  return def.kind === 'ticket' ? def.name : `${def.name}, grade ${def.grade}`
}

export function ItemIcon({ item, scale = 1, decorative = false, className = '' }: {
  item: string
  /** Whole-number scales only: 1 draws 32 pt, 2 draws 64 pt. */
  scale?: 1 | 2
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
