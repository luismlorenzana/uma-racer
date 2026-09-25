import { m, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { getContentAsset, type LoadedContent } from '../../content/runtime'
import type { BondRecallState } from '../../game/minigames/bond-recall'
import { AtlasSprite } from '../../ui/AtlasSprite'

/** Tiles keep the illustration's own 3:4 shape, so a face is the whole card and never a crop. */
const TILE_ASPECT = 3 / 4
const TILE_GAP = 6
const BOARD_PAD = 8
/** The full art tells cards apart at a glance, so tiles stay small even when the board has room. */
const TILE_MAX_WIDTH = 88

const ACCENT = 'var(--color-accent)'
const DANGER = 'var(--color-danger)'
const OUTLINE = '#05080c'
const alpha = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`

/**
 * The largest tile that fits the space the board is given. The board is centred inside a measured area whose size
 * never depends on the board, so the grid cannot squash its rows or push the screen past its height.
 */
function useTileSize(area: RefObject<HTMLDivElement | null>, columns: number, rows: number) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const element = area.current
    if (!element) return
    const measure = () => {
      const width = element.clientWidth - BOARD_PAD * 2
      const height = element.clientHeight - BOARD_PAD * 2
      const byWidth = (width - (columns - 1) * TILE_GAP) / columns
      const byHeight = ((height - (rows - 1) * TILE_GAP) / rows) * TILE_ASPECT
      const tile = Math.floor(Math.max(0, Math.min(TILE_MAX_WIDTH, byWidth, byHeight)))
      setSize({ width: tile, height: Math.floor(tile / TILE_ASPECT) })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [area, columns, rows])
  return size
}

/** A card's face: its full illustration, or its icon and name on a stage where no illustration is published. */
export function CardArt({ content, cardId, art }: { content: LoadedContent; cardId: string; art: string | null }) {
  if (art) return <img src={art} alt="" aria-hidden draggable={false} className="h-full w-full object-cover" />
  const template = content.cards.byId.get(cardId)
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-stage-soft to-stage p-1">
      <AtlasSprite
        asset={getContentAsset(content, 'card-icons', cardId)}
        decorative
        className="w-4/5 rounded-[18%]"
        fallback={<span className="font-display text-lg font-black text-accent">{template?.charName.slice(0, 1) ?? '✦'}</span>}
      />
      <span className="w-full truncate text-center text-[9px] leading-tight font-semibold text-ink-on-dark">{template?.charName}</span>
    </span>
  )
}

export function BondBoard({
  content,
  run,
  art,
  interactive,
  onChoose,
}: {
  content: LoadedContent
  run: BondRecallState
  art: ReadonlyMap<string, string>
  interactive: boolean
  onChoose: (index: number) => void
}) {
  const reducedMotion = useReducedMotion()
  const areaRef = useRef<HTMLDivElement>(null)
  const { columns, rows } = run.config
  const tile = useTileSize(areaRef, columns, rows)
  // Two cards face up that are not a pair: shown red until they turn back.
  const missed = run.revealed.length === 2 && (run.status === 'resolving' || run.status === 'lost')
  const radius = tile ? Math.max(6, Math.round(tile.width * 0.09)) : 8

  return (
    <div ref={areaRef} className="relative min-h-0 w-full flex-1">
      {tile && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            aria-label="Bond Recall board"
            className="grid rounded-2xl"
            style={{
              gridTemplateColumns: `repeat(${columns}, ${tile.width}px)`,
              gridAutoRows: `${tile.height}px`,
              gap: TILE_GAP,
              padding: BOARD_PAD,
              background: 'radial-gradient(120% 90% at 50% 20%, #182636 0%, #0e1721 60%, #0a1118 100%)',
              boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.07), inset 0 10px 24px rgb(0 0 0 / 0.45), 0 10px 24px -10px rgb(0 0 0 / 0.6)',
            }}
          >
            {run.tiles.map((entry, index) => {
              const matched = run.matched.includes(index)
              const revealed = run.revealed.includes(index)
              const faceUp = revealed || matched
              const wrong = missed && revealed
              const name = content.cards.byId.get(entry.cardId)?.charName ?? 'Card'
              const ring = matched
                ? `0 0 0 2px ${ACCENT}, 0 0 12px ${alpha(ACCENT, 60)}`
                : wrong
                  ? `0 0 0 2px ${DANGER}, 0 0 12px ${alpha(DANGER, 60)}`
                  : revealed
                    ? `0 0 0 2px ${ACCENT}`
                    : `0 0 0 1px ${OUTLINE}`
              const face: CSSProperties = {
                borderRadius: radius,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }
              return (
                <m.button
                  key={entry.id}
                  type="button"
                  disabled={!interactive || faceUp}
                  onClick={() => onChoose(index)}
                  aria-label={`${faceUp ? name : 'Hidden card'}, row ${Math.floor(index / columns) + 1}, column ${(index % columns) + 1}${matched ? ', matched' : ''}`}
                  className="relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default"
                  style={{ borderRadius: radius, perspective: 700 }}
                  whileTap={reducedMotion || faceUp ? undefined : { scale: 0.94 }}
                >
                  {/* Never fade this element: opacity below 1 flattens preserve-3d, and a flattened flip shows only the back. */}
                  <m.span
                    className="absolute inset-0 block"
                    style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d', borderRadius: radius }}
                    animate={{ rotateY: faceUp ? 180 : 0, scale: matched ? 0.95 : 1 }}
                    transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.2, 0, 0, 1] }}
                  >
                    <span
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        ...face,
                        background: [
                          'repeating-linear-gradient(45deg, rgb(211 154 43 / 0.07) 0 1.5px, transparent 1.5px 9px)',
                          'repeating-linear-gradient(-45deg, rgb(211 154 43 / 0.07) 0 1.5px, transparent 1.5px 9px)',
                          'linear-gradient(160deg, #213247, #121c27)',
                        ].join(', '),
                        boxShadow: `inset 0 0 0 3px #0d1620, inset 0 0 0 4px ${alpha(ACCENT, 55)}, 0 0 0 1px ${OUTLINE}, 0 3px 6px rgb(0 0 0 / 0.45)`,
                      }}
                    >
                      <span
                        className="font-display flex items-center justify-center rounded-full font-black text-accent"
                        style={{
                          width: tile.width * 0.44,
                          height: tile.width * 0.44,
                          fontSize: tile.width * 0.26,
                          background: 'radial-gradient(circle, #2a3a50, #152130)',
                          boxShadow: `0 0 0 1px ${alpha(ACCENT, 50)}`,
                        }}
                      >
                        ✦
                      </span>
                    </span>
                    <span
                      className="absolute inset-0 overflow-hidden bg-stage"
                      style={{ ...face, transform: 'rotateY(180deg)', boxShadow: `${ring}, 0 3px 6px rgb(0 0 0 / 0.45)` }}
                    >
                      <CardArt content={content} cardId={entry.cardId} art={art.get(entry.cardId) ?? null} />
                      {matched && (
                        <span aria-hidden className="absolute right-1 bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-ink shadow-1">
                          ✓
                        </span>
                      )}
                    </span>
                  </m.span>
                </m.button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
