import {
  LINEAGE_BAND,
  TREE_BOX,
  constellationEdges,
  isNodeUnlocked,
  nodeUnlockLevel,
  type ConstellationNode,
  type ConstellationTemplate,
  type NodeAssignment,
} from '@racer/domain'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { getContentAsset, type LoadedContent } from '../../content/runtime'
import { AtlasSprite } from '../AtlasSprite'
import { UmaBust } from '../UmaBust'

/**
 * The canvas fills the host at scale 1, so the 100×100 unit layout stretches to the screen's aspect. On a portrait
 * phone that spreads the tree down the long axis instead of wasting it. Tiles are sized from the tightest spacing
 * between two nodes, so a sparse tree gets thumb-sized tiles and a dense one still never overlaps.
 */
const NODE_FILL = 0.72
const NODE_MIN = 26
const NODE_MAX = 44
const MIN_SCALE = 0.5
const MAX_SCALE = 2.5

const STAT_TONE: Record<string, string> = {
  speed: 'var(--color-stat-speed)',
  stamina: 'var(--color-stat-stamina)',
  power: 'var(--color-stat-power)',
  guts: 'var(--color-stat-guts)',
  wit: 'var(--color-stat-wit)',
}
const STAT_LABEL: Record<string, string> = { speed: 'SPE', stamina: 'STA', power: 'POW', guts: 'GUT', wit: 'WIT' }
const ACCENT = 'var(--color-accent)'
/** Lineage reads apart from the card paths: silver, like an heirloom, against their gold. */
const LINEAGE = 'var(--color-tier-silver)'
const SOCKET = '#0a1118'
const OUTLINE = '#05080c'

