import {
  constellationEdges,
  isNodeUnlocked,
  lineageUnlockLevel,
  type ConstellationNode,
  type ConstellationTemplate,
  type NodeAssignment,
} from '@racer/domain'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getContentAsset, type ContentAsset, type LoadedContent } from '../../content/runtime'
import { AtlasSprite } from '../AtlasSprite'

/**
 * The canvas fills the host at scale 1, so the 100×100 unit layout stretches to the screen's aspect. On a
 * portrait phone that spreads the tree down the long axis instead of wasting it, which is what makes a
 * 38-node tier-14 tree readable without zooming.
 */
const NODE = 36
const MIN_SCALE = 0.5
const MAX_SCALE = 2.5

export interface GraphNodeView {
  node: ConstellationNode
  unlocked: boolean
  assignment: NodeAssignment | undefined
  /** Icon to show inside a filled node. */
  asset: ContentAsset | null
  label: string
  /** Type colour for a card node's rim, or null. */
  tone: string | null
}

const STAT_TONE: Record<string, string> = {
  speed: 'var(--color-stat-speed)',
  stamina: 'var(--color-stat-stamina)',
  power: 'var(--color-stat-power)',
  guts: 'var(--color-stat-guts)',
  wit: 'var(--color-stat-wit)',
}

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
  /** Card id → its type, for the rim colour. */
  cardTypes: Readonly<Record<string, string>>
  selectedId: string | null
  onSelect: (node: ConstellationNode) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ distance: number; scale: number; x: number; y: number } | null>(null)
  const dragged = useRef(false)

  /** The canvas already fills the host, so fitting is simply the identity view. */
  const fit = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), [])

  // Refit on mount, on a tier change, and whenever the host resizes — a rotation or a pane resize would
  // otherwise leave the tree at a scale computed for the old box.
  useEffect(() => {
    fit()
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => fit())
    observer.observe(host)
    return () => observer.disconnect()
  }, [fit, template.tier])

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
  const nodes = useMemo(
    () => template.nodes.filter((node) => node.kind !== 'root'),
    [template],
  )

  const sameCardEdge = (from: ConstellationNode, to: ConstellationNode): boolean => {
    const a = assignments[from.id]
    const b = assignments[to.id]
    return a?.kind === 'card' && b?.kind === 'card' && a.cardId === b.cardId
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.25rem] bg-stage">
      <div
        ref={hostRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute origin-top-left will-change-transform"
          style={{
            width: '100%',
            height: '100%',
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {edges.map(({ from, to }) => (
              <line
                key={`${from.id}-${to.id}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={sameCardEdge(from, to) ? 'var(--color-accent)' : 'rgba(255,255,255,0.16)'}
                strokeWidth={sameCardEdge(from, to) ? 0.5 : 0.25}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {nodes.map((node) => {
            const unlocked = isNodeUnlocked(template, node, trainingLevel)
            const assignment = assignments[node.id]
            const filled = assignment !== undefined
            const selected = node.id === selectedId
            const asset = !assignment
              ? null
              : assignment.kind === 'card'
                ? getContentAsset(content, 'card-icons', assignment.cardId)
                : assignment.kind === 'lineage'
                  ? getContentAsset(content, 'uma-icons', assignment.templateId)
                  : null
            const tone = assignment?.kind === 'card'
              ? STAT_TONE[cardTypes[assignment.cardId] ?? ''] ?? 'var(--color-accent)'
              : assignment?.kind === 'stat'
                ? STAT_TONE[assignment.stat] ?? null
                : null

            return (
              <button
                key={node.id}
                type="button"
                aria-label={nodeLabel(node, unlocked, trainingLevel, template)}
                aria-pressed={selected}
                disabled={!unlocked}
                onClick={() => {
                  // A pan that ends over a node must not also open it.
                  if (dragged.current) return
                  onSelect(node)
                }}
                className="absolute flex items-center justify-center rounded-full border transition-colors"
                style={{
                  width: NODE,
                  height: NODE,
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  marginLeft: -NODE / 2,
                  marginTop: -NODE / 2,
                  borderColor: !unlocked
                    ? 'transparent'
                    : selected
                      ? 'var(--color-accent)'
                      : tone ?? 'rgba(255,255,255,0.35)',
                  borderWidth: selected ? 3 : filled ? 2 : 1,
                  background: !unlocked
                    ? 'rgba(255,255,255,0.05)'
                    : filled
                      ? 'var(--color-stage-soft)'
                      : 'transparent',
                  borderStyle: unlocked && !filled ? 'dashed' : 'solid',
                }}
              >
                {asset
                  ? <AtlasSprite asset={asset} decorative className="h-[26px] w-[26px] rounded-full" />
                  : (
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-ink-on-dark-soft">
                      {!unlocked ? '' : assignment?.kind === 'stat' ? assignment.stat.slice(0, 3) : ''}
                    </span>
                  )}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={fit}
        className="absolute right-2 top-2 min-h-[32px] rounded-full bg-white/10 px-3 text-[11px] font-semibold text-ink-on-dark backdrop-blur"
      >
        Fit
      </button>
    </div>
  )
}

function nodeLabel(
  node: ConstellationNode,
  unlocked: boolean,
  trainingLevel: number,
  template: ConstellationTemplate,
): string {
  if (unlocked) return `${node.kind} node`
  const required = node.kind === 'card' || node.kind === 'stat'
    ? null
    : lineageUnlockLevel(template, node.id)
  return required !== null
    ? `Locked ${node.kind} node — opens at Training Level ${required}`
    : `Locked ${node.kind} node — currently Training Level ${trainingLevel}`
}
