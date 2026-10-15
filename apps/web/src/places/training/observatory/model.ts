// Her constellation at the Observatory (docs/rework/05-training-hub.md §3, §4, §8; docs/rework/03-uma-progression.md §6;
// docs/rework/11-hub-and-places.md §6; T139): `treeFor(T)` and `treeEdges`, each node's state for her now, the viewed
// preset's card on each open node and what it pays there (`nodeSkillIds`), and the choices of another card of the set
// under the per-card cap, each run through `set-assignments` on the current state so a refused one says why. The List
// carries the same nodes and the next layer's, which the tree can't draw (its size is her scenario's). Pure.
import type { DistanceCategory, SupportCardType } from '@racer/domain'
import { say } from '@racer/domain/rework/check-in'
import { cardNodeId, nodeOrder, perCardCap, treeCardNodesAt, treeEdges, treeFor, type Tree, type TreeEdge } from '@racer/domain/rework/constellation'
import { isRefusal, scenarioNumber, type UmaState } from '@racer/domain/rework/tiers'
import { fixedUnlock, layerUnlocks, setAssignments, type DerivedBuild, type Unlock } from '@racer/domain/rework/training'
import type { WorkState } from '@racer/domain/rework/work'
import type { WordsContext } from '../../../ui/work/words'
import { itemState, itemWords, ruleWords, type Content, type ItemState } from '../common'
import { trainingWords } from '../words'

export interface NodeView {
  readonly id: string
  readonly order: number
  /** Where it sits on the 0–100 canvas; null for a next-layer node, which only the List shows. */
  readonly x: number | null
  readonly y: number | null
  readonly state: ItemState['kind']
  /** The viewed preset's card on an open node. */
  readonly cardId: string | null
  readonly cardType: SupportCardType | null
  /** "Node 7". */
  readonly title: string
  /** What a locked node needs, in 05 §8's words; null once open. */
  readonly words: string | null
  /** The node's unlock, for **Unlock** while it's available. */
  readonly unlock: Unlock | null
  /** The skills it pays in the viewed preset (D182). */
  readonly skills: readonly string[]
}

export interface ObservatoryView {
  readonly T: number
  readonly tree: Tree
  readonly edges: readonly TreeEdge[]
  readonly root: { readonly x: number; readonly y: number }
  /** n1 … nN of her scenario's tree, then the next layer's for the List. */
  readonly nodes: readonly NodeView[]
  readonly cap: number
}

/** Her tree for the viewed preset, or null for the 15th scenario until it's drawn (05 §4). */
export function observatoryView(settled: WorkState, uma: UmaState, preset: DistanceCategory, derived: DerivedBuild, now: number, context: WordsContext, content: Content): ObservatoryView | null {
  const T = scenarioNumber(uma)
  const tree = treeFor(T)
  if (tree === null) return null
  const assignments = uma.build.presets[preset].assignments
  const row = settled.work[uma.outfitId]
  const node = (entry: Unlock, at: { x: number; y: number } | null): NodeView => {
    const order = nodeOrder(entry.target) ?? 0
    const state = itemState(uma, row, entry, now, settled.items)
    const cardId = state.kind === 'open' ? assignments[entry.target] ?? null : null
    return {
      id: entry.target,
      order,
      x: at?.x ?? null,
      y: at?.y ?? null,
      state: state.kind,
      cardId,
      cardType: cardId === null ? null : content.cards.get(cardId)?.type ?? null,
      title: trainingWords('node-title', { n: order }),
      words: itemWords(state, entry, context, content),
      unlock: state.kind === 'available' ? entry : null,
      skills: state.kind === 'open' ? derived.nodeSkillIds[entry.target] ?? [] : [],
    }
  }
  const drawn = tree.nodes.filter((entry) => entry.kind === 'card').map((entry) => node(fixedUnlock({ kind: 'node', target: entry.id })!, entry))
  const later = uma.scenario < 5
    ? layerUnlocks((uma.scenario + 1) as Unlock['layer']).filter((entry) => entry.kind === 'node').map((entry) => node(entry, null))
    : []
  const root = tree.nodes.find((entry) => entry.kind === 'root')!
  return { T, tree, edges: treeEdges(tree), root: { x: root.x, y: root.y }, nodes: [...drawn, ...later], cap: perCardCap(treeCardNodesAt(T)) }
}

export interface NodeChoice {
  readonly cardId: string | null
  /** Nodes it holds among her open ones in this preset. */
  readonly held: number
  /** The rule's words when `set-assignments` refuses it (`node-cap`, `node-locked`), else null. */
  readonly refusal: string | null
  readonly chosen: boolean
  /** The whole map this choice writes. */
  readonly assignments: Readonly<Record<string, string>>
}

/** Every card of the viewed preset's set for an open node, then "Leave it empty", each tried on the current state. */
export function nodeChoices(settled: WorkState, uma: UmaState, preset: DistanceCategory, nodeId: string, now: number, context: WordsContext, content: Content): readonly NodeChoice[] {
  const current = uma.build.presets[preset]
  const open = new Set(Array.from({ length: uma.build.constellationOpened }, (_, i) => cardNodeId(i + 1)))
  const heldBy = (cardId: string) => Object.entries(current.assignments).filter(([id, card]) => card === cardId && open.has(id)).length
  const choice = (cardId: string | null): NodeChoice => {
    const assignments: Record<string, string> = { ...current.assignments }
    if (cardId === null) delete assignments[nodeId]
    else assignments[nodeId] = cardId
    const tried = setAssignments(settled, { umaId: uma.outfitId, preset, assignments }, now)
    return {
      cardId,
      held: cardId === null ? 0 : heldBy(cardId),
      refusal: isRefusal(tried) ? ruleWords(say(tried.reason, tried.data), context, content) : null,
      chosen: (current.assignments[nodeId] ?? null) === cardId,
      assignments,
    }
  }
  return [...current.cardSetIds.map(choice), choice(null)]
}
