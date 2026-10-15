// An Uma's constellation drawn on `rework/constellation`'s `Tree` (docs/game/05-training-hub.md §4, §8;
// docs/game/11-hub-and-places.md §6; T139). The tree's 0–100 canvas stretches to the validator's 351 × 525 pt graph
// box (`PHONE_GRAPH_BOX_PT`), scaled to the host's width, so nodes keep the validator's 40 pt spacing; pinch zooms
// and a drag pans (transform only). Edges are SVG; each node is a DOM button, coloured by its card's type once open.
// Nodes are 36 pt, under the 44 pt rule: the List view carries every node's action at 44 pt (T139). The old
// app's constellation graph read its retired levels and templates, so it wasn't reused (T143 deleted it).
import { PHONE_GRAPH_BOX_PT } from '@racer/domain/training'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export type TreeNodeLook = 'open' | 'empty' | 'next' | 'locked' | 'session' | 'finished'

export interface TreeGraphNode {
  readonly id: string
  readonly x: number
  readonly y: number
  /** VoiceOver's line: "Node 7, Kitasan Black". */
  readonly label: string
  readonly look: TreeNodeLook
  /** An open node's card colour. */
  readonly tone: string | null
  readonly mark?: ReactNode
}

const NODE = 36
const MIN_SCALE = 1
const MAX_SCALE = 2.5

export function TreeGraph({ root, nodes, edges, selectedId, onSelect, rootMark }: {
  root: { readonly x: number; readonly y: number }
  nodes: readonly TreeGraphNode[]
  edges: readonly { readonly from: string; readonly to: string }[]
  selectedId: string | null
  onSelect: (id: string) => void
  rootMark?: ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>(PHONE_GRAPH_BOX_PT.width)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; scale: number; x: number; y: number } | null>(null)
  const dragged = useRef(false)

  useEffect(() => {
    const element = host.current
    if (element === null) return
    const measure = () => setWidth(element.clientWidth || PHONE_GRAPH_BOX_PT.width)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const k = width / PHONE_GRAPH_BOX_PT.width
  const at = (point: { x: number; y: number }) => ({ x: (point.x / 100) * PHONE_GRAPH_BOX_PT.width * k, y: (point.y / 100) * PHONE_GRAPH_BOX_PT.height * k })
  const maxY = Math.max(root.y, ...nodes.map((node) => node.y))
  const height = Math.ceil(((maxY + 4) / 100) * PHONE_GRAPH_BOX_PT.height * k)
  const byId = new Map([['n0', root], ...nodes.map((node) => [node.id, node] as const)])

  const down = (event: React.PointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    dragged.current = false
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), scale: view.scale, x: view.x, y: view.y }
    }
  }
  const move = (event: React.PointerEvent) => {
    const before = pointers.current.get(event.pointerId)
    if (before === undefined) return
    const next = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, next)
    if (pointers.current.size === 2 && pinch.current !== null) {
      const [a, b] = [...pointers.current.values()]
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.scale * (Math.hypot(a!.x - b!.x, a!.y - b!.y) / (pinch.current.distance || 1))))
      const box = host.current?.getBoundingClientRect()
      const midX = (a!.x + b!.x) / 2 - (box?.left ?? 0)
      const midY = (a!.y + b!.y) / 2 - (box?.top ?? 0)
      const ratio = scale / pinch.current.scale
      setView({ scale, x: midX - (midX - pinch.current.x) * ratio, y: midY - (midY - pinch.current.y) * ratio })
      dragged.current = true
      return
    }
    if (pointers.current.size === 1 && view.scale > 1) {
      const dx = next.x - before.x
      const dy = next.y - before.y
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragged.current = true
      setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }))
    }
  }
  const up = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0 && view.scale <= 1) setView({ scale: 1, x: 0, y: 0 })
  }

  const fill = (node: TreeGraphNode): string => {
    switch (node.look) {
      case 'open': return node.tone ?? 'var(--color-accent)'
      case 'empty': return 'var(--color-panel)'
      case 'next': return 'var(--color-accent-wash)'
      case 'finished': return 'var(--color-accent)'
      default: return 'var(--color-sunken)'
    }
  }

  return (
    <div
      ref={host}
      className={`relative w-full overflow-hidden rounded-md border border-hairline bg-panel ${view.scale > 1 ? 'touch-none' : 'touch-pan-y'}`}
      style={{ height }}
      data-g2="tree-graph"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ width, height, transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}>
        <svg aria-hidden className="absolute inset-0" width={width} height={height}>
          {edges.map((edge) => {
            const from = byId.get(edge.from)
            const to = byId.get(edge.to)
            if (from === undefined || to === undefined) return null
            const a = at(from)
            const b = at(to)
            const lit = 'look' in to && (to.look === 'open' || to.look === 'empty')
            return <line key={`${edge.from}-${edge.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={lit ? 4 : 3} strokeLinecap="round" stroke={lit ? 'var(--color-ink-soft)' : 'var(--color-hairline-strong)'} />
          })}
        </svg>
        <span
          aria-hidden
          className="absolute flex items-center justify-center rounded-full border-2 border-accent bg-stage text-[14px] text-accent"
          style={{ width: NODE, height: NODE, left: at(root).x - NODE / 2, top: at(root).y - NODE / 2 }}
        >
          {rootMark ?? '★'}
        </span>
        {nodes.map((node) => {
          const point = at(node)
          const selected = node.id === selectedId
          return (
            <button
              key={node.id}
              type="button"
              aria-label={node.label}
              aria-pressed={selected}
              data-node={node.id}
              data-look={node.look}
              onClick={() => {
                if (!dragged.current) onSelect(node.id)
              }}
              className={`absolute flex items-center justify-center rounded-full border-2 text-[11px] font-bold shadow-1 ${selected ? 'border-ink' : node.look === 'next' ? 'border-accent border-dashed' : 'border-hairline-strong'}`}
              style={{ width: NODE, height: NODE, left: point.x - NODE / 2, top: point.y - NODE / 2, background: fill(node), color: node.look === 'open' ? 'white' : 'var(--color-ink)' }}
            >
              {node.mark}
            </button>
          )
        })}
      </div>
    </div>
  )
}