const alpha = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`

type EdgeState = 'locked' | 'open' | 'lit'

export function ConstellationGraph({
  template,
  trainingLevel,
  assignments,
  content,
  cardTypes,
  selectedId,
  onSelect,
}: {
  template: ConstellationTemplate
  trainingLevel: number
  assignments: Readonly<Record<string, NodeAssignment>>
  content: LoadedContent
  /** Card id → its type, for the tile and path colour. */
  cardTypes: Readonly<Record<string, string>>
  selectedId: string | null
  onSelect: (node: ConstellationNode) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ distance: number; scale: number; x: number; y: number } | null>(null)
  const dragged = useRef(false)

  /** The canvas already fills the host, so fitting is simply the identity view. */
  const fit = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), [])

  // Measure and refit on mount, on a tier change, and whenever the host resizes — a rotation or a pane resize would
  // otherwise leave the tree drawn for the old box.
  useEffect(() => {
    fit()
    const host = hostRef.current
    if (!host) return
    const measure = () => setBox({ width: host.clientWidth, height: host.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      measure()
      fit()
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [fit, template.tier])

  useEffect(() => {
    if (!box || !selectedId) return
    const node = template.nodes.find((candidate) => candidate.id === selectedId)
    if (!node) return
    const scale = 1.35
    setView({
      scale,
      x: box.width / 2 - (node.x / 100) * box.width * scale,
      y: box.height / 2 - (node.y / 100) * box.height * scale,
    })
  }, [box, selectedId, template])

  const onPointerDown = (event: React.PointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    dragged.current = false
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        distance: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        scale: view.scale,
        x: view.x,
        y: view.y,
      }
    }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const next = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, next)

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      const ratio = distance / (gesture.current.distance || 1)
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, gesture.current.scale * ratio))
      // Keep the midpoint between the fingers fixed while the scale changes.
      const host = hostRef.current?.getBoundingClientRect()
      const midX = (a!.x + b!.x) / 2 - (host?.left ?? 0)
      const midY = (a!.y + b!.y) / 2 - (host?.top ?? 0)
      const k = scale / gesture.current.scale
      setView({
        scale,
        x: midX - (midX - gesture.current.x) * k,
        y: midY - (midY - gesture.current.y) * k,
      })
      dragged.current = true
      return
    }

    if (pointers.current.size === 1) {
      const dx = next.x - previous.x
      const dy = next.y - previous.y
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragged.current = true
      setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }))
    }
  }

  const onPointerUp = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) gesture.current = null
  }

  const edges = useMemo(() => constellationEdges(template), [template])
  const size = useMemo(() => {
    if (!box) return NODE_MIN
    let gap = Infinity
    const nodes = template.nodes
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const dx = ((nodes[i]!.x - nodes[j]!.x) / 100) * box.width
        const dy = ((nodes[i]!.y - nodes[j]!.y) / 100) * box.height
        gap = Math.min(gap, Math.hypot(dx, dy))
      }
    }
    return Math.round(Math.min(NODE_MAX, Math.max(NODE_MIN, gap * NODE_FILL)))
  }, [box, template])

  const unlocked = (node: ConstellationNode) => isNodeUnlocked(template, node, trainingLevel)
  const filled = (node: ConstellationNode) => node.kind === 'root' || (unlocked(node) && assignments[node.id] !== undefined)
  const toneOf = (assignment: NodeAssignment | undefined): string | null =>
    assignment?.kind === 'card'
      ? STAT_TONE[cardTypes[assignment.cardId] ?? ''] ?? ACCENT
      : assignment?.kind === 'stat'
        ? STAT_TONE[assignment.stat] ?? ACCENT
        : assignment?.kind === 'lineage'
          ? LINEAGE
          : null

  /**
   * A path lights up gold where both ends are filled, and in the card's own colour where both hold the same card, so a
   * stacked card reads as one stroke of the constellation. Paths into locked nodes stay dark.
   */
  const edgeLook = (from: ConstellationNode, to: ConstellationNode): { state: EdgeState; tone: string } => {
    if (!unlocked(from) || !unlocked(to)) return { state: 'locked', tone: OUTLINE }
    if (!filled(from) || !filled(to)) return { state: 'open', tone: '#4b5e72' }
    const a = assignments[from.id]
    const b = assignments[to.id]
    if (a?.kind === 'card' && b?.kind === 'card' && a.cardId === b.cardId) return { state: 'lit', tone: toneOf(a)! }
    return { state: 'lit', tone: to.kind === 'grandparent' ? LINEAGE : ACCENT }
  }

  const px = (node: ConstellationNode) => ({ x: (node.x / 100) * (box?.width ?? 0), y: (node.y / 100) * (box?.height ?? 0) })
  const nextLevel = trainingLevel + 1
  const crest = getContentAsset(content, 'scenario-icons', template.scenarioId)
  const root = template.nodes.find((node) => node.kind === 'root')
  const lineageDividerY = (TREE_BOX.maxY + LINEAGE_BAND.parentY) / 2
  const fitted = view.scale === 1 && view.x === 0 && view.y === 0

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[1.25rem]"
      style={{
        background: 'radial-gradient(120% 75% at 50% 30%, #182636 0%, var(--color-stage) 55%, #0a1118 100%)',
        boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.07), inset 0 14px 32px rgb(0 0 0 / 0.45), var(--shadow-2)',
      }}
    >
      <div
        ref={hostRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {box && (
          <div
            className="absolute origin-top-left will-change-transform"
            style={{
              width: box.width,
              height: box.height,
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
            }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-x-5 flex items-center gap-2"
              style={{ top: `${lineageDividerY}%`, transform: 'translateY(-50%)' }}
            >
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-on-dark-soft/70">Lineage</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <svg className="absolute inset-0" width={box.width} height={box.height} aria-hidden="true">
              {edges.map(({ from, to }) => {
                const { state, tone } = edgeLook(from, to)
                const a = px(from)
                const b = px(to)
                const line = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, strokeLinecap: 'round' as const }
                // A locked path is one recessed groove; open and lit paths are a coloured core in a dark outline, and a
                // lit one also glows.
                if (state === 'locked') return <line key={`${from.id}-${to.id}`} {...line} stroke={OUTLINE} strokeWidth={5} />
                const core = state === 'lit' ? 4 : 3
                return (
                  <g key={`${from.id}-${to.id}`}>
                    {state === 'lit' && <line {...line} strokeWidth={core + 8} style={{ stroke: alpha(tone, 30) }} />}
                    <line {...line} stroke={OUTLINE} strokeWidth={core + 4} />
                    <line {...line} strokeWidth={core} style={{ stroke: tone }} />
                  </g>
                )
              })}
            </svg>

            {root && (
              <div
                aria-hidden="true"
                className="absolute flex items-center justify-center rounded-full"
                style={{
                  width: size * 1.2,
                  height: size * 1.2,
                  left: px(root).x - size * 0.6,
                  top: px(root).y - size * 0.6,
                  background: 'radial-gradient(circle at 50% 35%, #3b2c10, #140f06)',
                  border: `2.5px solid ${ACCENT}`,
                  boxShadow: `0 0 0 1.5px ${OUTLINE}, 0 0 18px ${alpha(ACCENT, 55)}, 0 4px 10px rgb(0 0 0 / 0.6)`,
                }}
              >
                {crest
                  ? <AtlasSprite asset={crest} decorative className="h-[78%] w-[78%]" />
                  : <span className="text-accent" style={{ fontSize: size * 0.5 }}>★</span>}
              </div>
            )}

            {template.nodes.map((node) => {
              if (node.kind === 'root') return null
              const open = unlocked(node)
              const assignment = open ? assignments[node.id] : undefined
              const opensAt = nodeUnlockLevel(template, node)
              const selected = node.id === selectedId
              const center = px(node)
              return (
                <button
                  key={node.id}
                  type="button"
                  aria-label={nodeLabel(node, open, opensAt, assignment)}
                  aria-pressed={selected}
                  disabled={!open}
                  onClick={() => {
                    // A pan that ends over a node must not also open it.
                    if (dragged.current) return
                    onSelect(node)
                  }}
                  className="absolute flex items-center justify-center"
                  style={{ width: size, height: size, left: center.x - size / 2, top: center.y - size / 2 }}
                >
                  <NodeTile
                    node={node}
                    size={size}
                    open={open}
                    upNext={!open && opensAt === nextLevel}
                    opensAt={opensAt}
                    assignment={assignment}
                    tone={toneOf(assignment)}
                    selected={selected}
                    content={content}
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* At fit there is nothing to undo, and a corner node would sit under the button. */}
      {!fitted && (
        <button
          type="button"
          onClick={fit}
          className="absolute right-2 top-2 min-h-[32px] rounded-full bg-white/10 px-3 text-[11px] font-semibold text-ink-on-dark backdrop-blur"
        >
          Fit
        </button>
      )}
    </div>
  )
}

/**
 * One node's face. Card nodes are framed tiles, stat nodes are gems (a tile turned 45°), lineage nodes are portrait
 * rounds. They share one state language: a dark socket when locked (naming its Training Level when it opens next),
 * a gold frame with a plus when open, and the card, stat or Uma in her own colour when filled.
 */
function NodeTile({
  node,
  size,
  open,
  upNext,
  opensAt,
  assignment,
  tone,
  selected,
  content,
}: {
  node: ConstellationNode
  size: number
  open: boolean
  upNext: boolean
  opensAt: number
  assignment: NodeAssignment | undefined
  tone: string | null
  selected: boolean
  content: LoadedContent
}) {
  const lineage = node.kind === 'parent' || node.kind === 'grandparent'
  const gem = node.kind === 'stat'
  const side = gem ? size * 0.76 : size
  const glow = tone ?? (lineage ? LINEAGE : ACCENT)
  const frame = open ? glow : upNext ? alpha(ACCENT, 70) : '#1c2733'
  const ring = selected ? `0 0 0 2px ${SOCKET}, 0 0 0 4px #fff, ` : ''
  const lift = open
    ? `0 0 0 1px ${OUTLINE}, 0 0 ${tone ? 10 : 12}px ${alpha(glow, tone ? 50 : 40)}, 0 4px 8px rgb(0 0 0 / 0.6)`
    : 'inset 0 2px 5px rgb(0 0 0 / 0.7)'

  const style: CSSProperties = {
    width: side,
    height: side,
    borderRadius: lineage ? '9999px' : gem ? '22%' : '26%',
    border: `${open ? 2 : 1.5}px ${upNext ? 'dashed' : 'solid'} ${frame}`,
    background: assignment?.kind === 'stat'
      ? `linear-gradient(135deg, color-mix(in srgb, ${glow} 70%, white), ${glow} 55%, color-mix(in srgb, ${glow} 70%, black))`
      : open ? 'linear-gradient(180deg, #16222e, #0c141c)' : SOCKET,
    boxShadow: `${ring}${lift}`,
    transform: `${gem ? 'rotate(45deg)' : ''}${selected ? ' scale(1.08)' : ''}` || undefined,
    transition: 'transform 160ms ease-out, box-shadow 160ms ease-out',
  }

  let face: ReactNode
  if (assignment?.kind === 'card') {
    face = <AtlasSprite asset={getContentAsset(content, 'card-icons', assignment.cardId)} decorative className="h-full w-full" />
  } else if (assignment?.kind === 'lineage') {
    face = <UmaBust content={content} umaId={assignment.templateId} className="h-full w-full" />
  } else if (assignment?.kind === 'stat') {
    face = (
      <span className="font-display font-bold text-white" style={{ fontSize: Math.max(8, size * 0.26), textShadow: '0 1px 2px rgb(0 0 0 / 0.5)' }}>
        {STAT_LABEL[assignment.stat]}
      </span>
    )
  } else if (open) {
    face = <span className="font-display font-bold leading-none" style={{ fontSize: size * 0.5, color: glow }}>+</span>
  } else if (upNext || lineage) {
    face = (
      <span className="font-display font-bold" style={{ fontSize: Math.max(8, size * 0.24), color: upNext ? ACCENT : '#3a4a5c' }}>
        TL{opensAt}
      </span>
    )
  } else {
    face = <LockGlyph size={size * 0.34} />
  }

  return (
    <span className="pointer-events-none relative flex items-center justify-center overflow-hidden" style={style}>
      <span className="flex h-full w-full items-center justify-center" style={gem ? { transform: 'rotate(-45deg)' } : undefined}>
        {face}
      </span>
    </span>
  )
}

function LockGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#33414f" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function nodeLabel(node: ConstellationNode, open: boolean, opensAt: number, assignment: NodeAssignment | undefined): string {
  if (!open) return `Locked ${node.kind} node — opens at Training Level ${opensAt}`
  if (!assignment) return `Empty ${node.kind} node`
  return assignment.kind === 'stat' ? `${node.kind} node — ${assignment.stat}` : `${node.kind} node — filled`
}
